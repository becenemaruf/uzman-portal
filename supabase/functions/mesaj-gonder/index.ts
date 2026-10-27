// =====================================================================
// MESAJ GÖNDER (Supabase Edge Function)
// "Uzmana Mesaj Gönder" formundan gelen mesajı güvenli şekilde kaydeder.
//
// Sırasıyla:
//  1. İstek yalnızca sitenin kendi adresinden kabul edilir.
//  2. Tuzak alan doluysa (bot) sessizce "tamam" denir, hiçbir şey kaydedilmez.
//  3. Bilgiler kontrol edilir (uzunluk, e-posta/telefon biçimi).
//  4. CAPTCHA (Cloudflare Turnstile) Cloudflare'e sorularak doğrulanır.
//  5. Uzman yayında mı ve gerçekten tüm iletişim kanallarını kapatmış mı, bakılır.
//  6. Gönderim sınırı: Aynı kaynaktan saatte en fazla 3, aynı uzmana günde en fazla 2 mesaj.
//  7. Mesaj kaydedilir; 90 günden eski mesajlar silinir.
//  8. (İsteğe bağlı) Uzmana "yeni mesajınız var" e-postası gider. Bu e-postada mesajın
//     İÇERİĞİ YOKTUR; uzman mesajı yalnızca panelinde, giriş yaparak okur.
//
// Gizli değerler koda yazılmaz; Supabase panelinden "Edge Function Secrets" olarak girilir:
//  - TURNSTILE_GIZLI_ANAHTAR (zorunlu): Cloudflare Turnstile Secret Key
//  - IP_TUZU (zorunlu): Rastgele uzun bir metin. IP adresinin geri döndürülemez özetini üretmek için.
//  - RESEND_API_KEY ve BILDIRIM_GONDEREN (isteğe bağlı): Uzmana bildirim e-postası için.
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından otomatik sağlanır.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const IZINLI_ADRESLER = ["https://becenemaruf.github.io"];

