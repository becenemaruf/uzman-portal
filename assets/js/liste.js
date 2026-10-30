/*
 * UZMAN LİSTESİ SAYFASI
 * 1) Uzmanları veri katmanından alır
 * 2) Filtre seçeneklerini bu verilerden otomatik oluşturur
 * 3) Kullanıcı her yazdığında ya da seçim yaptığında listeyi yeniden süzer
 * 4) Sonuçları sayfalara böler (sayfa başına SAYFA_BOYUTU kadar uzman)
 * 5) Kutu (grid) ve liste görünümü arasında geçiş sağlar; seçim tarayıcıda hatırlanır
 * 6) Filtreleri ve sayfa numarasını adres çubuğunda tutar: Profilden geri dönünce seçimler
 *    korunur, arama bağlantısı başkasıyla paylaşılabilir.
 */
(async function () {
  const $ = (id) => document.getElementById(id);
  const kartAlani = $("kartlar");
  const hareketAzalt = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  // Tek bir meslek aktifken unvan filtresinin anlamı yoktur; gizlenir ve arama paneli yeniden dizilir.
  if (UNVANLAR.length <= 1) {
    document.querySelector(".unvan-kutu").hidden = true; // öğe yerinde kalır, filtre kodu bozulmaz
    $("aramaFormu").classList.add("tek-unvan");
  }
  secenekleriDoldur("filtreUzmanlik", benzersiz(uzmanlar.flatMap((u) => u.uzmanliklar || [])));
  secenekleriDoldur("filtreYas", YAS_GRUPLARI);
  secenekleriDoldur("filtreYaklasim", benzersiz(uzmanlar.flatMap((u) => u.yaklasimlar || [])));
  secenekleriDoldur("filtreDil", benzersiz(uzmanlar.flatMap((u) => u.diller || [])));

  // İhtiyaç seçenekleri: "sira"ya göre dizilir, "Henüz emin değilim" en sonda kalır.
  const ihtiyacSecimi = $("filtreIhtiyac");
  const eminDegilim = ihtiyacSecimi.querySelector('[value="emin-degilim"]');
  [...IHTIYAC_KATEGORILERI]
    .filter((k) => k.aktif !== false)
    .sort((a, b) => a.sira - b.sira)
    .forEach((k) => eminDegilim.insertAdjacentHTML("beforebegin", `<option value="${k.kod}">${esc(k.etiket)}</option>`));

  // --- Filtre alanları ---
  const temelFiltreler = ["aramaMetni", "filtreIhtiyac", "filtreSehir", "filtreUnvan", "filtreGorusme", "filtreYeniDanisan"];
  const ekFiltreler = ["filtreUzmanlik", "filtreYas", "filtreYaklasim", "filtreCinsiyet", "filtreDil"];

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
    if (f.filtreIhtiyac && f.filtreIhtiyac !== "emin-degilim"
        && !(u.uzmanliklar || []).some((alan) => kategoriBul(alan).kod === f.filtreIhtiyac)) return false;
    if (f.filtreSehir && u.sehir !== f.filtreSehir) return false;
    if (f.filtreUnvan && u.unvan !== f.filtreUnvan) return false;
    if (f.filtreGorusme && !u.gorusme.includes(f.filtreGorusme)) return false;
    if (f.filtreYeniDanisan && !u.yeniDanisan) return false;
    if (f.filtreUzmanlik && !(u.uzmanliklar || []).includes(f.filtreUzmanlik)) return false;
    if (f.filtreYas && !(u.yasGruplari || []).includes(f.filtreYas)) return false;
    if (f.filtreYaklasim && !(u.yaklasimlar || []).includes(f.filtreYaklasim)) return false;
    if (f.filtreCinsiyet && u.cinsiyet !== f.filtreCinsiyet) return false;
    if (f.filtreDil && !(u.diller || []).includes(f.filtreDil)) return false;
    return true;
  }

  function kartHtml(u) {
    const profilAdresi = `uzman.html?id=${encodeURIComponent(u.id)}`;
    const etiketler = (u.uzmanliklar || []).slice(0, 3).map(renkliEtiket).join("");
    // Kartın vurgu rengi: ilk çalışma alanının rengi
    const kartRengi = u.uzmanliklar && u.uzmanliklar.length ? uzmanlikRengi(u.uzmanliklar[0]) : "#1c4a66";
    const konum = u.gorusme.includes("yuzyuze") ? `${u.ilce}, ${u.sehir}` : u.sehir;
    // Kartın tamamı tıklanabilir: isimdeki bağlantı (kart-baglanti) görünmez bir katmanla tüm kartı kaplar.
    // kart-govde: liste görünümünde ortadaki sütun olur.
    return `
      <article class="kart" style="--kart-renk:${kartRengi}">
        <span class="kart-vurgu" aria-hidden="true"></span>
        <div class="kart-ust">
          ${avatarHtml(u)}
          <div class="kart-kimlik">
            <h2><a class="kart-baglanti" href="${profilAdresi}">${esc(u.ad)}</a></h2>
            <div class="rozetler">
              <span class="rozet">${esc(u.unvan)}</span>
              ${u.dogrulandi ? `<span class="dogrulama-isaret" title="Unvanı doğrulandı">${ikon("dogrulama")}<span class="gorunmez">Unvanı doğrulandı</span></span>` : ""}
            </div>
          </div>
        </div>
        <div class="kart-govde">
          <p class="kart-meta">
            <span>${ikon("konum")}${esc(konum)}</span>
            <span>${ikon("video")}${esc(gorusmeMetni(u.gorusme))}</span>
          </p>
          ${etiketler ? `<div class="etiketler">${etiketler}</div>` : ""}
          <p class="tanitim">${esc(u.kisaTanitim)}</p>
        </div>
        <div class="kart-alt">
          <div class="kart-alt-bilgi">
            <span class="durum ${kabulDurumu(u).sinif}">${kabulDurumu(u).metin}</span>
          </div>
          <span class="kart-git" aria-hidden="true">Profili gör ${ikon("ileri")}</span>
        </div>
      </article>`;
  }

  // --- Durum ---
  let sonuclar = []; // filtreden geçen tüm uzmanlar
  let sayfa = 1;     // şu an gösterilen sayfa

  // Filtreler değişince: listeyi yeniden süz ve 1. sayfaya dön
  function filtrele() {
    const f = {};
    [...temelFiltreler, ...ekFiltreler].forEach((id) => (f[id] = degerOku(id)));

    // SIRALAMA
    // 1) Arama metni varsa: adı eşleşenler önce, sonra unvanı/alanı eşleşenler.
    // 2) Yeni danışan kabul edenler önce, kabul durumu güncel olmayanlar sonra.
    // 3) Aynı gruptakiler arasında ziyaretçiye özel rastgele sıra (gunlukSira, bkz. ortak.js).
    // Alfabetik sıra bilerek kullanılmaz: Adı A ile başlayan uzmanlar kalıcı avantaj kazanmasın.
    const aranan = normallestir(f.aramaMetni);
    const skor = (u) => {
      if (!aranan) return 0;
      if (normallestir(u.ad).includes(aranan)) return 3;
      if (normallestir([u.unvan, ...(u.uzmanliklar || [])].join(" ")).includes(aranan)) return 2;
      return 1;
    };
    const kabulOnceligi = (u) => ({ acik: 0, eski: 1 })[kabulDurumu(u).sinif] ?? 2;

    sonuclar = uzmanlar
      .filter((u) => uygunMu(u, f))
      .sort((a, b) => skor(b) - skor(a) || kabulOnceligi(a) - kabulOnceligi(b) || gunlukSira(a.id) - gunlukSira(b.id));
    sayfa = 1;

    $("eminDegilimNotu").hidden = f.filtreIhtiyac !== "emin-degilim";

    // Kaç ek filtre seçili? "Daha fazla filtre (2)" sayacı
    const ekSecili = ekFiltreler.filter((id) => degerOku(id)).length;
    $("filtreSayac").hidden = ekSecili === 0;
    $("filtreSayac").textContent = ekSecili;
    $("temizleDugme").hidden = ![...temelFiltreler, ...ekFiltreler].some((id) => degerOku(id));

    ciz();
  }

  // --- Filtrelerin adres çubuğunda tutulması ---
  const ADRES_ANAHTARLARI = {
    aramaMetni: "q", filtreIhtiyac: "ihtiyac", filtreSehir: "sehir", filtreUnvan: "unvan",
    filtreGorusme: "gorusme", filtreYeniDanisan: "yeni", filtreUzmanlik: "alan", filtreYas: "grup",
    filtreYaklasim: "yaklasim", filtreCinsiyet: "cinsiyet", filtreDil: "dil",
  };
  function adreseYaz() {
    const p = new URLSearchParams();
    Object.entries(ADRES_ANAHTARLARI).forEach(([id, anahtar]) => {
      const deger = degerOku(id);
      if (deger === true) p.set(anahtar, "1");
      else if (deger) p.set(anahtar, deger);
    });
    if (sayfa > 1) p.set("sayfa", sayfa);
    const yeniAdres = location.pathname + (p.toString() ? "?" + p : "") + location.hash;
    history.replaceState(null, "", yeniAdres);
  }
  function adrestenOku() {
    const p = new URLSearchParams(location.search);
    Object.entries(ADRES_ANAHTARLARI).forEach(([id, anahtar]) => {
      if (!p.has(anahtar)) return;
      const el = $(id);
      if (el.type === "checkbox") el.checked = p.get(anahtar) === "1";
      // Listede olmayan bir değer gelirse (eski ya da hatalı bağlantı) yok sayılır
      else if (el.tagName !== "SELECT" || [...el.options].some((o) => o.value === p.get(anahtar))) el.value = p.get(anahtar);
    });
    // Ek filtrelerden biri seçiliyse paneli açık getir
    if (ekFiltreler.some((id) => degerOku(id))) {
      $("ekFiltreler").hidden = false;
      $("ekFiltreDugme").setAttribute("aria-expanded", "true");
    }
    return Math.max(1, parseInt(p.get("sayfa"), 10) || 1);
  }

  // Seçili sayfadaki uzmanları ve sayfa numaralarını çizer
  function ciz() {
    const toplam = sonuclar.length;
    const sayfaSayisi = Math.max(1, Math.ceil(toplam / SAYFA_BOYUTU));
    sayfa = Math.min(Math.max(1, sayfa), sayfaSayisi);
    const bas = (sayfa - 1) * SAYFA_BOYUTU;
    const sayfadakiler = sonuclar.slice(bas, bas + SAYFA_BOYUTU);

    $("sonucSayisi").innerHTML = !uzmanlar.length
      ? ""
      : toplam > SAYFA_BOYUTU
        ? `<strong>${toplam}</strong> klinik psikolog bulundu <span class="aralik">· ${bas + 1}–${bas + sayfadakiler.length} arası gösteriliyor</span>`
        : `<strong>${toplam}</strong> klinik psikolog bulundu`;

    kartAlani.innerHTML = toplam
      ? sayfadakiler.map(kartHtml).join("")
      : !uzmanlar.length
      ? // Rehberde henüz hiç yayında profil yoksa (ör. yayının ilk günleri) filtre mesajı yerine bu gösterilir
        `<div class="bos-durum">
           <h2>Uzman profilleri çok yakında burada</h2>
           <p>Klinik psikologların başvuruları inceleniyor; unvanı doğrulanan uzmanlar yayımlandıkça bu listede yer alacak.</p>
           <a class="btn btn-ana" href="giris.html#kayit">Klinik psikolog musunuz? Profil oluşturun</a>
         </div>`
      : `<div class="bos-durum">
           <h2>Bu kriterlere uygun klinik psikolog bulunamadı</h2>
           <p>Birkaç filtreyi kaldırmayı ya da aramanızı genişletmeyi deneyin.</p>
           <button class="btn btn-cizgi" type="button" data-temizle>Filtreleri temizle</button>
         </div>`;

    sayfalamaCiz(sayfaSayisi);
    adreseYaz();
    // Duyuru kartları (varsa) liste arasına yerleşsin diye haber verilir (duyurular.js)
    document.dispatchEvent(new CustomEvent("kartlar-cizildi", { detail: { alan: kartAlani, sayfa } }));
  }

  // Sayfa numaraları: çok sayfa varsa "1 … 4 5 6 … 12" şeklinde kısaltılır
  function sayfalamaCiz(sayfaSayisi) {
    const alan = $("sayfalama");
    if (sayfaSayisi <= 1) {
      alan.hidden = true;
      alan.innerHTML = "";
      return;
    }
    const numaralar = [];
    for (let i = 1; i <= sayfaSayisi; i++) {
      if (i === 1 || i === sayfaSayisi || Math.abs(i - sayfa) <= 1) numaralar.push(i);
      else if (numaralar[numaralar.length - 1] !== "…") numaralar.push("…");
    }
    alan.innerHTML = `
      <button class="sayfa-dugme sayfa-ok" type="button" data-sayfa="${sayfa - 1}" ${sayfa === 1 ? "disabled" : ""} aria-label="Önceki sayfa">${ikon("geri")}<span class="sayfa-ok-yazi">Önceki</span></button>
      ${numaralar
        .map((n) =>
          n === "…"
            ? `<span class="sayfa-bosluk" aria-hidden="true">…</span>`
            : `<button class="sayfa-dugme" type="button" data-sayfa="${n}" ${n === sayfa ? 'aria-current="page"' : ""} aria-label="${n}. sayfa">${n}</button>`
        )
        .join("")}
      <button class="sayfa-dugme sayfa-ok" type="button" data-sayfa="${sayfa + 1}" ${sayfa === sayfaSayisi ? "disabled" : ""} aria-label="Sonraki sayfa"><span class="sayfa-ok-yazi">Sonraki</span>${ikon("ileri")}</button>`;
    alan.hidden = false;
  }

  function sayfayaGit(n) {
    sayfa = n;
    ciz();
    // Yeni sayfanın başına kaydır (yapışkan üst menünün altında kalmasın diye biraz pay bırakılır)
    const ust = $("sonucSatiri").getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top: ust, behavior: hareketAzalt ? "auto" : "smooth" });
  }

  // --- Görünüm: kutu (grid) / liste ---
  const GORUNUM_ANAHTARI = "uzmanGorunumu";
  function gorunumUygula(gorunum) {
    kartAlani.classList.toggle("liste-gorunumu", gorunum === "liste");
    document.querySelectorAll("[data-gorunum-sec]").forEach((d) => {
      d.setAttribute("aria-pressed", String(d.dataset.gorunumSec === gorunum));
    });
  }
  let kayitliGorunum = "grid";
  try {
    kayitliGorunum = localStorage.getItem(GORUNUM_ANAHTARI) === "liste" ? "liste" : "grid";
  } catch (e) {
    /* tarayıcı hafızası kapalıysa varsayılan görünümle devam edilir */
  }
  gorunumUygula(kayitliGorunum);
  document.querySelectorAll("[data-gorunum-sec]").forEach((d) => {
    d.addEventListener("click", () => {
      const secilen = d.dataset.gorunumSec;
      gorunumUygula(secilen);
      try {
        localStorage.setItem(GORUNUM_ANAHTARI, secilen);
      } catch (e) {
        /* kaydedilemezse sorun değil */
      }
    });
  });

  function temizle() {
    [...temelFiltreler, ...ekFiltreler].forEach((id) => {
      const el = $(id);
      if (el.type === "checkbox") el.checked = false;
      else el.value = "";
    });
    filtrele();
  }

  // --- Olaylar ---
  [...temelFiltreler, ...ekFiltreler].forEach((id) => {
    $(id).addEventListener(id === "aramaMetni" ? "input" : "change", filtrele);
  });
  $("temizleDugme").addEventListener("click", temizle);
  kartAlani.addEventListener("click", (e) => {
    if (e.target.closest("[data-temizle]")) temizle();
  });
  $("sayfalama").addEventListener("click", (e) => {
    const dugme = e.target.closest("[data-sayfa]");
    if (dugme && !dugme.disabled) sayfayaGit(Number(dugme.dataset.sayfa));
  });
  // Başlık butonu: tıklanınca arama kutusuna odaklanır, danışan hemen yazmaya başlar
  $("baslikDugme").addEventListener("click", () => $("aramaMetni").focus());
  $("ekFiltreDugme").addEventListener("click", () => {
    const panel = $("ekFiltreler");
    panel.hidden = !panel.hidden;
    $("ekFiltreDugme").setAttribute("aria-expanded", String(!panel.hidden));
  });

  const baslangicSayfasi = adrestenOku();
  filtrele();
  if (baslangicSayfasi > 1) {
    sayfa = baslangicSayfasi;
    ciz();
  }
})();
