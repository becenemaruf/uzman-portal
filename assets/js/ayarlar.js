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

/*
 * BAĞLANTI BİLGİLERİ
 * Bu değerlerin hepsi HERKESE AÇIK olacak şekilde tasarlanmıştır; sitenin koduna konmaları güvenlidir.
 * - supabaseAdresi / supabaseAnahtari: Siteyi veritabanına bağlar. Bu anahtarla yalnızca
 *   veritabanındaki güvenlik kurallarının (RLS) izin verdiği işlemler yapılabilir.
 * - turnstileSiteAnahtari: Formlardaki CAPTCHA kutusunu gösterir.
 *
 * GİZLİ anahtarlar (Turnstile Secret Key, Supabase service_role / secret anahtarları,
 * veritabanı şifresi) ASLA bu dosyaya ya da repodaki herhangi bir dosyaya yazılmaz.
 */
const BAGLANTI = {
  supabaseAdresi: "https://nzkkbnhwxmjcywvghxon.supabase.co",
  supabaseAnahtari: "sb_publishable_vPd4ryhRte0G3Cv4ZyN7yQ_tPVhkDGM",
  turnstileSiteAnahtari: "0x4AAAAAAFoFIAxaZOt3g_v_",
  // "Uzmana Mesaj Gönder" sistemi (Supabase Edge Function "mesaj-gonder").
  // false yapılırsa form çalışır ama mesaj hiçbir yere gönderilmez; ziyaretçiye bu açıkça söylenir.
  mesajSistemiAcik: true,
};

// Uzmanların seçebileceği unvanlar (filtrede ve kayıt formunda kullanılır)
const UNVANLAR = [
  "Psikolog",
  "Klinik Psikolog",
  "Psikolojik Danışman (PDR)",
  "Psikiyatrist",
  "Çocuk ve Ergen Psikiyatristi",
  "Sosyal Hizmet Uzmanı",
  "Dil ve Konuşma Terapisti",
  "Ergoterapist",
  "Özel Eğitim Uzmanı",
  "Çocuk Gelişimci",
];

// Çalışılan yaş grupları
const YAS_GRUPLARI = ["Çocuk", "Ergen", "Yetişkin", "Çift", "Aile"];

// Bir sayfada gösterilecek en fazla uzman sayısı (fazlası sonraki sayfalara geçer)
const SAYFA_BOYUTU = 36;

// Ücret bilgisi bilinçli olarak gösterilmez (sağlık hizmeti tanıtım kuralları; README'deki karar tablosu).

// "Yeni danışan kabul ediyor" bilgisi bu kadar gün güncellenmezse "güncel değil" olarak gösterilir.
const KABUL_GUNCELLIK_GUN = 60;

/*
 * İHTİYAÇ KATEGORİLERİ
 * Danışanın klinik terim bilmeden arama yapabilmesi için çalışma alanları günlük dille gruplanır.
 * Bu gruplar tanı koymak ya da yönlendirmek için DEĞİL, aramayı kolaylaştırmak için vardır.
 * Aynı gruplar etiket renklerini de belirler (arka plan rengin %15 opaklığı, yazı koyu tonu).
 *
 * "kod" değerleri veritabanındaki uzmanlik_alanlari.kategori sütunuyla aynıdır.
 * "kelimeler": Veritabanı bir alanın kategorisini vermediğinde (ör. blog yazısı kategorisi) grup bu kelimelerle bulunur
 * (Türkçe karakter ve büyük/küçük harf farkı gözetilmez). Sıra önemlidir: İlk eşleşen grup alınır.
 */
const IHTIYAC_KATEGORILERI = [
  // Dizi sırası EŞLEŞME önceliğidir ("Sınav Kaygısı" önce çocuk-ergen grubuna girsin diye);
  // açılır listedeki görünüm sırasını "sira" belirler.
  { kod: "gelisim",       sira: 5, etiket: "Gelişim, konuşma ve öğrenme desteği", renk: "#8a7412",
    kelimeler: ["konusma", "kekemelik", "duyu", "gunluk yasam", "ozel egitim", "gelisimsel"] },
  { kod: "cocuk_ergen",   sira: 4, etiket: "Çocuk ve ergenlerle ilgili konular", renk: "#b86e12",
    kelimeler: ["cocuk", "ergen", "sinav", "okul", "ebeveyn", "hiperaktivite", "otizm", "ogrenme"] },
  { kod: "travma_yas",    sira: 3, etiket: "Travma, yas ve kayıp",               renk: "#b0506a",
    kelimeler: ["travma", "kayip", "yas ve"] },
  { kod: "kaygi",         sira: 1, etiket: "Kaygı, yoğun endişe ve panik",       renk: "#3b6ea8",
    kelimeler: ["kaygi", "panik", "obsesif", "fobi", "endise"] },
  { kod: "duygudurum",    sira: 2, etiket: "Depresif duygular ve duygudurum",    renk: "#7a5aa6",
    kelimeler: ["depresyon", "bipolar", "uyku", "duygudurum"] },
  { kod: "iliski_aile",   sira: 6, etiket: "İlişki, çift ve aile sorunları",     renk: "#2a8383",
    kelimeler: ["cift", "iliski", "aile", "bosanma", "ofke"] },
  { kod: "yasam_ozguven", sira: 7, etiket: "Özgüven, iş ve yaşam zorlukları",    renk: "#3f8a4c",
    kelimeler: ["ozguven", "benlik", "kariyer", "tukenmislik", "yetiskin", "psikososyal", "bakim veren"] },
  { kod: "diger",         sira: 8, etiket: "Bağımlılık, yeme ve diğer konular",  renk: "#6b6f78",
    kelimeler: ["bagimlilik", "yeme"] },
];