function cors(origin: string | null) {
  const izinli = origin && IZINLI_ADRESLER.includes(origin) ? origin : IZINLI_ADRESLER[0];
  return {
    "Access-Control-Allow-Origin": izinli,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function yanit(govde: unknown, durum: number, origin: string | null) {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

async function ozet(metin: string) {
  const veri = new TextEncoder().encode(metin);
  const h = await crypto.subtle.digest("SHA-256", veri);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const EPOSTA = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const TELEFON = /^0[0-9]{10}$/;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return yanit({ hata: "Geçersiz istek." }, 405, origin);
  if (!origin || !IZINLI_ADRESLER.includes(origin)) return yanit({ hata: "Geçersiz kaynak." }, 403, origin);
  // Gizli anahtarlar girilmemişse sistem çalışmaz (yanlışlıkla korumasız açılmasın diye)
  if (!Deno.env.get("TURNSTILE_GIZLI_ANAHTAR") || !Deno.env.get("IP_TUZU")) {
    return yanit({ hata: "Mesaj sistemi şu an kullanılamıyor." }, 503, origin);
  }

  let g: Record<string, unknown>;
  try {
    g = await req.json();
  } catch {
    return yanit({ hata: "Geçersiz istek." }, 400, origin);
  }

  // 2) Tuzak alan
  if (typeof g.web === "string" && g.web.trim() !== "") return yanit({ tamam: true }, 200, origin);

  // 3) Bilgi kontrolü
  const uzman = String(g.uzman ?? "");
  const ad = String(g.ad ?? "").trim();
  const eposta = g.eposta ? String(g.eposta).trim() : null;
  const telefon = g.telefon ? String(g.telefon).trim() : null;
  const mesaj = String(g.mesaj ?? "").trim();
  const captcha = String(g.captcha ?? "");
  if (!uzman || ad.length < 2 || ad.length > 60) return yanit({ hata: "Lütfen adınızı yazın." }, 400, origin);
  if (!eposta && !telefon) return yanit({ hata: "Lütfen bir iletişim bilgisi bırakın." }, 400, origin);
  if (eposta && (eposta.length > 120 || !EPOSTA.test(eposta))) return yanit({ hata: "E-posta adresi geçersiz." }, 400, origin);
  if (telefon && !TELEFON.test(telefon)) return yanit({ hata: "Telefon numarası geçersiz." }, 400, origin);
  if (mesaj.length < 20 || mesaj.length > 1000) return yanit({ hata: "Mesaj 20 ile 1000 karakter arasında olmalı." }, 400, origin);
  if (!captcha) return yanit({ hata: "Güvenlik doğrulaması eksik." }, 400, origin);

  // 4) CAPTCHA doğrulaması
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  const dogrulama = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: Deno.env.get("TURNSTILE_GIZLI_ANAHTAR") ?? "", response: captcha, remoteip: ip }),
  }).then((r) => r.json()).catch(() => ({ success: false }));
  if (!dogrulama.success) return yanit({ hata: "Güvenlik doğrulaması başarısız. Lütfen tekrar deneyin." }, 400, origin);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // 5) Uzman uygun mu? (slug ile aranır; yalnızca yayındaki ve TÜM kanalları kapalı uzmanlar)
  const { data: u } = await db
    .from("uzmanlar")
    .select("id, kullanici_id, telefon, whatsapp, eposta")
    .eq("slug", uzman)
    .eq("durum", "yayinda")
    .maybeSingle();
  if (!u) return yanit({ hata: "Uzman bulunamadı." }, 404, origin);
  if (u.telefon || u.whatsapp || u.eposta) {
    return yanit({ hata: "Bu uzmana profilindeki iletişim butonlarıyla ulaşabilirsiniz." }, 400, origin);
  }

  // 6) Gönderim sınırı
  const ipOzeti = await ozet(ip + "|" + (Deno.env.get("IP_TUZU") ?? ""));
  const birSaatOnce = new Date(Date.now() - 3600_000).toISOString();
  const birGunOnce = new Date(Date.now() - 86400_000).toISOString();
  const { count: saatlik } = await db.from("iletisim_mesajlari").select("id", { count: "exact", head: true })
    .eq("ip_ozeti", ipOzeti).gte("olusturulma", birSaatOnce);
  const { count: ayniUzman } = await db.from("iletisim_mesajlari").select("id", { count: "exact", head: true })
    .eq("ip_ozeti", ipOzeti).eq("uzman_id", u.id).gte("olusturulma", birGunOnce);
  if ((saatlik ?? 0) >= 3 || (ayniUzman ?? 0) >= 2) {
    return yanit({ hata: "Kısa sürede çok fazla mesaj gönderildi. Lütfen daha sonra tekrar deneyin." }, 429, origin);
  }

  // 7) Kaydet ve eski mesajları temizle
  const { error } = await db.from("iletisim_mesajlari").insert({
    uzman_id: u.id, gonderen_ad: ad, gonderen_eposta: eposta, gonderen_telefon: telefon, mesaj, ip_ozeti: ipOzeti,
  });
  if (error) return yanit({ hata: "Mesajınız kaydedilemedi. Lütfen daha sonra tekrar deneyin." }, 500, origin);
  await db.from("iletisim_mesajlari").delete().lt("olusturulma", new Date(Date.now() - 90 * 86400_000).toISOString());

  // 8) İsteğe bağlı bildirim (mesaj içeriği OLMADAN)
  const resend = Deno.env.get("RESEND_API_KEY");
  const gonderen = Deno.env.get("BILDIRIM_GONDEREN");
  if (resend && gonderen && u.kullanici_id) {
    const { data: kullanici } = await db.auth.admin.getUserById(u.kullanici_id);
    const alici = kullanici?.user?.email;
    if (alici) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: gonderen,
          to: alici,
          subject: "Profilinize yeni bir mesaj bırakıldı",
          text: "Bir danışan adayı profiliniz üzerinden size mesaj bıraktı. Mesajı okumak için uzman panelinize giriş yapın.\n\nGizliliğiniz için mesajın içeriği e-postaya eklenmez.",
        }),
      }).catch(() => {});
    }
  }

  return yanit({ tamam: true }, 200, origin);
});
