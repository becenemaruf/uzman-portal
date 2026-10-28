/*
 * ANA SAYFA BLOG ALANI ("Uzmanlarımızdan yazılar")
 * Son yazıları veri katmanından alır ve kart olarak dizer.
 * Kapak görseli yerine kategori renginden üretilen sade bir desen kullanılır;
 * uzman bir kapak görseli yüklediğinde (kapak alanı) o gösterilir.
 */
(async function () {
  const bolum = document.getElementById("yazilar");
  const alan = document.getElementById("yaziKartlari");
  if (!bolum || !alan) return;

  const yazilar = await Veri.yazilariGetir(6);
  if (!yazilar.length) return; // hiç yazı yoksa bölüm gizli kalır

  // "2026-10-20" → "20 Ekim 2026"
  function tarihMetni(iso) {
    return new Date(iso + "T12:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  }

  alan.innerHTML = yazilar
    .map((y) => {
      const renk = uzmanlikRengi(y.kategori);
      const kapak = y.kapak
        ? `<img class="yazi-kapak-gorsel" src="${esc(y.kapak)}" alt="" loading="lazy">`
        : `<span class="yazi-kapak-isaret" aria-hidden="true">“</span>`;
      return `
        <article class="yazi-kart">
          <div class="yazi-kapak" style="--kapak-renk:${renk};--kapak-zemin:${saydamRenk(renk, 0.12)}">
            ${kapak}
            ${renkliEtiket(y.kategori)}
          </div>
          <div class="yazi-icerik">
            <h3><a class="yazi-baglanti" href="yazi.html?id=${encodeURIComponent(y.id)}">${esc(y.baslik)}</a></h3>
            <p class="yazi-ozet">${esc(y.ozet)}</p>
            <div class="yazi-alt">
              ${avatarHtml(y.yazar)}
              <div>
                <strong>${esc(y.yazar.ad)}</strong>
                <span>${tarihMetni(y.tarih)} · ${y.okumaDakika} dk okuma</span>
              </div>
            </div>
          </div>
        </article>`;
    })
    .join("");

  bolum.hidden = false;
})();
