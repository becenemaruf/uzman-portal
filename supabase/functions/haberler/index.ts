// =====================================================================
// HABERLER (Supabase Edge Function)
// aktuelpsikoloji.com'un RSS beslemesindeki son haberleri sade bir JSON listesine çevirir.
//
// Neden sunucuda?
//  - Haber sitesinin beslemesi, tarayıcıdan doğrudan okunmaya (CORS) izin vermeyebilir.
//  - Ziyaretçinin tarayıcısı haber sitesine bağlanmaz; IP adresi üçüncü bir siteye gitmez.
//    Ziyaretçi yalnızca bir habere tıkladığında o siteye geçer.
//
// Güvenlik:
//  - Yalnızca sabit adreslerden (RSS ve ana sayfa) okur; dışarıdan adres almaz.
//  - Haber metinlerindeki HTML tamamen temizlenir; yalnızca düz metin döner.
//  - Bağlantılar yalnızca aktuelpsikoloji.com alan adına aitse kabul edilir.
//  - Sonuç 15 dakika önbellekte tutulur; haber sitesine her ziyarette istek gitmez.
// =====================================================================
// Önce RSS denenir. CM News'in RSS'i yalnızca güncel (o günün) haberleri verdiği için
// boş gelebilir; bu durumda haber sitesinin ana sayfasındaki haber bağlantıları okunur.
const KAYNAKLAR = [
  "https://www.aktuelpsikoloji.com/service/rss.php",
];
const ANA_SAYFA = "https://www.aktuelpsikoloji.com/";
// CM News haber adresleri: https://www.aktuelpsikoloji.com/<kisa-ad>-<numara>h.htm
const HABER_ADRESI = /^https?:\/\/(www\.)?aktuelpsikoloji\.com\/[a-z0-9-]+-(\d+)h\.htm$/i;
const TARAYICI_KIMLIGI =
  "Mozilla/5.0 (compatible; UzmanPortali-HaberOnizleme/1.0; +https://becenemaruf.github.io/uzman-portal/)";
const IZINLI_ALAN = /^https?:\/\/(www\.)?aktuelpsikoloji\.com\//;
const ONBELLEK_SURESI = 15 * 60 * 1000;
const EN_FAZLA = 12;

let onbellek: { zaman: number; veri: unknown } | null = null;

const BASLIKLAR = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, x-client-info, authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=600",
};

const VARLIKLAR: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", ndash: "–", mdash: "—",
};

function varlikCoz(metin: string) {
  return metin
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (t, ad) => VARLIKLAR[ad.toLowerCase()] ?? t);
}

function duzMetin(ham: string) {
  const icerik = ham.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
  const etiketsiz = (m: string) => m.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ");
  return etiketsiz(varlikCoz(etiketsiz(varlikCoz(icerik)))).replace(/\s+/g, " ").trim();
}

function etiket(oge: string, ad: string) {
  const m = oge.match(new RegExp(`<${ad}[^>]*>([\\s\\S]*?)</${ad}>`, "i"));
  return m ? m[1] : "";
}

function kisalt(metin: string, sinir: number) {
  if (metin.length <= sinir) return metin;
  const kesik = metin.slice(0, sinir);
  return kesik.slice(0, Math.max(kesik.lastIndexOf(" "), sinir - 20)).replace(/[,.;:\s]+$/, "") + "…";
}

function atomIlk(oge: string) {
  return oge.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? "";
}

async function haberleriGetir() {
  for (const kaynak of KAYNAKLAR) {
    try {
      const sonuc = await kaynaktanGetir(kaynak);
      if (sonuc.haberler.length) return sonuc;
    } catch (e) {
      console.log(JSON.stringify({ kaynak, hata: String(e).slice(0, 150) }));
    }
  }
  try {
    return await anaSayfadanGetir();
  } catch (e) {
    console.log(JSON.stringify({ kaynak: ANA_SAYFA, hata: String(e).slice(0, 150) }));
  }
  return { kaynak: "Aktüel Psikoloji", kaynakAdresi: "https://www.aktuelpsikoloji.com/", haberler: [] };
}

