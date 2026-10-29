// =====================================================================
// DESTEK (Supabase Edge Function) — destek talepleri (ticket)
//
// İşlemler (POST gövdesi "islem"):
//  - "olustur"   (herkes, CAPTCHA'lı) : Giriş yapamayan kişi destek.html'den talep açar. Kişiye takip bağlantısı içeren
//                                       bir e-posta, yönetime "yeni talep" e-postası gider.
//  - "goruntule" (takip bağlantısı)    : kod + anahtar ile talebi ve yönetimin yanıtlarını gösterir (iç notlar hariç).
//  - "yanitla"   (takip bağlantısı)    : kişi talebe yeni mesaj yazar; yönetime e-posta gider.
//  - "bildir"    (giriş yapmış)        : Panelden yazılan bir mesajın karşı tarafa e-postasını gönderir.
//                                       Yönetici yanıtı → talep sahibine; uzman mesajı → yönetime. Her mesaj için yalnızca bir kez.
//
// Güvenlik:
//  - Herkese açık talep: CAPTCHA (Cloudflare Turnstile) + tuzak alan + aynı kaynaktan saatte en fazla 3 talep.
//  - Takip bağlantısı anahtarı 64 karakterlik rastgele değerdir; yalnızca sunucu okuyabilir (destek_erisim).
//  - Form talepleri kimliği DOĞRULANMIŞ değildir: yönetim, hesapla ilgili işlem yapmadan önce kişinin hesabın sahibi
//    olduğunu ayrıca doğrulamalıdır (ör. hesap e-postasına şifre yenileme bağlantısı göndermek).
// Gizli değerler: TURNSTILE_GIZLI_ANAHTAR, IP_TUZU, RESEND_API_KEY, BILDIRIM_GONDEREN (Edge Function Secrets).
// =====================================================================
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

const IZINLI_ADRESLER = ["https://klinikpsikologlar.com.tr", "https://www.klinikpsikologlar.com.tr", "https://becenemaruf.github.io"];
const SITE = "https://klinikpsikologlar.com.tr";
const EPOSTA = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
const KATEGORILER: Record<string, string> = {
  giris: "Giriş / şifre sorunu",
  belge: "Belge ve doğrulama",
  profil: "Profil düzenleme",
  mesaj: "Mesajlar ve iletişim",
  teknik: "Teknik sorun",
  kvkk: "Kişisel veri (KVKK) başvurusu",
  diger: "Diğer",
};

