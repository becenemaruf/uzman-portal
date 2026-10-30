/*
 * UZMAN PANELİ — YAZILAR
 *  #yazilarim          → Uzmanın kendi blog yazıları (durumlarıyla)
 *  #yazi/yeni, #yazi/<no> → Yazı düzenleyici: taslak kaydet / incelemeye gönder / incelemeden geri çek / sil
 *  #gelisim            → "Mesleki Gelişim": yönetimin uzmanlara yönelik platform yazıları
 *  #gelisim/<adres>    → Platform yazısını panel içinde okuma
 *
 * Kurallar veritabanındadır: uzman yazısını kendisi yayınlayamaz (yalnızca taslak ↔ incelemede);
 * yayındaki yazı değiştirilirse yeniden incelemeye düşer. Metin düz yazıdır (yaziGovdesi ile biçimlenir).
 */
const Yazilar = (() => {
  const sb = Oturum.istemci;

  const DURUM = {
    taslak: { ad: "Taslak", sinif: "taslak" },
    incelemede: { ad: "İncelemede", sinif: "incelemede" },
    yayinda: { ad: "Yayında", sinif: "yayinda" },
    duzeltme_istendi: { ad: "Düzeltme istendi", sinif: "uyari" },
    reddedildi: { ad: "Kabul edilmedi", sinif: "uyari" },
  };
  const rozet = (d) => `<span class="panel-durum ${(DURUM[d] || {}).sinif || ""}">${esc((DURUM[d] || {}).ad || d)}</span>`;

  const kirinti = (...p) =>
    `<nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="panel.html#">Panel</a></li>${p
      .map((x, i) => (i === p.length - 1 ? `<li><span aria-current="page">${esc(x[0])}</span></li>` : `<li><a href="${x[1]}">${esc(x[0])}</a></li>`))
      .join("")}</ol></nav>`;

  const BICIM_YARDIMI = `<details class="bicim-yardimi"><summary>Metni nasıl biçimlendiririm?</summary>
    <ul>
      <li>Paragrafların arasında <strong>bir boş satır</strong> bırakın.</li>
      <li>Ara başlık için satırın başına <code>## </code> yazın. Örnek: <code>## Kaygı nasıl fark edilir?</code></li>
      <li>Madde işaretli liste için her satırın başına <code>- </code> yazın.</li>
      <li>Bir sözcüğü kalın yapmak için iki yıldız arasına alın: <code>**önemli**</code></li>
    </ul></details>`;

  // Panel ana sayfası için özet: kendi yazılarının sayısı + son mesleki gelişim yazıları
  async function ozet(uzmanId) {
    try {
      const [kendi, gelisim] = await Promise.all([
        sb.from("yazilar").select("durum").eq("uzman_id", uzmanId),
        sb.from("yazilar").select("slug, baslik, kategori, yayin_tarihi").eq("tur", "platform").eq("durum", "yayinda").in("hedef", ["uzmanlar", "ikisi"]).order("yayin_tarihi", { ascending: false }).limit(3),
      ]);
      const say = (d) => (kendi.data || []).filter((y) => y.durum === d).length;
      return { toplam: (kendi.data || []).length, yayinda: say("yayinda"), bekleyen: say("incelemede"), duzeltme: say("duzeltme_istendi"), gelisim: gelisim.data || [] };
    } catch (e) {
      return { toplam: 0, yayinda: 0, bekleyen: 0, duzeltme: 0, gelisim: [] };
    }
  }

  function kartlar(o) {
    const yeniMi = (t) => Date.now() - new Date(t).getTime() < 14 * 86400000;
    return `<div class="panel-izgara">
      <section class="blok panel-kart">
        <h2>Yazılarım ${o.duzeltme ? `<span class="sekme-sayi okunmamis-sayi">${o.duzeltme} düzeltme</span>` : ""}</h2>
        <p class="soluk">Danışanlara yönelik bilgilendirici yazılarınız ana sayfadaki blogda ve profilinizde yayımlanır. Her yazı yayından önce incelenir.</p>
        <p class="alan-ipucu">${o.toplam ? `${o.toplam} yazı · ${o.yayinda} yayında${o.bekleyen ? ` · ${o.bekleyen} incelemede` : ""}` : "Henüz yazınız yok."}</p>
        <div class="panel-dugmeler"><a class="btn btn-ana btn-kucuk" href="#yazi/yeni">${ikon("yazi")}Yeni yazı</a><a class="btn btn-cizgi btn-kucuk" href="#yazilarim">Yazılarım</a></div>
      </section>
      <section class="blok panel-kart">
        <h2>Mesleki Gelişim</h2>
        <p class="soluk">Platformun uzmanlara yönelik yazıları: mesleki gelişim, mevzuat, etik ve duyurular.</p>
        ${
          o.gelisim.length
            ? `<ul class="gelisim-kisa">${o.gelisim
                .map((y) => `<li><a href="#gelisim/${encodeURIComponent(y.slug)}">${esc(y.baslik)}</a>${yeniMi(y.yayin_tarihi) ? ` <span class="yeni-rozet">Yeni</span>` : ""}<span class="alan-ipucu">${esc(tarihMetni(y.yayin_tarihi))}</span></li>`)
                .join("")}</ul>`
            : `<p class="alan-ipucu">Henüz yazı yok.</p>`
        }
        <div class="panel-dugmeler"><a class="btn btn-cizgi btn-kucuk" href="#gelisim">Tüm yazılar</a></div>
      </section>
    </div>`;
  }

  // ================= YAZILARIM =================
  async function liste(alan, profil) {
    const { data, error } = await sb.from("yazilar").select("id, slug, baslik, kategori, durum, ret_nedeni, guncellenme, yayin_tarihi").eq("uzman_id", profil.id).order("guncellenme", { ascending: false });
    if (error) throw error;
    alan.innerHTML = `${kirinti(["Yazılarım"])}
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">Uzman paneli</p><h1>Yazılarım</h1>
        <p class="soluk">Yazılarınız yönetim incelemesinden sonra ana sayfadaki blogda ve profilinizde yayımlanır.${profil.durum !== "yayinda" ? " Profiliniz yayına alınmadan yazılarınız sitede görünmez." : ""}</p></div>
        <a class="btn btn-ana" href="#yazi/yeni">+ Yeni yazı</a></section>
      ${
        data.length
          ? `<ul class="yonetim-liste">${data
              .map(
                (y) => `<li><a href="#yazi/${y.id}"><span class="yl-ana"><strong>${esc(y.baslik)}</strong>
                  <span class="alan-ipucu">${esc(y.kategori || "Kategorisiz")} · ${y.durum === "yayinda" && y.yayin_tarihi ? "yayın: " + esc(tarihMetni(y.yayin_tarihi)) : "son değişiklik: " + esc(tarihMetni(y.guncellenme))}</span>
                  ${y.ret_nedeni && ["duzeltme_istendi", "reddedildi"].includes(y.durum) ? `<span class="alan-ipucu uyari-metin">Yönetim notu: ${esc(y.ret_nedeni)}</span>` : ""}</span>${rozet(y.durum)}</a></li>`
              )
              .join("")}</ul>`
          : `<div class="bos-durum"><h2>Henüz yazınız yok</h2><p>Uzmanlık alanınızla ilgili, danışanların anlayabileceği dilde kısa bilgilendirici yazılar paylaşabilirsiniz.</p><a class="btn btn-ana" href="#yazi/yeni">İlk yazınızı yazın</a></div>`
      }
      <p class="duzen-son"><a class="btn btn-cizgi" href="panel.html#">Panele dön</a></p>`;
  }

  // ================= DÜZENLEYİCİ =================
  async function duzenle(alan, profil, id) {
    const yeni = id === "yeni";
    let y = { baslik: "", kategori: "", ozet: "", icerik: "", durum: "taslak" };
    if (!yeni) {
      const { data, error } = await sb.from("yazilar").select("id, slug, baslik, kategori, ozet, icerik, durum, ret_nedeni, yayin_tarihi").eq("id", id).eq("uzman_id", profil.id).maybeSingle();
      if (error) throw error;
      if (!data) {
        alan.innerHTML = `${kirinti(["Yazılarım", "#yazilarim"], ["Bulunamadı"])}<p class="bos-not">Bu yazı bulunamadı.</p>`;
        return;
      }
      y = data;
    }
    const { data: alanlar } = await sb.from("uzmanlik_alanlari").select("ad").eq("aktif", true).order("sira");
    const notKutusu =
      y.ret_nedeni && ["duzeltme_istendi", "reddedildi"].includes(y.durum)
        ? `<div class="mesaj mesaj-uyari"><strong>${y.durum === "duzeltme_istendi" ? "Yönetim düzeltme istedi" : "Yazı kabul edilmedi"}:</strong> ${esc(y.ret_nedeni)}</div>`
        : "";
    const durumNotu = {
      incelemede: `<div class="mesaj mesaj-bilgi">Yazınız inceleniyor. Değişiklik yapmak isterseniz önce <strong>İncelemeden geri çek</strong> düğmesine basın.</div>`,
      yayinda: `<div class="mesaj mesaj-bilgi">Bu yazı yayında. Değişiklik kaydederseniz yazı yeniden incelemeye gider ve <strong>onaylanana kadar sitede görünmez</strong>.</div>`,
    }[y.durum] || "";
    const kilitli = y.durum === "incelemede";

    alan.innerHTML = `${kirinti(["Yazılarım", "#yazilarim"], [yeni ? "Yeni yazı" : y.baslik])}
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">Yazılarım</p><h1>${yeni ? "Yeni yazı" : "Yazıyı düzenle"}</h1></div>${yeni ? "" : rozet(y.durum)}</section>
      ${notKutusu}${durumNotu}
      <form class="blok panel-kart" id="yaziFormu" novalidate>
        <div class="form-alani"><label class="alan-etiket" for="yBaslik">Başlık</label>
          <input class="girdi" id="yBaslik" maxlength="150" value="${esc(y.baslik)}" ${kilitli ? "disabled" : ""}></div>
        <div class="iki-sutun">
          <div class="form-alani"><label class="alan-etiket" for="yKategori">Konu</label>
            <input class="girdi" id="yKategori" list="yKategoriler" maxlength="60" value="${esc(y.kategori || "")}" placeholder="ör. Kaygı" ${kilitli ? "disabled" : ""}>
            <datalist id="yKategoriler">${(alanlar || []).map((a) => `<option value="${esc(a.ad)}">`).join("")}</datalist></div>
          <div class="form-alani"><span class="alan-etiket">Okuma süresi</span><p class="alan-ipucu" id="ySure">—</p></div>
        </div>
        <div class="form-alani"><label class="alan-etiket" for="yOzet">Kısa özet <span class="soluk">(kartlarda görünür)</span></label>
          <textarea class="girdi" id="yOzet" rows="2" maxlength="400" ${kilitli ? "disabled" : ""}>${esc(y.ozet || "")}</textarea></div>
        <div class="form-alani"><label class="alan-etiket" for="yIcerik">Yazı</label>
          ${BICIM_YARDIMI}
          <textarea class="girdi yazi-metin-alani" id="yIcerik" rows="16" maxlength="40000" ${kilitli ? "disabled" : ""}>${esc(y.icerik || "")}</textarea>
          <p class="alan-ipucu"><span id="ySayac">0</span> / 40.000 karakter · Danışan bilgisi, ücret, indirim ya da sonuç vaadi içeren ifadeler yayımlanmaz.</p></div>
        <div id="yDenetim" class="ifade-sonuc" aria-live="polite"></div>
        <details class="yazi-onizleme-kutu" id="yOnizlemeKutu"><summary>Önizleme</summary><article class="yazi-sayfa"><div class="yazi-govde" id="yOnizleme"></div></article></details>
        <div class="mesaj" id="yMesaj" role="status" hidden></div>
        <div class="duzen-alt">
          ${yeni ? "" : `<button class="btn btn-cizgi btn-kucuk tehlike" type="button" id="ySil">Sil</button>`}
          ${
            kilitli
              ? `<button class="btn btn-cizgi btn-kucuk" type="button" id="yGeriCek">İncelemeden geri çek</button>`
              : `<button class="btn btn-cizgi btn-kucuk" type="button" id="yTaslak">Taslak olarak kaydet</button>
                 <button class="btn btn-ana btn-kucuk" type="button" id="yGonder">${y.durum === "yayinda" ? "Değişiklikleri incelemeye gönder" : "İncelemeye gönder"}</button>`
          }
        </div>
      </form>
      <p class="duzen-son"><a class="btn btn-cizgi" href="#yazilarim">Tüm yazılarım</a></p>`;

    const $ = (x) => document.getElementById(x);
    const msj = (m, t) => {
      const el = $("yMesaj");
      el.className = `mesaj mesaj-${t}`;
      el.textContent = m;
      el.hidden = !m;
      if (m) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    function guncelle() {
      const metin = $("yIcerik").value;
      $("ySayac").textContent = sayiBicimle(metin.length);
      $("ySure").textContent = metin.trim() ? `yaklaşık ${okumaSuresi(metin)} dk` : "—";
      $("yOnizleme").innerHTML = metin.trim() ? yaziGovdesi(metin) : `<p class="soluk">Yazı boş.</p>`;
      const tum = [$("yBaslik").value, $("yOzet").value, metin].join("\n");
      const b = typeof IfadeDenetimi !== "undefined" && tum.trim() ? IfadeDenetimi.tara(tum) : [];
      $("yDenetim").innerHTML = b.length ? IfadeDenetimi.html(b) : "";
    }
    ["yBaslik", "yOzet", "yIcerik"].forEach((k) => $(k).addEventListener("input", guncelle));
    guncelle();

    async function kaydet(durum) {
      const kayit = {
        baslik: $("yBaslik").value.trim(),
        kategori: $("yKategori").value.trim() || null,
        ozet: $("yOzet").value.trim() || null,
        icerik: $("yIcerik").value.trim(),
      };
      if (kayit.baslik.length < 5) return msj("Başlık en az 5 karakter olmalı.", "hata");
      if (durum === "incelemede") {
        if (kayit.icerik.length < 400) return msj("İncelemeye göndermek için yazı en az 400 karakter olmalı.", "hata");
        if (!kayit.ozet) return msj("İncelemeye göndermeden önce kısa bir özet yazın.", "hata");
      }
      kayit.okuma_dakika = okumaSuresi(kayit.icerik);
      kayit.durum = durum;
      document.querySelectorAll("#yaziFormu button").forEach((b) => (b.disabled = true));
      let sonuc;
      if (yeni) {
        const temel = adresKisaltmasi(kayit.baslik);
        for (let i = 0; i < 4; i++) {
          const slug = i === 0 ? temel : `${temel}-${Math.random().toString(36).slice(2, 6)}`;
          sonuc = await sb.from("yazilar").insert({ ...kayit, slug, uzman_id: profil.id }).select("id").single();
          if (!sonuc.error || sonuc.error.code !== "23505") break;
        }
      } else {
        sonuc = await sb.from("yazilar").update(kayit).eq("id", y.id).select("id").single();
      }
      document.querySelectorAll("#yaziFormu button").forEach((b) => (b.disabled = false));
      if (sonuc.error) return msj("Kaydedilemedi: " + (sonuc.error.message || "bilinmeyen hata"), "hata");
      if (yeni) history.replaceState(null, "", `#yazi/${sonuc.data.id}`);
      await duzenle(alan, profil, sonuc.data.id);
      const m = $("yMesaj");
      m.className = "mesaj mesaj-basari";
      m.textContent = durum === "incelemede" ? "Yazınız incelemeye gönderildi. Onaylandığında sitede yayımlanır." : "Taslak kaydedildi.";
      m.hidden = false;
    }
    if ($("yTaslak")) $("yTaslak").addEventListener("click", () => kaydet(y.durum === "yayinda" ? "incelemede" : "taslak"));
    if ($("yGonder")) $("yGonder").addEventListener("click", () => kaydet("incelemede"));
    if ($("yGeriCek"))
      $("yGeriCek").addEventListener("click", async () => {
        const { error } = await sb.from("yazilar").update({ durum: "taslak" }).eq("id", y.id);
        if (error) return msj("Geri çekilemedi. Lütfen tekrar deneyin.", "hata");
        await duzenle(alan, profil, y.id);
      });
    if ($("ySil")) {
      let hazir = false;
      $("ySil").addEventListener("click", async () => {
        if (!hazir) {
          hazir = true;
          $("ySil").textContent = "Silmek için tekrar basın";
          setTimeout(() => {
            hazir = false;
            if ($("ySil")) $("ySil").textContent = "Sil";
          }, 5000);
          return;
        }
        const { error } = await sb.from("yazilar").delete().eq("id", y.id);
        if (error) return msj("Silinemedi. Lütfen tekrar deneyin.", "hata");
        location.hash = "#yazilarim";
      });
    }
    // "yayında" bir yazının taslak düğmesi: kaydetmek zaten incelemeye gönderir, o yüzden gizlenir
    if (y.durum === "yayinda" && $("yTaslak")) $("yTaslak").hidden = true;
  }

  // ================= MESLEKİ GELİŞİM =================
  async function gelisimListe(alan) {
    const { data, error } = await sb
      .from("yazilar")
      .select("slug, baslik, ozet, kategori, yayin_tarihi, okuma_dakika")
      .eq("tur", "platform")
      .eq("durum", "yayinda")
      .in("hedef", ["uzmanlar", "ikisi"])
      .order("yayin_tarihi", { ascending: false });
    if (error) throw error;
    alan.innerHTML = `${kirinti(["Mesleki Gelişim"])}
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">Uzman paneli</p><h1>Mesleki Gelişim</h1>
        <p class="soluk">Klinik Psikologlar platformunun uzmanlara yönelik yazıları: mesleki gelişim, mevzuat, etik ve duyurular.</p></div></section>
      ${
        data.length
          ? `<div class="gelisim-liste">${data
              .map(
                (y) => `<a class="blok panel-kart gelisim-kart" href="#gelisim/${encodeURIComponent(y.slug)}">
                  ${y.kategori ? `<span class="etiket">${esc(y.kategori)}</span>` : ""}
                  <h2>${esc(y.baslik)}</h2>${y.ozet ? `<p class="soluk">${esc(y.ozet)}</p>` : ""}
                  <span class="alan-ipucu">${esc(tarihMetni(y.yayin_tarihi))}${y.okuma_dakika ? ` · ${y.okuma_dakika} dk okuma` : ""}</span></a>`
              )
              .join("")}</div>`
          : `<p class="bos-not">Henüz yazı yok. Yeni yazılar yayımlandığında burada görünecek.</p>`
      }
      <p class="duzen-son"><a class="btn btn-cizgi" href="panel.html#">Panele dön</a></p>`;
  }

  async function gelisimOku(alan, slug) {
    const { data: y, error } = await sb
      .from("yazilar")
      .select("slug, baslik, ozet, icerik, kategori, yayin_tarihi, okuma_dakika, yazar_adi, hedef")
      .eq("tur", "platform")
      .eq("durum", "yayinda")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!y) {
      alan.innerHTML = `${kirinti(["Mesleki Gelişim", "#gelisim"], ["Bulunamadı"])}<p class="bos-not">Bu yazı bulunamadı ya da yayından kaldırıldı.</p>`;
      return;
    }
    alan.innerHTML = `${kirinti(["Mesleki Gelişim", "#gelisim"], [y.baslik])}
      <article class="blok panel-kart yazi-sayfa panel-yazi">
        ${y.kategori ? `<span class="etiket">${esc(y.kategori)}</span>` : ""}
        <h1>${esc(y.baslik)}</h1>
        ${y.ozet ? `<p class="yazi-giris">${esc(y.ozet)}</p>` : ""}
        <p class="alan-ipucu">${esc(y.yazar_adi || "Klinik Psikologlar")} · ${esc(tarihMetni(y.yayin_tarihi))}${y.okuma_dakika ? ` · ${y.okuma_dakika} dk okuma` : ""}
          ${y.hedef === "ikisi" ? ` · <a href="yazi.html?id=${encodeURIComponent(y.slug)}" target="_blank" rel="noopener">Herkese açık sayfası</a>` : ""}</p>
        <div class="yazi-govde">${yaziGovdesi(y.icerik)}</div>
      </article>
      <p class="duzen-son"><a class="btn btn-cizgi" href="#gelisim">Tüm yazılar</a></p>`;
  }

  async function ac(alan, profil, hash) {
    const [kod, ...geri] = hash.replace(/^#/, "").split("/");
    const param = decodeURIComponent(geri.join("/"));
    if (kod === "yazilarim") return liste(alan, profil);
    if (kod === "yazi") return duzenle(alan, profil, param || "yeni");
    if (kod === "gelisim") return param ? gelisimOku(alan, param) : gelisimListe(alan);
  }

  return { ac, ozet, kartlar };
})();