// Ana sayfadaki haber bağlantılarını toplar. Aynı haber birden çok yerde geçebilir;
// her haber bir kez alınır, başlık için bağlantı metni ya da title niteliği kullanılır.
// Sıralama haber numarasına göredir (büyük numara = daha yeni haber).
async function anaSayfadanGetir() {
  const yanit = await fetch(ANA_SAYFA, {
    headers: { "User-Agent": TARAYICI_KIMLIGI, Accept: "text/html" },
    signal: AbortSignal.timeout(8000),
  });
  if (!yanit.ok) throw new Error(`Ana sayfa yanıt vermedi (${yanit.status})`);
  const html = await yanit.text();
  const bulunan = new Map<string, { baslik: string; numara: number }>();
  const baglantiDeseni = /<a\b([^>]*?)href=["']([^"'#?]+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = baglantiDeseni.exec(html))) {
    let adres = m[2].trim();
    if (adres.startsWith("/")) adres = "https://www.aktuelpsikoloji.com" + adres;
    const eslesme = adres.match(HABER_ADRESI);
    if (!eslesme) continue;
    adres = adres.replace(/^http:\/\//i, "https://");
    const nitelikler = m[1] + " " + m[3];
    const titleNiteligi = nitelikler.match(/title=["']([^"']+)["']/i)?.[1] ?? "";
    const metin = duzMetin(m[4]);
    // Başlığın başındaki saat ya da tarih bilgisi ("16:01", "27.10.2026") ayıklanır.
    const baslik = duzMetin(metin.length >= 15 ? metin : titleNiteligi || metin)
      .replace(/^(\d{1,2}[:.]\d{2}([.]\d{2,4})?\s+)+/, "")
      .trim();
    if (baslik.length < 15) continue;
    const onceki = bulunan.get(adres);
    if (!onceki || baslik.length > onceki.baslik.length) {
      bulunan.set(adres, { baslik, numara: Number(eslesme[2]) });
    }
  }
  const haberler = [...bulunan.entries()]
    .sort((a, b) => b[1].numara - a[1].numara)
    .slice(0, EN_FAZLA)
    .map(([baglanti, h]) => ({ baslik: kisalt(h.baslik, 160), ozet: "", baglanti, tarih: null, kategori: null }));
  console.log(JSON.stringify({ kaynak: ANA_SAYFA, durum: yanit.status, boyut: html.length, haber: haberler.length }));
  return { kaynak: "Aktüel Psikoloji", kaynakAdresi: "https://www.aktuelpsikoloji.com/", haberler };
}

async function kaynaktanGetir(KAYNAK: string) {
  const yanit = await fetch(KAYNAK, {
    headers: { "User-Agent": TARAYICI_KIMLIGI, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(6000),
  });
  if (!yanit.ok) throw new Error(`Kaynak yanıt vermedi (${yanit.status})`);
  // Karakter kodlaması: Türkçe siteler bazen UTF-8 yerine ISO-8859-9 / windows-1254 kullanır.
  // Önce sunucunun bildirdiği, yoksa XML başlığında yazan kodlama kullanılır.
  const ham = new Uint8Array(await yanit.arrayBuffer());
  const bas = new TextDecoder("latin1").decode(ham.slice(0, 200));
  const kodlama =
    (yanit.headers.get("content-type") || "").match(/charset=([\w-]+)/i)?.[1] ||
    bas.match(/encoding=["']([\w-]+)["']/i)?.[1] ||
    "utf-8";
  let xml: string;
  try {
    xml = new TextDecoder(kodlama.toLowerCase()).decode(ham);
  } catch {
    xml = new TextDecoder("utf-8").decode(ham);
  }
  // RSS (<item>) ve Atom (<entry>) biçimleri desteklenir.
  const ogeler =
    xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ??
    xml.match(/<url>[\s\S]*?<\/url>/gi) ??
    [];
  const haberler = [];
  for (const oge of ogeler) {
    const baslik = duzMetin(etiket(oge, "title")) || duzMetin(etiket(oge, "news:title"));
    const atomLink = oge.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? "";
    const baglantiHam = duzMetin(etiket(oge, "link")) || atomLink || duzMetin(etiket(oge, "guid")) || duzMetin(etiket(oge, "loc"));
    if (!baslik || !IZINLI_ALAN.test(baglantiHam)) continue;
    const baglanti = baglantiHam.replace(/^http:\/\//i, "https://");
    const tarihHam = duzMetin(etiket(oge, "pubDate")) || duzMetin(etiket(oge, "updated")) || duzMetin(etiket(oge, "published")) || duzMetin(etiket(oge, "news:publication_date"));
    const tarih = tarihHam && !isNaN(Date.parse(tarihHam)) ? new Date(tarihHam).toISOString() : null;
    haberler.push({
      baslik: kisalt(baslik, 160),
      ozet: kisalt(duzMetin(etiket(oge, "description")) || duzMetin(etiket(oge, "summary")), 200),
      baglanti,
      tarih,
      kategori: kisalt(duzMetin(etiket(oge, "category")), 40) || null,
    });
    if (haberler.length >= EN_FAZLA) break;
  }
  // Teşhis notu (sunucu kayıtlarında görünür; kişisel veri içermez)
  console.log(JSON.stringify({
    kaynak: KAYNAK, durum: yanit.status, tur: yanit.headers.get("content-type"), kodlama, boyut: ham.length,
    oge: ogeler.length, haber: haberler.length,
    ilkBaglanti: ogeler[0] ? (etiket(ogeler[0], "link") || atomIlk(ogeler[0])).slice(0, 120) : null,
    icerik: ogeler.length ? null : xml.slice(0, 300),
  }));
  return { kaynak: "Aktüel Psikoloji", kaynakAdresi: "https://www.aktuelpsikoloji.com/", haberler };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: BASLIKLAR });
  if (req.method !== "GET") return new Response(JSON.stringify({ hata: "Geçersiz istek." }), { status: 405, headers: BASLIKLAR });

  if (onbellek && Date.now() - onbellek.zaman < ONBELLEK_SURESI) {
    return new Response(JSON.stringify(onbellek.veri), { headers: BASLIKLAR });
  }
  try {
    const veri = await haberleriGetir();
    // Boş sonuç önbelleğe alınmaz; bir sonraki istekte yeniden denenir.
    if (veri.haberler.length) onbellek = { zaman: Date.now(), veri };
    return new Response(JSON.stringify(veri), { headers: BASLIKLAR });
  } catch (e) {
    console.log("haber kaynağı hatası:", String(e).slice(0, 200));
    // Kaynak geçici olarak ulaşılamıyorsa eski önbellek varsa onu döndür; yoksa boş liste.
    if (onbellek) return new Response(JSON.stringify(onbellek.veri), { headers: BASLIKLAR });
    return new Response(JSON.stringify({ kaynak: "Aktüel Psikoloji", haberler: [] }), { status: 502, headers: BASLIKLAR });
  }
});