function cors(origin: string | null) {
  const izinli = origin && IZINLI_ADRESLER.includes(origin) ? origin : IZINLI_ADRESLER[0];
  return {
    "Access-Control-Allow-Origin": izinli,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
const yanit = (g: unknown, d: number, o: string | null) => new Response(JSON.stringify(g), { status: d, headers: { ...cors(o), "Content-Type": "application/json" } });
const kacis = (m: string) => m.replace(/[&<>"']/g, (h) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[h]!);

async function ozet(metin: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(metin));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function rastgele(bayt = 32) {
  const a = new Uint8Array(bayt);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function esitMi(a: string, b: string) {
  if (a.length !== b.length) return false;
  let f = 0;
  for (let i = 0; i < a.length; i++) f |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return f === 0;
}

// ---------------------------------------------------------------------
// E-posta
// ---------------------------------------------------------------------
function sablon(baslik: string, paragraflar: string[], alinti: string | null, dugme: [string, string] | null) {
  const p = 'style="margin:0 0 12px;font-size:15px;line-height:1.65;"';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${kacis(baslik)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f2;font-family:Arial,Helvetica,sans-serif;color:#13202b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f2;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e3e4e1;">
<tr><td style="padding:26px 32px 6px;"><img src="${SITE}/assets/img/marka/logo-tam.png" width="220" alt="Klinik Psikologlar" style="display:block;width:220px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td style="padding:14px 32px 6px;">
<h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.3;color:#12354b;">${kacis(baslik)}</h1>
${paragraflar.map((x) => `<p ${p}>${x}</p>`).join("")}
${alinti ? `<div style="margin:14px 0;padding:12px 16px;background:#f6f2ea;border-left:4px solid #b08d5c;border-radius:6px;font-size:14px;line-height:1.6;">${kacis(alinti).replace(/\n/g, "<br>")}</div>` : ""}
${dugme ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="border-radius:10px;background:#1c4a66;"><a href="${dugme[1]}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${kacis(dugme[0])}</a></td></tr></table>` : ""}
</td></tr>
<tr><td style="padding:6px 32px 26px;"><p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#56626c;border-top:1px solid #e3e4e1;padding-top:14px;">
Bu e-posta, klinikpsikologlar.com.tr destek talebinizle ilgili otomatik gönderilmiştir. Lütfen bu e-postayı yanıtlamayın; yanıtınızı bağlantıdaki sayfadan yazın.
Destek yazışmalarında sağlık bilgisi ya da danışan bilgisi paylaşmayın.</p></td></tr>
</table></td></tr></table></body></html>`;
}

async function eposta(alici: string, konu: string, html: string) {
  const anahtar = Deno.env.get("RESEND_API_KEY");
  const gonderen = Deno.env.get("BILDIRIM_GONDEREN");
  if (!anahtar || !gonderen || !alici) return false;
  try {
    const y = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${anahtar}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: gonderen, to: [alici], subject: konu, html }),
    });
    if (!y.ok) console.error("E-posta gönderilemedi:", y.status, await y.text());
    return y.ok;
  } catch (e) {
    console.error("E-posta hatası:", (e as Error).message);
    return false;
  }
}

async function yonetimAdresi(db: SupabaseClient) {
  const { data } = await db.from("site_ayarlari").select("destek_eposta, iletisim_eposta").eq("id", 1).maybeSingle();
  return data?.destek_eposta || data?.iletisim_eposta || null;
}

async function yonetimeBildir(db: SupabaseClient, t: Record<string, string>, metin: string, yeni: boolean) {
  const adres = await yonetimAdresi(db);
  if (!adres) return false;
  return eposta(
    adres,
    `${yeni ? "Yeni destek talebi" : "Destek talebine yeni mesaj"}: ${t.kod} | Klinik Psikologlar`,
    sablon(
      `${yeni ? "Yeni destek talebi" : "Talebe yeni mesaj"} — ${t.kod}`,
      [
        `<strong>${kacis(t.baslik)}</strong> · ${kacis(KATEGORILER[t.kategori] || t.kategori)}`,
        `${kacis(t.ad || "")} &lt;${kacis(t.eposta || "")}&gt; · ${t.kaynak === "form" ? (t.kayitli_hesap ? "giriş yapmadan, kayıtlı bir hesabın e-postasıyla (kimlik doğrulanmadı)" : "giriş yapmadan, kayıtlı olmayan e-postayla") : "uzman panelinden"}`,
      ],
      metin,
      ["Yönetim panelinde aç", `${SITE}/yonetim.html#destek/${t.id}`]
    )
  );
}

async function kisiyeBildir(db: SupabaseClient, t: Record<string, string>, metin: string) {
  let baglanti = `${SITE}/panel.html#destek/${t.id}`;
  if (t.kaynak === "form") {
    const { data: e } = await db.from("destek_erisim").select("anahtar").eq("talep_id", t.id).maybeSingle();
    if (!e) return false;
    baglanti = `${SITE}/destek.html?talep=${encodeURIComponent(t.kod)}&anahtar=${e.anahtar}`;
  }
  return eposta(
    t.eposta,
    `Destek talebiniz yanıtlandı: ${t.kod} | Klinik Psikologlar`,
    sablon("Destek talebiniz yanıtlandı", [`Merhaba ${kacis(t.ad || "")},`, `<strong>${kacis(t.kod)}</strong> numaralı «${kacis(t.baslik)}» talebinize yönetimden yanıt geldi:`], metin, ["Talebimi görüntüle", baglanti])
  );
}

// ---------------------------------------------------------------------
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return yanit({ hata: "Geçersiz istek." }, 405, origin);
  if (!origin || !IZINLI_ADRESLER.includes(origin)) return yanit({ hata: "Geçersiz kaynak." }, 403, origin);
  let g: Record<string, unknown>;
  try {
    g = await req.json();
  } catch {
    return yanit({ hata: "Geçersiz istek." }, 400, origin);
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  const islem = String(g.islem || "");

  // ---------------- Herkese açık: talep oluştur ----------------
  if (islem === "olustur") {
    if (!Deno.env.get("TURNSTILE_GIZLI_ANAHTAR") || !Deno.env.get("IP_TUZU")) return yanit({ hata: "Destek formu şu an kullanılamıyor." }, 503, origin);
    if (typeof g.web === "string" && g.web.trim()) return yanit({ tamam: true }, 200, origin); // tuzak alan (bot)
    const ad = String(g.ad ?? "").trim();
    const ep = String(g.eposta ?? "").trim().toLowerCase();
    const kategori = String(g.kategori ?? "");
    const baslik = String(g.baslik ?? "").trim();
    const metin = String(g.metin ?? "").trim();
    if (ad.length < 2 || ad.length > 120) return yanit({ hata: "Lütfen adınızı ve soyadınızı yazın." }, 400, origin);
    if (ep.length > 160 || !EPOSTA.test(ep)) return yanit({ hata: "Geçerli bir e-posta adresi yazın." }, 400, origin);
    if (!KATEGORILER[kategori]) return yanit({ hata: "Konu seçin." }, 400, origin);
    if (baslik.length < 3 || baslik.length > 120) return yanit({ hata: "Kısa bir başlık yazın (3–120 karakter)." }, 400, origin);
    if (metin.length < 10 || metin.length > 5000) return yanit({ hata: "Sorununuzu biraz daha ayrıntılı anlatın (en az 10 karakter)." }, 400, origin);
    const captcha = String(g.captcha ?? "");
    if (!captcha) return yanit({ hata: "Güvenlik doğrulaması eksik." }, 400, origin);
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
    const d = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: Deno.env.get("TURNSTILE_GIZLI_ANAHTAR") ?? "", response: captcha, remoteip: ip }),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
    if (!d.success) return yanit({ hata: "Güvenlik doğrulaması başarısız. Lütfen tekrar deneyin." }, 400, origin);

    const ipOzeti = await ozet(ip + "|" + (Deno.env.get("IP_TUZU") ?? ""));
    const { count } = await db.from("destek_talepleri").select("id", { count: "exact", head: true }).eq("ip_ozeti", ipOzeti).gte("olusturulma", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= 3) return yanit({ hata: "Kısa sürede çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin." }, 429, origin);

    const { data: kayitli } = await db.rpc("destek_hesap_var_mi", { p_eposta: ep });
    const { data: t, error } = await db
      .from("destek_talepleri")
      .insert({ kaynak: "form", ad, eposta: ep, kayitli_hesap: !!kayitli, kategori, baslik, ip_ozeti: ipOzeti })
      .select("*")
      .single();
    if (error || !t) {
      console.error("Talep kaydedilemedi:", error?.message);
      return yanit({ hata: "Talebiniz kaydedilemedi. Lütfen daha sonra tekrar deneyin." }, 500, origin);
    }
    const anahtar = rastgele(32);
    await db.from("destek_erisim").insert({ talep_id: t.id, anahtar });
    await db.from("destek_mesajlari").insert({ talep_id: t.id, yazan: "kullanici", metin, bildirildi: true });
    const baglanti = `${SITE}/destek.html?talep=${encodeURIComponent(t.kod)}&anahtar=${anahtar}`;
    await eposta(
      ep,
      `Destek talebiniz alındı: ${t.kod} | Klinik Psikologlar`,
      sablon(
        "Destek talebiniz alındı",
        [
          `Merhaba ${kacis(ad)},`,
          `<strong>${kacis(t.kod)}</strong> numaralı «${kacis(baslik)}» talebinizi aldık. Yanıtımızı bu e-posta adresine bildireceğiz.`,
          "Talebinizi görmek ya da ek bilgi yazmak için aşağıdaki bağlantıyı kullanın. Bu bağlantı yalnızca size özeldir; başkalarıyla paylaşmayın.",
        ],
        null,
        ["Talebimi görüntüle", baglanti]
      )
    );
    await yonetimeBildir(db, t, metin, true);
    return yanit({ tamam: true, kod: t.kod }, 200, origin);
  }

  // ---------------- Takip bağlantısı: görüntüle / yanıtla ----------------
  if (islem === "goruntule" || islem === "yanitla") {
    const kod = String(g.kod ?? "").trim().toUpperCase();
    const anahtar = String(g.anahtar ?? "");
    if (!/^D-[0-9A-F]{6}$/.test(kod) || !/^[0-9a-f]{64}$/.test(anahtar)) return yanit({ hata: "Bağlantı geçersiz." }, 400, origin);
    const { data: t } = await db.from("destek_talepleri").select("*").eq("kod", kod).eq("kaynak", "form").maybeSingle();
    const { data: e } = t ? await db.from("destek_erisim").select("anahtar").eq("talep_id", t.id).maybeSingle() : { data: null };
    if (!t || !e || !esitMi(e.anahtar, anahtar)) return yanit({ hata: "Talep bulunamadı ya da bağlantı geçersiz." }, 404, origin);

    if (islem === "yanitla") {
      const metin = String(g.metin ?? "").trim();
      if (metin.length < 2 || metin.length > 5000) return yanit({ hata: "Mesajınızı yazın." }, 400, origin);
      const { count } = await db.from("destek_mesajlari").select("id", { count: "exact", head: true }).eq("talep_id", t.id).eq("yazan", "kullanici").gte("olusturulma", new Date(Date.now() - 3600_000).toISOString());
      if ((count ?? 0) >= 10) return yanit({ hata: "Kısa sürede çok fazla mesaj gönderildi. Lütfen daha sonra tekrar deneyin." }, 429, origin);
      const { error } = await db.from("destek_mesajlari").insert({ talep_id: t.id, yazan: "kullanici", metin, bildirildi: true });
      if (error) return yanit({ hata: "Mesajınız kaydedilemedi." }, 500, origin);
      await yonetimeBildir(db, t, metin, false);
    }
    const { data: t2 } = await db.from("destek_talepleri").select("kod, baslik, kategori, durum, olusturulma").eq("id", t.id).single();
    const { data: mesajlar } = await db.from("destek_mesajlari").select("yazan, metin, olusturulma").eq("talep_id", t.id).eq("ic_not", false).order("olusturulma");
    return yanit({ talep: { ...t2, kategori_adi: KATEGORILER[t2!.kategori] }, mesajlar: mesajlar || [] }, 200, origin);
  }

  // ---------------- Giriş yapmış: panelden yazılan mesajın e-postası ----------------
  if (islem === "bildir") {
    const yetki = req.headers.get("authorization") || "";
    if (!yetki.startsWith("Bearer ")) return yanit({ hata: "Giriş gerekli." }, 401, origin);
    const kdb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: yetki } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: kim } = await kdb.auth.getUser(yetki.slice(7));
    if (!kim?.user) return yanit({ hata: "Giriş gerekli." }, 401, origin);
    const mesajId = Number(g.mesaj_id);
    if (!Number.isInteger(mesajId)) return yanit({ hata: "Geçersiz istek." }, 400, origin);
    // Mesajı KULLANICININ KENDİ oturumuyla oku (yalnızca yetkili olduğu mesajı görebilir) ve kendi yazdığını doğrula
    const { data: m } = await kdb.from("destek_mesajlari").select("id, talep_id, yazan, yazan_id, metin, ic_not, bildirildi").eq("id", mesajId).maybeSingle();
    if (!m || m.yazan_id !== kim.user.id) return yanit({ hata: "Mesaj bulunamadı." }, 404, origin);
    if (m.ic_not || m.bildirildi) return yanit({ gonderildi: false }, 200, origin);
    // Tek seferlik: bildirildi=false → true geçişi
    const { data: isaret } = await db.from("destek_mesajlari").update({ bildirildi: true }).eq("id", m.id).eq("bildirildi", false).select("id").maybeSingle();
    if (!isaret) return yanit({ gonderildi: false }, 200, origin);
    const { data: t } = await db.from("destek_talepleri").select("*").eq("id", m.talep_id).single();
    const { count: mesajSayisi } = await db.from("destek_mesajlari").select("id", { count: "exact", head: true }).eq("talep_id", t.id).eq("ic_not", false);
    const ok = m.yazan === "yonetim" ? await kisiyeBildir(db, t, m.metin) : await yonetimeBildir(db, t, m.metin, (mesajSayisi ?? 0) <= 1);
    return yanit({ gonderildi: ok }, 200, origin);
  }

  return yanit({ hata: "Bilinmeyen işlem." }, 400, origin);
});
