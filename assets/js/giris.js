/*
 * UZMAN GİRİŞİ / KAYIT EKRANLARI (PROTOTİP)
 * Bu aşamada formlar gerçek bir sunucuya bağlı değil; sadece ekran akışını
 * ve form kontrollerini gösterir. Veritabanı (Supabase) bağlandığında
 * "SUNUCU" yazan yerler gerçek işlemlerle değiştirilecek.
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // --- Görünümler arası geçiş: adres sonundaki #kayit, #sifremi-unuttum gibi ekler ---
  const gorunumler = [...document.querySelectorAll("[data-gorunum]")];
  function gorunumGoster() {
    const istenen = location.hash.replace("#", "") || "giris";
    const hedef = gorunumler.find((g) => g.dataset.gorunum === istenen) || gorunumler[0];
    gorunumler.forEach((g) => (g.hidden = g !== hedef));
    // Ekran okuyucu kullananlar için başlığa odaklan
    const baslik = hedef.querySelector("h1");
    if (baslik) {
      baslik.setAttribute("tabindex", "-1");
      baslik.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", gorunumGoster);
  gorunumGoster();

  // --- Mesaj kutuları ---
  function mesaj(id, metin, tur = "hata") {
    const el = $(id);
    el.className = `mesaj mesaj-${tur}`;
    el.textContent = metin;
    el.hidden = !metin;
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

  // --- Unvan seçenekleri (ayarlar.js'teki listeden) ---
  UNVANLAR.forEach((u) => $("kayitUnvan").insertAdjacentHTML("beforeend", `<option>${esc(u)}</option>`));

  // --- Şifre kuralları: yazdıkça işaretlenir ---
  const KURALLAR = {
    uzunluk: (s) => s.length >= 10,
    buyuk: (s) => /[A-ZÇĞİÖŞÜ]/.test(s),
    kucuk: (s) => /[a-zçğıöşü]/.test(s),
    rakam: (s) => /\d/.test(s),
  };
  function sifreKontrol(sifre) {
    let saglanan = 0;
    Object.entries(KURALLAR).forEach(([ad, kontrol]) => {
      const tamam = kontrol(sifre);
      if (tamam) saglanan++;
      document.querySelector(`[data-kural="${ad}"]`).classList.toggle("tamam", tamam);
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

  // --- GİRİŞ ---
  $("girisFormu").addEventListener("submit", (e) => {
    e.preventDefault();
    const eposta = $("girisEposta").value.trim();
    const sifre = $("girisSifre").value;
    alanIsaretle("girisEposta", !EPOSTA_DESENI.test(eposta));
    alanIsaretle("girisSifre", !sifre);
    if (!EPOSTA_DESENI.test(eposta) || !sifre) {
      mesaj("girisHata", "Lütfen geçerli bir e-posta adresi ve şifrenizi girin.");
      return;
    }
    // SUNUCU: Burada Supabase ile giriş yapılacak. Hatalı denemede her zaman aynı mesaj
    // gösterilir ("E-posta veya şifre hatalı") — hangisinin yanlış olduğu söylenmez.
    mesaj("girisHata", "Taslak sürüm: Giriş, veritabanı bağlantısı kurulduğunda çalışacak.", "bilgi");
  });

  // --- KAYIT ---
  $("kayitFormu").addEventListener("submit", (e) => {
    e.preventDefault();
    const hatalar = [];
    const ad = $("kayitAd").value.trim();
    const soyad = $("kayitSoyad").value.trim();
    const eposta = $("kayitEposta").value.trim();
    const sifre = $("kayitSifre").value;
    const sifre2 = $("kayitSifre2").value;

    alanIsaretle("kayitAd", !ad);
    alanIsaretle("kayitSoyad", !soyad);
    alanIsaretle("kayitUnvan", !$("kayitUnvan").value);
    alanIsaretle("kayitEposta", !EPOSTA_DESENI.test(eposta));
    alanIsaretle("kayitSifre", !sifreKontrol(sifre));
    alanIsaretle("kayitSifre2", sifre !== sifre2 || !sifre2);

    if (!ad || !soyad || !$("kayitUnvan").value) hatalar.push("Ad, soyad ve unvan alanlarını doldurun.");
    if (!EPOSTA_DESENI.test(eposta)) hatalar.push("Geçerli bir e-posta adresi girin.");
    if (!sifreKontrol(sifre)) hatalar.push("Şifreniz tüm kuralları karşılamalı.");
    else if (sifre !== sifre2) hatalar.push("Şifreler birbiriyle eşleşmiyor.");
    if (!$("kayitKvkk").checked || !$("kayitRiza").checked) hatalar.push("Devam etmek için KVKK metnini onaylayın ve açık rıza verin.");

    if (hatalar.length) {
      mesaj("kayitHata", hatalar.join(" "));
      return;
    }
    mesaj("kayitHata", "");
    // SUNUCU: Burada hesap oluşturulacak ve doğrulama e-postası gönderilecek.
    $("dogrulamaAdresi").textContent = eposta;
    location.hash = "dogrulama";
  });

  // --- DOĞRULAMA E-POSTASINI TEKRAR GÖNDER (60 saniyede bir) ---
  $("tekrarGonder").addEventListener("click", () => {
    const dugme = $("tekrarGonder");
    let kalan = 60;
    dugme.disabled = true;
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
  $("unuttumFormu").addEventListener("submit", (e) => {
    e.preventDefault();
    const eposta = $("unuttumEposta").value.trim();
    alanIsaretle("unuttumEposta", !EPOSTA_DESENI.test(eposta));
    if (!EPOSTA_DESENI.test(eposta)) {
      mesaj("unuttumHata", "Lütfen geçerli bir e-posta adresi girin.");
      return;
    }
    mesaj("unuttumHata", "");
    // SUNUCU: Burada şifre yenileme e-postası gönderilecek.
    location.hash = "baglanti-gonderildi";
  });
})();
