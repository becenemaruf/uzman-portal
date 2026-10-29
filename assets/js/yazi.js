/*
 * YAZI OKUMA SAYFASI (yazi.html?id=...)
 * Blog kartlarındaki ve uzman profillerindeki yazı bağlantıları buraya gelir.
 * Yazı metni düz yazı olarak saklanır; HTML olarak yorumlanmaz (güvenlik).
 */
(function () {
  const alan = document.getElementById("yaziIcerik");
  const id = new URLSearchParams(location.search).get("id");
  const kok = location.origin + location.pathname.replace(/[^/]*$/, "");

  function meta(ad, deger, ozellik = false) {
    const secici = ozellik ? `meta[property="${ad}"]` : `meta[name="${ad}"]`;
    let m = document.head.querySelector(secici);
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute(ozellik ? "property" : "name", ad);
      document.head.appendChild(m);
    }
    m.setAttribute("content", deger);
  }

  function durumGoster(baslik, metin, yeniden) {
    alan.innerHTML = `
      <div class="bos-durum" ${yeniden ? 'role="alert"' : ""} style="margin-bottom:48px">
        <h1 class="bos-baslik">${baslik}</h1>
        <p>${metin}</p>
        <div class="bos-durum-butonlar">
          ${yeniden ? `<button class="btn btn-ana" type="button" id="yenidenDene">${ikon("yenile")}Yeniden dene</button>` : ""}
          <a class="btn ${yeniden ? "btn-cizgi" : "btn-ana"}" href="index.html#yazilar">Tüm yazılar</a>
        </div>
      </div>`;
    if (yeniden) document.getElementById("yenidenDene").addEventListener("click", baslat);
  }

  async function baslat() {
    alan.innerHTML = `<p role="status">Yazı yükleniyor…</p>`;
    let y;
    try {
      y = await Veri.yaziGetir(id);
    } catch (e) {
      console.error(e);
      durumGoster("Yazı şu an yüklenemedi", "Sunucuya ulaşılamadı ya da bağlantınız yavaş. Lütfen tekrar deneyin.", true);
      return;
    }
    if (!y) {
      meta("robots", "noindex");
      document.title = `Yazı bulunamadı | ${SITE.ad}`;
      durumGoster("Bu yazı bulunamadı", "Yazı yayından kaldırılmış ya da adres hatalı yazılmış olabilir.", false);
      return;
    }

    const adres = `${kok}yazi.html?id=${encodeURIComponent(y.id)}`;
    const yazarAdresi = `uzman.html?id=${encodeURIComponent(y.yazar.id)}`;
    const baslik = `${y.baslik} | ${SITE.ad}`;
    const aciklama = (y.ozet || y.baslik).slice(0, 160);
    document.title = baslik;
    meta("description", aciklama);
    meta("og:title", y.baslik, true);
    meta("og:description", aciklama, true);
    meta("og:url", adres, true);
    if (y.yazar.ornek) meta("robots", "noindex");
    const link = document.createElement("link");
    link.rel = "canonical";
    link.href = adres;
    document.head.appendChild(link);
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: y.baslik,
      description: y.ozet || undefined,
      datePublished: y.tarih,
      dateModified: y.guncellenme || undefined,
      inLanguage: "tr-TR",
      mainEntityOfPage: adres,
      author: { "@type": "Person", name: y.yazar.ad, jobTitle: y.yazar.unvan, url: `${kok}${yazarAdresi}` },
    }).replace(/</g, "\\u003c");
    document.head.appendChild(ld);

    const govde = y.paragraflar.length
      ? y.paragraflar.map((p) => `<p>${esc(p)}</p>`).join("")
      : `<p class="yazi-not">Bu yazının tam metni henüz eklenmedi. Şimdilik özetini okuyabilirsiniz.</p>`;

    alan.innerHTML = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer">
        <ol>
          <li><a href="index.html">Ana sayfa</a></li>
          <li><a href="index.html#yazilar">Yazılar</a></li>
          <li><span aria-current="page">${esc(y.baslik)}</span></li>
        </ol>
      </nav>
      <article class="yazi-sayfa">
        ${y.kategori ? renkliEtiket(y.kategori) : ""}
        <h1>${esc(y.baslik)}</h1>
        ${y.ozet ? `<p class="yazi-giris">${esc(y.ozet)}</p>` : ""}
        <div class="yazi-yazar">
          ${avatarHtml(y.yazar)}
          <div>
            <a href="${yazarAdresi}">${esc(y.yazar.ad)}</a>
            <small>${esc(y.yazar.unvan)} · <time datetime="${esc(y.tarih)}">${tarihMetni(y.tarih)}</time>${y.okumaDakika ? ` · ${esc(y.okumaDakika)} dk okuma` : ""}</small>
          </div>
        </div>
        <div class="yazi-govde">${govde}</div>
        <p class="yazi-not">Bu yazı genel bilgilendirme amaçlıdır; bir uzmanla yapılacak görüşmenin yerine geçmez. Kendinize ya da bir yakınınıza ilişkin
          durumlar için bir ruh sağlığı uzmanına danışın. Acil bir durumdaysanız 112'yi arayın.</p>
      </article>`;
    const geri = document.querySelector(".geri-link");
    if (geri) geri.hidden = true;
  }

  baslat();
})();
