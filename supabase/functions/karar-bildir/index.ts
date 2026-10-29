// =====================================================================
// KARAR BİLDİR (Supabase Edge Function)
// Yönetici onay ekranında bir başvuru hakkında karar verdiğinde (yayına al, ek belge iste,
// reddet, askıya al) uzmana bilgilendirme e-postası gönderir.
//
// Güvenlik:
//  1. İstek yalnızca sitenin kendi adresinden ve giriş yapmış bir YÖNETİCİDEN kabul edilir
//     (yöneticinin kendi oturum anahtarıyla, veritabanının güvenlik kuralları üzerinden kontrol edilir).
//  2. E-posta, veritabanındaki GÜNCEL profil durumuna göre yazılır; istekte gönderilen karar,
//     veritabanındaki durumla uyuşmazsa e-posta gönderilmez.
//  3. Uzmanın e-posta adresi yalnızca sunucuda okunur, tarayıcıya hiç gönderilmez.
// Gizli değerler (RESEND_API_KEY, BILDIRIM_GONDEREN) Supabase panelindeki "Edge Function Secrets"tadır.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const IZINLI_ADRESLER = [
  "https://klinikpsikologlar.com.tr",
  "https://www.klinikpsikologlar.com.tr",
  "https://becenemaruf.github.io",
];
const SITE = "https://klinikpsikologlar.com.tr";

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
const kacis = (m: string) => m.replace(/[&<>"']/g, (h) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[h]!);

const METINLER: Record<string, { konu: string; baslik: string; govde: (ad: string) => string; dugme: [string, string] }> = {
  yayinda: {
    konu: "Profiliniz yayında",
    baslik: "Profiliniz doğrulandı ve yayına alındı",
    govde: (ad) =>
      `Merhaba ${ad},</p><p style="margin:0 0 12px;font-size:15px;line-height:1.65;">Belgeleriniz incelendi ve klinik psikolog unvanınız doğrulandı. Profiliniz artık Klinik Psikologlar'da danışanlara görünüyor.`,
    dugme: ["Profilimi görüntüle", "{profil}"],
  },
  ek_belge: {
    konu: "Başvurunuz için ek belge gerekiyor",
    baslik: "Başvurunuz için ek belge gerekiyor",
    govde: (ad) =>
      `Merhaba ${ad},</p><p style="margin:0 0 12px;font-size:15px;line-height:1.65;">Başvurunuzu inceledik. Değerlendirmeyi tamamlayabilmemiz için ek belge ya da düzeltme gerekiyor. Panelinizdeki «Belgeler ve inceleme» bölümünden gerekli belgeyi yükleyip başvurunuzu yeniden incelemeye gönderebilirsiniz.`,
    dugme: ["Belgelerime git", `${SITE}/panel.html#belgeler`],
  },
  reddedildi: {
    konu: "Başvurunuz hakkında",
    baslik: "Başvurunuz onaylanamadı",
    govde: (ad) =>
      `Merhaba ${ad},</p><p style="margin:0 0 12px;font-size:15px;line-height:1.65;">Başvurunuzu inceledik; ancak sunulan bilgi ve belgelerle klinik psikolog unvanınızı doğrulayamadık. Bilgilerinizi düzelterek yeniden başvurabilirsiniz.`,
    dugme: ["Panelime git", `${SITE}/panel.html`],
  },
  askida: {
    konu: "Profiliniz geçici olarak yayından kaldırıldı",
    baslik: "Profiliniz geçici olarak yayından kaldırıldı",
    govde: (ad) =>
      `Merhaba ${ad},</p><p style="margin:0 0 12px;font-size:15px;line-height:1.65;">Profiliniz platform yönetimi tarafından geçici olarak yayından kaldırıldı. Ayrıntılar için panelinize giriş yapabilir ya da yönetimle iletişime geçebilirsiniz.`,
    dugme: ["Panelime git", `${SITE}/panel.html`],
  },
};

function sablon(baslik: string, govde: string, not: string, dugmeYazi: string, dugmeAdres: string) {
  const p = 'style="margin:0 0 12px;font-size:15px;line-height:1.65;"';
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${kacis(baslik)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f2;font-family:Arial,Helvetica,sans-serif;color:#13202b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f2;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e3e4e1;">
<tr><td style="padding:28px 32px 8px;"><img src="${SITE}/assets/img/marka/logo-tam.png" width="220" alt="Klinik Psikologlar" style="display:block;width:220px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td style="padding:12px 32px 8px;">
<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#12354b;">${kacis(baslik)}</h1>
<p ${p}>${govde}</p>
${not ? `<div style="margin:16px 0;padding:12px 16px;background:#f6f2ea;border-left:4px solid #b08d5c;border-radius:6px;font-size:14px;line-height:1.6;"><strong>Yönetimin notu:</strong><br>${kacis(not).replace(/\n/g, "<br>")}</div>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr><td style="border-radius:10px;background:#1c4a66;">
<a href="${dugmeAdres}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${kacis(dugmeYazi)}</a></td></tr></table>
</td></tr>
<tr><td style="padding:8px 32px 28px;"><p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#56626c;border-top:1px solid #e3e4e1;padding-top:14px;">
Bu e-posta, klinikpsikologlar.com.tr üzerindeki uzman başvurunuzla ilgili olarak otomatik gönderilmiştir. Lütfen bu e-postayı yanıtlamayın.</p></td></tr>
</table><p style="margin:14px 0 0;font-size:12px;color:#56626c;">Klinik Psikologlar · Türkiye'nin klinik psikolog rehberi</p>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return yanit({ hata: "Geçersiz istek." }, 405, origin);
  if (!origin || !IZINLI_ADRESLER.includes(origin)) return yanit({ hata: "Geçersiz kaynak." }, 403, origin);

  const yetki = req.headers.get("authorization") || "";
  if (!yetki.startsWith("Bearer ")) return yanit({ hata: "Giriş gerekli." }, 401, origin);

  let girdi: { uzman_id?: string; karar?: string; not?: string };
  try {
    girdi = await req.json();
  } catch {
    return yanit({ hata: "Geçersiz istek." }, 400, origin);
  }
  const karar = String(girdi.karar || "");
  const not = String(girdi.not || "").trim().slice(0, 1000);
  if (!METINLER[karar] || !/^[0-9a-f-]{36}$/.test(String(girdi.uzman_id || ""))) return yanit({ hata: "Geçersiz istek." }, 400, origin);

  // Yöneticinin kendi oturumuyla (güvenlik kuralları geçerli) kontrol
  const kullaniciDb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: yetki } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: kim } = await kullaniciDb.auth.getUser(yetki.slice(7));
  if (!kim?.user) return yanit({ hata: "Giriş gerekli." }, 401, origin);
  const { data: yonetici } = await kullaniciDb.from("yoneticiler").select("kullanici_id").eq("kullanici_id", kim.user.id).maybeSingle();
  if (!yonetici) return yanit({ hata: "Yetkiniz yok." }, 403, origin);

  const { data: u } = await kullaniciDb
    .from("uzmanlar")
    .select("id, slug, ad, soyad, unvan_oneki, kullanici_id, durum, ornek")
    .eq("id", girdi.uzman_id!)
    .maybeSingle();
  if (!u) return yanit({ hata: "Uzman bulunamadı." }, 404, origin);
  if (u.durum !== karar) return yanit({ hata: "Profil durumu kararla uyuşmuyor; e-posta gönderilmedi." }, 409, origin);
  if (u.ornek || !u.kullanici_id) return yanit({ gonderildi: false, neden: "ornek" }, 200, origin);

  const resend = Deno.env.get("RESEND_API_KEY");
  const gonderen = Deno.env.get("BILDIRIM_GONDEREN");
  if (!resend || !gonderen) return yanit({ gonderildi: false, neden: "eposta_ayari_yok" }, 200, origin);

  const yoneticiDb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: hesap } = await yoneticiDb.auth.admin.getUserById(u.kullanici_id);
  const alici = hesap?.user?.email;
  if (!alici) return yanit({ gonderildi: false, neden: "eposta_yok" }, 200, origin);

  const m = METINLER[karar];
  const ad = kacis([u.unvan_oneki, u.ad, u.soyad].filter(Boolean).join(" "));
  const dugmeAdres = m.dugme[1].replace("{profil}", `${SITE}/uzman.html?id=${encodeURIComponent(u.slug)}`);
  const sonuc = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: gonderen,
      to: [alici],
      subject: `${m.konu} | Klinik Psikologlar`,
      html: sablon(m.baslik, m.govde(ad), karar === "yayinda" ? "" : not, m.dugme[0], dugmeAdres),
    }),
  });
  if (!sonuc.ok) {
    console.error("E-posta gönderilemedi:", sonuc.status, await sonuc.text());
    return yanit({ gonderildi: false, neden: "gonderim_hatasi" }, 200, origin);
  }
  return yanit({ gonderildi: true }, 200, origin);
});
