/*
 * VERİ KATMANI
 * Sayfalar uzman bilgilerini her zaman bu dosyadaki fonksiyonlar üzerinden ister.
 * Veriler Supabase veritabanından, herkese açık "publishable" anahtarla okunur.
 *
 * Bu anahtarla yalnızca veritabanındaki güvenlik kurallarının (RLS) izin verdiği
 * bilgiler gelir: yayındaki profiller, yayındaki yazılar, aktif manşetler.
 * Uzmanın yayımlanmasına izin vermediği telefon/WhatsApp/e-posta, herkese açık tabloda
 * hiç bulunmadığı için buraya da hiçbir zaman gelmez.
 *
 * Veritabanından gelen satırlar, sayfaların beklediği biçime (eski örnek veri biçimi)
 * çevrilir; böylece liste ve profil sayfalarının kodu değişmeden çalışır.
 */
const Veri = (() => {
  const ADRES = `${BAGLANTI.supabaseAdresi}/rest/v1`;
  const BASLIKLAR = { apikey: BAGLANTI.supabaseAnahtari, Accept: "application/json" };

  // Veritabanının döndürdüğü kategori kodları ortak.js'deki kategoriBul() tarafından kullanılır.
  window.ALAN_KATEGORILERI = window.ALAN_KATEGORILERI || {};

  async function oku(yol) {
    const yanit = await fetch(`${ADRES}/${yol}`, { headers: BASLIKLAR });
    if (!yanit.ok) throw new Error(`Veri alınamadı (${yanit.status})`);
    return yanit.json();
  }

  const siraliAdlar = (satirlar, tablo) =>
    (satirlar || [])
      .slice()
      .sort((a, b) => a.sira - b.sira)
      .map((s) => s[tablo] && s[tablo].ad)
      .filter(Boolean);

  function tamAd(s) {
    return [s.unvan_oneki, s.ad, s.soyad].filter(Boolean).join(" ");
  }

  // Bir veritabanı satırını sayfaların kullandığı uzman nesnesine çevirir.
  function uzmanaCevir(s) {
    (s.uzman_uzmanliklar || []).forEach((x) => {
      if (x.uzmanlik_alanlari) ALAN_KATEGORILERI[x.uzmanlik_alanlari.ad] = x.uzmanlik_alanlari.kategori;
    });
    const egitimler = (s.uzman_egitimler || []).slice().sort((a, b) => a.sira - b.sira);
    const iletisim = {};
    if (s.telefon) iletisim.telefon = s.telefon;
    if (s.whatsapp) iletisim.whatsapp = s.whatsapp;
    if (s.eposta) iletisim.eposta = s.eposta;
    const gorusme = [];
    if (s.gorusme_online) gorusme.push("online");
    if (s.gorusme_yuzyuze) gorusme.push("yuzyuze");
    return {
      id: s.slug,
      ornek: s.ornek,
      ad: tamAd(s),
      foto: s.foto_yolu,
      unvan: s.unvan,
      dogrulandi: true,
      sehir: s.sehir,
      ilce: s.ilce,
      gorusme,
      yeniDanisan: s.yeni_danisan,
      kabulGuncellenme: s.kabul_durumu_guncellenme,
      guncellenme: s.guncellenme,
      deneyimYili: s.deneyim_yili,
      cinsiyet: s.cinsiyet,
      diller: s.diller || [],
      kisaTanitim: s.kisa_tanitim,
      hakkinda: s.hakkinda ? s.hakkinda.split(/\n\s*\n/) : [],
      uzmanliklar: siraliAdlar(s.uzman_uzmanliklar, "uzmanlik_alanlari"),
      yaklasimlar: siraliAdlar(s.uzman_yaklasimlar, "yaklasimlar"),
      yasGruplari: s.yas_gruplari || [],
      seans: { sure: s.seans_suresi, onlinePlatform: s.online_platform, adres: s.muayenehane_adres },
      egitim: egitimler.filter((e) => e.tur === "egitim").map((e) => e.metin),
      sertifikalar: egitimler.filter((e) => e.tur === "sertifika").map((e) => e.metin),
      sss: (s.uzman_sss || []).slice().sort((a, b) => a.sira - b.sira).map((x) => ({ soru: x.soru, cevap: x.cevap })),
      yazilar: (s.yazilar || [])
        .slice()
        .sort((a, b) => String(b.yayin_tarihi).localeCompare(String(a.yayin_tarihi)))
        .map((y) => ({ baslik: y.baslik, tarih: tarihMetni(y.yayin_tarihi) })),
      iletisim,
    };
  }

  // Listede gereken alanlar (profil sayfasının uzun metinleri liste için indirilmez)
  const LISTE_ALANLARI = [
    "slug", "ornek", "unvan_oneki", "ad", "soyad", "unvan", "foto_yolu", "sehir", "ilce",
    "gorusme_online", "gorusme_yuzyuze", "yeni_danisan", "kabul_durumu_guncellenme", "guncellenme",
    "deneyim_yili", "cinsiyet", "diller", "yas_gruplari", "kisa_tanitim",
    "uzman_uzmanliklar(sira,uzmanlik_alanlari(ad,kategori))",
    "uzman_yaklasimlar(sira,yaklasimlar(ad))",
  ].join(",");

  const PROFIL_ALANLARI = [
    LISTE_ALANLARI, "hakkinda", "seans_suresi", "online_platform", "muayenehane_adres",
    "telefon", "whatsapp", "eposta",
    "uzman_egitimler(tur,metin,sira)", "uzman_sss(soru,cevap,sira)", "yazilar(baslik,yayin_tarihi)",
  ].join(",");

  return {
    // Yayındaki (unvanı doğrulanmış) tüm uzmanlar.
    async uzmanlariGetir() {
      try {
        const satirlar = await oku(`uzmanlar?select=${LISTE_ALANLARI}&durum=eq.yayinda`);
        return satirlar.map(uzmanaCevir);
      } catch (e) {
        console.error(e);
        return [];
      }
    },

    // Tek bir uzman (adres çubuğundaki kısa ada göre); bulunamazsa ya da yayında değilse null.
    async uzmanGetir(id) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id || "")) return null;
      try {
        const satirlar = await oku(`uzmanlar?select=${PROFIL_ALANLARI}&slug=eq.${encodeURIComponent(id)}&durum=eq.yayinda&yazilar.durum=eq.yayinda`);
        return satirlar.length ? uzmanaCevir(satirlar[0]) : null;
      } catch (e) {
        console.error(e);
        return null;
      }
    },

    // Blog yazıları: en yeniler önce, yazarın bilgisiyle birlikte.
    async yazilariGetir(adet = 6) {
      try {
        const satirlar = await oku(
          `yazilar?select=slug,baslik,ozet,kategori,kapak_yolu,okuma_dakika,yayin_tarihi,` +
            `uzmanlar!inner(slug,unvan_oneki,ad,soyad,unvan,foto_yolu)` +
            `&durum=eq.yayinda&uzmanlar.durum=eq.yayinda&order=yayin_tarihi.desc&limit=${Number(adet) || 6}`
        );
        return satirlar.map((y) => ({
          id: y.slug,
          yazarId: y.uzmanlar.slug,
          kategori: y.kategori,
          baslik: y.baslik,
          ozet: y.ozet,
          kapak: y.kapak_yolu,
          tarih: String(y.yayin_tarihi).slice(0, 10),
          okumaDakika: y.okuma_dakika,
          yazar: { id: y.uzmanlar.slug, ad: tamAd(y.uzmanlar), foto: y.uzmanlar.foto_yolu, unvan: y.uzmanlar.unvan },
        }));
      } catch (e) {
        console.error(e);
        return [];
      }
    },

    // Ana sayfa manşetleri: yalnızca aktif olanlar ve tarih aralığı bugünü kapsayanlar.
    async mansetleriGetir() {
      try {
        const bugun = new Date().toISOString().slice(0, 10);
        const satirlar = await oku(`mansetler?select=tur,baslik,metin,buton_yazi,buton_adres,tema,gorsel_yolu,baslangic,bitis&aktif=eq.true&order=sira`);
        return satirlar
          .filter((m) => (!m.baslangic || m.baslangic <= bugun) && (!m.bitis || m.bitis >= bugun))
          .map((m) => ({
            tur: m.tur,
            baslik: m.baslik,
            metin: m.metin,
            buton: m.buton_yazi && m.buton_adres ? { yazi: m.buton_yazi, adres: m.buton_adres } : null,
            tema: m.tema,
            gorsel: m.gorsel_yolu,
          }));
      } catch (e) {
        console.error(e);
        return [];
      }
    },

    // Psikoloji gündemi: aktuelpsikoloji.com haberleri (sunucu fonksiyonu "haberler" üzerinden).
    // Ek başlık gönderilmez; böylece tarayıcı ön kontrol isteği (preflight) yapmaz.
    async haberleriGetir(adet = 6) {
      try {
        const yanit = await fetch(`${BAGLANTI.supabaseAdresi}/functions/v1/haberler`);
        if (!yanit.ok) return [];
        const veri = await yanit.json();
        return (veri.haberler || [])
          .filter((h) => h && h.baslik && /^https:\/\/(www\.)?aktuelpsikoloji\.com\//.test(h.baglanti || ""))
          .slice(0, adet);
      } catch (e) {
        return [];
      }
    },

    /* Uzmana platform üzerinden mesaj gönderir (yalnızca hiçbir doğrudan iletişim kanalı açık olmayan uzmanlar için).
     * Mesaj tarayıcıdan veritabanına DOĞRUDAN yazılmaz: Önce sunucudaki "mesaj-gonder" fonksiyonu
     * CAPTCHA'yı doğrular, gönderim sınırını kontrol eder, sonra kaydeder.
     * Dönüş: { durum: "tamam" | "prototip" | "hata", mesaj? }
     */
    async mesajGonder(uzmanId, bilgi) {
      if (!BAGLANTI.mesajSistemiAcik) return { durum: "prototip" };
      try {
        const yanit = await fetch(`${BAGLANTI.supabaseAdresi}/functions/v1/mesaj-gonder`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: BAGLANTI.supabaseAnahtari },
          body: JSON.stringify({ uzman: uzmanId, ...bilgi }),
        });
        const veri = await yanit.json().catch(() => ({}));
        if (yanit.ok) return { durum: "tamam" };
        return { durum: "hata", mesaj: veri.hata };
      } catch (e) {
        return { durum: "hata" };
      }
    },
  };
})();
