/*
 * VERİ KATMANI
 * Sayfalar uzman bilgilerini doğrudan ORNEK_UZMANLAR'dan değil,
 * her zaman bu dosyadaki fonksiyonlar üzerinden ister.
 *
 * Neden? Veritabanına (Supabase) geçtiğimizde sadece bu dosyanın içi
 * değişecek; liste ve profil sayfalarına hiç dokunmamız gerekmeyecek.
 *
 * Fonksiyonlar "async" yazıldı: Veritabanından gelen cevap birkaç
 * yüz milisaniye sürer; sayfalar şimdiden bu beklemeye hazır olsun.
 */
const Veri = {
  // Yayındaki (unvanı doğrulanmış) tüm uzmanlar.
  // Doğrulanmamış profiller danışanlara hiç gösterilmez.
  async uzmanlariGetir() {
    return ORNEK_UZMANLAR.filter((u) => u.dogrulandi);
  },

  // Tek bir uzman; bulunamazsa ya da henüz onaylanmamışsa null döner.
  async uzmanGetir(id) {
    const uzman = ORNEK_UZMANLAR.find((u) => u.id === id);
    return uzman && uzman.dogrulandi ? uzman : null;
  },

  // Blog yazıları: en yeniler önce. Her yazıya yazarın bilgisi eklenir;
  // yazarı yayında olmayan (doğrulanmamış) yazılar gösterilmez.
  async yazilariGetir(adet = 6) {
    return ORNEK_YAZILAR.map((y) => ({ ...y, yazar: ORNEK_UZMANLAR.find((u) => u.id === y.yazarId && u.dogrulandi) }))
      .filter((y) => y.yazar)
      .sort((a, b) => b.tarih.localeCompare(a.tarih))
      .slice(0, adet);
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

  // Ana sayfa manşetleri: yalnızca tarih aralığı bugünü kapsayanlar.
  async mansetleriGetir() {
    const bugun = new Date().toISOString().slice(0, 10); // "2026-10-27"
    return ORNEK_MANSETLER.filter(
      (m) => (!m.baslangic || m.baslangic <= bugun) && (!m.bitis || m.bitis >= bugun)
    );
  },
};
