/*
 * ANA SAYFA "PSİKOLOJİ GÜNDEMİNDEN" ALANI
 * aktuelpsikoloji.com'un son haberlerini önizleme olarak gösterir.
 * İlk haber büyük kartta, diğerleri yanında başlık listesi olarak yer alır.
 * Haberler alınamazsa bölüm hiç görünmez (sayfanın geri kalanı etkilenmez).
 */
(async function () {
  const bolum = document.getElementById("haberler");
  const alan = document.getElementById("haberListesi");
  if (!bolum || !alan) return;

  const haberler = await Veri.haberleriGetir(6);
  if (!haberler.length) return;

  // Bugünkü haberlerde saat, eskilerde tarih gösterilir.
  function zamanMetni(iso) {
    if (!iso) return "";
    const t = new Date(iso);
    if (isNaN(t)) return "";
    const bugun = new Date();
    if (t.toDateString() === bugun.toDateString()) {
      return "Bugün " + t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    }
    return t.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  }
  const zamanEtiketi = (h) => (h.tarih ? `<time datetime="${esc(h.tarih)}">${esc(zamanMetni(h.tarih))}</time>` : "");

  const [ilk, ...digerleri] = haberler;
  const oneCikan = `
    <article class="haber-one-cikan">
      <div class="haber-meta">${ilk.kategori ? `<span class="haber-kategori">${esc(ilk.kategori)}</span>` : ""}${zamanEtiketi(ilk)}</div>
      <h3><a class="haber-baglanti" href="${esc(ilk.baglanti)}" target="_blank" rel="noopener">${esc(ilk.baslik)}</a></h3>
      ${ilk.ozet ? `<p>${esc(ilk.ozet)}</p>` : ""}
      <span class="haber-oku" aria-hidden="true">Haberi oku ${ikon("disari")}</span>
    </article>`;
  const liste = digerleri.length
    ? `<ol class="haber-listesi">${digerleri
        .map(
          (h) => `
        <li>
          <a href="${esc(h.baglanti)}" target="_blank" rel="noopener">
            <span class="haber-liste-baslik">${esc(h.baslik)}</span>
            <span class="haber-meta">${h.kategori ? `<span class="haber-kategori">${esc(h.kategori)}</span>` : ""}${zamanEtiketi(h)}</span>
          </a>
        </li>`
        )
        .join("")}</ol>`
    : "";

  alan.innerHTML = oneCikan + liste;
  bolum.hidden = false;
})();
