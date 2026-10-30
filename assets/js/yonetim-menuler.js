/*
 * YÖNETİM PANELİ — MENÜLER (#menuler)
 *  Sitenin üst menüsü ve alt bilgi bağlantıları (menu_ogeleri tablosu).
 *  Her menü kendi "Kaydet" düğmesiyle kaydedilir: silinenler silinir, değişenler güncellenir, yeniler eklenir.
 *  "Uzman Girişi" ve "Profil Oluştur" düğmeleri oturuma göre değiştiği için sabittir, burada düzenlenmez.
 *  Bağlantı kuralı veritabanında da uygulanır (javascript: vb. kaydedilemez).
 */
(() => {
  const sb = Yonetim.sb;

  const KONUMLAR = {
    ust: {
      ad: "Üst menü",
      aciklama: "Her sayfanın üstündeki menü. Telefonlarda ☰ düğmesiyle açılır. Okunaklı kalması için 6 bağlantıyı geçmemeniz önerilir.",
      oneri: 6,
    },
    alt: {
      ad: "Alt bilgi bağlantıları",
      aciklama: "Her sayfanın en altındaki bağlantılar. KVKK, gizlilik ve çerez metinlerinin burada kalması yasal açıdan önemlidir.",
      oneri: 10,
    },
  };

  // Hızlı seçim için sitedeki sayfalar
  const SAYFALAR = [
    ["index.html", "Ana sayfa"],
    ["index.html#aramaFormu", "Ana sayfa — klinik psikolog arama"],
    ["index.html#yazilar", "Ana sayfa — blog yazıları"],
    ["hakkimizda.html", "Hakkımızda"],
    ["iletisim.html", "İletişim"],
    ["destek.html", "Destek"],
    ["kvkk-aydinlatma.html", "KVKK Aydınlatma Metni"],
    ["gizlilik-politikasi.html", "Gizlilik Politikası"],
    ["cerez-politikasi.html", "Çerez Politikası"],
    ["giris.html", "Uzman girişi"],
    ["giris.html#kayit", "Uzman kaydı (profil oluştur)"],
  ];

  let sayac = 0;
  const yeniAnahtar = () => `y${++sayac}`;

  Yonetim.bolumEkle("menuler", async (alan) => {
    const { data, error } = await sb.from("menu_ogeleri").select("id, konum, etiket, baglanti, yeni_sekme, aktif, sira").order("konum").order("sira");
    if (error) throw error;

    // Her menü için düzenlenen liste ve kayıtlı hâli (silinenleri bulmak için)
    const durum = {};
    for (const k of Object.keys(KONUMLAR)) {
      const kayitli = data.filter((o) => o.konum === k);
      durum[k] = { kayitli, liste: kayitli.map((o) => ({ ...o, anahtar: `k${o.id}` })) };
    }

    alan.innerHTML = `
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">İçerik yönetimi</p><h1>Menüler</h1>
        <p class="soluk">Sitedeki menü bağlantılarını buradan ekleyip çıkarabilir, adlarını ve sırasını değiştirebilirsiniz.
        Değişiklikler kaydettiğiniz anda bütün sayfalarda geçerli olur. «Uzman Girişi» ve «Profil Oluştur» düğmeleri sabittir.</p></div></section>
      ${Object.entries(KONUMLAR)
        .map(
          ([k, T]) => `
        <section class="blok panel-kart menu-duzen" data-konum="${k}">
          <h2>${esc(T.ad)}</h2>
          <p class="alan-ipucu">${esc(T.aciklama)}</p>
          <div class="menu-onizleme ${k === "alt" ? "alt-onizleme" : ""}" aria-label="${esc(T.ad)} önizlemesi" data-onizleme></div>
          <ol class="menu-satirlar" data-satirlar></ol>
          <div class="mesaj" role="status" hidden data-mesaj></div>
          <div class="duzen-alt">
            <button class="btn btn-cizgi btn-kucuk" type="button" data-ekle>+ Bağlantı ekle</button>
            <button class="btn btn-ana btn-kucuk" type="button" data-kaydet>${esc(T.ad)} kaydet</button>
          </div>
        </section>`
        )
        .join("")}`;

    function satirHtml(o, i, n) {
      const secenekler = SAYFALAR.map(([d, ad]) => `<option value="${esc(d)}" ${d === o.baglanti ? "selected" : ""}>${esc(ad)}</option>`).join("");
      return `<li class="menu-satir ${o.aktif ? "" : "pasif"}" data-anahtar="${o.anahtar}">
        <div class="menu-sira">
          <button class="ikon-dugme" type="button" data-yukari ${i === 0 ? "disabled" : ""} aria-label="Yukarı taşı" title="Yukarı taşı">${ikon("asagi")}</button>
          <button class="ikon-dugme ters" type="button" data-asagi ${i === n - 1 ? "disabled" : ""} aria-label="Aşağı taşı" title="Aşağı taşı">${ikon("asagi")}</button>
        </div>
        <div class="menu-alanlar">
          <div class="form-alani"><label class="alan-etiket" for="e-${o.anahtar}">Görünen ad</label>
            <input class="girdi" id="e-${o.anahtar}" data-alan="etiket" maxlength="40" value="${esc(o.etiket || "")}"></div>
          <div class="form-alani"><label class="alan-etiket" for="b-${o.anahtar}">Bağlantı</label>
            <div class="menu-baglanti-secim">
              <select class="girdi" data-sayfa aria-label="Sitedeki bir sayfayı seçin"><option value="">Sayfa seç…</option>${secenekler}</select>
              <input class="girdi" id="b-${o.anahtar}" data-alan="baglanti" maxlength="500" value="${esc(o.baglanti || "")}" placeholder="ör. hakkimizda.html ya da https://…">
            </div></div>
          <div class="menu-secenekler">
            <label class="onay-kutusu"><input type="checkbox" data-alan="aktif" ${o.aktif ? "checked" : ""}> <span>Sitede göster</span></label>
            <label class="onay-kutusu"><input type="checkbox" data-alan="yeni_sekme" ${o.yeni_sekme ? "checked" : ""}> <span>Yeni sekmede aç</span></label>
            <button class="btn btn-cizgi btn-kucuk tehlike" type="button" data-sil>Kaldır</button>
          </div>
        </div>
      </li>`;
    }

    function onizleme(k) {
      const gorunen = durum[k].liste.filter((o) => o.aktif && o.etiket.trim());
      const kutu = alan.querySelector(`[data-konum="${k}"] [data-onizleme]`);
      kutu.innerHTML = gorunen.length
        ? gorunen.map((o) => `<span class="${k === "ust" ? "metin-link" : ""}">${esc(o.etiket)}</span>`).join("")
        : `<span class="alan-ipucu">Bu menüde gösterilecek bağlantı yok.</span>`;
    }

    function ciz(k) {
      const L = durum[k].liste;
      const kutu = alan.querySelector(`[data-konum="${k}"]`);
      kutu.querySelector("[data-satirlar]").innerHTML = L.length ? L.map((o, i) => satirHtml(o, i, L.length)).join("") : `<li class="bos-not">Henüz bağlantı yok.</li>`;
      onizleme(k);
    }

    function mesaj(k, metin, tur) {
      Yonetim.mesaj(alan.querySelector(`[data-konum="${k}"] [data-mesaj]`), metin, tur);
    }

    for (const k of Object.keys(KONUMLAR)) {
      const kutu = alan.querySelector(`[data-konum="${k}"]`);
      const bul = (el) => durum[k].liste.find((o) => o.anahtar === el.closest("[data-anahtar]").dataset.anahtar);

      kutu.addEventListener("input", (e) => {
        const alanAdi = e.target.dataset.alan;
        if (!alanAdi) return;
        const o = bul(e.target);
        o[alanAdi] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        if (alanAdi === "aktif") e.target.closest(".menu-satir").classList.toggle("pasif", !o.aktif);
        if (alanAdi === "baglanti") {
          const s = e.target.closest(".menu-satir").querySelector("[data-sayfa]");
          s.value = SAYFALAR.some(([d]) => d === o.baglanti) ? o.baglanti : "";
        }
        Yonetim.kirliYap(true);
        onizleme(k);
      });
      kutu.addEventListener("change", (e) => {
        if (!e.target.matches("[data-sayfa]") || !e.target.value) return;
        const o = bul(e.target);
        o.baglanti = e.target.value;
        e.target.closest(".menu-satir").querySelector('[data-alan="baglanti"]').value = o.baglanti;
        // Ad boşsa sayfanın adını öner
        if (!o.etiket.trim()) {
          o.etiket = SAYFALAR.find(([d]) => d === o.baglanti)[1].replace(/^Ana sayfa — /, "").replace(/^./, (h) => h.toLocaleUpperCase("tr"));
          e.target.closest(".menu-satir").querySelector('[data-alan="etiket"]').value = o.etiket;
        }
        Yonetim.kirliYap(true);
        onizleme(k);
      });
      kutu.addEventListener("click", (e) => {
        const d = e.target.closest("button");
        if (!d) return;
        const L = durum[k].liste;
        if (d.matches("[data-ekle]")) {
          L.push({ anahtar: yeniAnahtar(), konum: k, etiket: "", baglanti: "", yeni_sekme: false, aktif: true });
          ciz(k);
          kutu.querySelector(`[data-anahtar="${L[L.length - 1].anahtar}"] [data-alan="etiket"]`).focus();
          Yonetim.kirliYap(true);
          return;
        }
        if (d.matches("[data-kaydet]")) return kaydet(k, d);
        const o = bul(d);
        const i = L.indexOf(o);
        if (d.matches("[data-sil]")) L.splice(i, 1);
        else if (d.matches("[data-yukari]") && i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]];
        else if (d.matches("[data-asagi]") && i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]];
        else return;
        Yonetim.kirliYap(true);
        ciz(k);
      });
      ciz(k);
    }

    async function kaydet(k, dugme) {
      const { liste, kayitli } = durum[k];
      // Denetim
      for (const [i, o] of liste.entries()) {
        o.etiket = o.etiket.trim();
        o.baglanti = o.baglanti.trim();
        if (!o.etiket) return mesaj(k, `${i + 1}. bağlantının görünen adını yazın.`, "hata");
        if (!o.baglanti) return mesaj(k, `«${o.etiket}» için bir bağlantı seçin ya da yazın.`, "hata");
        if (!Yonetim.baglantiUygun(o.baglanti))
          return mesaj(k, `«${o.etiket}» bağlantısı geçerli değil. Sitedeki bir sayfa (ör. hakkimizda.html), https:// ile başlayan bir adres ya da mailto: kullanın.`, "hata");
      }
      dugme.disabled = true;
      try {
        const kalan = new Set(liste.filter((o) => o.id).map((o) => o.id));
        const silinecek = kayitli.filter((o) => !kalan.has(o.id)).map((o) => o.id);
        if (silinecek.length) {
          const { error } = await sb.from("menu_ogeleri").delete().in("id", silinecek);
          if (error) throw error;
        }
        for (const [i, o] of liste.entries()) {
          const kayit = { konum: k, etiket: o.etiket, baglanti: o.baglanti, yeni_sekme: !!o.yeni_sekme, aktif: !!o.aktif, sira: i + 1 };
          if (o.id) {
            const eski = kayitli.find((x) => x.id === o.id);
            if (eski && ["etiket", "baglanti", "yeni_sekme", "aktif", "sira"].every((a) => eski[a] === kayit[a])) continue;
            const { error } = await sb.from("menu_ogeleri").update(kayit).eq("id", o.id);
            if (error) throw error;
          } else {
            const { data: y, error } = await sb.from("menu_ogeleri").insert(kayit).select("id").single();
            if (error) throw error;
            o.id = y.id;
          }
          Object.assign(o, kayit);
        }
        durum[k].kayitli = liste.map((o) => ({ id: o.id, konum: k, etiket: o.etiket, baglanti: o.baglanti, yeni_sekme: !!o.yeni_sekme, aktif: !!o.aktif, sira: o.sira }));
        Yonetim.kirliYap(false);
        // Bu sayfanın kendi üst/alt menüsü de hemen güncellensin (önbellek de yenilenir)
        if (typeof SiteIcerik !== "undefined") SiteIcerik.menuyuYenile();
        const fazla = liste.filter((o) => o.aktif).length > KONUMLAR[k].oneri;
        mesaj(
          k,
          `${KONUMLAR[k].ad} kaydedildi. Sitede hemen geçerli olur.${fazla ? ` Not: ${KONUMLAR[k].oneri}'dan fazla bağlantı menüyü kalabalıklaştırabilir.` : ""}`,
          "basari"
        );
        ciz(k);
      } catch (e) {
        mesaj(k, "Kaydedilemedi: " + Yonetim.hataMetni(e), "hata");
      } finally {
        dugme.disabled = false;
      }
    }
  });
})();
