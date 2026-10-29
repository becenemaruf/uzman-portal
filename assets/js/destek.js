/*
 * DESTEK SAYFASI (destek.html) — giriş yapamayanlar için
 *  destek.html                          → Yeni destek talebi formu (CAPTCHA'lı)
 *  destek.html?talep=D-XXXXXX&anahtar=… → E-postadaki takip bağlantısı: yazışma ve yeni mesaj
 * Giriş yapabilen uzmanlar talebi panellerindeki "Destek" bölümünden açar.
 * Tüm işlemler "destek" sunucu fonksiyonu üzerinden yapılır; tarayıcı veritabanına doğrudan yazmaz.
 */
(function () {
  const alan = document.getElementById("destekAlan");
  const p = new URLSearchParams(location.search);
  const kod = p.get("talep");
  const anahtar = p.get("anahtar");
  const ADRES = `${BAGLANTI.supabaseAdresi}/functions/v1/destek`;
  const yerelMi = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const SITE_ANAHTARI = yerelMi ? "1x00000000000000000000AA" : BAGLANTI.turnstileSiteAnahtari;
  const KATEGORILER = {
    giris: "Giriş yapamıyorum / şifre sorunu",
    belge: "Belge ve doğrulama",
    profil: "Profil düzenleme",
    mesaj: "Mesajlar ve iletişim",
    teknik: "Teknik sorun",
    kvkk: "Kişisel veri (KVKK) başvurusu",
    diger: "Diğer",
  };
  const DURUM = { acik: "Yanıt bekleniyor", yanitlandi: "Yanıtlandı", kapandi: "Kapatıldı" };

  async function istek(govde) {
    const y = await fetch(ADRES, { method: "POST", headers: { "Content-Type": "application/json", apikey: BAGLANTI.supabaseAnahtari }, body: JSON.stringify(govde) });
    let veri = {};
    try {
      veri = await y.json();
    } catch (e) {
      /* boş yanıt */
    }
    if (!y.ok) throw new Error(veri.hata || "İşlem yapılamadı. Lütfen daha sonra tekrar deneyin.");
    return veri;
  }
  function mesaj(el, metin, tur) {
    el.className = `mesaj mesaj-${tur}`;
    el.textContent = metin;
    el.hidden = !metin;
  }

  // ---------- CAPTCHA ----------
  let captchaKimligi = null;
  function captchaYukle() {
    const ciz = () => {
      captchaKimligi = window.turnstile.render("#destekCaptcha", { sitekey: SITE_ANAHTARI, language: "tr" });
    };
    if (window.turnstile) return ciz();
    const b = document.createElement("script");
    b.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    b.async = true;
    b.onload = ciz;
    b.onerror = () => {
      const k = document.getElementById("destekCaptcha");
      if (k) k.textContent = "Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyip tekrar deneyin.";
    };
    document.head.appendChild(b);
  }

  // ================= YENİ TALEP =================
  function formCiz() {
    alan.innerHTML = `
      <div class="destek-izgara">
        <form class="blok panel-kart" id="destekFormu" novalidate>
          <h2>Talebiniz</h2>
          <div class="iki-sutun">
            <div class="form-alani"><label class="alan-etiket" for="dAd">Adınız soyadınız *</label><input class="girdi" id="dAd" maxlength="120" autocomplete="name"></div>
            <div class="form-alani"><label class="alan-etiket" for="dEposta">E-posta adresiniz *</label><input class="girdi" id="dEposta" type="email" maxlength="160" autocomplete="email">
              <p class="alan-ipucu">Hesabınızla ilgiliyse, kayıt olduğunuz e-posta adresini yazın.</p></div>
          </div>
          <div class="form-alani"><label class="alan-etiket" for="dKategori">Konu *</label>
            <select class="girdi" id="dKategori"><option value="">Seçin…</option>${Object.entries(KATEGORILER).map(([k, a]) => `<option value="${k}">${a}</option>`).join("")}</select></div>
          <div class="form-alani"><label class="alan-etiket" for="dBaslik">Kısa başlık *</label><input class="girdi" id="dBaslik" maxlength="120" placeholder="Ör. Şifre yenileme e-postası gelmiyor"></div>
          <div class="form-alani"><label class="alan-etiket" for="dMetin">Sorununuzu anlatın *</label>
            <textarea class="girdi" id="dMetin" rows="6" maxlength="5000" placeholder="Ne yapmaya çalıştınız, ne oldu? Gördüğünüz hata mesajını yazabilirsiniz."></textarea>
            <p class="alan-ipucu">Şifrenizi, kimlik numaranızı, sağlık bilgisi ya da danışan bilgisi yazmayın.</p></div>
          <div class="gorunmez" aria-hidden="true"><label for="dWeb">Bu alanı boş bırakın</label><input id="dWeb" tabindex="-1" autocomplete="off"></div>
          <div class="captcha-alani" id="destekCaptcha"></div>
          <div class="mesaj" id="dDurum" role="status" hidden></div>
          <div class="duzen-alt"><button class="btn btn-ana" type="submit" id="dGonder">Talebi gönder</button></div>
          <p class="alan-ipucu">Gönderdiğiniz bilgiler yalnızca talebinizi yanıtlamak için kullanılır. <a href="kvkk-aydinlatma.html" target="_blank" rel="noopener">KVKK Aydınlatma Metni</a></p>
        </form>
        <aside class="blok panel-kart destek-ipucu">
          <h2>Önce bunları deneyin</h2>
          <ul class="madde-listesi">
            <li><strong>Şifrenizi mi unuttunuz?</strong> <a href="giris.html#sifremi-unuttum">Şifremi unuttum</a> sayfasından yeni şifre belirleyebilirsiniz.</li>
            <li><strong>E-posta gelmedi mi?</strong> Gereksiz (spam) klasörünü kontrol edin. Bağlantılar 1 saat geçerlidir; süresi dolduysa yenisini isteyin.</li>
            <li><strong>Giriş yapabiliyorsanız</strong> talebinizi <a href="panel.html#destek">uzman panelinizdeki Destek</a> bölümünden açmanız daha hızlıdır.</li>
            <li><strong>Bir uzmana mı ulaşmak istiyorsunuz?</strong> Lütfen uzmanın profilindeki iletişim seçeneklerini kullanın; bu form terapi ya da randevu için değildir.</li>
          </ul>
          <p class="acil-not"><strong>Acil bir durumdaysanız</strong> 112'yi arayın.</p>
        </aside>
      </div>`;
    captchaYukle();
    document.getElementById("destekFormu").addEventListener("input", () => {
      const d = document.getElementById("dDurum");
      if (d.classList.contains("mesaj-hata")) d.hidden = true;
    });
    document.getElementById("destekFormu").addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = document.getElementById("dDurum");
      const v = (id) => document.getElementById(id).value.trim();
      const govde = { islem: "olustur", ad: v("dAd"), eposta: v("dEposta"), kategori: v("dKategori"), baslik: v("dBaslik"), metin: v("dMetin"), web: v("dWeb") };
      if (govde.ad.length < 2) return mesaj(d, "Lütfen adınızı ve soyadınızı yazın.", "hata");
      if (!/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(govde.eposta)) return mesaj(d, "Geçerli bir e-posta adresi yazın.", "hata");
      if (!govde.kategori) return mesaj(d, "Konu seçin.", "hata");
      if (govde.baslik.length < 3) return mesaj(d, "Kısa bir başlık yazın.", "hata");
      if (govde.metin.length < 10) return mesaj(d, "Sorununuzu biraz daha ayrıntılı anlatın.", "hata");
      govde.captcha = window.turnstile && captchaKimligi !== null ? window.turnstile.getResponse(captchaKimligi) : "";
      if (!govde.captcha) return mesaj(d, "Lütfen güvenlik doğrulamasını tamamlayın.", "hata");
      const dugme = document.getElementById("dGonder");
      dugme.disabled = true;
      dugme.textContent = "Gönderiliyor…";
      try {
        const r = await istek(govde);
        alan.innerHTML = `<div class="bos-durum destek-tamam" role="status">
          <h2 class="bos-baslik">Talebiniz alındı${r.kod ? ` — ${esc(r.kod)}` : ""}</h2>
          <p><strong>${esc(govde.eposta)}</strong> adresine bir onay e-postası gönderdik. Yanıtımızı ve yazışmanın devamını o e-postadaki bağlantıdan görebilirsiniz.</p>
          <p class="alan-ipucu">E-posta birkaç dakika içinde gelmezse gereksiz (spam) klasörünü kontrol edin.</p>
          <div class="bos-durum-butonlar"><a class="btn btn-ana" href="index.html">Ana sayfaya dön</a></div></div>`;
      } catch (h) {
        mesaj(d, h.message, "hata");
        dugme.disabled = false;
        dugme.textContent = "Talebi gönder";
        if (window.turnstile && captchaKimligi !== null) window.turnstile.reset(captchaKimligi);
      }
    });
  }

  // ================= TAKİP BAĞLANTISI =================
  async function takipCiz(veri) {
    const { talep, mesajlar } = veri;
    document.getElementById("destekBaslik").textContent = `Destek talebi ${talep.kod}`;
    document.getElementById("destekGiris").textContent = "Bu sayfa yalnızca size gönderilen bağlantıyla açılır. Bağlantıyı başkalarıyla paylaşmayın.";
    alan.innerHTML = `
      <section class="blok panel-kart">
        <div class="destek-ust"><div><h2>${esc(talep.baslik)}</h2><p class="alan-ipucu">${esc(talep.kategori_adi || "")} · ${esc(tarihMetni(talep.olusturulma))}</p></div>
          <span class="panel-durum ${talep.durum === "yanitlandi" ? "yayinda" : talep.durum === "kapandi" ? "" : "incelemede"}">${esc(DURUM[talep.durum] || talep.durum)}</span></div>
        <ol class="yazisma">${mesajlar
          .map(
            (m) => `<li class="yazisma-mesaj ${m.yazan === "yonetim" ? "yonetimden" : "sizden"}">
              <span class="yazisma-kim">${m.yazan === "yonetim" ? "Klinik Psikologlar destek" : "Siz"} · ${esc(new Date(m.olusturulma).toLocaleString("tr-TR"))}</span>
              <p class="on-metin">${esc(m.metin)}</p></li>`
          )
          .join("")}</ol>
        <form id="yanitFormu" novalidate>
          <div class="form-alani"><label class="alan-etiket" for="yMetin">${talep.durum === "kapandi" ? "Talep kapatıldı. Yeniden yazarsanız talep tekrar açılır." : "Yeni mesaj"}</label>
            <textarea class="girdi" id="yMetin" rows="4" maxlength="5000"></textarea></div>
          <div class="mesaj" id="yDurum" role="status" hidden></div>
          <div class="duzen-alt"><button class="btn btn-ana btn-kucuk" type="submit" id="yGonder">Gönder</button></div>
        </form>
      </section>`;
    document.getElementById("yanitFormu").addEventListener("submit", async (e) => {
      e.preventDefault();
      const metin = document.getElementById("yMetin").value.trim();
      const d = document.getElementById("yDurum");
      if (metin.length < 2) return mesaj(d, "Mesajınızı yazın.", "hata");
      const dugme = document.getElementById("yGonder");
      dugme.disabled = true;
      try {
        const r = await istek({ islem: "yanitla", kod, anahtar, metin });
        await takipCiz(r);
        mesaj(document.getElementById("yDurum"), "Mesajınız iletildi.", "basari");
      } catch (h) {
        mesaj(d, h.message, "hata");
        dugme.disabled = false;
      }
    });
  }

  async function baslat() {
    if (kod && anahtar) {
      try {
        await takipCiz(await istek({ islem: "goruntule", kod, anahtar }));
      } catch (h) {
        alan.innerHTML = `<div class="bos-durum" role="alert"><h2 class="bos-baslik">Talep açılamadı</h2><p>${esc(h.message)}</p>
          <div class="bos-durum-butonlar"><a class="btn btn-ana" href="destek.html">Yeni talep oluştur</a></div></div>`;
      }
    } else formCiz();
  }
  baslat();
})();
