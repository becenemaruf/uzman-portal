// =====================================================================
// BİLDİRİM GÖNDER (Supabase Edge Function)
// Yönetimin uzmanlara gönderdiği sistem bildirimlerini (panel içi, e-posta, SMS) işler.
//
// İşlemler (POST gövdesi "islem"):
//  - "durum"        (yönetici) : Hangi kanalların kullanılabilir olduğunu söyler (e-posta / SMS ayarı var mı).
//  - "gonder"       (yönetici) : Taslak ya da planlı bir bildirimi hemen gönderir. "onay": true zorunludur.
//  - "yeniden_dene" (yönetici) : Gönderilmiş bir bildirimin BAŞARISIZ e-posta/SMS gönderimlerini yeniden dener.
//  - "planli"       (herkes)   : Zamanı gelmiş planlı bildirimleri gönderir. Veritabanındaki zamanlanmış görev
//                                (pg_cron) her 5 dakikada bir çağırır. Yalnızca yöneticinin önceden planladığı
//                                bildirimleri gönderdiği için dışarıdan çağrılması zarar vermez.
//
// Güvenlik ve sağlamlık:
//  - Yönetici kontrolü, isteği yapanın kendi oturumuyla veritabanından yapılır.
//  - Bir bildirim yalnızca BİR KEZ gönderime alınır: durum "taslak/planlandi" → "gonderiliyor" geçişi tek adımda yapılır;
//    ikinci bir istek bu adımı geçemez. Her (bildirim, uzman) için tek alıcı satırı vardır.
//  - E-postalar Resend'e "Idempotency-Key" ile gönderilir; aynı alıcıya aynı bildirim iki kez gitmez.
//  - Uzmanların e-posta adresleri yalnızca sunucuda okunur.
//  - E-posta tercihini kapatan uzmana yalnızca KRİTİK bildirimler e-postayla gider (hizmet/güvenlik bildirimi).
//  - SMS yalnızca SMS'e açıkça izin vermiş ve numarasını girmiş uzmanlara gider.
//
// Gizli değerler (Supabase → Edge Function Secrets):
//  - RESEND_API_KEY, BILDIRIM_GONDEREN : e-posta (mevcut)
//  - SMS_SAGLAYICI ve sağlayıcıya özel anahtarlar : SMS (henüz tanımlı değil → SMS gönderilmez)
// =====================================================================
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

const IZINLI_ADRESLER = ["https://klinikpsikologlar.com.tr", "https://www.klinikpsikologlar.com.tr", "https://becenemaruf.github.io"];
const SITE = "https://klinikpsikologlar.com.tr";
const TUR_ADI: Record<string, string> = {
  teknik: "Teknik aksaklık",
  guvenlik: "Güvenlik bildirimi",
  bakim: "Planlı bakım",
  guncelleme: "Sistem güncellemesi",
  genel: "Genel bilgilendirme",
};
const ONCELIK_ADI: Record<string, string> = { normal: "Normal", onemli: "Önemli", kritik: "Kritik" };

