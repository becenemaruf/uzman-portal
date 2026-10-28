/*
 * UZMAN PROFİL SAYFASI
 * Adres çubuğundaki ?id=... değerine göre uzmanı veri katmanından alır
 * ve profil bölümlerini oluşturur. Uzmanın doldurmadığı bölümler hiç gösterilmez.
 */
(async function () {
  const alan = document.getElementById("profilIcerik");
  const id = new URLSearchParams(location.search).get("id");
  const u = id ? await Veri.uzmanGetir(id) : null;

  if (!u) {
    alan.innerHTML = `
      <div class="bos-durum" style="margin-bottom:48px">
        <h2>Bu profil bulunamadı</h2>
        <p>Profil kaldırılmış ya da adres hatalı yazılmış olabilir.</p>
        <a class="btn btn-ana" href="index.html">Tüm uzmanlara göz at</a>
      </div>`;
    return;
  }

  // Sayfa başlığı ve açıklaması (Google'da ve paylaşımlarda görünen metin)
  document.title = `${u.ad} — ${u.unvan}, ${u.sehir} | ${SITE.ad}`;
  document.querySelector('meta[name="description"]').setAttribute("content", u.kisaTanitim);

  // u.iletisim YALNIZCA uzmanın yayımlanmasına izin verdiği kanalları içerir.
  // İzin verilmeyen numara/adres veri katmanından hiç gelmez, bu yüzden sayfaya da yazılamaz.
  const iletisim = u.iletisim || {};
  const konum = u.gorusme.includes("yuzyuze") ? `${u.ilce}, ${u.sehir}` : u.sehir;

  // --- Yardımcı parçalar ---
  function etiketler(dizi) {
    return `<div class="etiketler">${dizi.map((e) => `<span class="etiket">${esc(e)}</span>`).join("")}</div>`;
  }
  // Profil bölümleri: Başlık, simgesiyle birlikte renkli bir şerit olarak gösterilir;
  // böylece "Çalışma alanları", "Seans bilgileri" gibi başlıklar içerikten net biçimde ayrılır.
  function blok(baslik, icerik, ikonAdi = "bilgi") {
    return `<section class="blok blok-bolum">
      <h2 class="blok-baslik"><span class="blok-ikon" aria-hidden="true">${ikon(ikonAdi)}</span>${baslik}</h2>
      <div class="blok-icerik">${icerik}</div>
    </section>`;
  }
  function doluMu(dizi) {
    return Array.isArray(dizi) && dizi.length > 0;
  }

  /* İLETİŞİM KANALLARI
   * Her kanal, uzmanın profil ayarlarında verdiği izne göre bağımsız çalışır:
   *  - İzin verilen kanal: renkli, tıklanabilir bağlantı.
   *  - İzin verilmeyen kanal: gri, tıklanamaz; içinde hiçbir bağlantı, numara ya da adres bulunmaz.
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
    return `<a class="btn btn-blok btn-iletisim ${k.sinif}" href="${esc(k.adres(deger))}"${k.yeniSekme ? ' target="_blank" rel="noopener"' : ""}>
        ${ikon(k.ikon)}<span class="btn-metin">${k.etiket}<small>${esc(k.altMetin(deger))}</small></span>
      </a>`;
  }

  const mesajButonu = (kisa = false) =>
    `<button class="btn ${kisa ? "" : "btn-blok"} btn-iletisim btn-mesaj" type="button" data-mesaj-ac>
      ${ikon("gonder")}<span class="btn-metin">${kisa ? "Mesaj gönder" : `Uzmana Mesaj Gönder<small>Platform üzerinden iletilir</small>`}</span>
    </button>`;

  // Mobilde ekranın altına sabitlenen kısa çubuk: yalnızca kullanılabilir kanallar.
  function mobilCubuk() {
    if (kanalYok) return mesajButonu(true);
    return aktifKanallar
      .map((k) => `<a class="btn btn-iletisim ${k.sinif}" href="${esc(k.adres(iletisim[k.kod]))}"${k.yeniSekme ? ' target="_blank" rel="noopener"' : ""}>${ikon(k.ikon)}${k.kisaEtiket}</a>`)
      .join("");
  }

  // --- Üst kısım ---
  const ozet = [
    `<span>${ikon("konum")}${esc(konum)}</span>`,
    `<span>${ikon("video")}${esc(gorusmeMetni(u.gorusme))}</span>`,
    u.deneyimYili ? `<span>${ikon("deneyim")}${u.deneyimYili} yıllık deneyim</span>` : "",
    doluMu(u.diller) ? `<span>${ikon("dil")}${esc(u.diller.join(", "))}</span>` : "",
  ].join("");

  const ust = `
    <section class="blok">
      <div class="profil-bas">
        ${avatarHtml(u, "avatar-buyuk")}
        <div>
          <h1>${esc(u.ad)}</h1>
          <div class="rozetler">
            <span class="rozet">${esc(u.unvan)}</span>
          </div>
          <!-- Rozetin neyi doğruladığını, neyi doğrulamadığını açıklayan bölüm (taslak metin, hukuki incelemeye açık) -->
          <details class="dogrulama-detay">
            <summary>${ikon("dogrulama")}Unvanı doğrulandı ${ikon("bilgi")}<span class="gorunmez">Ne anlama geliyor?</span></summary>
            <p>Bu profilde belirtilen mesleki unvana ilişkin belgeler platform yönetimi tarafından incelenmiştir.
               Doğrulama; uzmanın sunduğu hizmetlerin niteliğine, kullandığı yöntemlere ya da sonuçlarına ilişkin bir garanti anlamına gelmez.</p>
          </details>
        </div>
      </div>
      <p class="tanitim">${esc(u.kisaTanitim)}</p>
      <div class="ozet-bilgiler">${ozet}</div>
      ${u.guncellenme ? `<p class="guncellik">Profil bilgileri en son ${tarihMetni(u.guncellenme)} tarihinde güncellendi.</p>` : ""}
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
  if (doluMu(u.uzmanliklar) || doluMu(u.yaklasimlar) || doluMu(u.yasGruplari)) {
    alanlar = blok(
      "Çalışma alanları",
      (doluMu(u.uzmanliklar) ? `<h3>Uzmanlık alanları</h3><div class="etiketler">${u.uzmanliklar.map(renkliEtiket).join("")}</div>` : "") +
        (doluMu(u.yaklasimlar) ? `<h3>Terapi yaklaşımları</h3>${etiketler(u.yaklasimlar)}` : "") +
        (doluMu(u.yasGruplari) ? `<h3>Çalıştığı gruplar</h3>${etiketler(u.yasGruplari)}` : ""),
      "katman"
    );
  }

  // --- Seans bilgileri ---
  const s = u.seans || {};
  const seansSatirlari = [
    ["Görüşme şekli", gorusmeMetni(u.gorusme)],
    ["Seans süresi", s.sure],
    ["Online platform", u.gorusme.includes("online") ? s.onlinePlatform : ""],
    ["Muayenehane", u.gorusme.includes("yuzyuze") ? s.adres : ""],
  ].filter(([, deger]) => deger);
  const seans = blok(
    "Seans bilgileri",
    `<dl class="seans-tablo">${seansSatirlari.map(([b, d]) => `<div><dt>${b}</dt><dd>${esc(d)}</dd></div>`).join("")}</dl>`,
    "saat"
  );

  // --- Eğitim ---
  let egitim = "";
  if (doluMu(u.egitim) || doluMu(u.sertifikalar)) {
    const liste = (dizi) => `<ul class="liste-sade">${dizi.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
    egitim = blok(
      "Eğitim ve sertifikalar",
      (doluMu(u.egitim) ? `<h3>Eğitim</h3>${liste(u.egitim)}` : "") +
        (doluMu(u.sertifikalar) ? `<h3>Aldığı eğitimler ve sertifikalar</h3>${liste(u.sertifikalar)}` : ""),
      "kep"
    );
  }

  // --- Yazılar ---
  const yazilar = doluMu(u.yazilar)
    ? blok(
        "Yazıları",
        `<ul class="yazi-listesi">${u.yazilar
          .map((y) => `<li><a href="#"><span>${esc(y.baslik)}</span><small>${esc(y.tarih)}</small></a></li>`)
          .join("")}</ul>`,
        "yazi"
      )
    : "";

  // --- Sık sorulan sorular ---
  const sss = doluMu(u.sss)
    ? blok(
        "Sık sorulan sorular",
        `<div class="sss">${u.sss
          .map((x) => `<details><summary>${esc(x.soru)}</summary><p>${esc(x.cevap)}</p></details>`)
          .join("")}</div>`,
        "soru"
      )
    : "";

  // --- Yan kutu: iletişim ---
  const kabul = kabulDurumu(u);
  const durum = `<span class="durum ${kabul.sinif}">${kabul.metin}</span>`;
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
        ${durum}
        ${kabulNotu}
        <div class="iletisim-butonlari">
          ${KANALLAR.map(kanalButonu).join("")}
          ${kanalYok ? mesajButonu() : ""}
        </div>
        ${kanalYok ? `<p class="alt-not">Uzman doğrudan iletişim bilgisi paylaşmıyor. Mesajınız platform üzerinden uzmana iletilir; iletişim bilgileriniz yalnızca bu uzmana iletilir.</p>` : ""}
        <p class="alt-not">İlk mesajınızda sağlık bilgilerinizi paylaşmanız gerekmez; kısaca görüşme talebinizi iletmeniz yeterli.</p>
        ${iletisim.whatsapp ? `<p class="alt-not">WhatsApp butonu sizi WhatsApp uygulamasına yönlendirir; yazışmalarınız WhatsApp'ın gizlilik koşullarına tabidir.</p>` : ""}
      </section>
    </aside>`;

  alan.innerHTML = `
    <div class="profil-duzen">
      <div class="profil-ana">
        ${ust}${hakkinda}${alanlar}${seans}${egitim}${yazilar}${sss}
      </div>
      ${yan}
    </div>
    <div class="mobil-iletisim">${mobilCubuk()}</div>
    ${kanalYok ? MesajFormu.html(u) : ""}`;

  document.body.classList.add("mobil-cubuk-var");
  if (kanalYok) MesajFormu.bagla(u);

  // "Uzman listesine dön": Listeden gelindiyse tarayıcının geri adımını kullan,
  // böylece listedeki filtreler ve sayfa numarası korunur.
  const geriLink = document.querySelector(".geri-link");
  if (geriLink && document.referrer) {
    try {
      const onceki = new URL(document.referrer);
      if (onceki.origin === location.origin && /\/(index\.html)?$/.test(onceki.pathname)) {
        geriLink.addEventListener("click", (e) => {
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
})();
