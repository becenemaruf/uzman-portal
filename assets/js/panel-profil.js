/*
 * UZMAN PANELİ — PROFİL DÜZENLEME (panel.html#profil)
 *
 * Her bölüm kendi "Kaydet" düğmesiyle ayrı kaydedilir; böylece bir bölümdeki hata diğerlerini etkilemez.
 * Yazma kuralları veritabanında da (RLS + tetikleyiciler + alan kuralları) ayrıca denetlenir;
 * buradaki kontroller yalnızca uzmana anında ve anlaşılır geri bildirim vermek içindir.
 *
 *  - Ad, soyad, unvan ve unvan öneki: yalnızca taslak / ek belge / reddedildi durumunda değiştirilebilir
 *    (incelemeden sonra kilitlenir; veritabanı da engeller).
 *  - İletişim bilgileri ayrı ve gizli bir tabloda (uzman_iletisim) tutulur; yalnızca "profilimde göster"
 *    işaretli olanlar herkese açık profile yansır.
 *  - Fotoğraf tarayıcıda 640×640 boyutuna küçültülüp WebP olarak yüklenir (hızlı açılış, az depolama).
 */
const ProfilDuzenle = (() => {
  const sb = Oturum.istemci;
  const SINIR = { alan: 12, yaklasim: 8, egitim: 10, sertifika: 15, sss: 8 };
  const DUZENLENEBILIR_DURUMLAR = ["taslak", "ek_belge", "reddedildi"];

  let p = null; // uzmanlar satırı
  let kullanici = null;
  let listeler = { alanlar: [], yaklasimlar: [] };
  let secim = { alanlar: [], yaklasimlar: [] }; // seçim sırası korunur (kartta ilk 3 alan görünür)
  let egitimler = { egitim: [], sertifika: [] };
  let sss = [];
  let iletisim = null;

  /* ---------- Yardımcılar ---------- */
  const $ = (id) => document.getElementById(id);
  const say = (metin) => [...String(metin || "")].length;

  function durumYaz(bolum, metin, tur = "bilgi") {
    const el = document.querySelector(`[data-bolum="${bolum}"] .bolum-durum`);
    if (!el) return;
    el.className = `bolum-durum mesaj mesaj-${tur}`;
    el.textContent = metin;
    el.hidden = !metin;
    if (tur === "basari") setTimeout(() => (el.hidden = true), 4000);
  }

  function hataMetni(hata) {
    const m = String((hata && hata.message) || "");
    if (hata && hata.code === "23514") return "Girilen bilgilerden biri geçerli biçimde değil. Lütfen kontrol edin.";
    if (hata && hata.code === "42501") return m || "Bu değişikliği yapma yetkiniz yok.";
    if (/fetch|network/i.test(m)) return "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.";
    return "Kaydedilemedi. Lütfen tekrar deneyin.";
  }

  async function kaydetIsi(bolum, dugme, is) {
    dugme.disabled = true;
    const eski = dugme.textContent;
    dugme.textContent = "Kaydediliyor…";
    durumYaz(bolum, "");
    try {
      const sonuc = await is();
      if (sonuc === false) return; // doğrulama hatası: mesaj zaten yazıldı
      durumYaz(bolum, "Kaydedildi.", "basari");
    } catch (e) {
      console.error(e);
      durumYaz(bolum, hataMetni(e), "hata");
    } finally {
      dugme.disabled = false;
      dugme.textContent = eski;
    }
  }

  const kontrol = (sart, bolum, metin) => {
    if (!sart) durumYaz(bolum, metin, "hata");
    return sart;
  };

  function bolum(kod, baslik, aciklama, icerik, kaydetYazi = "Kaydet") {
    return `
      <form class="blok panel-kart duzen-bolum" data-bolum="${kod}" id="bolum-${kod}" novalidate>
        <h2>${baslik}</h2>
        ${aciklama ? `<p class="soluk duzen-aciklama">${aciklama}</p>` : ""}
        ${icerik}
        <div class="bolum-durum mesaj" role="status" hidden></div>
        <div class="duzen-alt"><button class="btn btn-ana btn-kucuk" type="submit">${kaydetYazi}</button></div>
      </form>`;
  }

  const alanHtml = (id, etiket, girdi, ipucu = "") => `
    <div class="form-alani">
      <label class="alan-etiket" for="${id}">${etiket}</label>
      ${girdi}
      ${ipucu ? `<p class="alan-ipucu" id="${id}-ipucu">${ipucu}</p>` : ""}
    </div>`;

  const sayacli = (id, sinir) => `<p class="alan-ipucu sayac" data-sayac="${id}" data-sinir="${sinir}"></p>`;

  function sayaclariBagla(kok) {
    kok.querySelectorAll("[data-sayac]").forEach((s) => {
      const girdi = $(s.dataset.sayac);
      const sinir = Number(s.dataset.sinir);
      const guncelle = () => {
        const n = say(girdi.value);
        s.textContent = `${n} / ${sinir}`;
        s.classList.toggle("asim", n > sinir);
      };
      girdi.addEventListener("input", guncelle);
      guncelle();
    });
  }

  /* ---------- Veri yükleme ---------- */
  async function yukle(uzmanId) {
    const [u, ua, uy, ue, us, ui, la, ly] = await Promise.all([
      sb.from("uzmanlar").select("*").eq("id", uzmanId).single(),
      sb.from("uzman_uzmanliklar").select("alan_id, sira").eq("uzman_id", uzmanId).order("sira"),
      sb.from("uzman_yaklasimlar").select("yaklasim_id, sira").eq("uzman_id", uzmanId).order("sira"),
      sb.from("uzman_egitimler").select("tur, metin, sira").eq("uzman_id", uzmanId).order("sira"),
      sb.from("uzman_sss").select("soru, cevap, sira").eq("uzman_id", uzmanId).order("sira"),
      sb.from("uzman_iletisim").select("*").eq("uzman_id", uzmanId).maybeSingle(),
      sb.from("uzmanlik_alanlari").select("id, ad, kategori, sira").eq("aktif", true).order("sira"),
      sb.from("yaklasimlar").select("id, ad, sira").eq("aktif", true).order("sira"),
    ]);
    const hata = [u, ua, uy, ue, us, ui, la, ly].find((x) => x.error);
    if (hata) throw hata.error;
    p = u.data;
    listeler = { alanlar: la.data, yaklasimlar: ly.data };
    const aktifAlan = new Set(la.data.map((x) => x.id));
    const aktifYak = new Set(ly.data.map((x) => x.id));
    secim = {
      alanlar: ua.data.map((x) => x.alan_id).filter((id) => aktifAlan.has(id)),
      yaklasimlar: uy.data.map((x) => x.yaklasim_id).filter((id) => aktifYak.has(id)),
    };
    egitimler = {
      egitim: ue.data.filter((x) => x.tur === "egitim").map((x) => x.metin),
      sertifika: ue.data.filter((x) => x.tur === "sertifika").map((x) => x.metin),
    };
    sss = us.data.map((x) => ({ soru: x.soru, cevap: x.cevap }));
    iletisim = ui.data || { telefon: null, whatsapp: null, eposta: null, telefon_yayinda: false, whatsapp_yayinda: false, eposta_yayinda: false };
  }

  /* ---------- Bölümler ---------- */
  function fotografBolumu() {
    return bolum(
      "foto",
      "Profil fotoğrafı",
      "Yüzünüzün net göründüğü, sade arka planlı bir fotoğraf danışanlara güven verir. JPG, PNG ya da WebP; en fazla 8 MB.",
      `<div class="foto-alani">
        <div class="foto-onizleme" id="fotoOnizleme">${avatarHtml({ ad: `${p.ad} ${p.soyad}`, foto: p.foto_yolu }, "avatar-buyuk")}</div>
        <div class="foto-dugmeler">
          <label class="btn btn-cizgi btn-kucuk dosya-sec">
            <input type="file" id="fotoDosya" accept="image/jpeg,image/png,image/webp" class="gorunmez-girdi">
            Fotoğraf seç
          </label>
          ${p.foto_yolu ? `<button class="btn btn-cizgi btn-kucuk" type="button" id="fotoKaldir">Fotoğrafı kaldır</button>` : ""}
          <p class="alan-ipucu">Seçtiğiniz fotoğraf kare olarak kırpılır ve küçültülür.</p>
        </div>
      </div>`,
      "Fotoğrafı yükle"
    );
  }

  function temelBolumu() {
    const kilitli = !DUZENLENEBILIR_DURUMLAR.includes(p.durum);
    const kilitNotu = kilitli
      ? `<p class="mesaj mesaj-bilgi">Ad, soyad ve unvan bilgileri inceleme sonrasında değiştirilemez. Değişiklik için yönetimle iletişime geçin.</p>`
      : "";
    const dil = new Set(p.diller || []);
    return bolum(
      "temel",
      "Temel bilgiler",
      "",
      `${kilitNotu}
      <div class="iki-sutun">
        ${alanHtml("dAd", "Ad", `<input class="girdi" id="dAd" maxlength="60" value="${esc(p.ad)}" ${kilitli ? "disabled" : ""} required>`)}
        ${alanHtml("dSoyad", "Soyad", `<input class="girdi" id="dSoyad" maxlength="60" value="${esc(p.soyad)}" ${kilitli ? "disabled" : ""} required>`)}
      </div>
      <div class="iki-sutun">
        ${alanHtml(
          "dOnek",
          "Unvan öneki",
          `<select class="girdi" id="dOnek" ${kilitli ? "disabled" : ""}><option value="">Yok</option>${UNVAN_ONEKLERI.map(
            (o) => `<option ${p.unvan_oneki === o ? "selected" : ""}>${esc(o)}</option>`
          ).join("")}</select>`,
          "Akademik unvanınız varsa (belgesi incelemede istenir)."
        )}
        ${alanHtml("dUnvan", "Unvan", `<input class="girdi" id="dUnvan" value="${esc(p.unvan)}" disabled>`)}
      </div>
      <div class="iki-sutun">
        ${alanHtml(
          "dSehir",
          "Şehir",
          `<select class="girdi" id="dSehir"><option value="">Seçiniz</option>${ILLER.map((il) => `<option ${p.sehir === il ? "selected" : ""}>${il}</option>`).join("")}</select>`
        )}
        ${alanHtml("dIlce", "İlçe", `<input class="girdi" id="dIlce" maxlength="40" value="${esc(p.ilce || "")}">`, "Yalnızca yüz yüze görüşme yapıyorsanız profilde görünür.")}
      </div>
      <div class="iki-sutun">
        ${alanHtml(
          "dCinsiyet",
          "Cinsiyet",
          `<select class="girdi" id="dCinsiyet"><option value="">Belirtmek istemiyorum</option>${["Kadın", "Erkek"]
            .map((c) => `<option ${p.cinsiyet === c ? "selected" : ""}>${c}</option>`)
            .join("")}</select>`,
          "Bazı danışanlar terapist cinsiyetine göre arama yapar; isteğe bağlıdır."
        )}
        ${alanHtml("dDeneyim", "Mesleki deneyim (yıl)", `<input class="girdi" id="dDeneyim" type="number" min="0" max="70" inputmode="numeric" value="${p.deneyim_yili ?? ""}">`)}
      </div>
      <fieldset class="secim-grubu">
        <legend class="alan-etiket">Görüşme yaptığınız diller</legend>
        <div class="kutucuklar">${DIL_SECENEKLERI.map(
          (d, i) => `<label class="onay-kutusu"><input type="checkbox" name="dil" value="${esc(d)}" ${dil.has(d) ? "checked" : ""}> ${esc(d)}</label>`
        ).join("")}</div>
      </fieldset>`
    );
  }

  function tanitimBolumu() {
    return bolum(
      "tanitim",
      "Tanıtım",
      `Kendinizi ve çalışma biçiminizi danışanın anlayacağı bir dille anlatın. Sağlık hizmeti tanıtım kuralları gereği
       <strong>tedavi ya da sonuç garantisi, "en iyi / kesin çözüm" gibi ifadeler, danışan yorumları ve fiyat bilgisi yazmayın</strong>;
       bu tür içerikler yayına alınmaz.`,
      `${alanHtml("dKisa", "Kısa tanıtım", `<textarea class="girdi" id="dKisa" rows="2" maxlength="200">${esc(p.kisa_tanitim || "")}</textarea>`)}
      ${sayacli("dKisa", 200)}
      ${alanHtml(
        "dHakkinda",
        "Hakkımda",
        `<textarea class="girdi" id="dHakkinda" rows="9" maxlength="5000">${esc(p.hakkinda || "")}</textarea>`,
        "Paragrafları ayırmak için bir satır boş bırakın."
      )}
      ${sayacli("dHakkinda", 5000)}`
    );
  }

  function alanlarBolumu() {
    const grup = {};
    listeler.alanlar.forEach((a) => (grup[a.kategori] = grup[a.kategori] || []).push(a));
    const kategoriler = IHTIYAC_KATEGORILERI.filter((k) => k.aktif !== false && grup[k.kod]).sort((a, b) => a.sira - b.sira);
    const digerleri = Object.keys(grup).filter((k) => !kategoriler.find((x) => x.kod === k));
    const grupHtml = (baslik, dizi) => `
      <div class="alan-grubu"><h4>${esc(baslik)}</h4><div class="kutucuklar">${dizi
        .map((a) => `<label class="onay-kutusu"><input type="checkbox" name="alan" value="${a.id}" ${secim.alanlar.includes(a.id) ? "checked" : ""}> ${esc(a.ad)}</label>`)
        .join("")}</div></div>`;
    const yas = new Set(p.yas_gruplari || []);
    return bolum(
      "alanlar",
      "Çalışma alanları ve yaklaşımlar",
      `En fazla ${SINIR.alan} çalışma alanı ve ${SINIR.yaklasim} yaklaşım seçebilirsiniz. <strong>İlk seçtiğiniz 3 alan</strong> uzman listesindeki kartınızda görünür.`,
      `<div class="secim-sirasi" id="alanSirasi" aria-live="polite"></div>
      ${kategoriler.map((k) => grupHtml(k.etiket, grup[k.kod])).join("")}
      ${digerleri.map((k) => grupHtml("Diğer", grup[k])).join("")}
      <fieldset class="secim-grubu">
        <legend class="alan-etiket">Terapi yaklaşımları ve ekoller</legend>
        <div class="kutucuklar">${listeler.yaklasimlar
          .map((y) => `<label class="onay-kutusu"><input type="checkbox" name="yaklasim" value="${y.id}" ${secim.yaklasimlar.includes(y.id) ? "checked" : ""}> ${esc(y.ad)}</label>`)
          .join("")}</div>
      </fieldset>
      <fieldset class="secim-grubu">
        <legend class="alan-etiket">Çalıştığınız gruplar</legend>
        <div class="kutucuklar">${YAS_GRUPLARI.map(
          (g) => `<label class="onay-kutusu"><input type="checkbox" name="yas" value="${esc(g)}" ${yas.has(g) ? "checked" : ""}> ${esc(g)}</label>`
        ).join("")}</div>
      </fieldset>`
    );
  }

  function gorusmeBolumu() {
    return bolum(
      "gorusme",
      "Görüşme bilgileri",
      "",
      `<fieldset class="secim-grubu">
        <legend class="alan-etiket">Görüşme şekli</legend>
        <div class="kutucuklar">
          <label class="onay-kutusu"><input type="checkbox" id="dOnline" ${p.gorusme_online ? "checked" : ""}> Online</label>
          <label class="onay-kutusu"><input type="checkbox" id="dYuzyuze" ${p.gorusme_yuzyuze ? "checked" : ""}> Yüz yüze</label>
        </div>
      </fieldset>
      <div class="iki-sutun">
        ${alanHtml("dSure", "Seans süresi", `<input class="girdi" id="dSure" maxlength="40" placeholder="ör. 50 dakika" value="${esc(p.seans_suresi || "")}">`)}
        ${alanHtml("dPlatform", "Online görüşme platformu", `<input class="girdi" id="dPlatform" maxlength="60" placeholder="ör. Zoom, Google Meet" value="${esc(p.online_platform || "")}">`)}
      </div>
      ${alanHtml(
        "dAdres",
        "Muayenehane adresi",
        `<input class="girdi" id="dAdres" maxlength="200" placeholder="ör. Caferağa Mah. Moda Cad. No:1 D:3" value="${esc(p.muayenehane_adres || "")}">`,
        "Bu adres profilinizde <strong>herkese açık</strong> görünür ve danışanlar buradan yol tarifi alabilir. Paylaşmak istemiyorsanız boş bırakın."
      )}`
    );
  }

  function listeDuzenleyici(kod, baslik, dizi, sinir, yerTutucu) {
    return `
      <div class="liste-duzen" data-liste="${kod}" data-sinir="${sinir}">
        <h3>${baslik}</h3>
        <ol class="liste-satirlar">${dizi.map((m) => satirHtml(kod, m, yerTutucu)).join("")}</ol>
        <button class="btn btn-cizgi btn-kucuk" type="button" data-ekle="${kod}" data-yer="${esc(yerTutucu)}">+ Ekle</button>
      </div>`;
  }
  function satirHtml(kod, metin, yerTutucu) {
    return `<li class="liste-satir">
      <input class="girdi" maxlength="300" value="${esc(metin)}" placeholder="${esc(yerTutucu)}" aria-label="${kod === "egitim" ? "Eğitim" : "Sertifika"}">
      <div class="satir-dugmeler">
        <button type="button" class="kucuk-dugme" data-yukari aria-label="Yukarı taşı">↑</button>
        <button type="button" class="kucuk-dugme" data-asagi aria-label="Aşağı taşı">↓</button>
        <button type="button" class="kucuk-dugme sil" data-sil aria-label="Sil">×</button>
      </div>
    </li>`;
  }

  function egitimBolumu() {
    return bolum(
      "egitim",
      "Eğitim ve sertifikalar",
      "Akademik eğitimleriniz profilinizde en üstte gösterilir. Psikoloji lisans ve klinik psikoloji yüksek lisans diplomalarınızı ayrıca incelemeye yükleyeceksiniz.",
      `${listeDuzenleyici("egitim", "Akademik eğitim", egitimler.egitim, SINIR.egitim, "ör. Yüksek Lisans — Klinik Psikoloji, Ankara Üniversitesi (2018)")}
      ${listeDuzenleyici("sertifika", "Mesleki eğitimler ve sertifikalar", egitimler.sertifika, SINIR.sertifika, "ör. EMDR Düzey 1 ve 2 Eğitimi")}`
    );
  }

  function sssSatir(x = { soru: "", cevap: "" }) {
    return `<li class="sss-satir">
      <input class="girdi" maxlength="200" placeholder="Soru (ör. İlk görüşme nasıl geçiyor?)" value="${esc(x.soru)}" aria-label="Soru">
      <textarea class="girdi" rows="3" maxlength="1500" placeholder="Cevap" aria-label="Cevap">${esc(x.cevap)}</textarea>
      <div class="satir-dugmeler">
        <button type="button" class="kucuk-dugme" data-yukari aria-label="Yukarı taşı">↑</button>
        <button type="button" class="kucuk-dugme" data-asagi aria-label="Aşağı taşı">↓</button>
        <button type="button" class="kucuk-dugme sil" data-sil aria-label="Sil">×</button>
      </div>
    </li>`;
  }
  function sssBolumu() {
    return bolum(
      "sss",
      "Sık sorulan sorular",
      `Danışanların ilk görüşme öncesi merak ettiklerini yanıtlayın (en fazla ${SINIR.sss} soru).`,
      `<ol class="liste-satirlar" id="sssListe">${sss.map(sssSatir).join("")}</ol>
       <button class="btn btn-cizgi btn-kucuk" type="button" id="sssEkle">+ Soru ekle</button>`
    );
  }

  function iletisimBolumu() {
    const k = (kod, etiket, tip, deger, acik, ipucu) => `
      <div class="iletisim-satir">
        ${alanHtml(`i_${kod}`, etiket, `<input class="girdi" id="i_${kod}" type="${tip}" ${tip === "tel" ? 'inputmode="tel" placeholder="05XX XXX XX XX"' : 'inputmode="email"'} value="${esc(deger || "")}">`, ipucu)}
        <label class="anahtar"><input type="checkbox" id="i_${kod}_yayinda" ${acik ? "checked" : ""}><span>Profilimde göster</span></label>
      </div>`;
    return bolum(
      "iletisim",
      "İletişim tercihleri",
      `Danışanlar size yalnızca <strong>"Profilimde göster"</strong> işaretli kanallardan ulaşabilir. İşaretlemediğiniz bilgiler sitede hiçbir yerde görünmez.
       Hiçbirini açmazsanız profilinizde "Uzmana Mesaj Gönder" formu çıkar; mesajlar panelinize gelir.`,
      `${k("telefon", "Telefon", "tel", iletisim.telefon, iletisim.telefon_yayinda, "")}
       ${k("whatsapp", "WhatsApp", "tel", iletisim.whatsapp, iletisim.whatsapp_yayinda, "")}
       ${k("eposta", "E-posta", "email", iletisim.eposta, iletisim.eposta_yayinda, "Hesap e-postanızdan farklı olabilir.")}`
    );
  }

  function sosyalBolumu() {
    return bolum(
      "sosyal",
      "Sosyal medya",
      "İsteğe bağlıdır. Kullanıcı adınızı ya da profil bağlantınızı yazabilirsiniz; her kutu yalnızca kendi platformunun adresini kabul eder. Profilinizde küçük simgeler olarak görünür.",
      `<div class="iki-sutun sosyal-izgara">${SOSYAL_MEDYA.map((m) =>
        alanHtml(
          `s_${m.kod}`,
          `<span class="sosyal-etiket">${ikon(m.kod)}${esc(m.etiket)}</span>`,
          `<input class="girdi" id="s_${m.kod}" maxlength="250" autocomplete="off" spellcheck="false" placeholder="${esc(m.ornek)}" value="${esc(p[m.kod] || "")}">`
        )
      ).join("")}</div>`
    );
  }

  /* ---------- Etkileşimler ---------- */
  function alanSirasiGoster() {
    const kutu = $("alanSirasi");
    if (!kutu) return;
    const adlar = secim.alanlar.map((id) => (listeler.alanlar.find((a) => a.id === id) || {}).ad).filter(Boolean);
    kutu.innerHTML = adlar.length
      ? `<span class="alan-ipucu">Seçim sırası (${adlar.length}/${SINIR.alan}):</span> ${adlar
          .map((a, i) => `<span class="etiket ${i < 3 ? "etiket-one" : ""}">${i + 1}. ${esc(a)}</span>`)
          .join("")}`
      : `<span class="alan-ipucu">Henüz alan seçmediniz.</span>`;
  }

  function listeleriBagla(kok) {
    // Ekle / sil / taşı (eğitim, sertifika, SSS)
    kok.addEventListener("click", (e) => {
      const d = e.target.closest("button");
      if (!d) return;
      const satir = d.closest("li");
      if (d.hasAttribute("data-sil")) satir.remove();
      else if (d.hasAttribute("data-yukari") && satir.previousElementSibling) satir.parentNode.insertBefore(satir, satir.previousElementSibling);
      else if (d.hasAttribute("data-asagi") && satir.nextElementSibling) satir.parentNode.insertBefore(satir.nextElementSibling, satir);
      else if (d.dataset.ekle) {
        const kutu = d.closest(".liste-duzen");
        const ol = kutu.querySelector(".liste-satirlar");
        if (ol.children.length >= Number(kutu.dataset.sinir)) return;
        ol.insertAdjacentHTML("beforeend", satirHtml(d.dataset.ekle, "", d.dataset.yer));
        ol.lastElementChild.querySelector("input").focus();
      } else if (d.id === "sssEkle") {
        const ol = $("sssListe");
        if (ol.children.length >= SINIR.sss) return;
        ol.insertAdjacentHTML("beforeend", sssSatir());
        ol.lastElementChild.querySelector("input").focus();
      }
    });

    // Çalışma alanı seçim sırası ve sınırlar
    kok.querySelectorAll('input[name="alan"]').forEach((k) =>
      k.addEventListener("change", () => {
        const id = Number(k.value);
        if (k.checked) {
          if (secim.alanlar.length >= SINIR.alan) {
            k.checked = false;
            durumYaz("alanlar", `En fazla ${SINIR.alan} çalışma alanı seçebilirsiniz.`, "hata");
            return;
          }
          secim.alanlar.push(id);
        } else secim.alanlar = secim.alanlar.filter((x) => x !== id);
        alanSirasiGoster();
      })
    );
    kok.querySelectorAll('input[name="yaklasim"]').forEach((k) =>
      k.addEventListener("change", () => {
        const id = Number(k.value);
        if (k.checked) {
          if (secim.yaklasimlar.length >= SINIR.yaklasim) {
            k.checked = false;
            durumYaz("alanlar", `En fazla ${SINIR.yaklasim} yaklaşım seçebilirsiniz.`, "hata");
            return;
          }
          secim.yaklasimlar.push(id);
        } else secim.yaklasimlar = secim.yaklasimlar.filter((x) => x !== id);
      })
    );
  }

  /* Fotoğrafı kare kırpıp 640 piksele küçültür ve WebP'ye çevirir. */
  async function fotoHazirla(dosya) {
    const resim = await createImageBitmap(dosya);
    const kenar = Math.min(resim.width, resim.height);
    const boyut = Math.min(640, kenar);
    const tuval = document.createElement("canvas");
    tuval.width = tuval.height = boyut;
    tuval.getContext("2d").drawImage(resim, (resim.width - kenar) / 2, (resim.height - kenar) / 2, kenar, kenar, 0, 0, boyut, boyut);
    return await new Promise((tamam) => tuval.toBlob(tamam, "image/webp", 0.85));
  }

  const telefonTemizle = (t) => {
    let r = String(t || "").replace(/\D/g, "");
    if (r.startsWith("90") && r.length === 12) r = "0" + r.slice(2);
    if (r.length === 10 && r.startsWith("5")) r = "0" + r;
    return r;
  };

  /* ---------- Kaydetme ---------- */
  const KAYDET = {
    async foto(form) {
      const dosya = $("fotoDosya").files[0];
      if (!kontrol(dosya, "foto", "Önce bir fotoğraf seçin.")) return false;
      if (!kontrol(/^image\/(jpeg|png|webp)$/.test(dosya.type), "foto", "Yalnızca JPG, PNG ya da WebP yükleyebilirsiniz.")) return false;
      if (!kontrol(dosya.size <= 8 * 1024 * 1024, "foto", "Dosya 8 MB'tan büyük olamaz.")) return false;
      const veri = await fotoHazirla(dosya);
      const yol = `${kullanici.id}/profil-${Date.now()}.webp`;
      const { error: yErr } = await sb.storage.from("uzman-fotograflari").upload(yol, veri, { contentType: "image/webp", upsert: false });
      if (yErr) throw yErr;
      const adres = sb.storage.from("uzman-fotograflari").getPublicUrl(yol).data.publicUrl;
      const eskiYol = eskiFotoYolu(p.foto_yolu);
      const { error } = await sb.from("uzmanlar").update({ foto_yolu: adres }).eq("id", p.id);
      if (error) throw error;
      p.foto_yolu = adres;
      if (eskiYol) sb.storage.from("uzman-fotograflari").remove([eskiYol]).catch(() => {});
      $("fotoOnizleme").innerHTML = avatarHtml({ ad: `${p.ad} ${p.soyad}`, foto: adres }, "avatar-buyuk");
      $("fotoDosya").value = "";
    },
    async temel() {
      const kilitli = !DUZENLENEBILIR_DURUMLAR.includes(p.durum);
      const deneyim = $("dDeneyim").value === "" ? null : Number($("dDeneyim").value);
      const g = {
        sehir: $("dSehir").value || null,
        ilce: $("dIlce").value.trim() || null,
        cinsiyet: $("dCinsiyet").value || null,
        deneyim_yili: deneyim,
        diller: [...document.querySelectorAll('input[name="dil"]:checked')].map((x) => x.value),
      };
      if (!kilitli) {
        g.ad = $("dAd").value.trim();
        g.soyad = $("dSoyad").value.trim();
        g.unvan_oneki = $("dOnek").value || null;
        if (!kontrol(g.ad && g.soyad, "temel", "Ad ve soyad boş bırakılamaz.")) return false;
      }
      if (!kontrol(deneyim === null || (Number.isInteger(deneyim) && deneyim >= 0 && deneyim <= 70), "temel", "Deneyim yılı 0 ile 70 arasında bir tam sayı olmalı.")) return false;
      if (!kontrol(g.diller.length > 0, "temel", "En az bir görüşme dili seçin.")) return false;
      const { error } = await sb.from("uzmanlar").update(g).eq("id", p.id);
      if (error) throw error;
      Object.assign(p, g);
    },
    async tanitim() {
      const kisa = $("dKisa").value.trim();
      const hakkinda = $("dHakkinda").value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      if (!kontrol(say(kisa) <= 200 && say(hakkinda) <= 5000, "tanitim", "Metin sınırı aşıldı.")) return false;
      const { error } = await sb.from("uzmanlar").update({ kisa_tanitim: kisa || null, hakkinda: hakkinda || null }).eq("id", p.id);
      if (error) throw error;
      p.kisa_tanitim = kisa || null;
      p.hakkinda = hakkinda || null;
    },
    async alanlar() {
      const yas = [...document.querySelectorAll('input[name="yas"]:checked')].map((x) => x.value);
      // Önce sil, sonra seçim sırasıyla yeniden ekle.
      let r = await sb.from("uzman_uzmanliklar").delete().eq("uzman_id", p.id);
      if (r.error) throw r.error;
      if (secim.alanlar.length) {
        r = await sb.from("uzman_uzmanliklar").insert(secim.alanlar.map((id, i) => ({ uzman_id: p.id, alan_id: id, sira: i })));
        if (r.error) throw r.error;
      }
      r = await sb.from("uzman_yaklasimlar").delete().eq("uzman_id", p.id);
      if (r.error) throw r.error;
      if (secim.yaklasimlar.length) {
        r = await sb.from("uzman_yaklasimlar").insert(secim.yaklasimlar.map((id, i) => ({ uzman_id: p.id, yaklasim_id: id, sira: i })));
        if (r.error) throw r.error;
      }
      r = await sb.from("uzmanlar").update({ yas_gruplari: yas }).eq("id", p.id);
      if (r.error) throw r.error;
      p.yas_gruplari = yas;
    },
    async gorusme() {
      const g = {
        gorusme_online: $("dOnline").checked,
        gorusme_yuzyuze: $("dYuzyuze").checked,
        seans_suresi: $("dSure").value.trim() || null,
        online_platform: $("dPlatform").value.trim() || null,
        muayenehane_adres: $("dAdres").value.trim() || null,
      };
      if (!kontrol(g.gorusme_online || g.gorusme_yuzyuze, "gorusme", "En az bir görüşme şekli seçin.")) return false;
      const { error } = await sb.from("uzmanlar").update(g).eq("id", p.id);
      if (error) throw error;
      Object.assign(p, g);
    },
    async egitim(form) {
      const oku = (kod) =>
        [...form.querySelectorAll(`[data-liste="${kod}"] .liste-satir input`)].map((x) => x.value.trim()).filter(Boolean);
      const e = oku("egitim");
      const s = oku("sertifika");
      if (!kontrol([...e, ...s].every((m) => say(m) >= 2 && say(m) <= 300), "egitim", "Her satır 2 ile 300 karakter arasında olmalı.")) return false;
      let r = await sb.from("uzman_egitimler").delete().eq("uzman_id", p.id);
      if (r.error) throw r.error;
      const satirlar = [
        ...e.map((metin, i) => ({ uzman_id: p.id, tur: "egitim", metin, sira: i })),
        ...s.map((metin, i) => ({ uzman_id: p.id, tur: "sertifika", metin, sira: i })),
      ];
      if (satirlar.length) {
        r = await sb.from("uzman_egitimler").insert(satirlar);
        if (r.error) throw r.error;
      }
      egitimler = { egitim: e, sertifika: s };
    },
    async sss(form) {
      const satirlar = [...form.querySelectorAll(".sss-satir")]
        .map((li) => ({ soru: li.querySelector("input").value.trim(), cevap: li.querySelector("textarea").value.trim() }))
        .filter((x) => x.soru || x.cevap);
      if (!kontrol(satirlar.every((x) => say(x.soru) >= 5 && say(x.soru) <= 200), "sss", "Her soru 5 ile 200 karakter arasında olmalı.")) return false;
      if (!kontrol(satirlar.every((x) => say(x.cevap) >= 2 && say(x.cevap) <= 1500), "sss", "Her cevap 2 ile 1500 karakter arasında olmalı.")) return false;
      let r = await sb.from("uzman_sss").delete().eq("uzman_id", p.id);
      if (r.error) throw r.error;
      if (satirlar.length) {
        r = await sb.from("uzman_sss").insert(satirlar.map((x, i) => ({ uzman_id: p.id, ...x, sira: i })));
        if (r.error) throw r.error;
      }
      sss = satirlar;
    },
    async iletisim() {
      const tel = telefonTemizle($("i_telefon").value);
      const wa = telefonTemizle($("i_whatsapp").value);
      const ep = $("i_eposta").value.trim();
      const g = {
        uzman_id: p.id,
        telefon: tel || null,
        whatsapp: wa || null,
        eposta: ep || null,
        telefon_yayinda: $("i_telefon_yayinda").checked,
        whatsapp_yayinda: $("i_whatsapp_yayinda").checked,
        eposta_yayinda: $("i_eposta_yayinda").checked,
      };
      const TEL = /^0[0-9]{10}$/;
      if (!kontrol(!g.telefon || TEL.test(g.telefon), "iletisim", "Telefon numarası 05XX XXX XX XX biçiminde olmalı.")) return false;
      if (!kontrol(!g.whatsapp || TEL.test(g.whatsapp), "iletisim", "WhatsApp numarası 05XX XXX XX XX biçiminde olmalı.")) return false;
      if (!kontrol(!g.eposta || (g.eposta.length <= 120 && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(g.eposta)), "iletisim", "E-posta adresi geçerli değil.")) return false;
      if (!kontrol(!g.telefon_yayinda || g.telefon, "iletisim", "Göstermek için telefon numarası girin.")) return false;
      if (!kontrol(!g.whatsapp_yayinda || g.whatsapp, "iletisim", "Göstermek için WhatsApp numarası girin.")) return false;
      if (!kontrol(!g.eposta_yayinda || g.eposta, "iletisim", "Göstermek için e-posta adresi girin.")) return false;
      const { error } = await sb.from("uzman_iletisim").upsert(g, { onConflict: "uzman_id" });
      if (error) throw error;
      iletisim = g;
      // Biçimlendirilmiş değerleri geri yaz
      $("i_telefon").value = g.telefon ? okunurNumara(g.telefon) : "";
      $("i_whatsapp").value = g.whatsapp ? okunurNumara(g.whatsapp) : "";
    },
    async sosyal() {
      const g = {};
      const hatali = [];
      SOSYAL_MEDYA.forEach((m) => {
        const girdi = $(`s_${m.kod}`);
        const sonuc = sosyalBaglanti(m, girdi.value);
        girdi.setAttribute("aria-invalid", sonuc === null ? "true" : "false");
        if (sonuc === null) hatali.push(m.etiket);
        else g[m.kod] = sonuc || null;
      });
      if (!kontrol(!hatali.length, "sosyal", `Şu alanlardaki adres geçerli değil: ${hatali.join(", ")}.`)) return false;
      const { error } = await sb.from("uzmanlar").update(g).eq("id", p.id);
      if (error) throw error;
      Object.assign(p, g);
      SOSYAL_MEDYA.forEach((m) => ($(`s_${m.kod}`).value = g[m.kod] || ""));
    },
  };

  function eskiFotoYolu(adres) {
    const m = String(adres || "").match(/\/storage\/v1\/object\/public\/uzman-fotograflari\/(.+)$/);
    return m && m[1].startsWith(kullanici.id + "/") ? decodeURIComponent(m[1]) : null;
  }

  /* ---------- Ana çizim ---------- */
  async function ac(alan, uzmanId, kul) {
    kullanici = kul;
    alan.innerHTML = `<p role="status">Profil bilgileriniz yükleniyor…</p>`;
    await yukle(uzmanId);
    const bolumler = [
      ["foto", "Fotoğraf"],
      ["temel", "Temel bilgiler"],
      ["tanitim", "Tanıtım"],
      ["alanlar", "Çalışma alanları"],
      ["gorusme", "Görüşme"],
      ["egitim", "Eğitim"],
      ["sss", "SSS"],
      ["iletisim", "İletişim"],
      ["sosyal", "Sosyal medya"],
    ];
    alan.innerHTML = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer">
        <ol><li><a href="panel.html#">Panel</a></li><li><span aria-current="page">Profilimi düzenle</span></li></ol>
      </nav>
      <section class="panel-baslik">
        <div>
          <p class="bolum-ust-yazi">Uzman paneli</p>
          <h1>Profilimi düzenle</h1>
          <p class="soluk">Her bölümü ayrı ayrı kaydedebilirsiniz.${p.durum === "yayinda" ? " Profiliniz yayında; kaydettiğiniz değişiklikler hemen görünür." : ""}</p>
        </div>
      </section>
      <div class="duzen-duzen">
        <nav class="duzen-menu" aria-label="Profil bölümleri">
          ${bolumler.map(([k, ad]) => `<a href="#profil" data-git="bolum-${k}">${ad}</a>`).join("")}
        </nav>
        <div class="duzen-icerik">
          ${fotografBolumu()}${temelBolumu()}${tanitimBolumu()}${alanlarBolumu()}${gorusmeBolumu()}${egitimBolumu()}${sssBolumu()}${iletisimBolumu()}${sosyalBolumu()}
          <p class="duzen-son"><a class="btn btn-cizgi" href="panel.html#">Panele dön</a></p>
        </div>
      </div>`;

    // İletişim alanlarında kayıtlı numaraları okunur biçimde göster
    if (iletisim.telefon) $("i_telefon").value = okunurNumara(iletisim.telefon);
    if (iletisim.whatsapp) $("i_whatsapp").value = okunurNumara(iletisim.whatsapp);

    alan.querySelectorAll("[data-git]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const hedef = $(a.dataset.git);
        hedef.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        const baslik = hedef.querySelector("h2");
        baslik.setAttribute("tabindex", "-1");
        baslik.focus({ preventScroll: true });
      })
    );

    sayaclariBagla(alan);
    listeleriBagla(alan);
    alanSirasiGoster();

    const fotoDosya = $("fotoDosya");
    fotoDosya.addEventListener("change", () => {
      const d = fotoDosya.files[0];
      if (d) durumYaz("foto", `Seçildi: ${d.name}. Yüklemek için "Fotoğrafı yükle"ye basın.`);
    });
    const kaldir = $("fotoKaldir");
    if (kaldir)
      kaldir.addEventListener("click", () =>
        kaydetIsi("foto", kaldir, async () => {
          const eskiYol = eskiFotoYolu(p.foto_yolu);
          const { error } = await sb.from("uzmanlar").update({ foto_yolu: null }).eq("id", p.id);
          if (error) throw error;
          if (eskiYol) sb.storage.from("uzman-fotograflari").remove([eskiYol]).catch(() => {});
          p.foto_yolu = null;
          $("fotoOnizleme").innerHTML = avatarHtml({ ad: `${p.ad} ${p.soyad}`, foto: null }, "avatar-buyuk");
          kaldir.remove();
        })
      );

    alan.querySelectorAll("form.duzen-bolum").forEach((form) =>
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const kod = form.dataset.bolum;
        kaydetIsi(kod, form.querySelector('button[type="submit"]'), () => KAYDET[kod](form));
      })
    );
  }

  /* Panel özetinde kullanılan doluluk kontrolü: yayına göndermeden önce eksikleri gösterir. */
  async function eksikler(uzmanId) {
    const [u, ua, ue] = await Promise.all([
      sb.from("uzmanlar").select("foto_yolu, sehir, kisa_tanitim, hakkinda, gorusme_online, gorusme_yuzyuze").eq("id", uzmanId).single(),
      sb.from("uzman_uzmanliklar").select("alan_id", { count: "exact", head: true }).eq("uzman_id", uzmanId),
      sb.from("uzman_egitimler").select("id", { count: "exact", head: true }).eq("uzman_id", uzmanId).eq("tur", "egitim"),
    ]);
    if (u.error) throw u.error;
    const x = u.data;
    const liste = [];
    if (!x.foto_yolu) liste.push("Profil fotoğrafı");
    if (!x.sehir) liste.push("Şehir");
    if (!x.kisa_tanitim) liste.push("Kısa tanıtım");
    if (!x.hakkinda) liste.push("Hakkımda yazısı");
    if (!x.gorusme_online && !x.gorusme_yuzyuze) liste.push("Görüşme şekli");
    if ((ua.count || 0) < 3) liste.push("En az 3 çalışma alanı");
    if ((ue.count || 0) < 1) liste.push("Akademik eğitim bilgisi");
    return liste;
  }

  return { ac, eksikler };
})();