function cors(origin: string | null) {
  const izinli = origin && IZINLI_ADRESLER.includes(origin) ? origin : IZINLI_ADRESLER[0];
  return {
    "Access-Control-Allow-Origin": izinli,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
const yanit = (govde: unknown, durum: number, origin: string | null) =>
  new Response(JSON.stringify(govde), { status: durum, headers: { ...cors(origin), "Content-Type": "application/json" } });
const kacis = (m: string) => m.replace(/[&<>"']/g, (h) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[h]!);
const kisalt = (m: unknown) => String(m ?? "").slice(0, 300);

// ---------------------------------------------------------------------
// SMS SAĞLAYICISI
// Sağlayıcı seçildiğinde buraya o sağlayıcının API çağrısı eklenir (ör. NetGSM, İleti Merkezi, Mutlucell).
// Anahtarlar yalnızca Edge Function Secrets'ta tutulur. SMS_SAGLAYICI tanımlı değilse hiçbir SMS gönderilmez.
// ---------------------------------------------------------------------
function smsHazirMi(): boolean {
  const s = Deno.env.get("SMS_SAGLAYICI");
  return !!s && SMS_SAGLAYICILARI[s] !== undefined;
}
const SMS_SAGLAYICILARI: Record<string, (telefon: string, metin: string) => Promise<{ tamam: boolean; hata?: string }>> = {
  // Örnek yapı — gerçek sağlayıcı bağlanınca doldurulacak:
  // netgsm: async (telefon, metin) => { ...fetch(...)...; return { tamam: true }; },
};
async function smsGonder(telefon: string, metin: string) {
  const s = Deno.env.get("SMS_SAGLAYICI") || "";
  const f = SMS_SAGLAYICILARI[s];
  if (!f) return { tamam: false, hata: "SMS sağlayıcısı tanımlı değil." };
  try {
    return await f(telefon, metin);
  } catch (e) {
    return { tamam: false, hata: kisalt((e as Error).message) };
  }
}

// ---------------------------------------------------------------------
// E-POSTA ŞABLONU
// ---------------------------------------------------------------------
function epostaHtml(b: Record<string, string>, ad: string) {
  const p = 'style="margin:0 0 12px;font-size:15px;line-height:1.65;"';
  const renk = b.oncelik === "kritik" ? "#a33a2b" : b.oncelik === "onemli" ? "#8a6a3d" : "#1c4a66";
  const govde = kacis(b.metin).split(/\n{2,}/).map((x) => `<p ${p}>${x.replace(/\n/g, "<br>")}</p>`).join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${kacis(b.baslik)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f2;font-family:Arial,Helvetica,sans-serif;color:#13202b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f2;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e3e4e1;border-top:4px solid ${renk};">
<tr><td style="padding:26px 32px 6px;"><img src="${SITE}/assets/img/marka/logo-tam.png" width="220" alt="Klinik Psikologlar" style="display:block;width:220px;max-width:100%;height:auto;border:0;"></td></tr>
<tr><td style="padding:14px 32px 6px;">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${renk};font-weight:bold;">${kacis(TUR_ADI[b.tur] || "Bilgilendirme")}${b.oncelik !== "normal" ? " · " + kacis(ONCELIK_ADI[b.oncelik]) : ""}</p>
<h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#12354b;">${kacis(b.baslik)}</h1>
<p ${p}>Merhaba ${kacis(ad)},</p>
${govde}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="border-radius:10px;background:#1c4a66;">
<a href="${SITE}/panel.html#bildirimler" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">Panelimde görüntüle</a></td></tr></table>
</td></tr>
<tr><td style="padding:6px 32px 26px;"><p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#56626c;border-top:1px solid #e3e4e1;padding-top:14px;">
Bu e-posta, klinikpsikologlar.com.tr uzman hesabınız ve platform hizmetleriyle ilgili bir bilgilendirmedir; ticari elektronik ileti değildir.
Kritik olmayan bildirim e-postalarını panelinizdeki "Bildirim tercihleri" bölümünden kapatabilirsiniz. Lütfen bu e-postayı yanıtlamayın.</p></td></tr>
</table></td></tr></table></body></html>`;
}

// ---------------------------------------------------------------------
// GÖNDERİM
// ---------------------------------------------------------------------
async function epostalariGonder(db: SupabaseClient, b: Record<string, string>, tekrar = false) {
  const sonuc = { gonderildi: 0, basarisiz: 0, atlandi: 0 };
  const resend = Deno.env.get("RESEND_API_KEY");
  const gonderen = Deno.env.get("BILDIRIM_GONDEREN");
  const { data: liste, error } = await db.rpc("bildirim_gonderim_listesi", { p_bildirim: b.id, p_kanal: "eposta" });
  if (error) throw error;
  const kritik = b.oncelik === "kritik";
  const gonderilecek: { alici_id: number; eposta: string; ad: string }[] = [];
  for (const a of liste || []) {
    if (!a.eposta) {
      await db.from("bildirim_alicilari").update({ eposta_durum: "basarisiz", eposta_hata: "Kayıtlı e-posta adresi yok.", eposta_zamani: new Date().toISOString() }).eq("id", a.alici_id);
      sonuc.basarisiz++;
    } else if (!a.eposta_izin && !kritik) {
      await db.from("bildirim_alicilari").update({ eposta_durum: "atlandi", eposta_hata: "Uzman bildirim e-postalarını kapatmış.", eposta_zamani: new Date().toISOString() }).eq("id", a.alici_id);
      sonuc.atlandi++;
    } else gonderilecek.push({ alici_id: a.alici_id, eposta: a.eposta, ad: a.ad });
  }
  if (!gonderilecek.length) return sonuc;
  if (!resend || !gonderen) {
    for (const a of gonderilecek) await db.from("bildirim_alicilari").update({ eposta_durum: "basarisiz", eposta_hata: "E-posta servisi ayarlı değil." }).eq("id", a.alici_id);
    sonuc.basarisiz += gonderilecek.length;
    return sonuc;
  }
  const konu = `${b.oncelik === "kritik" ? "[Kritik] " : b.oncelik === "onemli" ? "[Önemli] " : ""}${b.baslik} | Klinik Psikologlar`;
  // Resend toplu gönderim: tek istekte en fazla 100 e-posta. 50'şerli gruplar.
  for (let i = 0; i < gonderilecek.length; i += 50) {
    const grup = gonderilecek.slice(i, i + 50);
    let tamam = false;
    let hata = "";
    try {
      const y = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resend}`,
          "Content-Type": "application/json",
          // İlk gönderimde sabit anahtar (çift gönderim olmaz); yeniden denemede yeni anahtar.
          "Idempotency-Key": `bildirim-${b.id}-${tekrar ? "t" + Date.now() + "-" : ""}${grup.map((g) => g.alici_id).join("-")}`.slice(0, 256),
        },
        body: JSON.stringify(grup.map((g) => ({ from: gonderen, to: [g.eposta], subject: konu, html: epostaHtml(b, g.ad) }))),
      });
      tamam = y.ok;
      if (!y.ok) hata = kisalt(`Resend ${y.status}: ${await y.text()}`);
    } catch (e) {
      hata = kisalt((e as Error).message);
    }
    const zaman = new Date().toISOString();
    await db
      .from("bildirim_alicilari")
      .update(tamam ? { eposta_durum: "gonderildi", eposta_hata: null, eposta_zamani: zaman } : { eposta_durum: "basarisiz", eposta_hata: hata || "Gönderilemedi.", eposta_zamani: zaman })
      .in("id", grup.map((g) => g.alici_id));
    if (tamam) sonuc.gonderildi += grup.length;
    else sonuc.basarisiz += grup.length;
    if (i + 50 < gonderilecek.length) await new Promise((r) => setTimeout(r, 600)); // Resend hız sınırı
  }
  return sonuc;
}

