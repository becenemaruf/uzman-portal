/*
 * UZMAN GİRİŞİ / KAYIT / ŞİFRE YENİLEME
 * Supabase Auth'a bağlıdır (assets/js/oturum.js).
 *
 * Akış:
 *  1. Kayıt  → doğrulama e-postası gider → bağlantıya tıklayınca panel.html açılır.
 *  2. Giriş  → panel.html
 *  3. Şifremi unuttum → e-postadaki bağlantı giris.html?yenile=1 adresine döner → "Yeni şifre" ekranı.
 *
 * Güvenlik:
 *  - Giriş hatasında e-posta mı şifre mi yanlış söylenmez.
 *  - "Şifremi unuttum" ekranı, adresin kayıtlı olup olmadığını belli etmez.
 *  - Her istek Cloudflare Turnstile (CAPTCHA) anahtarıyla gönderilir.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const sb = Oturum.istemci;
  const PANEL = "panel.html";

  // --- Görünümler arası geçiş: adres sonundaki #kayit, #sifremi-unuttum gibi ekler ---
  const gorunumler = [...document.querySelectorAll("[data-gorunum]")];
  let sabitGorunum = null; // Şifre yenileme bağlantısından gelindiyse adres ekinden bağımsız gösterilir.
  function gorunumGoster() {
    const ek = location.hash.replace("#", "");
    // Supabase bağlantısının taşıdığı anahtarlar (#access_token=...) bir görünüm adı değildir.
    const istenen = sabitGorunum || (ek && !ek.includes("=") ? ek : "giris");
    const hedef = gorunumler.find((g) => g.dataset.gorunum === istenen) || gorunumler[0];
    gorunumler.forEach((g) => (g.hidden = g !== hedef));
    const baslik = hedef.querySelector("h1");
    if (baslik) {
      baslik.setAttribute("tabindex", "-1");
      baslik.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
    // Görünen formun CAPTCHA kutusu çizilir.
    hedef.querySelectorAll(".captcha-kutu").forEach((k) => Captcha.ciz(k.id));
  }
  window.addEventListener("hashchange", () => {
    sabitGorunum = null;
    gorunumGoster();
  });

  // --- Mesaj kutuları ---
  function mesaj(id, metin, tur = "hata") {
    const el = $(id);
    el.className = `mesaj mesaj-${tur}`;
    el.textContent = metin;
    el.hidden = !metin;
  }

  // Düğmeyi işlem sürerken kilitler (çift tıklamayı önler).
  async function bekleyerek(dugmeId, yaziBekle, is) {
    const d = $(dugmeId);
    const eski = d.textContent;
    d.disabled = true;
    d.textContent = yaziBekle;
    try {
      return await is();
    } finally {
      d.disabled = false;
      d.textContent = eski;
    }
  }

  // --- Şifreyi göster/gizle düğmeleri ---
  document.querySelectorAll("[data-sifre-goster]").forEach((dugme) => {
    const girdi = $(dugme.dataset.sifreGoster);
    dugme.innerHTML = ikon("goz");
    dugme.addEventListener("click", () => {
      const gizli = girdi.type === "password";
      girdi.type = gizli ? "text" : "password";
      dugme.innerHTML = ikon(gizli ? "gozKapali" : "goz");
      dugme.setAttribute("aria-label", gizli ? "Şifreyi gizle" : "Şifreyi göster");
    });
  });

  // --- Unvan seçenekleri (ayarlar.js'teki aktif meslekler) ---
  UNVANLAR.forEach((u) => $("kayitUnvan").insertAdjacentHTML("beforeend", `<option>${esc(u)}</option>`));
  if (UNVANLAR.length === 1) $("kayitUnvan").value = UNVANLAR[0];

  // --- Şifre kuralları ---
  const KURALLAR = {
    uzunluk: (s) => s.length >= 10,
    buyuk: (s) => /[A-ZÇĞİÖŞÜ]/.test(s),
    kucuk: (s) => /[a-zçğıöşü]/.test(s),
    rakam: (s) => /\d/.test(s),
  };
  const sifreGucluMu = (s) => Object.values(KURALLAR).every((k) => k(s));
  function sifreKontrol(sifre) {
    let saglanan = 0;
    Object.entries(KURALLAR).forEach(([ad, kontrol]) => {
      const tamam = kontrol(sifre);
      if (tamam) saglanan++;
      const li = document.querySelector(`[data-kural="${ad}"]`);
      if (li) li.classList.toggle("tamam", tamam);
    });
    const cubuk = $("gucCubugu");
    cubuk.style.width = `${(saglanan / 4) * 100}%`;
    cubuk.style.backgroundColor = saglanan <= 2 ? "var(--hata)" : saglanan === 3 ? "#c58a1a" : "var(--basari)";
    return saglanan === 4;
  }
  $("kayitSifre").addEventListener("input", (e) => sifreKontrol(e.target.value));

  function alanIsaretle(id, hatali) {
    $(id).setAttribute("aria-invalid", hatali ? "true" : "false");
  }

  // --- "Beni hatırla" varsayılanı: önceki tercih ---
  try {
    $("beniHatirla").checked = localStorage.getItem("kpOturumKalici") === "1";
  } catch (e) {
    /* yok say */
  }

  // --- GİRİŞ ---
  $("girisFormu").addEventListener("submit", async (e) => {
    e.preventDefault();
    const eposta = $("girisEposta").value.trim();
    const sifre = $("girisSifre").value;
    alanIsaretle("girisEposta", !EPOSTA_DESENI.test(eposta));
    alanIsaretle("girisSifre", !sifre);
    if (!EPOSTA_DESENI.test(eposta) || !sifre) {
      mesaj("girisHata", "Lütfen geçerli bir e-posta adresi ve şifrenizi girin.");
      return;
    }
    mesaj("girisHata", "");
    Oturum.kaliciYap($("beniHatirla").checked);
    await bekleyerek("girisDugme", "Giriş yapılıyor…", async () => {
      const { error } = await sb.auth.signInWithPassword({
        email: eposta,
        password: sifre,
        options: { captchaToken: Captcha.anahtar("girisCaptcha") },
      });
      Captcha.sifirla("girisCaptcha");
      if (error) {
        mesaj("girisHata", Oturum.hataMetni(error));
        return;
      }
      location.href = PANEL;
    });
  });

  // --- KAYIT ---
  $("kayitFormu").addEventListener("submit", async (e) => {
    e.preventDefault();
    const hatalar = [];
    const ad = $("kayitAd").value.trim();
    const soyad = $("kayitSoyad").value.trim();
    const unvan = $("kayitUnvan").value;
    const eposta = $("kayitEposta").value.trim();
    const sifre = $("kayitSifre").value;
    const sifre2 = $("kayitSifre2").value;

    alanIsaretle("kayitAd", !ad || ad.length > 60);
    alanIsaretle("kayitSoyad", !soyad || soyad.length > 60);
    alanIsaretle("kayitUnvan", !unvan);
    alanIsaretle("kayitEposta", !EPOSTA_DESENI.test(eposta));
    alanIsaretle("kayitSifre", !sifreKontrol(sifre));
    alanIsaretle("kayitSifre2", sifre !== sifre2 || !sifre2);

    if (!ad || !soyad || !unvan) hatalar.push("Ad, soyad ve unvan alanlarını doldurun.");
    if (ad.length > 60 || soyad.length > 60) hatalar.push("Ad ve soyad en fazla 60 karakter olabilir.");
    if (!EPOSTA_DESENI.test(eposta)) hatalar.push("Geçerli bir e-posta adresi girin.");
    if (!sifreKontrol(sifre)) hatalar.push("Şifreniz tüm kuralları karşılamalı.");
    else if (sifre !== sifre2) hatalar.push("Şifreler birbiriyle eşleşmiyor.");
    if (hatalar.length) {
      mesaj("kayitHata", hatalar.join(" "));
      return;
    }
    mesaj("kayitHata", "");

    await bekleyerek("kayitDugme", "Hesap oluşturuluyor…", async () => {
      const { data, error } = await sb.auth.signUp({
        email: eposta,
        password: sifre,
        options: {
          emailRedirectTo: Oturum.kok + PANEL,
          captchaToken: Captcha.anahtar("kayitCaptcha"),
          // Profil, ilk girişte bu bilgilerle "taslak" olarak oluşturulur.
          data: { ad, soyad, unvan },
        },
      });
      Captcha.sifirla("kayitCaptcha");
      if (error) {
        mesaj("kayitHata", Oturum.hataMetni(error));
        return;
      }
      // E-posta doğrulaması kapalıysa Supabase doğrudan oturum açar.
      if (data && data.session) {
        location.href = PANEL;
        return;
      }
      $("dogrulamaAdresi").textContent = eposta;
      location.hash = "dogrulama";
    });
  });

  // --- DOĞRULAMA E-POSTASINI TEKRAR GÖNDER (60 saniyede bir) ---
  $("tekrarGonder").addEventListener("click", async () => {
    const dugme = $("tekrarGonder");
    const eposta = $("dogrulamaAdresi").textContent.trim();
    if (!EPOSTA_DESENI.test(eposta)) {
      location.hash = "kayit";
      return;
    }
    dugme.disabled = true;
    const { error } = await sb.auth.resend({
      type: "signup",
      email: eposta,
      options: { emailRedirectTo: Oturum.kok + PANEL, captchaToken: Captcha.anahtar("tekrarCaptcha") },
    });
    Captcha.sifirla("tekrarCaptcha");
    if (error) {
      mesaj("tekrarMesaj", Oturum.hataMetni(error));
      dugme.disabled = false;
      return;
    }
    mesaj("tekrarMesaj", "Doğrulama bağlantısı tekrar gönderildi.", "basari");
    let kalan = 60;
    dugme.textContent = `Tekrar göndermek için ${kalan} sn bekleyin`;
    const sayac = setInterval(() => {
      kalan--;
      dugme.textContent = `Tekrar göndermek için ${kalan} sn bekleyin`;
      if (kalan <= 0) {
        clearInterval(sayac);
        dugme.disabled = false;
        dugme.textContent = "Bağlantıyı tekrar gönder";
      }
    }, 1000);
  });

  // --- ŞİFREMİ UNUTTUM ---
  $("unuttumFormu").addEventListener("submit", async (e) => {
    e.preventDefault();
    const eposta = $("unuttumEposta").value.trim();
    alanIsaretle("unuttumEposta", !EPOSTA_DESENI.test(eposta));
    if (!EPOSTA_DESENI.test(eposta)) {
      mesaj("unuttumHata", "Lütfen geçerli bir e-posta adresi girin.");
      return;
    }
    mesaj("unuttumHata", "");
    await bekleyerek("unuttumDugme", "Gönderiliyor…", async () => {
      const { error } = await sb.auth.resetPasswordForEmail(eposta, {
        redirectTo: `${Oturum.kok}giris.html?yenile=1`,
        captchaToken: Captcha.anahtar("unuttumCaptcha"),
      });
      Captcha.sifirla("unuttumCaptcha");
      // Hesap var/yok bilgisi sızmasın: yalnızca CAPTCHA ve sınır hatalarını gösteririz.
      if (error && /captcha|rate|too many|fetch|network/i.test(error.message || "")) {
        mesaj("unuttumHata", Oturum.hataMetni(error));
        return;
      }
      location.hash = "baglanti-gonderildi";
    });
  });

  // --- YENİ ŞİFRE (yenileme bağlantısıyla gelindiğinde) ---
  $("yeniSifreFormu").addEventListener("submit", async (e) => {
    e.preventDefault();
    const s1 = $("yeniSifre").value;
    const s2 = $("yeniSifre2").value;
    alanIsaretle("yeniSifre", !sifreGucluMu(s1));
    alanIsaretle("yeniSifre2", s1 !== s2);
    if (!sifreGucluMu(s1)) {
      mesaj("yeniSifreHata", "Şifre en az 10 karakter olmalı; büyük harf, küçük harf ve rakam içermeli.");
      return;
    }
    if (s1 !== s2) {
      mesaj("yeniSifreHata", "Şifreler birbiriyle eşleşmiyor.");
      return;
    }
    await bekleyerek("yeniSifreDugme", "Güncelleniyor…", async () => {
      const { error } = await sb.auth.updateUser({ password: s1 });
      if (error) {
        mesaj("yeniSifreHata", Oturum.hataMetni(error));
        return;
      }
      mesaj("yeniSifreHata", "Şifreniz güncellendi. Panele yönlendiriliyorsunuz…", "basari");
      setTimeout(() => (location.href = PANEL), 1200);
    });
  });

  // --- Sayfa açılışı ---
  const yenilemeIstegi = new URLSearchParams(location.search).has("yenile");
  // Bağlantı hatalı/süresi dolmuşsa Supabase adrese #error=... ekler.
  const ekParametreler = new URLSearchParams(location.hash.slice(1));
  if (ekParametreler.get("error")) {
    const kod = ekParametreler.get("error_code") || "";
    history.replaceState(null, "", location.pathname + location.search);
    sabitGorunum = yenilemeIstegi ? "sifremi-unuttum" : "giris";
    gorunumGoster();
    mesaj(
      yenilemeIstegi ? "unuttumHata" : "girisHata",
      kod === "otp_expired"
        ? "Bağlantının süresi dolmuş ya da daha önce kullanılmış. Lütfen yeni bir bağlantı isteyin."
        : "Bağlantı geçersiz. Lütfen yeni bir bağlantı isteyin."
    );
    return;
  }

  sb.auth.onAuthStateChange((olay) => {
    if (olay === "PASSWORD_RECOVERY") {
      sabitGorunum = "yeni-sifre";
      gorunumGoster();
    }
  });

  (async () => {
    const oturum = await Oturum.oturum();
    if (yenilemeIstegi && oturum) {
      sabitGorunum = "yeni-sifre";
    } else if (oturum && !location.hash.includes("=")) {
      // Zaten giriş yapılmışsa giriş ekranı yerine panel açılır.
      location.replace(PANEL);
      return;
    }
    gorunumGoster();
  })();
})();
