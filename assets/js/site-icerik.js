/*
 * SİTE İÇERİĞİ — yönetim panelinden değiştirilen içeriklerin sitede uygulanması
 *
 * 1) Genel site ayarları (site_ayarlari): alt bilgi açıklaması, kurumsal adres, sosyal medya,
 *    iletişim e-postaları, ana sayfa açıklaması ve ana sayfa SEO başlığı/açıklaması.
 * 2) Sabit sayfalar (sayfa_surumleri): <body data-sayfa="..."> olan sayfalarda, panelden
 *    yayımlanmış bir sürüm varsa başlık, giriş metni ve içerik onunla değiştirilir.
 *    Yayımlanmış sürüm yoksa sayfa dosyasındaki orijinal metin görünür.
 *    ?onizleme=<sürüm no> ile açılırsa (yalnızca yönetici oturumuyla) taslak sürüm gösterilir.
 *
 * Güvenlik: Sayfa içeriği, ekrana basılmadan önce GuvenliHtml (DOMPurify) ile yeniden temizlenir.
 * Diğer tüm değerler yalnızca düz metin olarak (textContent) yazılır.
 * Bağlantı kurulamazsa sayfa olduğu gibi kalır; hiçbir şey bozulmaz.
 */
const SiteIcerik = (() => {
  const ADRES = `${BAGLANTI.supabaseAdresi}/rest/v1`;
  const BASLIK = { apikey: BAGLANTI.supabaseAnahtari, Accept: "application/json" };

  async function oku(yol, ek = {}) {
    const denetim = new AbortController();
    const sayac = setTimeout(() => denetim.abort(), 10000);
    try {
      const y = await fetch(`${ADRES}/${yol}`, { headers: { ...BASLIK, ...ek }, signal: denetim.signal });
      if (!y.ok) throw new Error(`Veri alınamadı (${y.status})`);
      return await y.json();
    } finally {
      clearTimeout(sayac);
    }
  }

  // Ayarlar bir kez okunur; manşet ve duyuru alanları da aynı sonucu bekler.
  const ayarlarSozu = oku("site_ayarlari?select=*&id=eq.1")
    .then((s) => s[0] || {})
    .catch((e) => {
      console.warn("Site ayarları okunamadı:", e);
      return {};
    });

  function meta(ad, deger, ozellik = false) {
    const secici = ozellik ? `meta[property="${ad}"]` : `meta[name="${ad}"]`;
    let m = document.head.querySelector(secici);
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute(ozellik ? "property" : "name", ad);
      document.head.appendChild(m);
    }
    m.setAttribute("content", deger);
  }

  const SOSYAL = [
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["linkedin", "LinkedIn"],
    ["youtube", "YouTube"],
  ];

  function ayarlariUygula(a) {
    // --- İletişim e-postaları (ör. İletişim sayfasındaki kartlar) ---
    document.querySelectorAll("[data-ayar]").forEach((el) => {
      const anahtar = el.dataset.ayar;
      const deger = a[anahtar] || (anahtar === "destek_eposta" ? a.iletisim_eposta : null);
      if (!deger || !/eposta$/.test(anahtar)) return;
      const link = document.createElement("a");
      link.href = `mailto:${deger}`;
      link.textContent = deger;
      link.className = "eposta-baglanti";
      el.replaceWith(link);
    });
    document.querySelectorAll("[data-ayar-yoksa]").forEach((el) => {
      if (a[el.dataset.ayarYoksa]) el.hidden = true;
    });

    // --- Alt bilgi: açıklama, adres, e-posta, sosyal medya ---
    const alt = document.querySelector("footer.alt .kapsayici");
    if (alt && !alt.querySelector(".alt-ek")) {
      const ek = document.createElement("div");
      ek.className = "alt-ek";
      if (a.footer_aciklama) {
        const p = document.createElement("p");
        p.className = "alt-aciklama";
        p.textContent = a.footer_aciklama;
        ek.appendChild(p);
      }
      const satir = [];
      if (a.kurumsal_adres) satir.push(Object.assign(document.createElement("span"), { textContent: a.kurumsal_adres }));
      if (a.iletisim_eposta) satir.push(Object.assign(document.createElement("a"), { href: `mailto:${a.iletisim_eposta}`, textContent: a.iletisim_eposta }));
      if (satir.length) {
        const p = document.createElement("p");
        p.className = "alt-iletisim";
        satir.forEach((x, i) => {
          if (i) p.append(" · ");
          p.appendChild(x);
        });
        ek.appendChild(p);
      }
      const sosyal = SOSYAL.filter(([k]) => a[k] && /^https:\/\//.test(a[k]));
      if (sosyal.length) {
        const nav = document.createElement("nav");
        nav.className = "alt-sosyal";
        nav.setAttribute("aria-label", "Sosyal medya hesaplarımız");
        nav.innerHTML = sosyal
          .map(([k, ad]) => `<a href="${esc(a[k])}" target="_blank" rel="noopener" aria-label="${ad}" title="${ad}">${ikon(k)}</a>`)
          .join("");
        ek.appendChild(nav);
      }
      if (ek.childNodes.length) {
        const yer = alt.querySelector(".acil-not") || alt.firstElementChild;
        yer.after(ek);
      }
    }

    // --- Ana sayfa ---
    if (document.body.dataset.sayfa === "ana-sayfa") {
      const aciklama = document.querySelector(".arama-aciklama");
      if (aciklama && a.ana_sayfa_aciklama) aciklama.textContent = a.ana_sayfa_aciklama;
      if (a.seo_baslik) {
        document.title = a.seo_baslik;
        meta("og:title", a.seo_baslik, true);
      }
      if (a.seo_aciklama) {
        meta("description", a.seo_aciklama);
        meta("og:description", a.seo_aciklama, true);
      }
    }
  }

  // ---------- Sabit sayfalar ----------
  function oturumAnahtari() {
    try {
      for (const depo of [sessionStorage, localStorage]) {
        const k = Object.keys(depo).find((x) => /^sb-.*-auth-token$/.test(x));
        if (!k) continue;
        const o = JSON.parse(depo.getItem(k));
        if (o && o.access_token && (!o.expires_at || o.expires_at * 1000 > Date.now() + 30000)) return o.access_token;
      }
    } catch (e) {
      /* depolama kapalı */
    }
    return null;
  }

  const kisaltma = (m) =>
    m
      .toLocaleLowerCase("tr")
      .replace(/[çğıöşü]/g, (h) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[h])
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "bolum";

  // İçindekiler listesini içerikteki ana başlıklardan (h2) yeniden oluşturur.
  function icindekileriYenile(icerik) {
    const nav = document.querySelector(".icindekiler ol");
    if (!nav) return;
    const kullanilan = new Set();
    const maddeler = [...icerik.querySelectorAll("h2")].map((h) => {
      const bolum = h.closest("section[id]");
      let id = h.id || (bolum && icerik.contains(bolum) ? bolum.id : "");
      if (!id || kullanilan.has(id)) {
        id = kisaltma(h.textContent);
        let n = 2;
        while (kullanilan.has(id) || document.getElementById(id)) id = `${kisaltma(h.textContent)}-${n++}`;
        h.id = id;
      }
      kullanilan.add(id);
      // "1. Veri sorumlusu" → "Veri sorumlusu"
      const metin = h.textContent.replace(/^\s*\d+\.\s*/, "").trim();
      return `<li><a href="#${esc(id)}">${esc(metin)}</a></li>`;
    });
    nav.innerHTML = maddeler.join("");
    nav.closest(".icindekiler").hidden = !maddeler.length;
  }

  async function sayfayiUygula() {
    const sayfa = document.body.dataset.sayfa;
    const icerik = document.querySelector("[data-sayfa-icerik]");
    if (!sayfa || !icerik || typeof GuvenliHtml === "undefined") return;

    const onizlemeNo = new URLSearchParams(location.search).get("onizleme");
    let surum = null;
    try {
      const alanlar = "id,baslik,giris,icerik,meta_baslik,meta_aciklama,yayin_tarihi,olusturulma,durum";
      if (onizlemeNo && /^\d+$/.test(onizlemeNo)) {
        const anahtar = oturumAnahtari();
        if (!anahtar) return;
        const s = await oku(`sayfa_surumleri?select=${alanlar}&id=eq.${onizlemeNo}&sayfa=eq.${encodeURIComponent(sayfa)}`, { Authorization: `Bearer ${anahtar}` });
        surum = s[0] || null;
        if (surum) onizlemeSeridi(surum);
      } else {
        const s = await oku(`sayfa_surumleri?select=${alanlar}&sayfa=eq.${encodeURIComponent(sayfa)}&durum=eq.yayinda&limit=1`);
        surum = s[0] || null;
      }
    } catch (e) {
      console.warn("Sayfa sürümü okunamadı; orijinal metin gösteriliyor.", e);
      return;
    }
    if (!surum) return;

    const baslik = document.querySelector("[data-sayfa-baslik]");
    if (baslik) baslik.textContent = surum.baslik;
    const giris = document.querySelector("[data-sayfa-giris]");
    if (giris) {
      giris.textContent = surum.giris || "";
      giris.hidden = !surum.giris;
    }
    const tarih = document.querySelector("[data-sayfa-tarih]");
    const t = surum.yayin_tarihi || surum.olusturulma;
    if (tarih && t) {
      tarih.innerHTML = `Son güncelleme: <time datetime="${esc(t.slice(0, 10))}">${esc(tarihMetni(t))}</time>`;
    }
    icerik.innerHTML = GuvenliHtml.temizle(surum.icerik);
    icindekileriYenile(icerik);
    if (surum.meta_baslik) {
      document.title = surum.meta_baslik;
      meta("og:title", surum.meta_baslik, true);
    }
    if (surum.meta_aciklama) {
      meta("description", surum.meta_aciklama);
      meta("og:description", surum.meta_aciklama, true);
    }
    // Değişen içerikteki e-posta yerlerini de doldur
    ayarlariUygula(await ayarlarSozu);
    // Adres bir bölüme işaret ediyorsa (ör. #haklar) içerik değiştikten sonra oraya git
    if (location.hash) {
      const hedef = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (hedef) hedef.scrollIntoView();
    }
  }

  function onizlemeSeridi(surum) {
    const serit = document.createElement("div");
    serit.className = "onizleme-seridi sayfa-onizleme";
    serit.setAttribute("role", "status");
    serit.innerHTML = `<span><strong>Önizleme</strong> — ${surum.durum === "yayinda" ? "yayındaki sürüm" : surum.durum === "arsiv" ? "eski bir sürüm" : "taslak (sitede görünmüyor)"}.
      Bu görünümü yalnızca yöneticiler görebilir.</span>
      <a class="btn btn-cizgi btn-kucuk" href="yonetim.html#sayfa/${esc(document.body.dataset.sayfa)}/${surum.id}">Düzenlemeye dön</a>`;
    const main = document.querySelector("main");
    if (main) main.prepend(serit);
    meta("robots", "noindex");
  }

  // ---------- Menüler (menu_ogeleri) ----------
  // Son okunan menü tarayıcıda saklanır ve sayfa açılır açılmaz uygulanır (titreme olmasın);
  // ardından güncel hâli okunur. Okunamazsa sayfa dosyasındaki menü olduğu gibi kalır.
  const MENU_DEPO = "kpMenu:v1";
  const baglantiUygun = (a) =>
    /^https?:\/\/[^\s<>"'`]+$/.test(a) || /^#[A-Za-z0-9_-]*$/.test(a) || /^[a-z0-9-]+\.html([?#][^\s<>"'`]*)?$/.test(a) || /^mailto:[^\s<>"'`]+$/.test(a);

  function menuleriUygula(ogeler) {
    if (!Array.isArray(ogeler)) return;
    const buSayfa = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    const yerler = { ust: document.querySelector("#anaMenu .menu-baglantilar"), alt: document.querySelector("footer .alt-linkler") };
    for (const [konum, kap] of Object.entries(yerler)) {
      if (!kap) continue;
      const liste = ogeler.filter((o) => o.konum === konum && o.aktif !== false && baglantiUygun(o.baglanti)).sort((a, b) => a.sira - b.sira);
      // Bu sayfayı gösteren ilk bağlantı (çapasız olan öncelikli) "bulunduğunuz sayfa" olarak işaretlenir
      const dosya = (o) => o.baglanti.split(/[?#]/)[0].toLowerCase();
      const isaretli = konum === "ust" ? liste.find((o) => dosya(o) === buSayfa && !o.baglanti.includes("#")) || liste.find((o) => dosya(o) === buSayfa) : null;
      kap.replaceChildren(
        ...liste.map((o) => {
          const a = document.createElement("a");
          if (konum === "ust") a.className = "metin-link";
          a.href = o.baglanti;
          a.textContent = o.etiket;
          if (o.yeni_sekme) {
            a.target = "_blank";
            a.rel = "noopener";
          }
          if (o === isaretli) a.setAttribute("aria-current", "page");
          return a;
        })
      );
    }
  }

  try {
    const onbellek = JSON.parse(localStorage.getItem(MENU_DEPO) || "null");
    if (onbellek) menuleriUygula(onbellek);
  } catch (e) {
    /* depolama kapalı */
  }
  const menuyuYenile = () =>
    oku("menu_ogeleri?select=konum,etiket,baglanti,yeni_sekme,sira&aktif=eq.true&order=konum,sira")
    .then((ogeler) => {
      menuleriUygula(ogeler);
      try {
        localStorage.setItem(MENU_DEPO, JSON.stringify(ogeler));
      } catch (e) {
        /* depolama kapalı */
      }
    })
    .catch((e) => console.warn("Menüler okunamadı; sayfadaki menü gösteriliyor.", e));
  menuyuYenile();

  ayarlarSozu.then(ayarlariUygula);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sayfayiUygula);
  else sayfayiUygula();

  return { ayarlar: () => ayarlarSozu, menuyuYenile };
})();
