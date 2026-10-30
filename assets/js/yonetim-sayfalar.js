/*
 * YÖNETİM PANELİ — SABİT SAYFALAR
 *  #sayfalar                 → Düzenlenebilir sayfaların listesi
 *  #sayfa/<kod>[/<sürüm no>] → Düzenleyici + sürüm geçmişi
 *
 * Sürüm mantığı (sayfa_surumleri tablosu):
 *  - Her kaydetme YENİ bir sürüm oluşturur; kaydedilmiş sürüm sonradan değişmez.
 *  - Bir sayfanın aynı anda tek bir "yayında" sürümü olur. Yeni sürüm yayımlanınca eskisi "arşiv" olur.
 *  - Eski bir sürümü yeniden yayımlamak = o sürüme geri dönmek.
 *  - Yayında sürüm yoksa sitede sayfa dosyasındaki orijinal metin görünür.
 *  - Hiç yayımlanmamış taslaklar silinebilir; yayımlanmış sürümler (hukuki iz) silinemez.
 * İçerik kaydetmeden önce ve sitede gösterilmeden önce GuvenliHtml (DOMPurify) ile temizlenir.
 */
(() => {
  const sb = Yonetim.sb;
  const SAYFALAR = {
    hakkimizda: { ad: "Hakkımızda", dosya: "hakkimizda.html", hukuki: false },
    iletisim: { ad: "İletişim", dosya: "iletisim.html", hukuki: false },
    "kvkk-aydinlatma": { ad: "KVKK Aydınlatma Metni", dosya: "kvkk-aydinlatma.html", hukuki: true },
    "gizlilik-politikasi": { ad: "Gizlilik Politikası", dosya: "gizlilik-politikasi.html", hukuki: true },
    "cerez-politikasi": { ad: "Çerez Politikası", dosya: "cerez-politikasi.html", hukuki: true },
  };
  const SURUM_DURUM = {
    yayinda: { ad: "Yayında", sinif: "yayinda" },
    taslak: { ad: "Taslak", sinif: "taslak" },
    arsiv: { ad: "Eski sürüm", sinif: "" },
  };
  const zaman = (t) => (t ? new Date(t).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

  // ================= LİSTE =================
  Yonetim.bolumEkle("sayfalar", async (alan) => {
    const { data, error } = await sb.from("sayfa_surumleri").select("sayfa, durum, yayin_tarihi, olusturulma").order("olusturulma", { ascending: false });
    if (error) throw error;
    alan.innerHTML = `
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">İçerik yönetimi</p><h1>Sabit sayfalar</h1>
        <p class="soluk">Sayfa metinlerini buradan düzenleyebilirsiniz. Sayfa adresleri değişmez. Her kayıt yeni bir sürüm olarak saklanır; istediğiniz zaman eski bir sürüme dönebilirsiniz.</p></div></section>
      <div class="sayfa-kartlari">
        ${Object.entries(SAYFALAR)
          .map(([kod, s]) => {
            const surumler = data.filter((x) => x.sayfa === kod);
            const yayinda = surumler.find((x) => x.durum === "yayinda");
            const taslak = surumler.filter((x) => x.durum === "taslak").length;
            return `<a class="sayfa-kart" href="#sayfa/${kod}">
              <strong>${esc(s.ad)}</strong>
              <span class="alan-ipucu">${esc(s.dosya)}${s.hukuki ? " · hukuki metin" : ""}</span>
              <span class="panel-durum ${yayinda ? "yayinda" : ""}">${yayinda ? `Panelden düzenlenmiş · ${esc(tarihMetni(yayinda.yayin_tarihi))}` : "Orijinal metin yayında"}</span>
              ${taslak ? `<span class="alan-ipucu">${taslak} taslak sürüm</span>` : ""}
            </a>`;
          })
          .join("")}
      </div>
      <p class="yonetim-not">Sık sorulan sorular sayfası henüz sitede yok; sayfa oluşturulduğunda bu listeye eklenecek.</p>`;
  });

  // ================= DÜZENLEYİCİ =================
  Yonetim.bolumEkle("sayfa", async (alan, param) => {
    const [kod, surumNo] = (param || "").split("/");
    const S = SAYFALAR[kod];
    if (!S) {
      location.hash = "#sayfalar";
      return;
    }

    async function surumleriGetir() {
      const { data, error } = await sb
        .from("sayfa_surumleri")
        .select("id, baslik, giris, icerik, meta_baslik, meta_aciklama, surum_notu, durum, olusturulma, yayin_tarihi")
        .eq("sayfa", kod)
        .order("olusturulma", { ascending: false });
      if (error) throw error;
      return data;
    }

    // Sitedeki dosyadan orijinal metni okur (henüz hiç sürüm yoksa başlangıç noktası)
    async function orijinalGetir() {
      const y = await fetch(`${S.dosya}?t=${Date.now()}`, { cache: "no-store" });
      if (!y.ok) throw new Error("Sayfanın orijinal metni okunamadı.");
      const belge = new DOMParser().parseFromString(await y.text(), "text/html");
      const icerik = belge.querySelector("[data-sayfa-icerik]");
      return {
        id: null,
        baslik: (belge.querySelector("[data-sayfa-baslik]")?.textContent || S.ad).replace(/\s+/g, " ").trim(),
        giris: (belge.querySelector("[data-sayfa-giris]")?.textContent || "").replace(/\s+/g, " ").trim(),
        icerik: icerik ? icerik.innerHTML.replace(/<!--[\s\S]*?-->/g, "").trim() : "",
        meta_baslik: (belge.querySelector("title")?.textContent || "").trim().slice(0, 70),
        meta_aciklama: (belge.querySelector('meta[name="description"]')?.getAttribute("content") || "").trim().slice(0, 170),
        durum: "orijinal",
      };
    }

    let surumler = await surumleriGetir();
    let aktif = surumNo ? surumler.find((x) => String(x.id) === surumNo) : surumler[0];
    if (!aktif) aktif = await orijinalGetir();
    const yayindaki = surumler.find((x) => x.durum === "yayinda");

    const surumSatiri = (x) => {
      const d = SURUM_DURUM[x.durum] || SURUM_DURUM.taslak;
      const silinebilir = x.durum === "taslak" && !x.yayin_tarihi;
      return `<li class="${aktif.id === x.id ? "secili" : ""}">
        <div class="surum-ust"><strong>${esc(zaman(x.olusturulma))}</strong><span class="panel-durum ${d.sinif}">${d.ad}</span></div>
        ${x.surum_notu ? `<span class="alan-ipucu">${esc(x.surum_notu)}</span>` : ""}
        ${x.yayin_tarihi ? `<span class="alan-ipucu">Yayımlandı: ${esc(zaman(x.yayin_tarihi))}</span>` : ""}
        <div class="surum-dugmeler">
          ${aktif.id === x.id ? `<span class="alan-ipucu">Düzenleyicide açık</span>` : `<a class="btn btn-cizgi btn-kucuk" href="#sayfa/${kod}/${x.id}">Aç</a>`}
          <a class="btn btn-cizgi btn-kucuk" href="${S.dosya}?onizleme=${x.id}" target="_blank" rel="noopener">Önizle</a>
          ${x.durum !== "yayinda" ? `<button class="btn btn-cizgi btn-kucuk" type="button" data-yayimla="${x.id}">${x.durum === "arsiv" ? "Bu sürüme geri dön" : "Yayımla"}</button>` : ""}
          ${silinebilir ? `<button class="btn btn-cizgi btn-kucuk tehlike" type="button" data-sil="${x.id}">Sil</button>` : ""}
        </div>
      </li>`;
    };

    alan.innerHTML = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="#sayfalar">Sabit sayfalar</a></li><li><span aria-current="page">${esc(S.ad)}</span></li></ol></nav>
      <section class="panel-baslik">
        <div><p class="bolum-ust-yazi">Sabit sayfa · ${esc(S.dosya)}</p><h1>${esc(S.ad)}</h1>
          <p class="soluk">${
            yayindaki
              ? `Sitede panelden yayımlanan sürüm görünüyor (${esc(zaman(yayindaki.yayin_tarihi))}).`
              : "Sitede sayfa dosyasındaki orijinal metin görünüyor."
          } ${aktif.durum === "orijinal" ? "Düzenleyicide orijinal metin açık." : `Düzenleyicide ${esc(zaman(aktif.olusturulma))} tarihli sürüm açık.`}</p></div>
        <a class="btn btn-cizgi btn-kucuk" href="${S.dosya}" target="_blank" rel="noopener">${ikon("disari")}Sayfayı sitede aç</a>
      </section>
      ${S.hukuki ? `<div class="mesaj mesaj-bilgi">Bu bir hukuki metindir. Yayımlanan her sürüm tarihiyle saklanır ve silinemez; gerektiğinde eski bir sürüme geri dönebilirsiniz.</div>` : ""}
      <div class="icerik-duzen sayfa-duzen">
        <form class="blok panel-kart" id="sayfaFormu" novalidate>
          <div class="form-alani"><label class="alan-etiket" for="sBaslik">Sayfa başlığı *</label>
            <input class="girdi" id="sBaslik" maxlength="160" value="${esc(aktif.baslik || "")}"></div>
          <div class="form-alani"><label class="alan-etiket" for="sGiris">Giriş metni (başlığın altındaki kısa paragraf)</label>
            <textarea class="girdi" id="sGiris" rows="3" maxlength="1500">${esc(aktif.giris || "")}</textarea></div>
          <div class="form-alani">
            <span class="alan-etiket" id="editorEtiket">Sayfa içeriği</span>
            <div class="editor-cubuk" role="toolbar" aria-label="Biçimlendirme">
              <button type="button" data-komut="formatBlock" data-deger="h2" title="Ana başlık">Başlık</button>
              <button type="button" data-komut="formatBlock" data-deger="h3" title="Alt başlık">Alt başlık</button>
              <button type="button" data-komut="formatBlock" data-deger="p" title="Normal paragraf">Paragraf</button>
              <span class="ayrac" aria-hidden="true"></span>
              <button type="button" data-komut="bold" title="Kalın"><strong>K</strong></button>
              <button type="button" data-komut="italic" title="İtalik"><em>İ</em></button>
              <span class="ayrac" aria-hidden="true"></span>
              <button type="button" data-komut="insertUnorderedList" title="Madde işaretli liste">• Liste</button>
              <button type="button" data-komut="insertOrderedList" title="Numaralı liste">1. Liste</button>
              <span class="ayrac" aria-hidden="true"></span>
              <button type="button" data-baglanti title="Seçili metne bağlantı ekle">Bağlantı</button>
              <button type="button" data-komut="unlink" title="Bağlantıyı kaldır">Bağlantıyı kaldır</button>
              <span class="ayrac" aria-hidden="true"></span>
              <button type="button" data-komut="undo" title="Geri al">↶ Geri al</button>
              <button type="button" data-komut="redo" title="Yinele">↷ Yinele</button>
            </div>
            <div class="editor-alan kurumsal-metin" id="editor" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="editorEtiket"></div>
            <p class="alan-ipucu">Word'den ya da başka bir yerden yapıştırdığınız metnin biçimi sadeleştirilir (yalnızca başlık, paragraf, kalın, italik, liste ve bağlantı kalır).
              Sarı "eksik" kutucukları yayın öncesi doldurulacak yerleri gösterir; bunları normal metin gibi düzenleyebilirsiniz.</p>
          </div>
          <details class="metin-ac">
            <summary>Arama motoru ayarları (meta başlık ve açıklama)</summary>
            <div class="form-alani" style="margin-top:12px"><label class="alan-etiket" for="sMetaBaslik">Meta başlık (en fazla 70 karakter)</label>
              <input class="girdi" id="sMetaBaslik" maxlength="70" value="${esc(aktif.meta_baslik || "")}"></div>
            <div class="form-alani"><label class="alan-etiket" for="sMetaAciklama">Meta açıklama (en fazla 170 karakter)</label>
              <textarea class="girdi" id="sMetaAciklama" rows="2" maxlength="170">${esc(aktif.meta_aciklama || "")}</textarea></div>
          </details>
          <div class="form-alani" style="margin-top:14px"><label class="alan-etiket" for="sNot">Sürüm notu (isteğe bağlı)</label>
            <input class="girdi" id="sNot" maxlength="200" placeholder="Ör. Saklama süreleri güncellendi"></div>
          <div class="mesaj" id="sayfaMesaj" role="status" hidden></div>
          <div class="duzen-alt karar-dugmeleri" style="justify-content:flex-end">
            <button class="btn btn-cizgi btn-kucuk" type="button" id="onizleDugme">${ikon("goz")}Önizle</button>
            <button class="btn btn-cizgi btn-kucuk" type="button" id="taslakDugme">Taslak olarak kaydet</button>
            <button class="btn btn-ana btn-kucuk" type="button" id="yayimlaDugme">Kaydet ve yayımla</button>
          </div>
        </form>
        <aside class="blok panel-kart onizleme-kutu">
          <h2>Sürüm geçmişi</h2>
          ${
            surumler.length
              ? `<ul class="surum-listesi">${surumler.map(surumSatiri).join("")}</ul>`
              : `<p class="alan-ipucu">Henüz panelden kaydedilmiş sürüm yok. İlk kaydınız ilk sürüm olur.</p>`
          }
          ${
            yayindaki
              ? `<p class="alan-ipucu" style="margin-top:14px">Panelden yayımlanan sürümü kaldırırsanız sitede sayfa dosyasındaki orijinal metin görünür.</p>
                 <button class="btn btn-cizgi btn-kucuk" type="button" id="kaldirDugme">Yayından kaldır (orijinal metne dön)</button>`
              : ""
          }
          <div class="mesaj" id="surumMesaj" role="status" hidden></div>
        </aside>
      </div>`;

    const $ = (x) => document.getElementById(x);
    const editor = $("editor");
    editor.innerHTML = GuvenliHtml.temizle(aktif.icerik);
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch (e) {
      /* eski tarayıcı */
    }

    // --- Değişiklik takibi ---
    const ilkHal = () => JSON.stringify(formDegeri(false));
    let kayitliHal = null;
    function formDegeri(temizle = true) {
      return {
        baslik: $("sBaslik").value.trim(),
        giris: $("sGiris").value.trim() || null,
        icerik: temizle ? GuvenliHtml.temizle(editor.innerHTML) : editor.innerHTML,
        meta_baslik: $("sMetaBaslik").value.trim() || null,
        meta_aciklama: $("sMetaAciklama").value.trim() || null,
      };
    }
    const degisti = () => JSON.stringify(formDegeri(false)) !== kayitliHal;
    kayitliHal = ilkHal();
    const kirlilik = () => Yonetim.kirliYap(degisti());
    $("sayfaFormu").addEventListener("input", kirlilik);
    editor.addEventListener("input", kirlilik);

    // Sarı kutuya tıklanınca yalnızca kutunun içi seçilir (üç kez tıklamada yandaki satırlar da seçilip silinmesin)
    editor.addEventListener("click", (e) => {
      const kutu = e.target.closest && e.target.closest("span.eksik");
      if (!kutu || !editor.contains(kutu)) return;
      const aralik = document.createRange();
      aralik.selectNodeContents(kutu);
      const secim = window.getSelection();
      secim.removeAllRanges();
      secim.addRange(aralik);
    });

    // Sarı "eksik" kutusunun içine yazılmaya başlanınca kutu kalkar, yazılan metin normal metne dönüşür
    editor.addEventListener("input", () => {
      const secim = window.getSelection();
      if (!secim || !secim.rangeCount) return;
      const dugum = secim.anchorNode;
      const kutu = dugum && (dugum.nodeType === 1 ? dugum : dugum.parentElement)?.closest("span.eksik");
      if (!kutu || !editor.contains(kutu)) return;
      const ofset = secim.anchorOffset;
      kutu.replaceWith(...kutu.childNodes);
      try {
        const aralik = document.createRange();
        aralik.setStart(dugum, Math.min(ofset, dugum.nodeType === 3 ? dugum.length : dugum.childNodes.length));
        aralik.collapse(true);
        secim.removeAllRanges();
        secim.addRange(aralik);
      } catch (e) {
        /* imleç konumu korunamazsa sorun değil */
      }
    });

    // --- Araç çubuğu ---
    alan.querySelectorAll("[data-komut]").forEach((d) =>
      d.addEventListener("mousedown", (e) => {
        e.preventDefault(); // seçim kaybolmasın
        editor.focus();
        const deger = d.dataset.deger;
        document.execCommand(d.dataset.komut, false, deger ? (d.dataset.komut === "formatBlock" ? `<${deger}>` : deger) : null);
        kirlilik();
      })
    );
    alan.querySelector("[data-baglanti]").addEventListener("mousedown", (e) => {
      e.preventDefault();
      const secim = window.getSelection();
      if (!secim || secim.isCollapsed || !editor.contains(secim.anchorNode)) {
        Yonetim.mesaj($("sayfaMesaj"), "Bağlantı eklemek için önce metinde bir kelime ya da cümle seçin.", "uyari");
        return;
      }
      const aralik = secim.getRangeAt(0).cloneRange();
      const adres = (window.prompt("Bağlantı adresi (ör. https://… , kvkk-aydinlatma.html#haklar ya da mailto:…):", "https://") || "").trim();
      if (!adres || adres === "https://") return;
      if (!/^(https?:\/\/[^\s<>"'`]+|mailto:[^\s<>"'`]+|tel:[0-9+ ]+|#[A-Za-z0-9_-]*|[a-z0-9-]+\.html([?#][^\s<>"'`]*)?)$/i.test(adres)) {
        Yonetim.mesaj($("sayfaMesaj"), "Bağlantı adresi geçersiz. https:// ile başlayan bir adres, bir site sayfası (ör. hakkimizda.html) ya da mailto: yazın.", "hata");
        return;
      }
      secim.removeAllRanges();
      secim.addRange(aralik);
      document.execCommand("createLink", false, adres);
      kirlilik();
    });

    // Yapıştırma: biçim sadeleştirilir
    editor.addEventListener("paste", (e) => {
      const html = e.clipboardData && e.clipboardData.getData("text/html");
      const metin = e.clipboardData && e.clipboardData.getData("text/plain");
      e.preventDefault();
      if (html) document.execCommand("insertHTML", false, GuvenliHtml.yapistirilaniTemizle(html));
      else if (metin)
        document.execCommand(
          "insertHTML",
          false,
          metin
            .split(/\n{2,}/)
            .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
            .join("")
        );
      kirlilik();
    });

    // --- Kaydetme ---
    function denetle(d) {
      if (d.baslik.length < 2) return "Sayfa başlığı en az 2 karakter olmalı.";
      const duz = new DOMParser().parseFromString(d.icerik, "text/html").body.textContent.trim();
      if (duz.length < 20) return "Sayfa içeriği çok kısa görünüyor. Yanlışlıkla silinmiş olabilir mi?";
      if (d.icerik.length > 200000) return "Sayfa içeriği çok uzun.";
      return null;
    }

    async function kaydet() {
      const d = formDegeri(true);
      const hata = denetle(d);
      if (hata) throw new Error(hata);
      const { data, error } = await sb
        .from("sayfa_surumleri")
        .insert({ sayfa: kod, ...d, surum_notu: $("sNot").value.trim() || null })
        .select("id")
        .single();
      if (error) throw error;
      kayitliHal = JSON.stringify(formDegeri(false));
      Yonetim.kirliYap(false);
      return data.id;
    }

    async function yayimla(id) {
      const { error } = await sb.rpc("sayfa_surumu_yayimla", { p_surum: Number(id) });
      if (error) throw error;
    }

    const dugmeIslem = (dugme, islem) =>
      dugme.addEventListener("click", async () => {
        const ilk = dugme.innerHTML;
        dugme.disabled = true;
        dugme.textContent = "Lütfen bekleyin…";
        try {
          await islem();
        } catch (e) {
          console.error(e);
          Yonetim.mesaj($("sayfaMesaj"), Yonetim.hataMetni(e), "hata");
        } finally {
          if (document.body.contains(dugme)) {
            dugme.disabled = false;
            dugme.innerHTML = ilk;
          }
        }
      });

    dugmeIslem($("taslakDugme"), async () => {
      const id = await kaydet();
      await Yonetim.git(`#sayfa/${kod}/${id}`);
      Yonetim.mesaj(document.getElementById("sayfaMesaj"), "Taslak kaydedildi. Sitede henüz görünmüyor; önizleyebilir ya da yayımlayabilirsiniz.", "basari");
    });
    dugmeIslem($("yayimlaDugme"), async () => {
      const id = degisti() || !aktif.id ? await kaydet() : aktif.id;
      await yayimla(id);
      await Yonetim.git(`#sayfa/${kod}/${id}`);
      Yonetim.mesaj(document.getElementById("sayfaMesaj"), "Yayımlandı. Sayfa sitede güncellendi.", "basari");
    });
    dugmeIslem($("onizleDugme"), async () => {
      // Önizleme kaydedilmiş bir sürümü gösterir; değişiklik varsa önce taslak olarak kaydedilir.
      const pencere = window.open("", "_blank");
      try {
        const id = degisti() || !aktif.id ? await kaydet() : aktif.id;
        if (pencere) pencere.location = `${S.dosya}?onizleme=${id}`;
        if (String(id) !== String(aktif.id)) await Yonetim.git(`#sayfa/${kod}/${id}`);
      } catch (e) {
        if (pencere) pencere.close();
        throw e;
      }
    });

    // --- Sürüm geçmişi işlemleri ---
    alan.querySelectorAll("[data-yayimla]").forEach((d) =>
      Yonetim.onayliDugme(d, "Yayımlamak için tekrar basın", async () => {
        try {
          await yayimla(d.dataset.yayimla);
          await Yonetim.git(`#sayfa/${kod}/${d.dataset.yayimla}`);
          Yonetim.mesaj(document.getElementById("sayfaMesaj"), "Seçilen sürüm yayımlandı; sitede artık bu sürüm görünüyor.", "basari");
        } catch (e) {
          Yonetim.mesaj($("surumMesaj"), Yonetim.hataMetni(e), "hata");
        }
      })
    );
    alan.querySelectorAll("[data-sil]").forEach((d) =>
      Yonetim.onayliDugme(d, "Silmek için tekrar basın", async () => {
        const { error } = await sb.from("sayfa_surumleri").delete().eq("id", d.dataset.sil);
        if (error) return Yonetim.mesaj($("surumMesaj"), Yonetim.hataMetni(error), "hata");
        await Yonetim.git(`#sayfa/${kod}`);
        Yonetim.mesaj(document.getElementById("sayfaMesaj"), "Taslak silindi.", "basari");
      })
    );
    const kaldir = $("kaldirDugme");
    if (kaldir)
      Yonetim.onayliDugme(kaldir, "Orijinal metne dönmek için tekrar basın", async () => {
        const { error } = await sb.rpc("sayfa_yayindan_kaldir", { p_sayfa: kod });
        if (error) return Yonetim.mesaj($("surumMesaj"), Yonetim.hataMetni(error), "hata");
        await Yonetim.git(`#sayfa/${kod}`);
        Yonetim.mesaj(document.getElementById("sayfaMesaj"), "Panelden yayımlanan sürüm kaldırıldı; sitede orijinal metin görünüyor.", "basari");
      });
  });
})();
