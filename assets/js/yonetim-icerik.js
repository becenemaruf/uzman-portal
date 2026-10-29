/*
 * YÖNETİM PANELİ — MANŞETLER VE DUYURULAR
 *  #mansetler, #manset/<id|yeni>   → Ana sayfadaki kayan manşet alanı (mansetler tablosu)
 *  #duyurular, #duyuru/<id|yeni>   → Ana sayfadaki duyuru/tanıtım kartları (duyurular tablosu)
 * İkisi aynı düzenleyiciyi kullanır; farkları TURLER tanımındadır.
 * Yayın durumu: "aktif" kutusu + (isteğe bağlı) başlangıç/bitiş tarihi.
 * Ziyaretçi yalnızca aktif ve tarihi uygun kayıtları görebilir (veritabanı kuralı).
 */
(() => {
  const sb = Yonetim.sb;

  const MANSET_TURLERI = { duyuru: "Duyuru", yenilik: "Yenilik", reklam: "Reklam / tanıtım" };
  const TEMALAR = { yesil: "Lacivert (koyu)", kum: "Kum (açık)", gri: "Gri (açık)" };
  const KONUMLAR = {
    arama_alti: "Uzman arama bölümünün altında",
    liste_arasi: "Uzman listesinin arasında (her 12 kartta bir)",
    sayfa_alti: "Ana sayfanın alt bölümünde",
  };

  const TURLER = {
    manset: {
      tablo: "mansetler",
      liste: "mansetler",
      tekil: "manşet",
      baslik: "Manşetler (slider)",
      aciklama: "Ana sayfanın en üstündeki kayan alan. Sıra, slaytların gösterim sırasıdır. Hiç yayında manşet yoksa alan görünmez.",
      metinSiniri: 220,
      alanlar: "id, tur, baslik, metin, buton_yazi, buton_adres, tema, gorsel_yolu, gorsel_mobil_yolu, baslangic, bitis, sira, aktif, guncellenme",
      etiket: (k) => MANSET_TURLERI[k.tur] || "Duyuru",
    },
    duyuru: {
      tablo: "duyurular",
      liste: "duyurular",
      tekil: "duyuru",
      baslik: "Duyurular ve tanıtımlar",
      aciklama:
        "Ana sayfadaki üç alanda gösterilen kartlar. Her kart sitede «Duyuru» etiketiyle gösterilir; uzman sonuçlarıyla karışmaz. Bir alanda yayında kart yoksa o alan hiç görünmez.",
      metinSiniri: 300,
      alanlar: "id, konum, baslik, metin, buton_yazi, buton_adres, gorsel_yolu, baslangic, bitis, sira, aktif, guncellenme",
      etiket: (k) => KONUMLAR[k.konum] || "",
    },
  };

  // ---------- Ortak: önizleme HTML'i (sitedeki görünümle aynı sınıflar) ----------
  function mansetOnizleme(k) {
    const butonSinif = (k.tema || "yesil") === "yesil" ? "btn-beyaz" : "btn-ana";
    return `<div class="manset onizleme-manset"><div class="manset-ray"><article class="manset-slayt tema-${esc(k.tema || "yesil")} ${k.gorsel_yolu ? "gorselli" : ""}">
      <div class="manset-icerik">
        <span class="manset-etiket ${k.tur === "reklam" ? "reklam" : ""}">${esc({ duyuru: "Duyuru", yenilik: "Yenilik", reklam: "Reklam" }[k.tur] || "Duyuru")}</span>
        <h2>${esc(k.baslik || "Başlık")}</h2>
        ${k.metin ? `<p>${esc(k.metin)}</p>` : ""}
        ${k.buton_yazi && k.buton_adres ? `<span class="btn ${butonSinif}">${esc(k.buton_yazi)}</span>` : ""}
      </div>
      ${k.gorsel_yolu ? `<img class="manset-gorsel" src="${esc(k.gorsel_yolu)}" alt="">` : ""}
    </article></div></div>`;
  }
  function duyuruOnizleme(k) {
    return `<div class="duyuru-kart ${k.gorsel_yolu ? "gorselli" : ""}">
      ${k.gorsel_yolu ? `<img class="duyuru-gorsel" src="${esc(k.gorsel_yolu)}" alt="">` : ""}
      <div class="duyuru-govde">
        <span class="duyuru-etiket">Duyuru</span>
        <h3>${esc(k.baslik || "Başlık")}</h3>
        ${k.metin ? `<p>${esc(k.metin)}</p>` : ""}
        ${k.buton_yazi && k.buton_adres ? `<span class="btn btn-cizgi btn-kucuk">${esc(k.buton_yazi)}</span>` : ""}
      </div>
    </div>`;
  }

  // ================= LİSTE =================
  function listeBolumu(tur) {
    const T = TURLER[tur];
    return async (alan) => {
      const { data, error } = await sb.from(T.tablo).select(T.alanlar).order(tur === "duyuru" ? "konum" : "sira").order("sira");
      if (error) throw error;
      let kayitlar = data;

      function satir(k, i, grup) {
        const d = Yonetim.yayinDurumu(k);
        return `<li class="icerik-satir">
          <div class="icerik-kucuk">${k.gorsel_yolu ? `<img src="${esc(k.gorsel_yolu)}" alt="" loading="lazy">` : ikon("yazi")}</div>
          <div class="icerik-bilgi">
            <strong>${esc(k.baslik)}</strong>
            <span class="alan-ipucu">${esc(T.etiket(k))}${k.bitis ? " · bitiş: " + tarihMetni(k.bitis) : ""}</span>
          </div>
          <span class="panel-durum ${d.sinif}">${esc(d.ad)}</span>
          <div class="icerik-dugmeler">
            <button class="ikon-dugme" type="button" data-yukari="${k.id}" ${i === 0 ? "disabled" : ""} aria-label="Yukarı taşı" title="Yukarı taşı">${ikon("asagi")}</button>
            <button class="ikon-dugme ters" type="button" data-asagi="${k.id}" ${i === grup.length - 1 ? "disabled" : ""} aria-label="Aşağı taşı" title="Aşağı taşı">${ikon("asagi")}</button>
            <a class="btn btn-cizgi btn-kucuk" href="#${tur}/${k.id}">Düzenle</a>
            <button class="btn btn-cizgi btn-kucuk" type="button" data-aktif="${k.id}">${k.aktif ? "Pasife al" : "Yayına al"}</button>
            <button class="btn btn-cizgi btn-kucuk tehlike" type="button" data-sil="${k.id}">Sil</button>
          </div>
        </li>`;
      }

      function gruplar() {
        if (tur === "manset") return [["", kayitlar]];
        return Object.keys(KONUMLAR).map((kon) => [kon, kayitlar.filter((k) => k.konum === kon)]);
      }

      function ciz() {
        const ara = (document.getElementById("icerikAra") || {}).value || "";
        const durumF = (document.getElementById("icerikDurum") || {}).value || "";
        const suz = (k) =>
          (!ara || k.baslik.toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr"))) &&
          (!durumF || Yonetim.yayinDurumu(k).sinif === durumF);
        document.getElementById("icerikListesi").innerHTML = gruplar()
          .map(([kon, grup]) => {
            const gorunen = grup.filter(suz);
            return `${kon ? `<h2 class="icerik-grup">${esc(KONUMLAR[kon])}</h2>` : ""}
              ${gorunen.length ? `<ul class="icerik-listesi">${gorunen.map((k) => satir(k, grup.indexOf(k), grup)).join("")}</ul>` : `<p class="bos-not">Kayıt yok.</p>`}`;
          })
          .join("");
        baglaOlaylar();
      }

      async function siraDegistir(id, yon) {
        const k = kayitlar.find((x) => x.id == id);
        const grup = tur === "manset" ? kayitlar : kayitlar.filter((x) => x.konum === k.konum);
        const i = grup.indexOf(k);
        const j = i + yon;
        if (j < 0 || j >= grup.length) return;
        [grup[i], grup[j]] = [grup[j], grup[i]];
        // Grubu 1'den başlayarak yeniden numaralandır; yalnızca değişenleri kaydet
        const guncellenecek = grup.map((x, n) => ({ x, yeni: n + 1 })).filter(({ x, yeni }) => x.sira !== yeni);
        for (const { x, yeni } of guncellenecek) {
          const { error } = await sb.from(T.tablo).update({ sira: yeni }).eq("id", x.id);
          if (error) return Yonetim.mesaj(document.getElementById("icerikMesaj"), "Sıra kaydedilemedi: " + Yonetim.hataMetni(error), "hata");
          x.sira = yeni;
        }
        kayitlar = tur === "manset" ? grup : kayitlar.slice().sort((a, b) => (a.konum === b.konum ? a.sira - b.sira : a.konum.localeCompare(b.konum)));
        ciz();
        Yonetim.mesaj(document.getElementById("icerikMesaj"), "Sıralama kaydedildi.", "basari");
      }

      function baglaOlaylar() {
        alan.querySelectorAll("[data-yukari]").forEach((d) => d.addEventListener("click", () => siraDegistir(d.dataset.yukari, -1)));
        alan.querySelectorAll("[data-asagi]").forEach((d) => d.addEventListener("click", () => siraDegistir(d.dataset.asagi, 1)));
        alan.querySelectorAll("[data-aktif]").forEach((d) =>
          d.addEventListener("click", async () => {
            const k = kayitlar.find((x) => x.id == d.dataset.aktif);
            d.disabled = true;
            const { error } = await sb.from(T.tablo).update({ aktif: !k.aktif }).eq("id", k.id);
            if (error) {
              d.disabled = false;
              return Yonetim.mesaj(document.getElementById("icerikMesaj"), "Güncellenemedi: " + Yonetim.hataMetni(error), "hata");
            }
            k.aktif = !k.aktif;
            ciz();
            Yonetim.mesaj(document.getElementById("icerikMesaj"), k.aktif ? "Yayına alındı." : "Pasife alındı; sitede görünmüyor.", "basari");
          })
        );
        alan.querySelectorAll("[data-sil]").forEach((d) =>
          Yonetim.onayliDugme(d, "Silmek için tekrar basın", async () => {
            const { error } = await sb.from(T.tablo).delete().eq("id", d.dataset.sil);
            if (error) return Yonetim.mesaj(document.getElementById("icerikMesaj"), "Silinemedi: " + Yonetim.hataMetni(error), "hata");
            kayitlar = kayitlar.filter((x) => x.id != d.dataset.sil);
            ciz();
            Yonetim.mesaj(document.getElementById("icerikMesaj"), "Silindi.", "basari");
          })
        );
      }

      alan.innerHTML = `
        <section class="panel-baslik">
          <div><p class="bolum-ust-yazi">İçerik yönetimi</p><h1>${esc(T.baslik)}</h1><p class="soluk">${esc(T.aciklama)}</p></div>
          <a class="btn btn-ana" href="#${tur}/yeni">+ Yeni ${esc(T.tekil)} ekle</a>
        </section>
        <div class="liste-arac">
          <input class="girdi" type="search" id="icerikAra" placeholder="Başlıkta ara…" aria-label="Başlıkta ara">
          <select class="girdi" id="icerikDurum" aria-label="Duruma göre süz">
            <option value="">Tüm durumlar</option><option value="yayinda">Yayında</option><option value="taslak">Taslak / pasif</option>
            <option value="incelemede">Zamanlanmış</option><option value="uyari">Süresi dolmuş</option>
          </select>
        </div>
        <div class="mesaj" id="icerikMesaj" role="status" hidden></div>
        <div id="icerikListesi"></div>`;
      document.getElementById("icerikAra").addEventListener("input", ciz);
      document.getElementById("icerikDurum").addEventListener("change", ciz);
      ciz();
    };
  }

  // ================= DÜZENLEYİCİ =================
  function duzenBolumu(tur) {
    const T = TURLER[tur];
    return async (alan, id) => {
      const yeni = !id || id === "yeni";
      let k = { aktif: false, sira: 0, tema: "yesil", tur: "duyuru", konum: "arama_alti" };
      if (!yeni) {
        const { data, error } = await sb.from(T.tablo).select(T.alanlar).eq("id", id).single();
        if (error) throw error;
        k = data;
      }
      const secenekler = (nesne, secili) => Object.entries(nesne).map(([d, ad]) => `<option value="${d}" ${d === secili ? "selected" : ""}>${esc(ad)}</option>`).join("");
      const gorselAlani = (ad, etiket, deger, ipucu) => `
        <div class="form-alani gorsel-alani">
          <span class="alan-etiket">${etiket}</span>
          <div class="gorsel-secim">
            <div class="gorsel-kucuk" id="${ad}Kucuk">${deger ? `<img src="${esc(deger)}" alt="">` : `<span class="alan-ipucu">Görsel yok</span>`}</div>
            <div>
              <input class="girdi" type="file" id="${ad}Dosya" accept="image/jpeg,image/png,image/webp">
              ${deger ? `<label class="onay-kutusu"><input type="checkbox" id="${ad}Kaldir"> <span>Görseli kaldır</span></label>` : ""}
              <p class="alan-ipucu">${ipucu}</p>
            </div>
          </div>
        </div>`;

      alan.innerHTML = `
        <nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="#${T.liste}">${esc(T.baslik)}</a></li><li><span aria-current="page">${yeni ? "Yeni " + esc(T.tekil) : esc(k.baslik)}</span></li></ol></nav>
        <section class="panel-baslik"><div><p class="bolum-ust-yazi">İçerik yönetimi</p><h1>${yeni ? "Yeni " + esc(T.tekil) : "Düzenle"}</h1></div></section>
        <div class="icerik-duzen">
          <form class="blok panel-kart" id="icerikFormu" novalidate>
            ${
              tur === "manset"
                ? `<div class="iki-sutun">
                    <div class="form-alani"><label class="alan-etiket" for="fTur">Etiket</label><select class="girdi" id="fTur">${secenekler(MANSET_TURLERI, k.tur)}</select></div>
                    <div class="form-alani"><label class="alan-etiket" for="fTema">Renk teması</label><select class="girdi" id="fTema">${secenekler(TEMALAR, k.tema)}</select></div>
                  </div>`
                : `<div class="form-alani"><label class="alan-etiket" for="fKonum">Gösterim konumu</label><select class="girdi" id="fKonum">${secenekler(KONUMLAR, k.konum)}</select></div>`
            }
            <div class="form-alani"><label class="alan-etiket" for="fBaslik">Başlık *</label><input class="girdi" id="fBaslik" maxlength="100" required value="${esc(k.baslik || "")}"></div>
            <div class="form-alani"><label class="alan-etiket" for="fMetin">Kısa açıklama</label><textarea class="girdi" id="fMetin" rows="3" maxlength="${T.metinSiniri}">${esc(k.metin || "")}</textarea>
              <p class="alan-ipucu sayac" id="fMetinSayac"></p></div>
            <div class="iki-sutun">
              <div class="form-alani"><label class="alan-etiket" for="fButonYazi">Buton metni (isteğe bağlı)</label><input class="girdi" id="fButonYazi" maxlength="40" value="${esc(k.buton_yazi || "")}" placeholder="Ör. Ayrıntılar"></div>
              <div class="form-alani"><label class="alan-etiket" for="fButonAdres">Buton bağlantısı</label><input class="girdi" id="fButonAdres" maxlength="500" value="${esc(k.buton_adres || "")}" placeholder="https://… ya da giris.html#kayit"></div>
            </div>
            <p class="alan-ipucu" style="margin-top:-8px">Bağlantı: tam adres (https://…), sitenin bir sayfası (ör. hakkimizda.html) ya da sayfa içi bölüm (ör. #aramaFormu). Dış bağlantılar yeni sekmede açılır.</p>
            ${gorselAlani("fGorsel", tur === "manset" ? "Masaüstü görseli" : "Görsel (isteğe bağlı)", k.gorsel_yolu, "JPG, PNG ya da WebP · en fazla 3 MB." + (tur === "manset" ? " Önerilen: yatay, yaklaşık 800×500 piksel; geniş ekranda sağda gösterilir." : " Önerilen: yaklaşık 600×400 piksel."))}
            ${tur === "manset" ? gorselAlani("fMobil", "Mobil görseli (isteğe bağlı)", k.gorsel_mobil_yolu, "Telefonda metnin üstünde gösterilir. Önerilen: yaklaşık 800×400 piksel. Boş bırakılırsa telefonda görsel gösterilmez.") : ""}
            <div class="iki-sutun">
              <div class="form-alani"><label class="alan-etiket" for="fBaslangic">Yayın başlangıcı (isteğe bağlı)</label><input class="girdi" type="date" id="fBaslangic" value="${esc(k.baslangic || "")}"></div>
              <div class="form-alani"><label class="alan-etiket" for="fBitis">Yayın bitişi (isteğe bağlı)</label><input class="girdi" type="date" id="fBitis" value="${esc(k.bitis || "")}"></div>
            </div>
            <div class="iki-sutun">
              <div class="form-alani"><label class="alan-etiket" for="fSira">Gösterim sırası</label><input class="girdi" type="number" id="fSira" min="0" max="999" value="${Number(k.sira) || 0}">
                <p class="alan-ipucu">Küçük sayı önce gösterilir. Listede oklarla da değiştirebilirsiniz.</p></div>
              <div class="form-alani"><span class="alan-etiket">Durum</span>
                <label class="onay-kutusu"><input type="checkbox" id="fAktif" ${k.aktif ? "checked" : ""}> <span><strong>Yayında</strong> (işaretli değilse taslak olarak kalır)</span></label></div>
            </div>
            <div class="mesaj" id="formMesaj" role="status" hidden></div>
            <div class="duzen-alt">
              <a class="btn btn-cizgi btn-kucuk" href="#${T.liste}">Vazgeç</a>
              <button class="btn btn-ana btn-kucuk" type="submit" id="kaydet">Kaydet</button>
            </div>
          </form>
          <aside class="blok panel-kart onizleme-kutu">
            <h2>Önizleme</h2>
            <p class="alan-ipucu">Sitede yaklaşık böyle görünür. Yeni seçtiğiniz görsel kaydettikten sonra görünür.</p>
            <div id="onizleme"></div>
          </aside>
        </div>`;

      const $ = (x) => document.getElementById(x);
      function formDegeri() {
        return {
          baslik: $("fBaslik").value.trim(),
          metin: $("fMetin").value.trim() || null,
          buton_yazi: $("fButonYazi").value.trim() || null,
          buton_adres: $("fButonAdres").value.trim() || null,
          baslangic: $("fBaslangic").value || null,
          bitis: $("fBitis").value || null,
          sira: Math.max(0, Math.min(999, parseInt($("fSira").value, 10) || 0)),
          aktif: $("fAktif").checked,
          ...(tur === "manset" ? { tur: $("fTur").value, tema: $("fTema").value } : { konum: $("fKonum").value }),
        };
      }
      function onizle() {
        const d = { ...k, ...formDegeri() };
        if ($("fGorselKaldir") && $("fGorselKaldir").checked) d.gorsel_yolu = null;
        $("onizleme").innerHTML = tur === "manset" ? mansetOnizleme(d) : duyuruOnizleme(d);
        $("fMetinSayac").textContent = `${$("fMetin").value.length} / ${T.metinSiniri}`;
      }
      $("icerikFormu").addEventListener("input", () => {
        Yonetim.kirliYap(true);
        onizle();
      });
      $("icerikFormu").addEventListener("change", onizle);
      onizle();

      $("icerikFormu").addEventListener("submit", async (e) => {
        e.preventDefault();
        const m = $("formMesaj");
        const d = formDegeri();
        if (d.baslik.length < 3) return Yonetim.mesaj(m, "Başlık en az 3 karakter olmalı.", "hata");
        if ((d.buton_yazi && !d.buton_adres) || (!d.buton_yazi && d.buton_adres)) return Yonetim.mesaj(m, "Buton için hem metin hem bağlantı girin (ya da ikisini de boş bırakın).", "hata");
        if (!Yonetim.baglantiUygun(d.buton_adres)) return Yonetim.mesaj(m, "Buton bağlantısı geçersiz. https:// ile başlayan bir adres, bir site sayfası (ör. hakkimizda.html) ya da #bolum yazın.", "hata");
        if (d.baslangic && d.bitis && d.bitis < d.baslangic) return Yonetim.mesaj(m, "Bitiş tarihi başlangıçtan önce olamaz.", "hata");
        const dugme = $("kaydet");
        dugme.disabled = true;
        dugme.textContent = "Kaydediliyor…";
        try {
          const klasor = tur === "manset" ? "mansetler" : "duyurular";
          if ($("fGorselDosya").files[0]) d.gorsel_yolu = await Yonetim.gorselYukle($("fGorselDosya").files[0], klasor);
          else if ($("fGorselKaldir") && $("fGorselKaldir").checked) d.gorsel_yolu = null;
          if (tur === "manset") {
            if ($("fMobilDosya").files[0]) d.gorsel_mobil_yolu = await Yonetim.gorselYukle($("fMobilDosya").files[0], klasor);
            else if ($("fMobilKaldir") && $("fMobilKaldir").checked) d.gorsel_mobil_yolu = null;
          }
          const sorgu = yeni ? sb.from(T.tablo).insert(d).select("id").single() : sb.from(T.tablo).update(d).eq("id", k.id).select("id").single();
          const { data, error } = await sorgu;
          if (error) throw error;
          Yonetim.kirliYap(false);
          if (yeni) {
            location.hash = `#${tur}/${data.id}`;
            return;
          }
          Object.assign(k, d);
          onizle();
          Yonetim.mesaj(m, d.aktif ? "Kaydedildi. Değişiklik sitede yayında." : "Kaydedildi (taslak; sitede görünmüyor).", "basari");
        } catch (h) {
          console.error(h);
          Yonetim.mesaj(m, "Kaydedilemedi: " + Yonetim.hataMetni(h), "hata");
        } finally {
          dugme.disabled = false;
          dugme.textContent = "Kaydet";
        }
      });
    };
  }

  Yonetim.bolumEkle("mansetler", listeBolumu("manset"));
  Yonetim.bolumEkle("manset", duzenBolumu("manset"));
  Yonetim.bolumEkle("duyurular", listeBolumu("duyuru"));
  Yonetim.bolumEkle("duyuru", duzenBolumu("duyuru"));
})();
