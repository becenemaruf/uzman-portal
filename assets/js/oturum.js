/*
 * OTURUM (Supabase Auth) — yalnızca giriş ve panel sayfalarında yüklenir.
 *
 * supabase-js kütüphanesi assets/vendor/supabase/ içinde yerel olarak tutulur
 * (sürüm 2.45.4); dışarıdaki bir sunucudan yüklenmez.
 *
 * "Beni hatırla":
 *  - İşaretliyse oturum tarayıcı kapatılıp açılsa da sürer (localStorage).
 *  - İşaretli değilse oturum yalnızca bu sekme açıkken geçerlidir (sessionStorage).
 */
const Oturum = (() => {
  const KALICI_ANAHTAR = "kpOturumKalici";

  function kaliciMi() {
    try {
      return localStorage.getItem(KALICI_ANAHTAR) !== "0";
    } catch (e) {
      return false;
    }
  }

  // İki depolama arasında seçim yapan küçük bir aracı.
  const depo = {
    getItem(k) {
      try {
        return sessionStorage.getItem(k) ?? localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    setItem(k, v) {
      try {
        if (kaliciMi()) {
          localStorage.setItem(k, v);
          sessionStorage.removeItem(k);
        } else {
          sessionStorage.setItem(k, v);
          localStorage.removeItem(k);
        }
      } catch (e) {
        /* depolama kapalı: oturum yalnızca bu sayfada sürer */
      }
    },
    removeItem(k) {
      try {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      } catch (e) {
        /* yok say */
      }
    },
  };

  const istemci = window.supabase.createClient(BAGLANTI.supabaseAdresi, BAGLANTI.supabaseAnahtari, {
    auth: {
      storage: depo,
      persistSession: true,
      autoRefreshToken: true,
      // E-postadaki bağlantılar (doğrulama, şifre yenileme) başka cihazda da açılabildiği için
      // "implicit" akış kullanılır; bağlantıdaki anahtar sayfa açılınca okunur ve adresten silinir.
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  });

  // Sitenin kök adresi (github.io/uzman-portal/ ya da klinikpsikologlar.com.tr/) — e-posta bağlantıları buraya döner.
  const kok = location.origin + location.pathname.replace(/[^/]*$/, "");

  /* Supabase'in İngilizce hata mesajlarını anlaşılır Türkçeye çevirir.
   * Güvenlik gereği giriş hatalarında "e-posta mı şifre mi yanlış" ayrımı yapılmaz. */
  function hataMetni(hata) {
    const m = String((hata && (hata.message || hata.msg)) || "").toLowerCase();
    const kod = hata && (hata.code || hata.error_code);
    if (kod === "invalid_credentials" || m.includes("invalid login credentials")) return "E-posta adresi veya şifre hatalı.";
    if (kod === "email_not_confirmed" || m.includes("email not confirmed"))
      return "E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzdaki doğrulama bağlantısına tıklayın.";
    if (kod === "user_already_exists" || m.includes("already registered")) return "Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.";
    // Sızdırılmış şifre koruması: şifre daha önce bir veri sızıntısında görülmüşse
    if ((hata && Array.isArray(hata.reasons) && hata.reasons.includes("pwned")) || m.includes("easy to guess") || m.includes("pwned"))
      return "Bu şifre daha önce internetteki bir veri sızıntısında görülmüş ya da kolay tahmin edilebilir. Güvenliğiniz için başka bir şifre seçin.";
    if (kod === "weak_password" || m.includes("password should")) return "Şifre yeterince güçlü değil. Lütfen kurallara uyan bir şifre seçin.";
    if (kod === "same_password" || m.includes("different from the old")) return "Yeni şifre eskisiyle aynı olamaz.";
    if (kod === "over_email_send_rate_limit" || kod === "over_request_rate_limit" || m.includes("rate limit") || m.includes("too many"))
      return "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.";
    if (m.includes("captcha")) return "Güvenlik doğrulaması tamamlanamadı. Lütfen kutuyu tekrar işaretleyip deneyin.";
    if (kod === "otp_expired" || m.includes("expired")) return "Bağlantının süresi dolmuş. Lütfen yeni bir bağlantı isteyin.";
    if (kod === "signup_disabled" || m.includes("signups not allowed")) return "Yeni kayıtlar şu an kapalı.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.";
    return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
  }

  return {
    istemci,
    kok,
    hataMetni,
    kaliciYap(evet) {
      try {
        localStorage.setItem(KALICI_ANAHTAR, evet ? "1" : "0");
      } catch (e) {
        /* yok say */
      }
    },
    async oturum() {
      const { data } = await istemci.auth.getSession();
      return data.session;
    },
    async cikis() {
      await istemci.auth.signOut();
    },
  };
})();

/* CAPTCHA (Cloudflare Turnstile) — her form için ayrı kutu.
 * Supabase'in "Attack Protection" ayarında CAPTCHA açıksa, giriş/kayıt/şifre yenileme
 * istekleri bu kutudan gelen tek kullanımlık anahtar olmadan kabul edilmez.
 * Yerelde (localhost) Cloudflare'in resmi test anahtarı kullanılır. */
const Captcha = (() => {
  const yerelMi = ["localhost", "127.0.0.1"].includes(location.hostname);
  const SITE_ANAHTARI = yerelMi ? "1x00000000000000000000AA" : BAGLANTI.turnstileSiteAnahtari;
  const kutular = {};
  let yukleniyor = null;

  function betikYukle() {
    if (window.turnstile) return Promise.resolve();
    if (yukleniyor) return yukleniyor;
    yukleniyor = new Promise((tamam, hata) => {
      const b = document.createElement("script");
      b.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      b.async = true;
      b.onload = tamam;
      b.onerror = hata;
      document.head.appendChild(b);
    });
    return yukleniyor;
  }

  return {
    async ciz(alanId) {
      const alan = document.getElementById(alanId);
      if (!alan || kutular[alanId] !== undefined) return;
      try {
        await betikYukle();
        kutular[alanId] = window.turnstile.render(alan, { sitekey: SITE_ANAHTARI, language: "tr", theme: "light" });
      } catch (e) {
        alan.textContent = "Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyip tekrar deneyin.";
      }
    },
    anahtar(alanId) {
      if (!window.turnstile || kutular[alanId] === undefined) return undefined;
      return window.turnstile.getResponse(kutular[alanId]) || undefined;
    },
    sifirla(alanId) {
      if (window.turnstile && kutular[alanId] !== undefined) window.turnstile.reset(kutular[alanId]);
    },
  };
})();
