/*
 * ORTAK YARDIMCILAR
 * Birden fazla sayfanın kullandığı küçük fonksiyonlar.
 */

// Marka adını sayfadaki ilgili yerlere yazar (data-site-adi işaretli öğeler).
function siteAdiniYerlestir() {
  document.querySelectorAll("[data-site-adi]").forEach((el) => {
    el.textContent = SITE.ad;
  });
  document.title = document.title.replace("Uzman Portalı", SITE.ad);
  const yil = document.querySelector("[data-yil]");
  if (yil) yil.textContent = new Date().getFullYear();
}

// Güvenlik: Veriden gelen metni sayfaya yazmadan önce HTML karakterlerini etkisiz hale getirir.
// Böylece biri profil metnine kod yazsa bile o kod çalışmaz, düz yazı olarak görünür.
function esc(metin) {
  return String(metin ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Türkçe karakterlere duyarlı arama: "Şişli", "sisli", "ŞİŞLİ" aynı kabul edilir.
function normallestir(metin) {
  return String(metin ?? "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

// Fotoğraf yokken gösterilecek baş harfler (unvan kısaltmaları atlanır).
function basHarfler(ad) {
  const parcalar = ad.replace(/^(Uzm\.|Dr\.|Prof\.|Doç\.)\s*/g, "").replace(/(Uzm\.|Dr\.)\s*/g, "").split(/\s+/);
  const ilk = parcalar[0] ? parcalar[0][0] : "";
  const son = parcalar.length > 1 ? parcalar[parcalar.length - 1][0] : "";
  return (ilk + son).toLocaleUpperCase("tr");
}

// Her uzmana isminden türetilen, hep aynı kalan sakin bir avatar rengi.
const AVATAR_RENKLERI = ["#3d6b5c", "#5a6f8c", "#8a6a4f", "#6b5b7b", "#4f7a7a", "#7a6248"];
function avatarRengi(ad) {
  let toplam = 0;
  for (const harf of ad) toplam = (toplam * 31 + harf.charCodeAt(0)) >>> 0;
  return AVATAR_RENKLERI[toplam % AVATAR_RENKLERI.length];
}

/* Fotoğraf bağlantısı bozuksa (silinmiş/yüklenemeyen dosya) kırık resim yerine baş harfler gösterilir.
 * Tüm sayfalardaki .avatar resimleri için tek yerden çalışır. */
document.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains("avatar")) return;
    const ad = img.getAttribute("alt") || "";
    const yedek = document.createElement("div");
    yedek.className = img.className;
    yedek.style.background = avatarRengi(ad || "?");
    yedek.setAttribute("aria-hidden", "true");
    yedek.textContent = basHarfler(ad);
    img.replaceWith(yedek);
  },
  true
);

function avatarHtml(uzman, ekSinif = "") {
  if (uzman.foto) {
    return `<img class="avatar ${ekSinif}" src="${esc(uzman.foto)}" alt="${esc(uzman.ad)}" loading="lazy">`;
  }
  return `<div class="avatar ${ekSinif}" style="background:${avatarRengi(uzman.ad)}" aria-hidden="true">${esc(basHarfler(uzman.ad))}</div>`;
}

// 1500 → "1.500"
function sayiBicimle(sayi) {
  return Number(sayi).toLocaleString("tr-TR");
}

function gorusmeMetni(gorusme) {
  const online = gorusme.includes("online");
  const yuzyuze = gorusme.includes("yuzyuze");
  if (online && yuzyuze) return "Online ve yüz yüze";
  if (online) return "Yalnızca online";
  return "Yalnızca yüz yüze";
}

// "05550000001" → WhatsApp ve telefon bağlantıları için uluslararası biçim
function uluslararasiNumara(numara) {
  let rakam = String(numara).replace(/\D/g, "");
  if (rakam.startsWith("0")) rakam = "90" + rakam.slice(1);
  if (!rakam.startsWith("90")) rakam = "90" + rakam;
  return rakam;
}

// "05550000001" → "0555 000 00 01"
function okunurNumara(numara) {
  const r = String(numara).replace(/\D/g, "").replace(/^90/, "0");
  if (r.length !== 11) return numara;
  return `${r.slice(0, 4)} ${r.slice(4, 7)} ${r.slice(7, 9)} ${r.slice(9)}`;
}

/* İHTİYAÇ KATEGORİLERİ VE ÇALIŞMA ALANI RENKLERİ */
// Bir çalışma alanının ihtiyaç kategorisini bulur. Veritabanı kategoriyi doğrudan verirse o kullanılır.
function kategoriBul(alan, kod) {
  kod = kod || (window.ALAN_KATEGORILERI || {})[alan];
  if (kod) {
    const kayitli = IHTIYAC_KATEGORILERI.find((k) => k.kod === kod);
    if (kayitli) return kayitli;
  }
  const ad = normallestir(alan);
  return (
    IHTIYAC_KATEGORILERI.find((g) => g.kelimeler.some((k) => ad.includes(k))) ||
    IHTIYAC_KATEGORILERI.find((g) => g.kod === "diger")
  );
}
function uzmanlikRengi(alan) {
  return kategoriBul(alan).renk;
}
// "#3b6ea8" → "rgba(59, 110, 168, 0.15)"
function saydamRenk(hex, oran) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${oran})`;
}
// Rengi koyulaştırır (yazının açık zeminde rahat okunması için)
function koyuRenk(hex, oran = 0.3) {
  const n = parseInt(hex.slice(1), 16);
  const k = (d) => Math.round(d * (1 - oran));
  return `rgb(${k((n >> 16) & 255)}, ${k((n >> 8) & 255)}, ${k(n & 255)})`;
}
function renkliEtiket(alan) {
  const renk = uzmanlikRengi(alan);
  return `<span class="etiket etiket-renkli" style="background:${saydamRenk(renk, 0.15)};color:${koyuRenk(renk)}">${esc(alan)}</span>`;
}

/* TARİH */
// "2026-10-20" ya da tam tarih → "20 Ekim 2026"
function tarihMetni(deger) {
  const t = new Date(String(deger).length === 10 ? deger + "T12:00:00" : deger);
  if (isNaN(t)) return "";
  return t.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

/* YENİ DANIŞAN KABUL DURUMU
 * Uzman bu bilgiyi KABUL_GUNCELLIK_GUN günden uzun süre güncellemediyse
 * "kabul ediyor" demek yerine bilginin güncel olmadığını söyleriz.
 */
function kabulDurumu(u) {
  if (u.kabulGuncellenme) {
    const gecenGun = (Date.now() - new Date(u.kabulGuncellenme).getTime()) / 86400000;
    if (gecenGun > KABUL_GUNCELLIK_GUN) {
      return { sinif: "eski", metin: "Kabul durumu bir süredir güncellenmedi" };
    }
  }
  return u.yeniDanisan
    ? { sinif: "acik", metin: "Yeni danışan kabul ediyor" }
    : { sinif: "", metin: "Şu an yeni danışan almıyor" };
}

/* ADİL SIRALAMA
 * Her uzmana, kimliği ve bugünün tarihinden türetilen bir sıra numarası verilir.
 * Böylece sıralama her gün değişir ama gün içinde sabit kalır: Sayfa yenilense ya da
 * sayfalar arasında gezilse bile aynı uzman iki kez görünmez, kimse kalıcı olarak önde kalmaz.
 */
/* RASTGELE SIRA
 * Her ziyaretçi uzmanları kendine özel rastgele bir sırayla görür; böylece hiçbir uzman
 * herkes için kalıcı olarak üstte ya da altta kalmaz. Sıra ziyaret boyunca sabittir
 * (sayfa değiştirip geri dönünce liste karışmaz); tarayıcı sekmesi kapatılınca yeni sıra oluşur.
 * Tarayıcı depolaması kapalıysa o günün tarihine göre bir sıra kullanılır. */
function siraTohumu() {
  try {
    let t = sessionStorage.getItem("kpSiraTohumu");
    if (!t) {
      t = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem("kpSiraTohumu", t);
    }
    return t;
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}
function gunlukSira(id) {
  const anahtar = id + "|" + siraTohumu();
  let h = 2166136261;
  for (let i = 0; i < anahtar.length; i++) {
    h ^= anahtar.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/* İKONLAR — dışarıdan kütüphane yüklemeden, sayfa içine gömülü küçük çizimler */
const IKON_YOLLARI = {
  ara: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  konum: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-7M12 13a3 3 0 0 1 6 0v4"/>',
  x_hesabi: '<path d="M4 4l16 16M20 4 4 20"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  facebook: '<path d="M14 21v-8h3l.5-3.5H14V7.8c0-1 .3-1.8 1.8-1.8H18V3a24 24 0 0 0-2.7-.1C12.6 2.9 11 4.5 11 7.4v2.1H8V13h3v8"/>',
  tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.6 2.2 4.3 5 4.5"/>',
  web_sitesi: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  paylas: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  yol: '<path d="M3 11 21 3l-8 18-2-8z"/>',
  yenile: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  dogrulama: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  telefon: '<path d="M5 4h3.5l2 5-2.3 1.4a11 11 0 0 0 5.4 5.4L15 13.5l5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mesaj: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.2A8.5 8.5 0 1 1 21 11.5z"/>',
  geri: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  ileri: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  filtre: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  asagi: '<path d="m6 9 6 6 6-6"/>',
  saat: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  deneyim: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  dil: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  onay: '<path d="m5 12 4.5 4.5L19 7"/>',
  kilit: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  goz: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  gozKapali: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  posta: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  kisi: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/>',
  yazi: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  tik: '<path d="m5 12 4.5 4.5L19 7"/>',
  gonder: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  kapat: '<path d="M6 6l12 12M18 6 6 18"/>',
  disari: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  kep: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>',
  universite: '<path d="M3 9.5 12 4l9 5.5"/><path d="M4 21h16M5 18h14"/><path d="M6.5 10.5V18M10 10.5V18M14 10.5V18M17.5 10.5V18"/>',
  rozet: '<circle cx="12" cy="9" r="5.5"/><path d="m9.5 9 1.7 1.7L14.5 7.5"/><path d="M8.5 13.8 7 21l5-2.5 5 2.5-1.5-7.2"/>',
  katman: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  soru: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 17h.01"/>',
  bilgi: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
};
function ikon(ad) {
  return `<svg class="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKON_YOLLARI[ad] || ""}</svg>`;
}

