/*
 * "UZMANA MESAJ GÖNDER" FORMU
 * Yalnızca telefon, WhatsApp ve e-postanın üçünü de kapatmış uzmanların profilinde görünür.
 * Ziyaretçi hesap açmadan mesaj bırakır; mesaj platformun sunucusu üzerinden uzmana iletilir.
 *
 * Güvenlik ve kişisel veri önlemleri:
 *  - CAPTCHA (Cloudflare Turnstile): Botların form doldurmasını engeller. Asıl doğrulama sunucuda yapılır.
 *  - Tuzak alan: İnsanların görmediği bir kutu. Dolu gelirse gönderim bot kabul edilir.
 *  - Veri azaltma: Yalnızca ad, BİR dönüş yolu (e-posta ya da telefon) ve kısa mesaj istenir.
 *  - Ziyaretçiye sağlık bilgisi yazmaması gerektiği açıkça söylenir.
 *  - Uzmanın kendi iletişim bilgileri ziyaretçiye hiçbir aşamada gösterilmez.
 */
const MesajFormu = (() => {
  const EN_AZ = 20;
  const EN_FAZLA = 1000;
  // Yerel bilgisayarda denerken Cloudflare'in "her zaman geçer" test anahtarı kullanılır;
  // gerçek anahtar yalnızca sitenin kayıtlı adresinde (github.io) çalışır.
  const yerelMi = ["localhost", "127.0.0.1"].includes(location.hostname);
  const SITE_ANAHTARI = yerelMi ? "1x00000000000000000000AA" : BAGLANTI.turnstileSiteAnahtari;

  let captchaKimligi = null;

  function html(u) {
    return `
    <dialog class="mesaj-pencere" id="mesajPenceresi" aria-labelledby="mesajBaslik">
      <form class="mesaj-form" id="mesajFormu" novalidate>
        <div class="mesaj-ust">
          <h2 id="mesajBaslik">Uzmana mesaj gönderin</h2>
          <button class="ikon-buton" type="button" data-mesaj-kapat aria-label="Pencereyi kapat">${ikon("kapat")}</button>
        </div>
        <p class="mesaj-aciklama">Mesajınız platform üzerinden <strong>${esc(u.ad)}</strong> adlı uzmana iletilir. Uzman, bıraktığınız iletişim bilgisiyle size dönüş yapar.</p>

        <div id="mesajIcerik">
          <div class="alan">
            <label class="alan-etiket" for="mesajAd">Adınız</label>
            <input class="girdi" id="mesajAd" name="ad" autocomplete="given-name" maxlength="60" required>
          </div>

          <fieldset class="alan donus-secimi">
            <legend class="alan-etiket">Size nasıl dönüş yapılsın?</legend>
            <label class="secim"><input type="radio" name="donus" value="eposta" checked> E-posta</label>
            <label class="secim"><input type="radio" name="donus" value="telefon"> Telefon</label>
          </fieldset>
          <div class="alan" id="donusEpostaAlani">
            <label class="alan-etiket" for="mesajEposta">E-posta adresiniz</label>
            <input class="girdi" id="mesajEposta" name="eposta" type="email" autocomplete="email" maxlength="120">
          </div>
          <div class="alan" id="donusTelefonAlani" hidden>
            <label class="alan-etiket" for="mesajTelefon">Telefon numaranız</label>
            <input class="girdi" id="mesajTelefon" name="telefon" type="tel" autocomplete="tel" inputmode="tel" placeholder="05XX XXX XX XX" maxlength="16">
          </div>

          <div class="alan">
            <label class="alan-etiket" for="mesajMetni">Mesajınız</label>
            <textarea class="girdi" id="mesajMetni" name="mesaj" rows="5" minlength="${EN_AZ}" maxlength="${EN_FAZLA}" required
              aria-describedby="mesajIpucu mesajSayac"></textarea>
            <div class="mesaj-alt-bilgi">
              <span id="mesajIpucu">Sağlık durumunuzla ilgili ayrıntı yazmanız gerekmez; kısaca görüşme talebinizi iletmeniz yeterli.</span>
              <span id="mesajSayac" aria-live="polite">0 / ${EN_FAZLA}</span>
            </div>
          </div>

          <!-- Tuzak alan: Ekranda görünmez. İnsanlar doldurmaz, botlar doldurur. -->
          <div class="tuzak" aria-hidden="true">
            <label for="mesajWeb">Web siteniz</label>
            <input id="mesajWeb" name="web" tabindex="-1" autocomplete="off">
          </div>

          <label class="onay-kutusu">
            <input type="checkbox" id="mesajOnay" required>
            <span><a href="#" target="_blank">Aydınlatma metnini</a> okudum. Adımın, iletişim bilgimin ve mesajımın yalnızca bu uzmana iletilmesi amacıyla işleneceğini biliyorum.</span>
          </label>

          <div class="captcha-alani" id="mesajCaptcha"></div>
          <p class="form-hata" id="mesajHata" role="alert" hidden></p>

          <button class="btn btn-ana btn-blok" type="submit" id="mesajGonderDugme">${ikon("gonder")}Mesajı gönder</button>
          <p class="alt-not acil-kisa">Bu form acil durumlar için değildir. Acil bir durumdaysanız 112'yi arayın.</p>
        </div>
      </form>
    </dialog>`;
  }

  // Turnstile betiği yalnızca form ilk açıldığında yüklenir (sayfa gereksiz yere yavaşlamasın).
  function captchaYukle() {
    if (captchaKimligi !== null) return;
    const ciz = () => {
      captchaKimligi = window.turnstile.render("#mesajCaptcha", {
        sitekey: SITE_ANAHTARI,
        language: "tr",
        appearance: "always",
      });
    };
    if (window.turnstile) return ciz();
    captchaKimligi = "yukleniyor";
    const betik = document.createElement("script");
    betik.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    betik.async = true;
    betik.onload = ciz;
    betik.onerror = () => {
      captchaKimligi = null;
      hataGoster("Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyip tekrar deneyin.");
    };
    document.head.appendChild(betik);
  }

  function hataGoster(metin) {
    const kutu = document.getElementById("mesajHata");
    kutu.textContent = metin;
    kutu.hidden = !metin;
  }

  // "0532 123 45 67", "+90 532..." → "05321234567"; geçersizse null
  function telefonDuzenle(deger) {
    let r = String(deger).replace(/\D/g, "");
    if (r.startsWith("90") && r.length === 12) r = "0" + r.slice(2);
    if (r.length === 10 && r.startsWith("5")) r = "0" + r;
    return /^0[0-9]{10}$/.test(r) ? r : null;
  }

  function bagla(u) {
    const pencere = document.getElementById("mesajPenceresi");
    const form = document.getElementById("mesajFormu");
    const metin = document.getElementById("mesajMetni");
    const sayac = document.getElementById("mesajSayac");
    const dugme = document.getElementById("mesajGonderDugme");

    document.querySelectorAll("[data-mesaj-ac]").forEach((d) =>
      d.addEventListener("click", () => {
        pencere.showModal();
        captchaYukle();
        document.getElementById("mesajAd").focus();
      })
    );
    pencere.querySelector("[data-mesaj-kapat]").addEventListener("click", () => pencere.close());
    // Pencerenin dışına (karartılmış alana) tıklayınca kapanır
    pencere.addEventListener("click", (e) => {
      if (e.target === pencere) pencere.close();
    });

    form.querySelectorAll('input[name="donus"]').forEach((r) =>
      r.addEventListener("change", () => {
        const eposta = form.donus.value === "eposta";
        document.getElementById("donusEpostaAlani").hidden = !eposta;
        document.getElementById("donusTelefonAlani").hidden = eposta;
      })
    );

    metin.addEventListener("input", () => {
      sayac.textContent = `${metin.value.length} / ${EN_FAZLA}`;
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hataGoster("");

      const ad = form.ad.value.trim();
      const donus = form.donus.value;
      const eposta = form.eposta.value.trim();
      const telefon = telefonDuzenle(form.telefon.value);
      const mesaj = metin.value.trim();
      const captcha = window.turnstile && typeof captchaKimligi === "string" && captchaKimligi !== "yukleniyor"
        ? window.turnstile.getResponse(captchaKimligi)
        : "";

      if (ad.length < 2) return hataGoster("Lütfen adınızı yazın.");
      if (donus === "eposta" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(eposta)) return hataGoster("Lütfen geçerli bir e-posta adresi yazın.");
      if (donus === "telefon" && !telefon) return hataGoster("Lütfen telefon numaranızı 05XX XXX XX XX biçiminde yazın.");
      if (mesaj.length < EN_AZ) return hataGoster(`Mesajınız en az ${EN_AZ} karakter olmalı.`);
      if (!document.getElementById("mesajOnay").checked) return hataGoster("Devam etmek için aydınlatma metnini okuduğunuzu onaylayın.");
      if (!captcha) return hataGoster("Lütfen güvenlik doğrulamasını tamamlayın.");

      dugme.disabled = true;
      const sonuc = await Veri.mesajGonder(u.id, {
        ad,
        eposta: donus === "eposta" ? eposta : null,
        telefon: donus === "telefon" ? telefon : null,
        mesaj,
        captcha,
        web: form.web.value, // tuzak alan
      });
      dugme.disabled = false;

      if (sonuc.durum === "hata") {
        if (window.turnstile) window.turnstile.reset(captchaKimligi);
        return hataGoster(sonuc.mesaj || "Mesajınız gönderilemedi. Lütfen biraz sonra tekrar deneyin.");
      }

      const icerik = document.getElementById("mesajIcerik");
      icerik.innerHTML =
        sonuc.durum === "prototip"
          ? `<div class="mesaj-sonuc prototip">
               <strong>Bu form henüz deneme aşamasında.</strong>
               <p>Mesaj iletme sistemi kurulduğunda bu adımda mesajınız uzmana iletilecek. Şu an hiçbir yere gönderilmedi ve kaydedilmedi.</p>
             </div>`
          : `<div class="mesaj-sonuc">
               <strong>${ikon("tik")}Mesajınız iletildi.</strong>
               <p>Uzman, bıraktığınız iletişim bilgisiyle size dönüş yapacak. Dönüş süresi uzmana göre değişebilir.</p>
             </div>`;
      icerik.insertAdjacentHTML("beforeend", `<button class="btn btn-cizgi btn-blok" type="button" data-mesaj-kapat>Kapat</button>`);
      icerik.querySelector("[data-mesaj-kapat]").addEventListener("click", () => pencere.close());
    });
  }

  return { html, bagla };
})();
