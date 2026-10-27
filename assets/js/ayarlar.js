/*
 * SİTE AYARLARI
 * Marka adı ve sabit listeler burada, tek bir yerde durur.
 * Marka adı belli olduğunda sadece SITE.ad satırını değiştirmek yeterli;
 * tüm sayfalardaki logo yazısı ve sayfa başlıkları kendiliğinden güncellenir.
 */
const SITE = {
  ad: "Uzman Portalı",
  slogan: "Ruh sağlığı uzmanlarını keşfedin",
};

// Uzmanların seçebileceği unvanlar (filtrede ve kayıt formunda kullanılır)
const UNVANLAR = [
  "Psikolog",
  "Klinik Psikolog",
  "Psikolojik Danışman (PDR)",
  "Psikiyatrist",
  "Çocuk ve Ergen Psikiyatristi",
  "Aile Danışmanı",
];

// Çalışılan yaş grupları
const YAS_GRUPLARI = ["Çocuk", "Ergen", "Yetişkin", "Çift", "Aile"];

// Ücret filtresi seçenekleri (seans başına üst sınır, TL)
const UCRET_SINIRLARI = [1500, 2000, 2500, 3000];
