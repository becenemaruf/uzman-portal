/*
 * SİTE AYARLARI
 * Marka adı ve sabit listeler burada, tek bir yerde durur.
 * Marka adı belli olduğunda sadece SITE.ad satırını değiştirmek yeterli;
 * tüm sayfalardaki logo yazısı ve sayfa başlıkları kendiliğinden güncellenir.
 */
const SITE = {
  ad: "Klinik Psikologlar",
  slogan: "Türkiye'nin klinik psikolog rehberi",
  alanAdi: "klinikpsikologlar.com.tr",
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

/*
 * UNVANLAR
 * TUM_UNVANLAR: Altyapının desteklediği bütün meslekler (veritabanı da hepsini kabul eder).
 * AKTIF_UNVANLAR: Şu an sitede yer alan meslekler. Platform yalnızca klinik psikologlarla başlıyor;
 * ileride başka bir mesleğe açılmak için bu listeye o mesleği eklemek yeterli.
 * Tek bir aktif unvan olduğunda arama panelindeki "unvan" filtresi kendiliğinden gizlenir.
 */
const TUM_UNVANLAR = [
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
const AKTIF_UNVANLAR = ["Klinik Psikolog"];
const UNVANLAR = TUM_UNVANLAR.filter((u) => AKTIF_UNVANLAR.includes(u));

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
  // "gelisim" grubu (dil-konuşma, ergoterapi, özel eğitim) şimdilik pasif; diğer meslekler açıldığında aktif olur.
  { kod: "gelisim",       sira: 5, aktif: false, etiket: "Gelişim, konuşma ve öğrenme desteği", renk: "#8a7412",
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

/* PROFİL DÜZENLEME LİSTELERİ (uzman paneli) */
const ILLER = ["Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır","Isparta","İstanbul","İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kilis","Kırıkkale","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Şanlıurfa","Şırnak","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak"];
const DIL_SECENEKLERI = ["Türkçe", "İngilizce", "Almanca", "Fransızca", "Arapça", "Kürtçe", "Rusça", "Farsça", "İspanyolca", "İtalyanca", "Azerbaycan Türkçesi", "Türk İşaret Dili"];
const UNVAN_ONEKLERI = ["Uzm.", "Dr.", "Uzm. Dr.", "Doç. Dr.", "Prof. Dr."];

/* SOSYAL MEDYA
 * "kalip" veritabanındaki kurallarla aynıdır (supabase/migrations/20261029090000_sosyal_medya.sql).
 * Uzman yalnızca kullanıcı adını yazarsa "adres" ile tam bağlantı oluşturulur. */
// Uzmanın profil sayfası için seçebileceği tema renkleri. Sayfada %10 yoğunlukta zemin rengi,
// bölüm başlıklarında ve simgelerde vurgu olarak kullanılır. (Veritabanındaki liste ile aynı olmalı.)
const PROFIL_RENKLERI = [
  { kod: "lacivert", ad: "Lacivert", renk: "#1c4a66" },
  { kod: "turkuaz", ad: "Turkuaz", renk: "#1f7a80" },
  { kod: "yesil", ad: "Yeşil", renk: "#2f6b4f" },
  { kod: "mor", ad: "Mor", renk: "#5b3f86" },
  { kod: "bordo", ad: "Bordo", renk: "#8a2e3b" },
  { kod: "altin", ad: "Altın", renk: "#8a6a3d" },
  { kod: "gri", ad: "Gri", renk: "#4f5b66" },
];

const SOSYAL_MEDYA = [
  { kod: "instagram", etiket: "Instagram", ornek: "kullaniciadi ya da https://instagram.com/kullaniciadi",
    kalip: /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?$/, adres: (k) => `https://www.instagram.com/${k}` },
  { kod: "linkedin", etiket: "LinkedIn", ornek: "https://www.linkedin.com/in/adiniz",
    kalip: /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9_%-]{2,100}\/?$/, adres: (k) => `https://www.linkedin.com/in/${k}` },
  { kod: "x_hesabi", etiket: "X (Twitter)", ornek: "kullaniciadi ya da https://x.com/kullaniciadi",
    kalip: /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?$/, adres: (k) => `https://x.com/${k}` },
  { kod: "youtube", etiket: "YouTube", ornek: "@kanaladi ya da https://www.youtube.com/@kanaladi",
    kalip: /^https:\/\/(www\.)?youtube\.com\/(@[A-Za-z0-9._-]{3,30}|channel\/[A-Za-z0-9_-]{10,40}|c\/[A-Za-z0-9._-]{1,100})\/?$/,
    adres: (k) => `https://www.youtube.com/@${k}` },
  { kod: "facebook", etiket: "Facebook", ornek: "sayfaadi ya da https://www.facebook.com/sayfaadi",
    kalip: /^https:\/\/(www\.)?facebook\.com\/([A-Za-z0-9.-]{2,80}|profile\.php\?id=[0-9]{5,20})\/?$/, adres: (k) => `https://www.facebook.com/${k}` },
  { kod: "tiktok", etiket: "TikTok", ornek: "@kullaniciadi ya da https://www.tiktok.com/@kullaniciadi",
    kalip: /^https:\/\/(www\.)?tiktok\.com\/@[A-Za-z0-9._]{2,24}\/?$/, adres: (k) => `https://www.tiktok.com/@${k}` },
  { kod: "web_sitesi", etiket: "Web sitesi", ornek: "https://www.siteniz.com.tr",
    kalip: /^https:\/\/[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+(\/[^\s<>"']*)?$/i, adres: null },
];

/* Uzmanın yazdığını tam bağlantıya çevirir; geçersizse null, boşsa "".
 * "@ad", "ad", "instagram.com/ad", "http://..." gibi yazımlar düzeltilir. */
function sosyalBaglanti(platform, girdi) {
  let d = String(girdi || "").trim();
  if (!d) return "";
  if (/^https?:\/\//i.test(d) || /^(www\.)?[a-z0-9-]+\.[a-z]/i.test(d)) {
    d = d.replace(/^http:\/\//i, "https://");
    if (!/^https:\/\//i.test(d)) d = "https://" + d;
    d = d.replace(/^https:\/\/m\./i, "https://www.").replace(/[?#].*$/, (ek) => (/profile\.php\?id=/.test(d) ? ek : ""));
  } else if (platform.adres) {
    d = platform.adres(d.replace(/^@/, ""));
  } else {
    d = "https://" + d;
  }
  if (d.length > 250) return null;
  return platform.kalip.test(d) ? d : null;
}