// Mobilde kartlara dönüşen tablolarda her hücrenin üstünde sütun adı görünsün diye
// sütun başlıklarını hücrelere "data-etiket" olarak kopyalar.
function tabloEtiketleri() {
  document.querySelectorAll(".veri-tablosu").forEach((tablo) => {
    const basliklar = [...tablo.querySelectorAll("thead th")].map((th) => th.textContent.trim());
    tablo.querySelectorAll("tbody tr").forEach((tr) => {
      [...tr.children].forEach((hucre, i) => {
        if (basliklar[i]) hucre.setAttribute("data-etiket", basliklar[i]);
      });
    });
  });
}

// Mobil menü: ☰ düğmesi paneli açar/kapatır; bağlantıya tıklanınca, dışarı dokununca ya da Esc ile kapanır.
function mobilMenu() {
  const dugme = document.querySelector(".menu-dugme");
  const menu = document.getElementById("anaMenu");
  if (!dugme || !menu) return;
  const kapat = () => {
    menu.classList.remove("acik");
    dugme.setAttribute("aria-expanded", "false");
  };
  dugme.addEventListener("click", (e) => {
    e.stopPropagation();
    const acik = menu.classList.toggle("acik");
    dugme.setAttribute("aria-expanded", String(acik));
  });
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", kapat));
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) kapat();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("acik")) {
      kapat();
      dugme.focus();
    }
  });
}

/* Giriş yapmış uzman: üst menüde "Uzman Girişi / Profil Oluştur" yerine "Panelim" görünür.
 * Yalnızca tarayıcıda oturum kaydı olup olmadığına bakılır (kütüphane yüklenmez); asıl kontrol panel sayfasındadır. */
function oturumMenusu() {
  let var_ = false;
  try {
    const anahtar = Object.keys(localStorage).concat(Object.keys(sessionStorage)).find((k) => /^sb-.*-auth-token$/.test(k));
    var_ = !!anahtar;
  } catch (e) {
    return;
  }
  if (!var_) return;
  const kutu = document.querySelector(".menu-butonlar");
  if (!kutu || kutu.querySelector('[href="panel.html"]')) return;
  kutu.innerHTML = `<a class="btn btn-ana btn-kucuk" href="panel.html">Panelim</a>`;
}

document.addEventListener("DOMContentLoaded", siteAdiniYerlestir);
document.addEventListener("DOMContentLoaded", oturumMenusu);
document.addEventListener("DOMContentLoaded", mobilMenu);
document.addEventListener("DOMContentLoaded", tabloEtiketleri);
