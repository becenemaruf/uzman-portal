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
};
