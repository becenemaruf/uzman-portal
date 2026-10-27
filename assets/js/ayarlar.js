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

// Bir sayfada gösterilecek en fazla uzman sayısı (fazlası sonraki sayfalara geçer)
const SAYFA_BOYUTU = 36;

// Ücret filtresi seçenekleri (seans başına üst sınır, TL)
const UCRET_SINIRLARI = [1500, 2000, 2500, 3000];

// Çalışma alanı renkleri: Etiket adında bu kelimelerden biri geçiyorsa o rengi alır.
// Etiketin arka planı rengin %15 opaklığı, yazısı rengin koyu tonudur.
// Hiçbir gruba uymayan alanlar, adına göre aşağıdaki renklerden birini sabit olarak alır.
const UZMANLIK_RENKLERI = [
  { renk: "#3b6ea8", kelimeler: ["kaygi", "panik", "obsesif", "fobi"] },
  { renk: "#7a5aa6", kelimeler: ["depresyon", "bipolar", "uyku"] },
  { renk: "#b0506a", kelimeler: ["travma", "yas", "kayip"] },
  { renk: "#b86e12", kelimeler: ["cocuk", "ergen", "sinav", "okul", "ebeveyn", "dikkat", "otizm", "ogrenme"] },
  { renk: "#2a8383", kelimeler: ["cift", "iliski", "aile", "bosanma", "ofke"] },
  { renk: "#3f8a4c", kelimeler: ["ozguven", "benlik", "kariyer", "tukenmislik"] },
];
