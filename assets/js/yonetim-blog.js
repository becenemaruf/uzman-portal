/*
 * YÖNETİM PANELİ — BLOG YAZILARI
 *  #blog                 → İnceleme bekleyen uzman yazıları (varsayılan sekme)
 *  #blog/uzman           → Tüm uzman yazıları
 *  #blog/platform        → Platform (yönetim) yazıları
 *  #blog/yazi/<no>       → Uzman yazısı: inceleme ve karar | Platform yazısı: düzenleyici
 *  #blog/yeni            → Yeni platform yazısı
 *
 * Uzman yazısı kararları: yayınla · düzeltme iste (not zorunlu) · reddet (not zorunlu) · yayından kaldır.
 * Platform yazısı hedefi: uzmanlar (yalnızca uzman panelindeki "Mesleki Gelişim"), herkes (herkese açık blog), ikisi.
 * Metin düz yazıdır; yaziGovdesi ile biçimlenir (HTML yorumlanmaz).
 */
(() => {
  const sb = Yonetim.sb;

  const DURUM = {
    taslak: { ad: "Taslak", sinif: "taslak" },
    incelemede: { ad: "İnceleme bekliyor", sinif: "incelemede" },
    yayinda: { ad: "Yayında", sinif: "yayinda" },
    duzeltme_istendi: { ad: "Düzeltme istendi", sinif: "uyari" },
    reddedildi: { ad: "Reddedildi", sinif: "uyari" },
  };
  const HEDEF = {
    uzmanlar: { ad: "Yalnızca uzman paneli", aciklama: "Uzman panelindeki «Mesleki Gelişim» bölümünde görünür. Ziyaretçiler göremez." },
    herkes: { ad: "Herkese açık blog", aciklama: "Ana sayfadaki blog bölümünde herkes görür." },
    ikisi: { ad: "İkisi birden", aciklama: "Hem herkese açık blogda hem uzman panelinde görünür." },
  };
  const PLATFORM_KONULARI = ["Mesleki gelişim", "Mevzuat", "Meslek etiği", "Eğitim ve etkinlik", "Platform duyurusu", "Ruh sağlığı okuryazarlığı"];
  const rozet = (d) => `<span class="panel-durum ${(DURUM[d] || {}).sinif || ""}">${esc((DURUM[d] || {}).ad || d)}</span>`;
  const tamAd = (u) => (u ? [u.unvan_oneki, u.ad, u.soyad].filter(Boolean).join(" ") : "");
  const BICIM_YARDIMI = `<details class="bicim-yardimi"><summary>Metni nasıl biçimlendiririm?</summary>
    <ul><li>Paragrafların arasında <strong>bir boş satır</strong> bırakın.</li>
      <li>Ara başlık: satır başına <code>## </code> — ör. <code>## Süpervizyon neden önemli?</code></li>
      <li>Madde listesi: her satırın başına <code>- </code></li>
      <li>Kalın: <code>**önemli**</code></li></ul></details>`;

  // ================= LİSTE =================
  async function liste(alan, sekme) {
    const { data, error } = await sb
      .from("yazilar")
      .select("id, tur, hedef, yazar_adi, baslik, kategori, durum, guncellenme, yayin_tarihi, uzmanlar(id, ad, soyad, unvan_oneki, ornek)")
      .order("guncellenme", { ascending: false });
    if (error) throw error;
    const gruplar = {
      inceleme: data.filter((y) => y.tur === "uzman" && y.durum === "incelemede"),
      uzman: data.filter((y) => y.tur === "uzman"),
      platform: data.filter((y) => y.tur === "platform"),
    };
    const SEKMELER = [
      ["inceleme", "İnceleme bekleyen"],
      ["uzman", "Uzman yazıları"],
      ["platform", "Platform yazıları"],
    ];
    alan.innerHTML = `
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">İçerik yönetimi</p><h1>Blog yazıları</h1>
        <p class="soluk">Uzmanların gönderdiği yazıları inceleyin; platformun kendi bilgilendirme yazılarını yazın. Platform yazılarını yalnızca uzman paneline, herkese açık bloga ya da ikisine birden yayımlayabilirsiniz.</p></div>
        <a class="btn btn-ana" href="#blog/yeni">+ Yeni platform yazısı</a></section>
      <div class="sekme-satiri" role="tablist">${SEKMELER.map(
        ([k, ad]) => `<a role="tab" href="#blog/${k === "inceleme" ? "" : k}" aria-selected="${k === sekme}">${ad} <span class="sekme-sayi ${k === "inceleme" && gruplar.inceleme.length ? "okunmamis-sayi" : ""}">${gruplar[k].length}</span></a>`
      ).join("")}</div>
      <div class="liste-arac"><input class="girdi" type="search" id="bAra" placeholder="Başlık ya da yazar ara…" aria-label="Yazılarda ara"></div>
      <div id="bListe"></div>`;
    function ciz() {
      const q = document.getElementById("bAra").value.trim().toLocaleLowerCase("tr");
      const g = gruplar[sekme].filter((y) => !q || `${y.baslik} ${tamAd(y.uzmanlar)} ${y.kategori || ""}`.toLocaleLowerCase("tr").includes(q));
      document.getElementById("bListe").innerHTML = g.length
        ? `<ul class="yonetim-liste">${g
            .map(
              (y) => `<li><a href="#blog/yazi/${y.id}"><span class="yl-ana"><strong>${esc(y.baslik)}</strong>
                <span class="alan-ipucu">${
                  y.tur === "platform" ? `${esc(y.yazar_adi || "Klinik Psikologlar")} · ${esc(HEDEF[y.hedef].ad)}` : `${esc(tamAd(y.uzmanlar))}${y.uzmanlar && y.uzmanlar.ornek ? " (örnek profil)" : ""}`
                } · ${esc(y.kategori || "Konusuz")} · ${esc(tarihMetni(y.yayin_tarihi || y.guncellenme))}</span></span>${rozet(y.durum)}</a></li>`
            )
            .join("")}</ul>`
        : `<p class="bos-not">${sekme === "inceleme" ? "İnceleme bekleyen yazı yok." : "Bu grupta yazı yok."}</p>`;
    }
    document.getElementById("bAra").addEventListener("input", ciz);
    ciz();
  }

  // ================= UZMAN YAZISI İNCELEME =================
  async function inceleme(alan, y) {
    const bulgular = typeof IfadeDenetimi !== "undefined" ? IfadeDenetimi.tara([y.baslik, y.ozet || "", y.icerik || ""].join("\n")) : [];
    alan.innerHTML = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="#blog">Blog yazıları</a></li><li><span aria-current="page">${esc(y.baslik)}</span></li></ol></nav>
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">Uzman yazısı</p><h1>${esc(y.baslik)}</h1>
        <p class="soluk">${esc(tamAd(y.uzmanlar))} · ${esc(y.kategori || "Konusuz")} · son değişiklik ${esc(tarihMetni(y.guncellenme))}${y.yayin_tarihi ? ` · ilk yayın ${esc(tarihMetni(y.yayin_tarihi))}` : ""}</p></div>${rozet(y.durum)}</section>
      <div class="mesaj" id="kMesaj" role="status" hidden></div>
      ${y.uzmanlar && y.uzmanlar.durum !== "yayinda" ? `<div class="mesaj mesaj-uyari">Yazarın profili yayında değil; yazıyı yayınlasanız da profil yayına alınana kadar sitede görünmez.</div>` : ""}
      ${y.ret_nedeni && y.durum !== "yayinda" ? `<div class="mesaj mesaj-bilgi"><strong>Son yönetim notu:</strong> ${esc(y.ret_nedeni)}</div>` : ""}
      <section class="blok panel-kart">
        <h2>İfade denetimi</h2>
        ${bulgular.length ? IfadeDenetimi.html(bulgular) : `<p class="mesaj mesaj-basari">Reklam dili ya da sonuç vaadi gibi işaretlenen bir ifade bulunmadı.</p>`}
        <p class="alan-ipucu">Ayrıca kontrol edin: danışan bilgisi, ücret/indirim, iletişim bilgisi, başka bir kaynaktan kopyalanmış metin.</p>
      </section>
      <section class="blok panel-kart">
        <h2>Yazı</h2>
        <article class="yazi-sayfa">${y.ozet ? `<p class="yazi-giris">${esc(y.ozet)}</p>` : ""}<div class="yazi-govde">${y.icerik ? yaziGovdesi(y.icerik) : `<p class="soluk">Metin boş.</p>`}</div></article>
      </section>
      <section class="blok panel-kart">
        <h2>Karar</h2>
        <div class="form-alani"><label class="alan-etiket" for="kNot">Uzmana not <span class="soluk">(düzeltme istemek ya da reddetmek için zorunlu; uzman panelinde görür)</span></label>
          <textarea class="girdi" id="kNot" rows="3" maxlength="1000"></textarea></div>
        <div class="karar-dugmeleri">
          ${y.durum !== "yayinda" ? `<button class="btn btn-ana btn-kucuk" type="button" data-karar="yayinda">Yayınla</button>` : ""}
          <button class="btn btn-cizgi btn-kucuk" type="button" data-karar="duzeltme_istendi">${y.durum === "yayinda" ? "Yayından kaldır ve düzeltme iste" : "Düzeltme iste"}</button>
          ${y.durum !== "reddedildi" ? `<button class="btn btn-cizgi btn-kucuk tehlike" type="button" data-karar="reddedildi">Reddet</button>` : ""}
        </div>
        <p class="alan-ipucu">Uzman, kararı panelindeki «Yazılarım» bölümünde görür.${y.uzmanlar ? ` <a href="#basvuru/${y.uzmanlar.id}">Uzmanın başvuru sayfası</a>` : ""}</p>
      </section>`;
    alan.querySelectorAll("[data-karar]").forEach((d) =>
      d.addEventListener("click", async () => {
        const karar = d.dataset.karar;
        const not = document.getElementById("kNot").value.trim();
        if (karar !== "yayinda" && not.length < 5) return Yonetim.mesaj(document.getElementById("kMesaj"), "Uzmanın neyi düzeltmesi gerektiğini kısaca yazın.", "hata");
        d.disabled = true;
        const { error } = await sb.from("yazilar").update({ durum: karar, ret_nedeni: karar === "yayinda" ? null : not }).eq("id", y.id);
        if (error) {
          d.disabled = false;
          return Yonetim.mesaj(document.getElementById("kMesaj"), "Kaydedilemedi: " + Yonetim.hataMetni(error), "hata");
        }
        await Yonetim.git(`#blog/yazi/${y.id}`);
        Yonetim.mesaj(
          document.getElementById("kMesaj"),
          { yayinda: "Yazı yayımlandı.", duzeltme_istendi: "Düzeltme istendi; uzman notunuzu panelinde görecek.", reddedildi: "Yazı reddedildi." }[karar],
          "basari"
        );
      })
    );
  }

  // ================= PLATFORM YAZISI DÜZENLEYİCİ =================
  async function platformDuzen(alan, y) {
    const yeni = !y;
    y = y || { baslik: "", kategori: "", ozet: "", icerik: "", yazar_adi: "", hedef: "uzmanlar", durum: "taslak" };
    alan.innerHTML = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="#blog/platform">Platform yazıları</a></li><li><span aria-current="page">${yeni ? "Yeni yazı" : esc(y.baslik)}</span></li></ol></nav>
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">Platform yazısı</p><h1>${yeni ? "Yeni platform yazısı" : "Platform yazısını düzenle"}</h1></div>${yeni ? "" : rozet(y.durum)}</section>
      <div class="mesaj" id="pMesaj" role="status" hidden></div>
      <form class="blok panel-kart" id="pFormu" novalidate>
        <div class="form-alani"><label class="alan-etiket" for="pBaslik">Başlık</label><input class="girdi" id="pBaslik" maxlength="150" value="${esc(y.baslik)}"></div>
        <div class="iki-sutun">
          <div class="form-alani"><label class="alan-etiket" for="pKategori">Konu</label>
            <input class="girdi" id="pKategori" list="pKonular" maxlength="60" value="${esc(y.kategori || "")}" placeholder="ör. Mesleki gelişim">
            <datalist id="pKonular">${PLATFORM_KONULARI.map((k) => `<option value="${esc(k)}">`).join("")}</datalist></div>
          <div class="form-alani"><label class="alan-etiket" for="pYazar">Yazar adı <span class="soluk">(boşsa «Klinik Psikologlar»)</span></label>
            <input class="girdi" id="pYazar" maxlength="80" value="${esc(y.yazar_adi || "")}" placeholder="ör. Klinik Psikologlar Yayın Kurulu"></div>
        </div>
        <fieldset class="form-alani hedef-secim"><legend class="alan-etiket">Kimler görecek?</legend>
          ${Object.entries(HEDEF)
            .map(
              ([k, h]) => `<label class="secim-karti"><input type="radio" name="pHedef" value="${k}" ${y.hedef === k ? "checked" : ""}>
                <span><strong>${esc(h.ad)}</strong><small>${esc(h.aciklama)}</small></span></label>`
            )
            .join("")}
        </fieldset>
        <div class="form-alani"><label class="alan-etiket" for="pOzet">Kısa özet</label><textarea class="girdi" id="pOzet" rows="2" maxlength="400">${esc(y.ozet || "")}</textarea></div>
        <div class="form-alani"><label class="alan-etiket" for="pIcerik">Yazı</label>${BICIM_YARDIMI}
          <textarea class="girdi yazi-metin-alani" id="pIcerik" rows="18" maxlength="40000">${esc(y.icerik || "")}</textarea>
          <p class="alan-ipucu"><span id="pSayac">0</span> / 40.000 karakter</p></div>
        <details class="yazi-onizleme-kutu"><summary>Önizleme</summary><article class="yazi-sayfa"><div class="yazi-govde" id="pOnizleme"></div></article></details>
        <div class="duzen-alt">
          ${yeni ? "" : `<button class="btn btn-cizgi btn-kucuk tehlike" type="button" id="pSil">Sil</button>`}
          ${y.durum === "yayinda" ? `<button class="btn btn-cizgi btn-kucuk" type="button" data-kaydet="taslak">Yayından kaldır</button>` : `<button class="btn btn-cizgi btn-kucuk" type="button" data-kaydet="taslak">Taslak kaydet</button>`}
          <button class="btn btn-ana btn-kucuk" type="button" data-kaydet="yayinda">${y.durum === "yayinda" ? "Değişiklikleri yayınla" : "Yayınla"}</button>
        </div>
        ${y.durum === "yayinda" && y.hedef !== "uzmanlar" ? `<p class="alan-ipucu">Herkese açık adresi: <a href="yazi.html?id=${encodeURIComponent(y.slug)}" target="_blank" rel="noopener">yazi.html?id=${esc(y.slug)}</a></p>` : ""}
      </form>`;
    const $ = (x) => document.getElementById(x);
    const guncelle = () => {
      $("pSayac").textContent = sayiBicimle($("pIcerik").value.length);
      $("pOnizleme").innerHTML = $("pIcerik").value.trim() ? yaziGovdesi($("pIcerik").value) : `<p class="soluk">Yazı boş.</p>`;
      Yonetim.kirliYap(true);
    };
    $("pIcerik").addEventListener("input", guncelle);
    ["pBaslik", "pOzet", "pKategori", "pYazar"].forEach((k) => $(k).addEventListener("input", () => Yonetim.kirliYap(true)));
    guncelle();
    Yonetim.kirliYap(false);

    alan.querySelectorAll("[data-kaydet]").forEach((d) =>
      d.addEventListener("click", async () => {
        const durum = d.dataset.kaydet;
        const kayit = {
          tur: "platform",
          baslik: $("pBaslik").value.trim(),
          kategori: $("pKategori").value.trim() || null,
          yazar_adi: $("pYazar").value.trim() || null,
          hedef: (alan.querySelector('input[name="pHedef"]:checked') || {}).value || "uzmanlar",
          ozet: $("pOzet").value.trim() || null,
          icerik: $("pIcerik").value.trim(),
          durum,
        };
        if (kayit.baslik.length < 5) return Yonetim.mesaj($("pMesaj"), "Başlık en az 5 karakter olmalı.", "hata");
        if (durum === "yayinda" && kayit.icerik.length < 50) return Yonetim.mesaj($("pMesaj"), "Yayınlamak için yazının metnini girin.", "hata");
        kayit.okuma_dakika = okumaSuresi(kayit.icerik);
        d.disabled = true;
        let sonuc;
        if (yeni) {
          const temel = adresKisaltmasi(kayit.baslik);
          for (let i = 0; i < 4; i++) {
            sonuc = await sb.from("yazilar").insert({ ...kayit, slug: i ? `${temel}-${Math.random().toString(36).slice(2, 6)}` : temel }).select("id").single();
            if (!sonuc.error || sonuc.error.code !== "23505") break;
          }
        } else {
          sonuc = await sb.from("yazilar").update(kayit).eq("id", y.id).select("id").single();
        }
        d.disabled = false;
        if (sonuc.error) return Yonetim.mesaj($("pMesaj"), "Kaydedilemedi: " + Yonetim.hataMetni(sonuc.error), "hata");
        Yonetim.kirliYap(false);
        await Yonetim.git(`#blog/yazi/${sonuc.data.id}`);
        Yonetim.mesaj(
          document.getElementById("pMesaj"),
          durum === "yayinda" ? `Yazı yayımlandı (${HEDEF[kayit.hedef].ad.toLocaleLowerCase("tr")}).` : y.durum === "yayinda" ? "Yazı yayından kaldırıldı; taslak olarak duruyor." : "Taslak kaydedildi.",
          "basari"
        );
      })
    );
    if ($("pSil"))
      Yonetim.onayliDugme($("pSil"), "Silmek için tekrar basın", async () => {
        const { error } = await sb.from("yazilar").delete().eq("id", y.id);
        if (error) return Yonetim.mesaj($("pMesaj"), "Silinemedi: " + Yonetim.hataMetni(error), "hata");
        Yonetim.kirliYap(false);
        await Yonetim.git("#blog/platform");
      });
  }

  Yonetim.bolumEkle("blog", async (alan, param) => {
    const [a, b] = (param || "").split("/");
    if (a === "yeni") return platformDuzen(alan, null);
    if (a === "yazi" && b) {
      const { data: y, error } = await sb
        .from("yazilar")
        .select("id, tur, hedef, yazar_adi, slug, baslik, kategori, ozet, icerik, durum, ret_nedeni, guncellenme, yayin_tarihi, uzmanlar(id, ad, soyad, unvan_oneki, durum)")
        .eq("id", b)
        .maybeSingle();
      if (error) throw error;
      if (!y) {
        alan.innerHTML = `<p class="bos-not">Yazı bulunamadı. <a href="#blog">Blog yazılarına dön</a></p>`;
        return;
      }
      return y.tur === "platform" ? platformDuzen(alan, y) : inceleme(alan, y);
    }
    return liste(alan, ["uzman", "platform"].includes(a) ? a : "inceleme");
  });
})();
