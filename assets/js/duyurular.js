/*
 * ANA SAYFA DUYURU VE TANITIM KARTLARI
 * Üç yerleşim alanı (yönetim panelinden seçilir):
 *  - arama_alti  : Uzman arama bölümünün hemen altında
 *  - liste_arasi : Uzman listesinde her 12 kartta bir (sırayla dönerek)
 *  - sayfa_alti  : Ana sayfanın alt bölümünde ("Klinik psikolog musunuz?" alanının üstünde)
 * Her kart açıkça "Duyuru" etiketi taşır; uzman sonuçlarıyla karışmaz ve sıralamayı etkilemez.
 * Bir alanda yayında duyuru yoksa o alan hiç görünmez. "Duyuru alanlarını göster" ayarı kapalıysa hiçbiri görünmez.
 */
(async function () {
  const ARALIK = 12;
  const ayarlar = typeof SiteIcerik !== "undefined" ? await SiteIcerik.ayarlar() : {};
  if (ayarlar.duyurular_goster === false) return;
  const duyurular = await Veri.duyurulariGetir();
  if (!duyurular.length) return;

  function kart(d) {
    const dis = d.buton_adres && /^https?:\/\//.test(d.buton_adres);
    const buton =
      d.buton_yazi && d.buton_adres
        ? `<a class="btn btn-cizgi btn-kucuk" href="${esc(d.buton_adres)}"${dis ? ' target="_blank" rel="noopener"' : ""}>${esc(d.buton_yazi)}</a>`
        : "";
    return `<aside class="duyuru-kart ${d.gorsel_yolu ? "gorselli" : ""}" aria-label="Duyuru: ${esc(d.baslik)}">
      ${d.gorsel_yolu ? `<img class="duyuru-gorsel" src="${esc(d.gorsel_yolu)}" alt="" loading="lazy">` : ""}
      <div class="duyuru-govde">
        <span class="duyuru-etiket">Duyuru</span>
        <h3>${esc(d.baslik)}</h3>
        ${d.metin ? `<p>${esc(d.metin)}</p>` : ""}
        ${buton}
      </div>
    </aside>`;
  }

  // Sabit alanlar
  document.querySelectorAll(".duyuru-alani[data-konum]").forEach((alan) => {
    const liste = duyurular.filter((d) => d.konum === alan.dataset.konum);
    if (!liste.length) return;
    alan.innerHTML = liste.map(kart).join("");
    alan.classList.toggle("coklu", liste.length > 1);
    alan.hidden = false;
  });

  // Liste arası: uzman kartları her çizildiğinde yeniden yerleştirilir
  const araDuyurular = duyurular.filter((d) => d.konum === "liste_arasi");
  if (!araDuyurular.length) return;
  function yerlestir(alan, sayfa) {
    if (!alan) return;
    alan.querySelectorAll(":scope > .duyuru-kart").forEach((x) => x.remove());
    const kartlar = [...alan.children].filter((x) => !x.classList.contains("bos-durum"));
    if (kartlar.length <= ARALIK) return;
    let sira = ((sayfa || 1) - 1) * 3; // farklı sayfalarda farklı duyuru görünsün
    for (let i = ARALIK; i < kartlar.length; i += ARALIK) {
      const d = araDuyurular[sira++ % araDuyurular.length];
      kartlar[i - 1].insertAdjacentHTML("afterend", kart(d));
    }
  }
  document.addEventListener("kartlar-cizildi", (e) => yerlestir(e.detail.alan, e.detail.sayfa));
  yerlestir(document.getElementById("kartlar"), 1);
})();
