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

function ucretMetni(ucret) {
  if (!ucret) return "";
  if (ucret.min === ucret.max) return `${sayiBicimle(ucret.min)} ₺`;
  return `${sayiBicimle(ucret.min)}–${sayiBicimle(ucret.max)} ₺`;
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

/* İKONLAR — dışarıdan kütüphane yüklemeden, sayfa içine gömülü küçük çizimler */
const IKON_YOLLARI = {
  ara: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  konum: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  dogrulama: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  telefon: '<path d="M5 4h3.5l2 5-2.3 1.4a11 11 0 0 0 5.4 5.4L15 13.5l5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mesaj: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.2A8.5 8.5 0 1 1 21 11.5z"/>',
  geri: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  filtre: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  asagi: '<path d="m6 9 6 6 6-6"/>',
  saat: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  deneyim: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  dil: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  kilit: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  goz: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  gozKapali: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  posta: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  kisi: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/>',
  ucret: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>',
  yazi: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  tik: '<path d="m5 12 4.5 4.5L19 7"/>',
};
function ikon(ad) {
  return `<svg class="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKON_YOLLARI[ad] || ""}</svg>`;
}

document.addEventListener("DOMContentLoaded", siteAdiniYerlestir);