async function smsleriGonder(db: SupabaseClient, b: Record<string, string>) {
  const sonuc = { gonderildi: 0, basarisiz: 0, atlandi: 0 };
  const { data: liste, error } = await db.rpc("bildirim_gonderim_listesi", { p_bildirim: b.id, p_kanal: "sms" });
  if (error) throw error;
  const metin = (b.sms_metni || `${b.baslik}: ${b.metin}`).slice(0, 600) + " - klinikpsikologlar.com.tr";
  for (const a of liste || []) {
    const zaman = new Date().toISOString();
    if (!a.sms_izin || !a.sms_telefon) {
      await db.from("bildirim_alicilari").update({ sms_durum: "atlandi", sms_hata: "Uzmanın SMS izni ya da numarası yok.", sms_zamani: zaman }).eq("id", a.alici_id);
      sonuc.atlandi++;
      continue;
    }
    if (!smsHazirMi()) {
      await db.from("bildirim_alicilari").update({ sms_durum: "basarisiz", sms_hata: "SMS sağlayıcısı tanımlı değil.", sms_zamani: zaman }).eq("id", a.alici_id);
      sonuc.basarisiz++;
      continue;
    }
    const r = await smsGonder(a.sms_telefon, metin);
    await db.from("bildirim_alicilari").update(r.tamam ? { sms_durum: "gonderildi", sms_hata: null, sms_zamani: zaman } : { sms_durum: "basarisiz", sms_hata: kisalt(r.hata), sms_zamani: zaman }).eq("id", a.alici_id);
    if (r.tamam) sonuc.gonderildi++;
    else sonuc.basarisiz++;
  }
  return sonuc;
}

