// =====================================================================
// HESAP SİL (Supabase Edge Function)
// Uzman, panelinden kendi hesabını kalıcı olarak siler (KVKK: silme hakkı).
//
// Sırasıyla:
//  1. İstek yalnızca sitenin kendi adresinden ve giriş yapmış kullanıcının kendi oturumuyla kabul edilir.
//  2. Onay için hesabın e-posta adresi yazılmış olmalıdır.
//  3. Yönetici hesapları bu yolla silinemez.
//  4. Uzmanın fotoğrafları ve doğrulama belgeleri dosya depolarından silinir.
//  5. Profil ve ona bağlı her şey (eğitim, SSS, iletişim, belgeler, mesajlar, yazılar) silinir
//     (veritabanındaki profilimi_sil fonksiyonu, kullanıcının KENDİ oturumuyla çalışır).
//  6. Giriş hesabı silinir.
// SUPABASE_URL, SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından otomatik sağlanır.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const IZINLI_ADRESLER = [
  "https://klinikpsikologlar.com.tr",
  "https://www.klinikpsikologlar.com.tr",
  "https://becenemaruf.github.io",
];
const DEPOLAR = ["uzman-fotograflari", "dogrulama-belgeleri"];

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
  return new Response(JSON.stringify(govde), { status: durum, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return yanit({ hata: "Geçersiz istek." }, 405, origin);
  if (!origin || !IZINLI_ADRESLER.includes(origin)) return yanit({ hata: "Geçersiz kaynak." }, 403, origin);
  const yetki = req.headers.get("authorization") || "";
  if (!yetki.startsWith("Bearer ")) return yanit({ hata: "Giriş gerekli." }, 401, origin);

  let girdi: { eposta?: string };
  try {
    girdi = await req.json();
  } catch {
    return yanit({ hata: "Geçersiz istek." }, 400, origin);
  }

  const kullaniciDb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: yetki } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: kim } = await kullaniciDb.auth.getUser(yetki.slice(7));
  const kullanici = kim?.user;
  if (!kullanici) return yanit({ hata: "Giriş gerekli." }, 401, origin);
  if (String(girdi.eposta || "").trim().toLowerCase() !== String(kullanici.email || "").toLowerCase())
    return yanit({ hata: "Onay için hesabınızın e-posta adresini doğru yazın." }, 400, origin);

  const { data: yonetici } = await kullaniciDb.from("yoneticiler").select("kullanici_id").eq("kullanici_id", kullanici.id).maybeSingle();
  if (yonetici) return yanit({ hata: "Yönetici hesabı bu yolla silinemez." }, 403, origin);

  const servis = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Dosyalar (yalnızca kullanıcının kendi klasörü)
  for (const depo of DEPOLAR) {
    const { data: dosyalar, error } = await servis.storage.from(depo).list(kullanici.id, { limit: 1000 });
    if (error) {
      console.error(depo, "listelenemedi:", error.message);
      return yanit({ hata: "Dosyalarınız silinemedi; hesabınız silinmedi. Lütfen tekrar deneyin." }, 500, origin);
    }
    const yollar = (dosyalar || []).filter((d) => d.name).map((d) => `${kullanici.id}/${d.name}`);
    if (yollar.length) {
      const { error: sErr } = await servis.storage.from(depo).remove(yollar);
      if (sErr) {
        console.error(depo, "silinemedi:", sErr.message);
        return yanit({ hata: "Dosyalarınız silinemedi; hesabınız silinmedi. Lütfen tekrar deneyin." }, 500, origin);
      }
    }
  }

  // 2) Profil ve bağlı kayıtlar (kullanıcının kendi oturumuyla)
  const { error: pErr } = await kullaniciDb.rpc("profilimi_sil");
  if (pErr) {
    console.error("Profil silinemedi:", pErr.message);
    return yanit({ hata: "Profiliniz silinemedi. Lütfen tekrar deneyin." }, 500, origin);
  }

  // 3) Giriş hesabı
  const { error: hErr } = await servis.auth.admin.deleteUser(kullanici.id);
  if (hErr) {
    console.error("Hesap silinemedi:", hErr.message);
    return yanit({ hata: "Profiliniz silindi ancak giriş hesabınız silinemedi. Lütfen yönetimle iletişime geçin." }, 500, origin);
  }
  return yanit({ silindi: true }, 200, origin);
});
