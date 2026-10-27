/*
 * UZMAN LİSTESİ SAYFASI
 * 1) Uzmanları veri katmanından alır
 * 2) Filtre seçeneklerini bu verilerden otomatik oluşturur
 * 3) Kullanıcı her yazdığında ya da seçim yaptığında listeyi yeniden süzer
 */
(async function () {
  const $ = (id) => document.getElementById(id);
  const kartAlani = $("kartlar");

  const uzmanlar = await Veri.uzmanlariGetir();

  // --- Filtre seçeneklerini doldur ---
  // Seçenekler verilerden toplanır; yeni bir şehir ya da uzmanlık eklendiğinde listeye kendiliğinden girer.
  function benzersiz(dizi) {
    return [...new Set(dizi)].sort((a, b) => a.localeCompare(b, "tr"));
  }
  function secenekleriDoldur(selectId, degerler, etiketFn = (d) => d) {
    const select = $(selectId);
    degerler.forEach((d) => select.insertAdjacentHTML("beforeend", `<option value="${esc(d)}">${esc(etiketFn(d))}</option>`));
  }
  secenekleriDoldur("filtreSehir", benzersiz(uzmanlar.map((u) => u.sehir)));
  secenekleriDoldur("filtreUnvan", UNVANLAR.filter((un) => uzmanlar.some((u) => u.unvan === un)));
  secenekleriDoldur("filtreUzmanlik", benzersiz(uzmanlar.flatMap((u) => u.uzmanliklar || [])));
  secenekleriDoldur("filtreYas", YAS_GRUPLARI);
  secenekleriDoldur("filtreYaklasim", benzersiz(uzmanlar.flatMap((u) => u.yaklasimlar || [])));
  secenekleriDoldur("filtreDil", benzersiz(uzmanlar.flatMap((u) => u.diller || [])));
  secenekleriDoldur("filtreUcret", UCRET_SINIRLARI, (s) => `${sayiBicimle(s)} ₺'ye kadar`);

  // --- Filtre alanları ---
  const temelFiltreler = ["aramaMetni", "filtreSehir", "filtreUnvan", "filtreGorusme", "filtreYeniDanisan"];
  const ekFiltreler = ["filtreUzmanlik", "filtreYas", "filtreYaklasim", "filtreCinsiyet", "filtreDil", "filtreUcret"];

  function degerOku(id) {
    const el = $(id);
    return el.type === "checkbox" ? el.checked : el.value;
  }

  function uygunMu(u, f) {
    if (f.aramaMetni) {
      const aranan = normallestir(f.aramaMetni);
      const havuz = normallestir(
        [u.ad, u.unvan, u.sehir, u.ilce, u.kisaTanitim, ...(u.uzmanliklar || []), ...(u.yaklasimlar || [])].join(" ")
      );
      // Birden fazla kelime yazıldıysa hepsi geçmeli: "kaygı kadıköy"
      if (!aranan.split(/\s+/).every((kelime) => havuz.includes(kelime))) return false;
    }
    if (f.filtreSehir && u.sehir !== f.filtreSehir) return false;
    if (f.filtreUnvan && u.unvan !== f.filtreUnvan) return false;
    if (f.filtreGorusme && !u.gorusme.includes(f.filtreGorusme)) return false;
    if (f.filtreYeniDanisan && !u.yeniDanisan) return false;
    if (f.filtreUzmanlik && !(u.uzmanliklar || []).includes(f.filtreUzmanlik)) return false;
    if (f.filtreYas && !(u.yasGruplari || []).includes(f.filtreYas)) return false;
    if (f.filtreYaklasim && !(u.yaklasimlar || []).includes(f.filtreYaklasim)) return false;
    if (f.filtreCinsiyet && u.cinsiyet !== f.filtreCinsiyet) return false;
    if (f.filtreDil && !(u.diller || []).includes(f.filtreDil)) return false;
    // Ücret filtresi seçiliyse ücret bilgisi paylaşmayan uzmanlar gösterilmez
    if (f.filtreUcret && (!u.ucret || u.ucret.min > Number(f.filtreUcret))) return false;
    return true;
  }

  function kartHtml(u) {
    const profilAdresi = `uzman.html?id=${encodeURIComponent(u.id)}`;
    const etiketler = (u.uzmanliklar || []).slice(0, 3).map(renkliEtiket).join("");
    // Kartın vurgu rengi: ilk çalışma alanının rengi
    const kartRengi = u.uzmanliklar && u.uzmanliklar.length ? uzmanlikRengi(u.uzmanliklar[0]) : "#1d5c48";
    const konum = u.gorusme.includes("yuzyuze") ? `${u.ilce}, ${u.sehir}` : u.sehir;
    // Kartın tamamı tıklanabilir: isimdeki bağlantı (kart-baglanti) görünmez bir katmanla tüm kartı kaplar.
    return `
      <article class="kart" style="--kart-renk:${kartRengi}">
        <span class="kart-vurgu" aria-hidden="true"></span>
        <div class="kart-ust">
          ${avatarHtml(u)}
          <div class="kart-kimlik">
            <h2><a class="kart-baglanti" href="${profilAdresi}">${esc(u.ad)}</a></h2>
            <div class="rozetler">
              <span class="rozet">${esc(u.unvan)}</span>
              <span class="dogrulama-isaret" title="Unvanı doğrulandı">${ikon("dogrulama")}<span class="gorunmez">Unvanı doğrulandı</span></span>
            </div>
          </div>
        </div>
        <p class="kart-meta">
          <span>${ikon("konum")}${esc(konum)}</span>
          <span>${ikon("video")}${esc(gorusmeMetni(u.gorusme))}</span>
        </p>
        ${etiketler ? `<div class="etiketler">${etiketler}</div>` : ""}
        <p class="tanitim">${esc(u.kisaTanitim)}</p>
        <div class="kart-alt">
          <div class="kart-alt-bilgi">
            ${u.ucret ? `<span class="ucret">${ucretMetni(u.ucret)} <small>/ seans</small></span>` : `<span class="ucret ucret-yok">Ücret görüşmede</span>`}
            <span class="durum ${u.yeniDanisan ? "acik" : ""}">${u.yeniDanisan ? "Yeni danışan kabul ediyor" : "Şu an yeni danışan almıyor"}</span>
          </div>
          <span class="kart-git" aria-hidden="true">Profili gör ${ikon("ileri")}</span>
        </div>
      </article>`;
  }

  function listele() {
    const f = {};
    [...temelFiltreler, ...ekFiltreler].forEach((id) => (f[id] = degerOku(id)));

    // Sıralama: yeni danışan kabul edenler önce, sonra isme göre.
    const sonuc = uzmanlar
      .filter((u) => uygunMu(u, f))
      .sort((a, b) => (b.yeniDanisan - a.yeniDanisan) || a.ad.localeCompare(b.ad, "tr"));

    $("sonucSayisi").innerHTML = `<strong>${sonuc.length}</strong> uzman bulundu`;

    kartAlani.innerHTML = sonuc.length
      ? sonuc.map(kartHtml).join("")
      : `<div class="bos-durum">
           <h2>Bu kriterlere uygun uzman bulunamadı</h2>
           <p>Birkaç filtreyi kaldırmayı ya da aramanızı genişletmeyi deneyin.</p>
           <button class="btn btn-cizgi" type="button" data-temizle>Filtreleri temizle</button>
         </div>`;

    // Kaç ek filtre seçili? "Daha fazla filtre (2)" sayacı
    const ekSecili = ekFiltreler.filter((id) => degerOku(id)).length;
    $("filtreSayac").hidden = ekSecili === 0;
    $("filtreSayac").textContent = ekSecili;

    const herhangiSecili = [...temelFiltreler, ...ekFiltreler].some((id) => degerOku(id));
    $("temizleDugme").hidden = !herhangiSecili;
  }

  function temizle() {
    [...temelFiltreler, ...ekFiltreler].forEach((id) => {
      const el = $(id);
      if (el.type === "checkbox") el.checked = false;
      else el.value = "";
    });
    listele();
  }

  // --- Olaylar ---
  [...temelFiltreler, ...ekFiltreler].forEach((id) => {
    $(id).addEventListener(id === "aramaMetni" ? "input" : "change", listele);
  });
  $("temizleDugme").addEventListener("click", temizle);
  kartAlani.addEventListener("click", (e) => {
    if (e.target.closest("[data-temizle]")) temizle();
  });
  $("ekFiltreDugme").addEventListener("click", () => {
    const panel = $("ekFiltreler");
    panel.hidden = !panel.hidden;
    $("ekFiltreDugme").setAttribute("aria-expanded", String(!panel.hidden));
  });

  listele();
})();