async function gonder(db: SupabaseClient, id: number, gonderenEposta: string) {
  // Tek seferlik geçiş: aynı bildirim iki kez gönderime alınamaz.
  const { data: b, error } = await db
    .from("sistem_bildirimleri")
    .update({ durum: "gonderiliyor", gonderen_eposta: gonderenEposta })
    .eq("id", id)
    .in("durum", ["taslak", "planlandi"])
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!b) return { hata: "Bu bildirim zaten gönderilmiş ya da gönderiliyor." };
  try {
    const { data: alici, error: aErr } = await db.rpc("bildirim_alicilarini_olustur", { p_bildirim: id });
    if (aErr) throw aErr;
    const eposta = b.kanal_eposta ? await epostalariGonder(db, b) : null;
    const sms = b.kanal_sms ? await smsleriGonder(db, b) : null;
    await db.from("sistem_bildirimleri").update({ durum: "gonderildi", gonderim_zamani: new Date().toISOString() }).eq("id", id);
    return { gonderildi: true, alici, eposta, sms };
  } catch (e) {
    // Alıcı satırları oluştuysa durum yine "gonderildi" yapılır; başarısızlar "yeniden dene" ile tekrar gönderilir.
    console.error("Gönderim hatası:", (e as Error).message);
    await db.from("sistem_bildirimleri").update({ durum: "gonderildi", gonderim_zamani: new Date().toISOString() }).eq("id", id);
    return { gonderildi: true, uyari: "Gönderim sırasında bir hata oluştu; başarısız gönderimleri yeniden deneyebilirsiniz." };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return yanit({ hata: "Geçersiz istek." }, 405, origin);
  let girdi: { islem?: string; bildirim_id?: number; onay?: boolean };
  try {
    girdi = await req.json();
  } catch {
    return yanit({ hata: "Geçersiz istek." }, 400, origin);
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

  // --- Zamanı gelen planlı bildirimler (zamanlanmış görev) ---
  if (girdi.islem === "planli") {
    const { data: hazir } = await db.from("sistem_bildirimleri").select("id").eq("durum", "planlandi").lte("planlanan_zaman", new Date().toISOString()).limit(5);
    const sonuclar = [];
    for (const x of hazir || []) sonuclar.push(await gonder(db, x.id, "Zamanlanmış gönderim"));
    return yanit({ islenen: sonuclar.length }, 200, origin);
  }

  // --- Yönetici işlemleri ---
  if (!origin || !IZINLI_ADRESLER.includes(origin)) return yanit({ hata: "Geçersiz kaynak." }, 403, origin);
  const yetki = req.headers.get("authorization") || "";
  if (!yetki.startsWith("Bearer ")) return yanit({ hata: "Giriş gerekli." }, 401, origin);
  const kullaniciDb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: yetki } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: kim } = await kullaniciDb.auth.getUser(yetki.slice(7));
  if (!kim?.user) return yanit({ hata: "Giriş gerekli." }, 401, origin);
  const { data: yonetici } = await kullaniciDb.from("yoneticiler").select("kullanici_id").eq("kullanici_id", kim.user.id).maybeSingle();
  if (!yonetici) return yanit({ hata: "Yetkiniz yok." }, 403, origin);

  if (girdi.islem === "durum") {
    return yanit({ eposta_hazir: !!(Deno.env.get("RESEND_API_KEY") && Deno.env.get("BILDIRIM_GONDEREN")), sms_hazir: smsHazirMi() }, 200, origin);
  }
  const id = Number(girdi.bildirim_id);
  if (!Number.isInteger(id) || id <= 0) return yanit({ hata: "Geçersiz bildirim." }, 400, origin);

  if (girdi.islem === "gonder") {
    if (girdi.onay !== true) return yanit({ hata: "Gönderim onayı eksik." }, 400, origin);
    const { data: b } = await db.from("sistem_bildirimleri").select("kanal_sms").eq("id", id).maybeSingle();
    if (b?.kanal_sms && !smsHazirMi()) return yanit({ hata: "SMS sağlayıcısı tanımlı değil; SMS kanalını kapatıp tekrar deneyin." }, 400, origin);
    const s = await gonder(db, id, kim.user.email || "yönetici");
    return yanit(s, s.hata ? 409 : 200, origin);
  }

  if (girdi.islem === "yeniden_dene") {
    const { data: b } = await db.from("sistem_bildirimleri").select("*").eq("id", id).eq("durum", "gonderildi").maybeSingle();
    if (!b) return yanit({ hata: "Yalnızca gönderilmiş bildirimler yeniden denenebilir." }, 400, origin);
    const eposta = b.kanal_eposta ? await epostalariGonder(db, b, true) : null;
    const sms = b.kanal_sms && smsHazirMi() ? await smsleriGonder(db, b) : null;
    return yanit({ eposta, sms }, 200, origin);
  }
  return yanit({ hata: "Bilinmeyen işlem." }, 400, origin);
});
