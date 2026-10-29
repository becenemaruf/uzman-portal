/*
 * ANA SAYFA MANŞET ALANI (kayan duyurular)
 * - Manşetler veri katmanından gelir; hiç manşet yoksa alan tamamen gizlenir.
 * - Mobilde parmakla kaydırılır (tarayıcının kendi kaydırma özelliği kullanılır).
 * - Slaytlar 7 saniyede bir kendiliğinden geçer; fare üzerindeyken, klavyeyle
 *   içinde gezinirken ya da kullanıcı durdurduğunda geçiş durur.
 * - Cihazında "hareketi azalt" ayarı açık olan kullanıcılarda otomatik geçiş hiç başlamaz.
 */
(async function () {
  const alan = document.getElementById("manset");
  if (!alan) return;

  // Yönetim panelindeki "Manşet alanını göster" ayarı kapalıysa alan hiç gösterilmez.
  const ayarlar = typeof SiteIcerik !== "undefined" ? await SiteIcerik.ayarlar() : {};
  if (ayarlar.manset_goster === false) return;

  const mansetler = await Veri.mansetleriGetir();
  if (!mansetler.length) return; // alan "hidden" olarak kalır

  const ray = document.getElementById("mansetRay");
  const noktalar = document.getElementById("mansetNoktalar");
  const durdurDugme = document.getElementById("mansetDurdur");
  const hareketAzalt = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TUR_ETIKETI = { duyuru: "Duyuru", yenilik: "Yenilik", reklam: "Reklam" };
  const SURE = 7000;
  const n = mansetler.length;

  // --- Slaytları oluştur ---
  ray.innerHTML = mansetler
    .map((m, i) => {
      const reklam = m.tur === "reklam";
      const disBaglanti = m.buton && /^https?:\/\//.test(m.buton.adres);
      // Reklam bağlantılarına "sponsored" işareti: arama motorlarına bunun ücretli bir bağlantı olduğunu bildirir
      const rel = disBaglanti ? ` target="_blank" rel="${reklam ? "sponsored " : ""}noopener"` : "";
      const butonSinif = m.tema === "yesil" ? "btn-beyaz" : "btn-ana";
      return `
        <article class="manset-slayt tema-${esc(m.tema || "yesil")} ${m.gorsel ? "gorselli" : ""} ${m.gorselMobil ? "mobil-gorselli" : ""}"
                 role="group" aria-roledescription="slayt" aria-label="${i + 1} / ${n}">
          ${m.gorselMobil ? `<img class="manset-gorsel-mobil" src="${esc(m.gorselMobil)}" alt="" loading="lazy">` : ""}
          <div class="manset-icerik">
            <span class="manset-etiket ${reklam ? "reklam" : ""}">${esc(TUR_ETIKETI[m.tur] || "Duyuru")}</span>
            <h2>${esc(m.baslik)}</h2>
            ${m.metin ? `<p>${esc(m.metin)}</p>` : ""}
            ${m.buton ? `<a class="btn ${butonSinif}" href="${esc(m.buton.adres)}"${rel}>${esc(m.buton.yazi)}</a>` : ""}
          </div>
          ${m.gorsel ? `<img class="manset-gorsel" src="${esc(m.gorsel)}" alt="" loading="lazy">` : ""}
        </article>`;
    })
    .join("");

  alan.hidden = false;

  if (n === 1) {
    document.getElementById("mansetKontroller").hidden = true;
    return;
  }

  noktalar.innerHTML = mansetler
    .map((_, i) => `<button class="manset-nokta" type="button" data-sira="${i}" aria-label="${i + 1}. duyuruya git"></button>`)
    .join("");

  // --- Gezinme ---
  let aktif = 0;
  function git(sira) {
    const hedef = (sira + n) % n;
    ray.scrollTo({ left: hedef * ray.clientWidth, behavior: hareketAzalt ? "auto" : "smooth" });
  }
  function noktalariGuncelle() {
    aktif = Math.round(ray.scrollLeft / ray.clientWidth);
    noktalar.querySelectorAll(".manset-nokta").forEach((nokta, i) => {
      nokta.setAttribute("aria-current", i === aktif ? "true" : "false");
    });
  }
  let kaydirmaZamani;
  ray.addEventListener("scroll", () => {
    clearTimeout(kaydirmaZamani);
    kaydirmaZamani = setTimeout(noktalariGuncelle, 60);
  });
  window.addEventListener("resize", () => git(aktif));

  document.getElementById("mansetGeri").addEventListener("click", () => git(aktif - 1));
  document.getElementById("mansetIleri").addEventListener("click", () => git(aktif + 1));
  noktalar.addEventListener("click", (e) => {
    const nokta = e.target.closest("[data-sira]");
    if (nokta) git(Number(nokta.dataset.sira));
  });

  // --- Otomatik geçiş ---
  const IKON_DURDUR = '<svg class="ikon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  const IKON_OYNAT = '<svg class="ikon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
  let kullaniciDurdurdu = hareketAzalt;
  let gecici = false; // fare üzerinde ya da klavye odağı içeride

  function durdurDugmesiniGuncelle() {
    durdurDugme.innerHTML = kullaniciDurdurdu ? IKON_OYNAT : IKON_DURDUR;
    durdurDugme.setAttribute("aria-label", kullaniciDurdurdu ? "Otomatik geçişi başlat" : "Otomatik geçişi durdur");
  }
  durdurDugme.addEventListener("click", () => {
    kullaniciDurdurdu = !kullaniciDurdurdu;
    durdurDugmesiniGuncelle();
  });

  alan.addEventListener("mouseenter", () => (gecici = true));
  alan.addEventListener("mouseleave", () => (gecici = false));
  alan.addEventListener("focusin", () => (gecici = true));
  alan.addEventListener("focusout", () => (gecici = false));
  ray.addEventListener("touchstart", () => (gecici = true), { passive: true });
  ray.addEventListener("touchend", () => setTimeout(() => (gecici = false), SURE), { passive: true });

  setInterval(() => {
    if (!kullaniciDurdurdu && !gecici && !document.hidden) git(aktif + 1);
  }, SURE);

  durdurDugmesiniGuncelle();
  noktalariGuncelle();
})();
