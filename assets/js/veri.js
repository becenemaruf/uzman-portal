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

  // Yalnızca sitede aktif olan meslekler listelenir (ayarlar.js → AKTIF_UNVANLAR).
  const UNVAN_SUZGECI = `in.(${AKTIF_UNVANLAR.map((u) => `"${u}"`).join(",")})`;

  // Bağlantı çok yavaşsa 15 saniye sonra vazgeçilir; sayfa "yeniden dene" seçeneği gösterir.
  const ZAMAN_ASIMI_MS = 15000;

  async function oku(yol, ekBasliklar = {}) {
    const denetim = new AbortController();
    const sayac = setTimeout(() => denetim.abort(), ZAMAN_ASIMI_MS);
    try {
      const yanit = await fetch(`${ADRES}/${yol}`, { headers: { ...BASLIKLAR, ...ekBasliklar }, signal: denetim.signal });
      if (!yanit.ok) throw new Error(`Veri alınamadı (${yanit.status})`);
      return await yanit.json();
    } finally {
      clearTimeout(sayac);
    }
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
  // Platform (yönetim) yazılarının yazar kimliği
  const PLATFORM_YAZAR = { id: null, ad: "Klinik Psikologlar", unvan: "Platform yazısı", foto: "assets/img/marka/isaret-256.webp", platform: true };

  // Yazı satırını sayfaların kullandığı biçime çevirir. Yazarı yayında olmayan uzman yazısı → null
  function yaziCevir(y) {
    let yazar;
    if (y.tur === "platform") {
      yazar = { ...PLATFORM_YAZAR, unvan: y.yazar_adi || PLATFORM_YAZAR.unvan };
    } else {
      if (!y.uzmanlar) return null;
      yazar = { id: y.uzmanlar.slug, ad: tamAd(y.uzmanlar), foto: y.uzmanlar.foto_yolu, unvan: y.uzmanlar.unvan, ornek: y.uzmanlar.ornek };
    }
    return {
      id: y.slug,
      tur: y.tur || "uzman",
      yazarId: yazar.id,
      kategori: y.kategori,
      baslik: y.baslik,
      ozet: y.ozet,
      kapak: y.kapak_yolu,
      tarih: String(y.yayin_tarihi).slice(0, 10),
      okumaDakika: y.okuma_dakika,
      yazar,
    };
  }

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
      // Rozet, uzmanın beyanından değil veritabanındaki yayın durumundan gelir:
      // "yayinda" durumuna yalnızca yönetici, belgeleri inceledikten sonra geçirebilir
      // (bkz. ozel.uzman_degisikligini_denetle). Örnek (deneme) profiller hiçbir zaman "doğrulandı" sayılmaz.
      dogrulandi: s.durum === "yayinda" && !s.ornek,
      durum: s.durum,
      ad: tamAd(s),
      foto: s.foto_yolu,
      unvan: s.unvan,
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
        .map((y) => ({ id: y.slug, baslik: y.baslik, tarih: tarihMetni(y.yayin_tarihi) })),
      iletisim,
      // Sosyal medya: yalnızca dolu olanlar; adresler veritabanında platforma göre denetlenir.
      profilRengi: s.profil_rengi || null,
      sosyal: SOSYAL_MEDYA.filter((m) => s[m.kod]).map((m) => ({ kod: m.kod, etiket: m.etiket, adres: s[m.kod] })),
    };
  }

  // Listede gereken alanlar (profil sayfasının uzun metinleri liste için indirilmez)
  const LISTE_ALANLARI = [
    "slug", "ornek", "durum", "unvan_oneki", "ad", "soyad", "unvan", "foto_yolu", "sehir", "ilce",
    "gorusme_online", "gorusme_yuzyuze", "yeni_danisan", "kabul_durumu_guncellenme", "guncellenme",
    "deneyim_yili", "cinsiyet", "diller", "yas_gruplari", "kisa_tanitim",
    "uzman_uzmanliklar(sira,uzmanlik_alanlari(ad,kategori))",
    "uzman_yaklasimlar(sira,yaklasimlar(ad))",
  ].join(",");

  const PROFIL_ALANLARI = [
    LISTE_ALANLARI, "hakkinda", "seans_suresi", "online_platform", "muayenehane_adres",
    "telefon", "whatsapp", "eposta",
    "instagram", "linkedin", "x_hesabi", "youtube", "facebook", "tiktok", "web_sitesi", "profil_rengi",
    "uzman_egitimler(tur,metin,sira)", "uzman_sss(soru,cevap,sira)", "yazilar(slug,baslik,yayin_tarihi)",
  ].join(",");

  return {
    // Yayındaki (unvanı doğrulanmış) tüm uzmanlar.
    async uzmanlariGetir() {
      try {
        const satirlar = await oku(`uzmanlar?select=${LISTE_ALANLARI}&durum=eq.yayinda&unvan=${encodeURIComponent(UNVAN_SUZGECI)}`);
        return satirlar.map(uzmanaCevir);
      } catch (e) {
        console.error(e);
        return [];
      }
    },

    /* Tek bir uzman (adres çubuğundaki kısa ada göre).
     * - Bulunamazsa, yayından kaldırılmışsa ya da adres geçersizse: null
     * - Sunucuya ulaşılamazsa / zaman aşımında: hata FIRLATIR (sayfa "yeniden dene" gösterir).
     *   Böylece bağlantı sorunu, "profil bulunamadı" diye yanlış bildirilmez.
     */
    async uzmanGetir(id) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id || "")) return null;
      const satirlar = await oku(`uzmanlar?select=${PROFIL_ALANLARI}&slug=eq.${encodeURIComponent(id)}&durum=eq.yayinda&unvan=${encodeURIComponent(UNVAN_SUZGECI)}&yazilar.durum=eq.yayinda`);
      return satirlar.length ? uzmanaCevir(satirlar[0]) : null;
    },

    /* ÖNİZLEME: Uzman, henüz yayında olmayan kendi profilini görür.
     * Uzmanın oturum anahtarıyla istenir; veritabanı kuralları (RLS) yalnızca kendi profilini döndürür,
     * başkasının taslak profili bu yolla da görülemez. */
    async onizlemeGetir(id, erisimAnahtari) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id || "") || !erisimAnahtari) return null;
      const satirlar = await oku(`uzmanlar?select=${PROFIL_ALANLARI}&slug=eq.${encodeURIComponent(id)}&yazilar.durum=eq.yayinda`, {
        Authorization: `Bearer ${erisimAnahtari}`,
      });
      return satirlar.length ? uzmanaCevir(satirlar[0]) : null;
    },

    /* Tek bir yazı (yazi.html için). Bulunamazsa null; bağlantı hatasında hata fırlatır.
     * Metin düz yazı olarak saklanır ve sayfada HTML olarak YORUMLANMAZ (boş satırlar paragraf olur). */
    async yaziGetir(id) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id || "")) return null;
      // Yazarı olmayan (platform) yazılar da gelsin diye "inner" değil, sol birleştirme kullanılır;
      // uzman yazısının yazarı yayında değilse embed boş döner ve yazı gösterilmez.
      const satirlar = await oku(
        `yazilar?select=slug,tur,hedef,yazar_adi,baslik,ozet,icerik,kategori,okuma_dakika,yayin_tarihi,guncellenme,` +
          `uzmanlar(slug,unvan_oneki,ad,soyad,unvan,foto_yolu,ornek)` +
          `&slug=eq.${encodeURIComponent(id)}&durum=eq.yayinda&or=(tur.eq.uzman,hedef.in.(herkes,ikisi))&uzmanlar.durum=eq.yayinda&uzmanlar.unvan=${encodeURIComponent(UNVAN_SUZGECI)}`
      );
      const y = satirlar.map(yaziCevir).filter(Boolean)[0];
      if (!y) return null;
      const ham = satirlar[0];
      return { ...y, icerik: ham.icerik || "", guncellenme: ham.guncellenme };
    },

    // Blog yazıları: en yeniler önce, yazarın bilgisiyle birlikte.
    async yazilariGetir(adet = 6) {
      try {
        const satirlar = await oku(
          `yazilar?select=slug,tur,hedef,yazar_adi,baslik,ozet,kategori,kapak_yolu,okuma_dakika,yayin_tarihi,` +
            `uzmanlar(slug,unvan_oneki,ad,soyad,unvan,foto_yolu,ornek)` +
            `&durum=eq.yayinda&or=(tur.eq.uzman,hedef.in.(herkes,ikisi))` +
            `&uzmanlar.durum=eq.yayinda&uzmanlar.unvan=${encodeURIComponent(UNVAN_SUZGECI)}&order=yayin_tarihi.desc&limit=${(Number(adet) || 6) * 3}`
        );
        return satirlar.map(yaziCevir).filter(Boolean).slice(0, Number(adet) || 6);
      } catch (e) {
        console.error(e);
        return [];
      }
    },

    // Ana sayfa manşetleri: yalnızca aktif olanlar ve tarih aralığı bugünü kapsayanlar.
    async mansetleriGetir() {
      try {
        const bugun = new Date().toISOString().slice(0, 10);
        const satirlar = await oku(`mansetler?select=tur,baslik,metin,buton_yazi,buton_adres,tema,gorsel_yolu,gorsel_mobil_yolu,baslangic,bitis&aktif=eq.true&order=sira`);
        return satirlar
          .filter((m) => (!m.baslangic || m.baslangic <= bugun) && (!m.bitis || m.bitis >= bugun))
          .map((m) => ({
            tur: m.tur,
            baslik: m.baslik,
            metin: m.metin,
            buton: m.buton_yazi && m.buton_adres ? { yazi: m.buton_yazi, adres: m.buton_adres } : null,
            tema: m.tema,
            gorsel: m.gorsel_yolu,
            gorselMobil: m.gorsel_mobil_yolu,
          }));
      } catch (e) {
        console.error(e);
        return [];
      }
    },

    // Ana sayfa duyuruları (yalnızca aktif ve tarihi uygun olanlar; veritabanı kuralı da aynısını uygular)
    async duyurulariGetir() {
      try {
        const bugun = new Date().toISOString().slice(0, 10);
        const satirlar = await oku(`duyurular?select=id,konum,baslik,metin,buton_yazi,buton_adres,gorsel_yolu,baslangic,bitis&aktif=eq.true&order=sira`);
        return satirlar.filter((d) => (!d.baslangic || d.baslangic <= bugun) && (!d.bitis || d.bitis >= bugun));
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
