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
//  - Yalnızca sabit bir adresten (KAYNAK) okur; dışarıdan adres almaz.
//  - Haber metinlerindeki HTML tamamen temizlenir; yalnızca düz metin döner.
//  - Bağlantılar yalnızca aktuelpsikoloji.com alan adına aitse kabul edilir.
//  - Sonuç 15 dakika önbellekte tutulur; haber sitesine her ziyarette istek gitmez.
// =====================================================================
const KAYNAK = "https://www.aktuelpsikoloji.com/service/rss.php";
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
  const yanit = await fetch(KAYNAK, {
    headers: { "User-Agent": "UzmanPortali-HaberOnizleme/1.0", Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(8000),
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
  const ogeler = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const haberler = [];
  for (const oge of ogeler) {
    const baslik = duzMetin(etiket(oge, "title"));
    const atomLink = oge.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? "";
    const baglantiHam = duzMetin(etiket(oge, "link")) || atomLink || duzMetin(etiket(oge, "guid"));
    if (!baslik || !IZINLI_ALAN.test(baglantiHam)) continue;
    const baglanti = baglantiHam.replace(/^http:\/\//i, "https://");
    const tarihHam = duzMetin(etiket(oge, "pubDate")) || duzMetin(etiket(oge, "updated")) || duzMetin(etiket(oge, "published"));
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
    durum: yanit.status, tur: yanit.headers.get("content-type"), kodlama, boyut: ham.length,
    oge: ogeler.length, haber: haberler.length,
    ilkBaglanti: ogeler[0] ? (etiket(ogeler[0], "link") || atomIlk(ogeler[0])).slice(0, 120) : null,
    bas: ogeler.length ? null : xml.slice(0, 300),
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
