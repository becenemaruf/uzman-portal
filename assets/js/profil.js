/*
 * UZMAN PROFİL SAYFASI
 * Adres çubuğundaki ?id=... değerine göre uzmanı veri katmanından alır
 * ve profil bölümlerini oluşturur. Uzmanın doldurmadığı bölümler hiç gösterilmez.
 *
 * Durumlar:
 *  - Yükleniyor: ekran okuyuculara da duyurulan bir bekleme alanı.
 *  - Bulunamadı (hatalı adres, kaldırılmış/yayında olmayan profil): açıklama + uzman listesine bağlantı,
 *    sayfa arama motorlarına "dizine ekleme" denir.
 *  - Bağlantı hatası / zaman aşımı: açıklama + "Yeniden dene" düğmesi.
 *  - Profil: tüm bölümler; eksik alanlar hata üretmeden atlanır.
 */
(function () {
  const alan = document.getElementById("profilIcerik");
  // Hem ?id= hem ?slug= kabul edilir (eski bağlantılar bozulmasın).
  const parametreler = new URLSearchParams(location.search);
  const id = parametreler.get("id") || parametreler.get("slug");

  // Sayfanın kalıcı adresi (canonical). Alan adı değişse de doğru çalışır.
  const sayfaKoku = location.origin + location.pathname.replace(/[^/]*$/, "");
  const kaliciAdres = (slug) => `${sayfaKoku}uzman.html?id=${encodeURIComponent(slug)}`;

  function yukleniyorGoster() {
    alan.setAttribute("aria-busy", "true");
    alan.innerHTML = `
      <div class="profil-iskelet" role="status">
        <span class="gorunmez">Profil yükleniyor…</span>
        <div class="iskelet-satir iskelet-avatar"></div>
        <div class="iskelet-satir" style="width:55%"></div>
        <div class="iskelet-satir" style="width:35%"></div>
        <div class="iskelet-satir" style="width:80%"></div>
      </div>`;
  }

  function bulunamadiGoster() {
    alan.removeAttribute("aria-busy");
    metaAyarla("robots", "noindex");
    document.title = `Profil bulunamadı | ${SITE.ad}`;
    alan.innerHTML = `
      <div class="bos-durum" style="margin-bottom:48px">
        <h1 class="bos-baslik">Bu profil bulunamadı</h1>
        <p>Profil yayından kaldırılmış ya da adres hatalı yazılmış olabilir.</p>
        <a class="btn btn-ana" href="index.html#aramaFormu">Klinik psikologlara göz atın</a>
      </div>`;
  }

  function hataGoster() {
    alan.removeAttribute("aria-busy");
    alan.innerHTML = `
      <div class="bos-durum" role="alert" style="margin-bottom:48px">
        <h1 class="bos-baslik">Profil şu an yüklenemedi</h1>
        <p>Sunucuya ulaşılamadı ya da bağlantınız yavaş. İnternet bağlantınızı kontrol edip tekrar deneyebilirsiniz.</p>
        <div class="bos-durum-butonlar">
          <button class="btn btn-ana" type="button" id="yenidenDene">${ikon("yenile")}Yeniden dene</button>
          <a class="btn btn-cizgi" href="index.html">Ana sayfaya dön</a>
        </div>
      </div>`;
    document.getElementById("yenidenDene").addEventListener("click", baslat);
  }

  async function baslat() {
    yukleniyorGoster();
    let u;
    try {
      u = await Veri.uzmanGetir(id);
    } catch (e) {
      console.error(e);
      hataGoster();
      return;
    }
    if (!u) {
      bulunamadiGoster();
      return;
    }
    try {
      ciz(u);
    } catch (e) {
      // Beklenmeyen bir veri biçimi sayfayı boş bırakmasın.
      console.error(e);
      hataGoster();
    }
  }

  /* ---------- SEO: başlık, açıklama, canonical, paylaşım etiketleri, yapılandırılmış veri ---------- */
  function metaAyarla(ad, deger, ozellik = false) {
    const secici = ozellik ? `meta[property="${ad}"]` : `meta[name="${ad}"]`;
    let m = document.head.querySelector(secici);
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute(ozellik ? "property" : "name", ad);
      document.head.appendChild(m);
    }
    m.setAttribute("content", deger);
  }

  function seoAyarla(u, konum) {
    const adres = kaliciAdres(u.id);
    const baslik = `${u.ad} — ${u.unvan}${u.sehir ? ", " + u.sehir : ""} | ${SITE.ad}`;
    const aciklama = (
      u.kisaTanitim ||
      `${u.ad}, ${konum ? konum + " " : ""}${u.unvan}. Çalışma alanları, görüşme bilgileri ve iletişim seçenekleri.`
    ).slice(0, 160);
    const gorsel = u.foto ? new URL(u.foto, sayfaKoku).href : `${sayfaKoku}assets/img/marka/isaret-512.png`;

    document.title = baslik;
    metaAyarla("description", aciklama);
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = adres;

    metaAyarla("og:type", "profile", true);
    metaAyarla("og:site_name", SITE.ad, true);
    metaAyarla("og:locale", "tr_TR", true);
    metaAyarla("og:title", baslik, true);
    metaAyarla("og:description", aciklama, true);
    metaAyarla("og:url", adres, true);
    metaAyarla("og:image", gorsel, true);
    metaAyarla("twitter:card", "summary");
    // Örnek (deneme) profiller arama motorlarında listelenmesin.
    if (u.ornek) metaAyarla("robots", "noindex");

    // Person + ProfilePage + BreadcrumbList (schema.org). Doğrulama ya da ruhsat iddiası İÇERMEZ;
    // telefon/e-posta gibi iletişim bilgileri de bilinçli olarak eklenmez.
    const kisi = {
      "@type": "Person",
      name: u.ad,
      jobTitle: u.unvan,
      url: adres,
      image: u.foto ? gorsel : undefined,
      description: u.kisaTanitim || undefined,
      knowsLanguage: u.diller.length ? u.diller : undefined,
      knowsAbout: u.uzmanliklar.length ? u.uzmanliklar : undefined,
      address: u.sehir
        ? {
            "@type": "PostalAddress",
            addressLocality: u.gorusme.includes("yuzyuze") && u.ilce ? u.ilce : undefined,
            addressRegion: u.sehir,
            addressCountry: "TR",
          }
        : undefined,
    };
    const veri = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ProfilePage",
          url: adres,
          name: baslik,
          dateModified: u.guncellenme || undefined,
          inLanguage: "tr-TR",
          mainEntity: kisi,
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana sayfa", item: `${sayfaKoku}` },
            { "@type": "ListItem", position: 2, name: "Klinik psikolog bul", item: `${sayfaKoku}index.html` },
            { "@type": "ListItem", position: 3, name: u.ad, item: adres },
          ],
        },
      ],
    };
    let betik = document.getElementById("yapilandirilmisVeri");
    if (!betik) {
      betik = document.createElement("script");
      betik.type = "application/ld+json";
      betik.id = "yapilandirilmisVeri";
      document.head.appendChild(betik);
    }
    // "<" kaçırılır: veri içindeki bir metin </script> ile betiği kapatamasın.
    betik.textContent = JSON.stringify(veri).replace(/</g, "\\u003c");
  }

  /* ---------- Profil çizimi ---------- */
  function ciz(u) {
    // Eksik alanlar hata üretmesin diye diziler her zaman dizi olarak ele alınır.
    ["gorusme", "diller", "uzmanliklar", "yaklasimlar", "yasGruplari", "egitim", "sertifikalar", "sss", "yazilar", "hakkinda"].forEach(
      (k) => {
        if (!Array.isArray(u[k])) u[k] = [];
      }
    );

    // u.iletisim YALNIZCA uzmanın yayımlanmasına izin verdiği kanalları içerir.
    // İzin verilmeyen numara/adres veri katmanından hiç gelmez, bu yüzden sayfaya da yazılamaz.
    const iletisim = u.iletisim || {};
    const yuzyuze = u.gorusme.includes("yuzyuze");
    const online = u.gorusme.includes("online");
    const konum = [yuzyuze ? u.ilce : "", u.sehir].filter(Boolean).join(", ");

    seoAyarla(u, konum);

    // --- Yardımcı parçalar ---
    const etiketler = (dizi) => `<div class="etiketler">${dizi.map((e) => `<span class="etiket">${esc(e)}</span>`).join("")}</div>`;
    // Profil bölümleri: Başlık, simgesiyle birlikte renkli bir şerit olarak gösterilir.
    function blok(baslik, icerik, ikonAdi = "bilgi") {
      return `<section class="blok blok-bolum">
        <h2 class="blok-baslik"><span class="blok-ikon" aria-hidden="true">${ikon(ikonAdi)}</span>${baslik}</h2>
        <div class="blok-icerik">${icerik}</div>
      </section>`;
    }
    const doluMu = (dizi) => Array.isArray(dizi) && dizi.length > 0;

    /* İLETİŞİM KANALLARI
     * Her kanal, uzmanın profil ayarlarında verdiği izne göre bağımsız çalışır:
     *  - İzin verilen kanal: renkli, tıklanabilir bağlantı.
     *  - İzin verilmeyen kanal: gri, tıklanamaz; içinde hiçbir bağlantı, numara ya da adres bulunmaz.
     * Hazır mesaj, danışanı sağlık bilgisi paylaşmaya yönlendirmez.
     */
    const ilkMesaj = `Merhaba ${u.ad}, ${SITE.ad} üzerindeki profilinizi gördüm. Görüşme hakkında bilgi almak istiyorum.`;
    const KANALLAR = [
      {
        kod: "telefon", etiket: "Uzmanı Ara", kisaEtiket: "Ara", ikon: "telefon", sinif: "btn-ara",
        adres: (n) => `tel:+${uluslararasiNumara(n)}`,
        altMetin: (n) => okunurNumara(n),
      },
      {
        kod: "whatsapp", etiket: "WhatsApp ile İletişim", kisaEtiket: "WhatsApp", ikon: "mesaj", sinif: "btn-wa",
        adres: (n) => `https://wa.me/${uluslararasiNumara(n)}?text=${encodeURIComponent(ilkMesaj)}`,
        altMetin: () => "Hazır bir mesajla açılır",
        yeniSekme: true,
      },
      {
        kod: "eposta", etiket: "E-posta Gönder", kisaEtiket: "E-posta", ikon: "posta", sinif: "btn-eposta",
        adres: (e) => `mailto:${e}?subject=${encodeURIComponent("Görüşme talebi")}&body=${encodeURIComponent(ilkMesaj)}`,
        altMetin: (e) => e,
      },
    ];
    const aktifKanallar = KANALLAR.filter((k) => iletisim[k.kod]);
    const kanalYok = aktifKanallar.length === 0;

    function kanalButonu(k) {
      const deger = iletisim[k.kod];
      if (!deger) {
        // Pasif buton: <a> değil <span>; href, numara ya da adres içermez.
        return `<span class="btn btn-blok btn-iletisim pasif" aria-disabled="true">
            ${ikon(k.ikon)}<span class="btn-metin">${k.etiket}<small>Uzman bu kanalı kullanmıyor</small></span>
          </span>`;
      }
      // Örnek (deneme) profiller: Buton görünür ama hiçbir numarayı aramaz, WhatsApp ya da e-posta açmaz.
      if (u.ornek) {
        return `<button class="btn btn-blok btn-iletisim ${k.sinif}" type="button" data-ornek-kanal>
            ${ikon(k.ikon)}<span class="btn-metin">${k.etiket}<small>Örnek profil — gerçek bir kişiye bağlı değil</small></span>
          </button>`;
      }
      return `<a class="btn btn-blok btn-iletisim ${k.sinif}" href="${esc(k.adres(deger))}"${k.yeniSekme ? ' target="_blank" rel="noopener"' : ""}>
          ${ikon(k.ikon)}<span class="btn-metin">${k.etiket}<small>${esc(k.altMetin(deger))}</small></span>
        </a>`;
    }

    const mesajButonu = (kisa = false) =>
      `<button class="btn ${kisa ? "" : "btn-blok"} btn-iletisim btn-mesaj" type="button" ${u.ornek ? "data-ornek-kanal" : "data-mesaj-ac"}>
        ${ikon("gonder")}<span class="btn-metin">${kisa ? "Mesaj gönder" : `Uzmana Mesaj Gönder<small>Platform üzerinden iletilir</small>`}</span>
      </button>`;

    // Mobilde ekranın altına sabitlenen kısa çubuk: yalnızca kullanılabilir kanallar.
    function mobilCubuk() {
      if (kanalYok) return mesajButonu(true);
      if (u.ornek) {
        return aktifKanallar
          .map((k) => `<button class="btn btn-iletisim ${k.sinif}" type="button" data-ornek-kanal>${ikon(k.ikon)}${k.kisaEtiket}</button>`)
          .join("");
      }
      return aktifKanallar
        .map((k) => `<a class="btn btn-iletisim ${k.sinif}" href="${esc(k.adres(iletisim[k.kod]))}"${k.yeniSekme ? ' target="_blank" rel="noopener"' : ""}>${ikon(k.ikon)}${k.kisaEtiket}</a>`)
        .join("");
    }

    // --- Yol tarifi: yalnızca yüz yüze çalışan ve muayenehane adresini yayımlamayı seçen uzmanlarda ---
    const s = u.seans || {};
    // Uzman adrese ilçe/il yazmışsa tekrar eklenmez.
    const adresKucuk = String(s.adres || "").toLocaleLowerCase("tr");
    const acikAdres =
      yuzyuze && s.adres
        ? [s.adres, ...[u.ilce, u.sehir].filter((p) => p && !adresKucuk.includes(String(p).toLocaleLowerCase("tr")))].join(", ")
        : "";
    const yolTarifiAdresi = acikAdres
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(acikAdres)}`
      : "";

    // --- Doğrulama rozeti ---
    // Yalnızca yöneticinin belgeleri inceleyip yayına aldığı gerçek profillerde gösterilir (bkz. veri.js → dogrulandi).
    // İsmin hemen yanındaki onay işareti: dokununca/tıklayınca (ve klavyeyle) açıklama balonu açılır.
    const isimRozeti = u.dogrulandi
      ? `<span class="onay-sarici">
          <button class="onay-dugme" type="button" aria-expanded="false" aria-controls="onayBalonu" aria-label="Unvanı doğrulandı — ayrıntıyı göster">${ikon("dogrulama")}</button>
          <span class="onay-balon" id="onayBalonu" role="tooltip" hidden>
            <strong>Unvanı doğrulandı</strong>
            Psikoloji lisans ve klinik psikoloji yüksek lisans diplomaları platform yönetimi tarafından incelenmiştir.
            <small>Bu inceleme bir ruhsat, kamu kurumu onayı ya da bağımsız çalışma izni değildir; hizmetin niteliğine
            veya sonuçlarına ilişkin bir garanti anlamına gelmez.</small>
          </span>
        </span>`
      : "";
    const rozet = u.dogrulandi
      ? ""
      : u.ornek
        ? `<p class="ornek-rozet">${ikon("bilgi")}Örnek profil — gerçek bir uzmana ait değildir, unvan doğrulaması yapılmamıştır.</p>`
        : "";

    // --- Üst kısım ---
    const ozet = [
      konum ? `<span>${ikon("konum")}${esc(konum)}</span>` : "",
      u.deneyimYili ? `<span>${ikon("deneyim")}${esc(u.deneyimYili)} yıllık mesleki deneyim</span>` : "",
      doluMu(u.diller) ? `<span>${ikon("dil")}${esc(u.diller.join(", "))}</span>` : "",
    ].join("");

    const kabul = kabulDurumu(u);

    // Seans biçimi ve hedef kitle: üst kısımda etiket olarak.
    const bicimEtiketleri = [
      yuzyuze ? `<span class="etiket etiket-bicim">${ikon("konum")}Yüz yüze</span>` : "",
      online ? `<span class="etiket etiket-bicim">${ikon("video")}Online</span>` : "",
    ].join("");
    const kitleEtiketleri = u.yasGruplari.map((g) => `<span class="etiket etiket-kitle">${esc(g)}</span>`).join("");
    const ustEtiketler =
      bicimEtiketleri || kitleEtiketleri
        ? `<div class="profil-etiket-satirlari">
            ${bicimEtiketleri ? `<div class="etiket-satiri"><span class="etiket-satir-baslik">Görüşme</span><div class="etiketler">${bicimEtiketleri}</div></div>` : ""}
            ${kitleEtiketleri ? `<div class="etiket-satiri"><span class="etiket-satir-baslik">Çalıştığı gruplar</span><div class="etiketler">${kitleEtiketleri}</div></div>` : ""}
          </div>`
        : "";

    const ust = `
      <section class="blok profil-ust-blok">
        <div class="profil-bas">
          ${avatarHtml(u, "avatar-buyuk")}
          <div class="profil-kimlik">
            <h1>${esc(u.ad)}${isimRozeti}</h1>
            <div class="rozetler">
              <span class="rozet">${esc(u.unvan)}</span>
              <span class="durum ${kabul.sinif}">${kabul.metin}</span>
            </div>
            ${rozet}
          </div>
          <div class="profil-araclar">
            <button class="btn btn-cizgi btn-kucuk" type="button" id="paylasDugme">${ikon("paylas")}Paylaş</button>
          </div>
        </div>
        <p class="paylas-bildirim" id="paylasBildirim" role="status" aria-live="polite"></p>
        ${ustEtiketler}
        ${u.kisaTanitim ? `<p class="tanitim">${esc(u.kisaTanitim)}</p>` : ""}
        ${ozet ? `<div class="ozet-bilgiler">${ozet}</div>` : ""}
        ${u.guncellenme && tarihMetni(u.guncellenme) ? `<p class="guncellik">Profil bilgileri en son <time datetime="${esc(u.guncellenme)}">${tarihMetni(u.guncellenme)}</time> tarihinde güncellendi.</p>` : ""}
      </section>`;

    // --- Hakkımda ---
    let hakkinda = "";
    if (doluMu(u.hakkinda)) {
      const uzun = u.hakkinda.join(" ").length > 480;
      hakkinda = blok(
        "Hakkımda",
        `<div class="uzun-metin ${uzun ? "kapali" : ""}" id="hakkindaMetni">${u.hakkinda.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
         ${uzun ? `<button class="link-buton" type="button" id="devamiDugme" aria-expanded="false" aria-controls="hakkindaMetni">Devamını oku</button>` : ""}`,
        "kisi"
      );
    }

    // --- Uzmanlık, yaklaşım, gruplar ---
    let alanlar = "";
    if (doluMu(u.uzmanliklar) || doluMu(u.yaklasimlar)) {
      alanlar = blok(
        "Çalışma alanları",
        (doluMu(u.uzmanliklar) ? `<h3>Uzmanlık alanları</h3><div class="etiketler">${u.uzmanliklar.map(renkliEtiket).join("")}</div>` : "") +
          (doluMu(u.yaklasimlar) ? `<h3>Terapi yaklaşımları ve ekoller</h3>${etiketler(u.yaklasimlar)}` : ""),
        "katman"
      );
    }

    // --- Seans bilgileri (boşsa hiç gösterilmez) ---
    const seansSatirlari = [
      ["Görüşme şekli", u.gorusme.length ? gorusmeMetni(u.gorusme) : ""],
      ["Seans süresi", s.sure],
      ["Online platform", online ? s.onlinePlatform : ""],
      ["Muayenehane", acikAdres],
    ].filter(([, deger]) => deger);
    const seans = seansSatirlari.length
      ? blok(
          "Seans bilgileri",
          `<dl class="seans-tablo">${seansSatirlari.map(([b, d]) => `<div><dt>${b}</dt><dd>${esc(d)}</dd></div>`).join("")}</dl>
           ${yolTarifiAdresi ? `<a class="btn btn-cizgi btn-kucuk yol-tarifi" href="${esc(yolTarifiAdresi)}" target="_blank" rel="noopener">${ikon("yol")}Yol tarifi al<span class="gorunmez"> (Google Haritalar yeni sekmede açılır)</span></a>` : ""}`,
          "saat"
        )
      : "";

    // --- Eğitim ---
    let egitim = "";
    if (doluMu(u.egitim) || doluMu(u.sertifikalar)) {
      const liste = (dizi) => `<ul class="liste-sade">${dizi.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
      egitim = blok(
        "Eğitim ve yetkinlik",
        (doluMu(u.egitim) ? `<h3>Akademik eğitim</h3>${liste(u.egitim)}` : "") +
          (doluMu(u.sertifikalar) ? `<h3>Mesleki eğitimler ve sertifikalar</h3>${liste(u.sertifikalar)}` : ""),
        "kep"
      );
    }

    // --- Yazılar: her başlık yazının kendi sayfasına gider ---
    const yazilarListesi = u.yazilar.filter((y) => y && y.baslik && y.id);
    const yazilar = yazilarListesi.length
      ? blok(
          "Yazıları",
          `<ul class="yazi-listesi">${yazilarListesi
            .map((y) => `<li><a href="yazi.html?id=${encodeURIComponent(y.id)}"><span>${esc(y.baslik)}</span><small>${esc(y.tarih)}</small></a></li>`)
            .join("")}</ul>`,
          "yazi"
        )
      : "";

    // --- Sık sorulan sorular ---
    const sssListesi = u.sss.filter((x) => x && x.soru && x.cevap);
    const sss = sssListesi.length
      ? blok(
          "Sık sorulan sorular",
          `<div class="sss">${sssListesi.map((x) => `<details><summary>${esc(x.soru)}</summary><p>${esc(x.cevap)}</p></details>`).join("")}</div>`,
          "soru"
        )
      : "";

    // --- Yan kutu: iletişim ---
    // Var olmayan bir hizmeti (ör. bekleme listesi) vaat etmeden, uzmanın beyanını aktarırız.
    let kabulNotu = "";
    if (kabul.sinif === "eski") {
      kabulNotu = `<p class="kapali-uyari">Uzman bu bilgiyi en son ${tarihMetni(u.kabulGuncellenme)} tarihinde güncelledi. Yeni danışan kabul edip etmediğini iletişime geçerek öğrenebilirsiniz.</p>`;
    } else if (!u.yeniDanisan) {
      kabulNotu = `<p class="kapali-uyari">Bu uzman şu an yeni danışan almadığını belirtiyor.</p>`;
    }
    const yan = `
      <aside class="profil-yan">
        <section class="blok iletisim-kutu" aria-labelledby="iletisimBaslik">
          <h2 id="iletisimBaslik">İletişime geçin</h2>
          <span class="durum ${kabul.sinif}">${kabul.metin}</span>
          ${kabulNotu}
          ${u.ornek ? `<p class="kapali-uyari" id="ornekKanalNotu" tabindex="-1" role="status" hidden>Bu bir örnek profildir; butonlar tasarımı göstermek içindir ve hiçbir numarayı aramaz, mesaj göndermez.</p>` : ""}
          <div class="iletisim-butonlari">
            ${KANALLAR.map(kanalButonu).join("")}
            ${kanalYok ? mesajButonu() : ""}
          </div>
          ${kanalYok ? `<p class="alt-not">Uzman doğrudan iletişim bilgisi paylaşmıyor. Mesajınız platform üzerinden uzmana iletilir; iletişim bilgileriniz yalnızca bu uzmana iletilir.</p>` : ""}
          <p class="alt-not">İlk mesajınızda sağlık bilgilerinizi paylaşmanız gerekmez; kısaca görüşme talebinizi iletmeniz yeterli.</p>
          ${Array.isArray(u.sosyal) && u.sosyal.length ? `
            <div class="sosyal-baglantilar">
              <h3>Sosyal medya</h3>
              <ul>${u.sosyal
                .map((m) => `<li><a href="${esc(m.adres)}" target="_blank" rel="noopener nofollow ugc" title="${esc(m.etiket)}">${ikon(m.kod)}<span class="gorunmez">${esc(m.etiket)} (yeni sekmede açılır)</span></a></li>`)
                .join("")}</ul>
            </div>` : ""}
          ${iletisim.whatsapp ? `<p class="alt-not">WhatsApp butonu sizi WhatsApp uygulamasına yönlendirir; yazışmalarınız WhatsApp'ın gizlilik koşullarına tabidir.</p>` : ""}
        </section>
      </aside>`;

    // --- Gezinme izi (breadcrumb) ---
    const kirinti = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer">
        <ol>
          <li><a href="index.html">Ana sayfa</a></li>
          <li><a href="index.html#aramaFormu" id="listeyeDon">Klinik psikolog bul</a></li>
          <li><span aria-current="page">${esc(u.ad)}</span></li>
        </ol>
      </nav>`;

    alan.removeAttribute("aria-busy");
    alan.innerHTML = `
      ${kirinti}
      <div class="profil-duzen">
        <div class="profil-ana">
          ${ust}${egitim}${hakkinda}${alanlar}${seans}${yazilar}${sss}
        </div>
        ${yan}
      </div>
      <div class="mobil-iletisim">${mobilCubuk()}</div>
      ${kanalYok && !u.ornek ? MesajFormu.html(u) : ""}`;

    // Statik "Uzman listesine dön" bağlantısı, gezinme izi geldikten sonra gereksizleşir.
    const geriLink = document.querySelector(".geri-link");
    if (geriLink) geriLink.hidden = true;

    document.body.classList.add("mobil-cubuk-var");
    // Örnek profillere gerçek danışanlardan mesaj toplanmaz.
    if (kanalYok && !u.ornek) MesajFormu.bagla(u);

    // "Klinik psikolog bul": Listeden gelindiyse tarayıcının geri adımını kullan,
    // böylece listedeki filtreler ve sayfa numarası korunur.
    const listeyeDon = document.getElementById("listeyeDon");
    if (listeyeDon && document.referrer) {
      try {
        const onceki = new URL(document.referrer);
        if (onceki.origin === location.origin && /\/(index\.html)?$/.test(onceki.pathname)) {
          listeyeDon.addEventListener("click", (e) => {
            e.preventDefault();
            history.back();
          });
        }
      } catch (e) {
        /* geçersiz referans: bağlantı normal çalışır */
      }
    }

    // "Devamını oku" düğmesi
    const devami = document.getElementById("devamiDugme");
    if (devami) {
      devami.addEventListener("click", () => {
        const metin = document.getElementById("hakkindaMetni");
        const kapali = metin.classList.toggle("kapali");
        devami.textContent = kapali ? "Devamını oku" : "Daha az göster";
        devami.setAttribute("aria-expanded", String(!kapali));
      });
    }

    // Onay balonu: dokunma/tıklama ile aç-kapa; farenin üzerine gelince de açılır; Esc ve dışarı tıklama kapatır.
    const onayDugme = alan.querySelector(".onay-dugme");
    if (onayDugme) {
      const balon = document.getElementById("onayBalonu");
      const ayarla = (acik) => {
        balon.hidden = !acik;
        onayDugme.setAttribute("aria-expanded", String(acik));
      };
      // "sabit": tıklama/dokunmayla açıldı (fare çekilince kapanmaz). "uzerinde": fare işaretin üzerinde.
      let sabit = false;
      let uzerinde = false;
      onayDugme.addEventListener("click", (e) => {
        e.stopPropagation();
        sabit = !sabit;
        ayarla(sabit || uzerinde);
      });
      const sarici = onayDugme.parentElement;
      if (matchMedia("(hover: hover)").matches) {
        sarici.addEventListener("mouseenter", () => {
          uzerinde = true;
          ayarla(true);
        });
        sarici.addEventListener("mouseleave", () => {
          uzerinde = false;
          if (!sabit) ayarla(false);
        });
      }
      document.addEventListener("click", (e) => {
        if (!sarici.contains(e.target)) {
          sabit = false;
          ayarla(false);
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !balon.hidden) {
          sabit = false;
          ayarla(false);
          onayDugme.focus();
        }
      });
    }

    // Örnek profillerde iletişim butonuna basılınca yalnızca açıklama gösterilir.
    alan.querySelectorAll("[data-ornek-kanal]").forEach((d) =>
      d.addEventListener("click", () => {
        const kutu = document.getElementById("ornekKanalNotu");
        if (kutu) {
          kutu.hidden = false;
          kutu.focus();
        }
      })
    );

    // Paylaş: Telefonlarda sistemin paylaşım menüsü; desteklenmeyen tarayıcılarda bağlantıyı kopyalar.
    const paylasDugme = document.getElementById("paylasDugme");
    const bildirim = document.getElementById("paylasBildirim");
    paylasDugme.addEventListener("click", async () => {
      const adres = kaliciAdres(u.id);
      const veri = { title: `${u.ad} — ${u.unvan}`, text: `${u.ad} (${u.unvan}) profilini ${SITE.ad} üzerinde inceleyin.`, url: adres };
      if (navigator.share) {
        try {
          await navigator.share(veri);
        } catch (e) {
          /* kullanıcı paylaşımı kapattı */
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(adres);
        bildirim.textContent = "Profil bağlantısı kopyalandı.";
      } catch (e) {
        // Pano izni yoksa bağlantıyı seçilebilir biçimde göster.
        bildirim.innerHTML = `Bağlantıyı kopyalayın: <input class="paylas-adres" type="text" readonly value="${esc(adres)}" aria-label="Profil bağlantısı">`;
        const girdi = bildirim.querySelector("input");
        girdi.focus();
        girdi.select();
      }
      clearTimeout(paylasDugme._sayac);
      paylasDugme._sayac = setTimeout(() => {
        if (!bildirim.contains(document.activeElement)) bildirim.textContent = "";
      }, 6000);
    });
  }

  baslat();
})();
