/*
 * YÖNETİM PANELİ — ÇERÇEVE (yonetim.html)
 *  - Yalnızca "yoneticiler" tablosunda kaydı olan hesaplar girebilir. Asıl koruma veritabanındadır:
 *    bu sayfadaki her okuma/yazma, Supabase güvenlik kuralları (RLS) tarafından ayrıca denetlenir.
 *  - Sol menü + sayfa içi yönlendirme (#basvurular, #mansetler, #duyurular, #sayfalar, #ayarlar).
 *  - Bölümler kendilerini Yonetim.bolumEkle(...) ile kaydeder (yonetim-*.js dosyaları).
 */
const Yonetim = (() => {
  const sb = Oturum.istemci;
  const DEPO = "site-gorselleri";
  const bolumler = {};
  let alan, kullanici;

  const MENU = [
    { kod: "", ad: "Özet", ikon: "katman" },
    { kod: "basvurular", ad: "Uzman başvuruları", ikon: "dogrulama" },
    { kod: "bildirimler", ad: "Sistem bildirimleri", ikon: "zil" },
    { grup: "İçerik yönetimi" },
    { kod: "mansetler", ad: "Manşetler (slider)", ikon: "yazi" },
    { kod: "duyurular", ad: "Duyurular ve tanıtımlar", ikon: "bilgi" },
    { kod: "sayfalar", ad: "Sabit sayfalar", ikon: "yazi" },
    { kod: "ayarlar", ad: "Genel site ayarları", ikon: "filtre" },
  ];

  function bolumEkle(kod, ac) {
    bolumler[kod] = ac;
  }

  // "#basvuru/abc" → { kod: "basvuru", param: "abc" }
  function adres() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    const [kod, ...geri] = h.split("/");
    return { kod, param: geri.join("/") };
  }

  function menuCiz(aktifKod) {
    const ust = { basvuru: "basvurular", manset: "mansetler", duyuru: "duyurular", sayfa: "sayfalar", bildirim: "bildirimler" }[aktifKod] ?? aktifKod;
    return `<nav class="yonetim-menu" aria-label="Yönetim bölümleri">
      ${MENU.map((m) =>
        m.grup
          ? `<p class="yonetim-menu-grup">${esc(m.grup)}</p>`
          : `<a href="#${m.kod}" ${m.kod === ust ? 'aria-current="page"' : ""}>${ikon(m.ikon)}<span>${esc(m.ad)}</span></a>`
      ).join("")}
      <button class="btn btn-cizgi btn-kucuk yonetim-cikis" type="button" data-cikis>Çıkış yap</button>
    </nav>`;
  }

  async function goster() {
    const { kod, param } = adres();
    const ac = bolumler[kod] || bolumler[""];
    alan.innerHTML = `<div class="yonetim-duzen">${menuCiz(kod)}<div class="yonetim-icerik" id="yonetimBolum"><p role="status">Yükleniyor…</p></div></div>`;
    alan.querySelectorAll("[data-cikis]").forEach((b) => b.addEventListener("click", cikis));
    const hedef = document.getElementById("yonetimBolum");
    try {
      await ac(hedef, param);
    } catch (e) {
      console.error(e);
      hedef.innerHTML = `<div class="mesaj mesaj-hata" role="alert">Bu bölüm yüklenemedi: ${esc(hataMetni(e))}
        <br><button class="btn btn-cizgi btn-kucuk" type="button" onclick="location.reload()" style="margin-top:10px">Yeniden dene</button></div>`;
    }
    window.scrollTo(0, 0);
  }

  // Bölüm içinden başka bir adrese geçiş (aynı adrese de "yeniden yükle" olarak çalışır).
  // İşlem bitince sayfa çizilmiş olur; ardından başarı mesajı gösterilebilir.
  async function git(hedef) {
    kirli = false;
    if (location.hash !== hedef) history.pushState(null, "", hedef);
    await goster();
  }

  async function cikis() {
    await Oturum.cikis();
    location.replace("giris.html");
  }

  // ---------- Bölümlerin ortak kullandığı yardımcılar ----------
  function hataMetni(e) {
    const m = (e && (e.message || e.error_description)) || "";
    if (/row-level security|permission denied|42501/i.test(m)) return "Bu işlem için yetkiniz yok.";
    if (/check constraint|violates/i.test(m)) return "Girilen bilgilerden biri kurallara uymuyor (uzunluk, bağlantı ya da görsel adresi). Lütfen kontrol edin.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.";
    return m || "Bilinmeyen bir hata oluştu.";
  }

  function mesaj(el, metin, tur = "bilgi") {
    if (!el) return;
    el.className = `mesaj mesaj-${tur}`;
    el.textContent = metin;
    el.hidden = !metin;
    if (metin && tur !== "bilgi") el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // İki aşamalı onay: ilk tıklamada uyarı, ikincisinde işlem (tarayıcı açılır penceresi kullanılmaz).
  function onayliDugme(dugme, metin, islem) {
    let hazir = false;
    const ilk = dugme.innerHTML;
    dugme.addEventListener("click", async () => {
      if (!hazir) {
        hazir = true;
        dugme.textContent = metin;
        dugme.classList.add("dikkat");
        setTimeout(() => {
          if (hazir && document.body.contains(dugme)) {
            hazir = false;
            dugme.innerHTML = ilk;
            dugme.classList.remove("dikkat");
          }
        }, 5000);
        return;
      }
      hazir = false;
      dugme.disabled = true;
      try {
        await islem();
      } finally {
        if (document.body.contains(dugme)) {
          dugme.disabled = false;
          dugme.innerHTML = ilk;
          dugme.classList.remove("dikkat");
        }
      }
    });
  }

  // Görsel yükleme: yalnızca JPG/PNG/WebP, en fazla 3 MB. Dönen adres herkese açık görsel adresidir.
  async function gorselYukle(dosya, klasor) {
    if (!dosya) return null;
    if (!/^image\/(jpeg|png|webp)$/.test(dosya.type)) throw new Error("Yalnızca JPG, PNG ya da WebP görsel yükleyebilirsiniz.");
    if (dosya.size > 3 * 1024 * 1024) throw new Error("Görsel 3 MB'tan büyük olamaz.");
    const uzanti = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[dosya.type];
    const yol = `${klasor}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${uzanti}`;
    const { error } = await sb.storage.from(DEPO).upload(yol, dosya, { contentType: dosya.type, upsert: false });
    if (error) throw error;
    return sb.storage.from(DEPO).getPublicUrl(yol).data.publicUrl;
  }

  // Bağlantı alanı için tarayıcı tarafı kontrol (veritabanı da aynı kuralı uygular)
  function baglantiUygun(adres) {
    if (!adres) return true;
    return /^https?:\/\/[^\s<>"'`]+$/.test(adres) || /^#[A-Za-z0-9_-]*$/.test(adres) || /^[a-z0-9-]+\.html([?#][^\s<>"'`]*)?$/.test(adres) || /^mailto:[^\s<>"'`]+$/.test(adres);
  }

  // Yayın durumu (aktif + tarih aralığı) → etiket
  function yayinDurumu(k) {
    const bugun = new Date().toISOString().slice(0, 10);
    if (!k.aktif) return { ad: "Taslak / pasif", sinif: "taslak" };
    if (k.baslangic && k.baslangic > bugun) return { ad: `Zamanlandı (${tarihMetni(k.baslangic)})`, sinif: "incelemede" };
    if (k.bitis && k.bitis < bugun) return { ad: "Süresi doldu", sinif: "uyari" };
    return { ad: "Yayında", sinif: "yayinda" };
  }

  async function baslat() {
    alan = document.getElementById("yonetimIcerik");
    const ustCikis = document.getElementById("cikisDugme");
    if (ustCikis) ustCikis.addEventListener("click", cikis);
    const oturum = await Oturum.oturum();
    if (!oturum) {
      location.replace("giris.html");
      return;
    }
    kullanici = oturum.user;
    const { data, error } = await sb.from("yoneticiler").select("kullanici_id").eq("kullanici_id", kullanici.id).maybeSingle();
    if (error || !data) {
      location.replace("panel.html");
      return;
    }
    window.addEventListener("hashchange", goster);
    await goster();
  }

  // Değişiklik uyarısı: kaydedilmemiş form varken sayfadan çıkılırsa uyar.
  let kirli = false;
  window.addEventListener("beforeunload", (e) => {
    if (kirli) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("hashchange", () => (kirli = false));

  document.addEventListener("DOMContentLoaded", baslat);

  return {
    sb,
    bolumEkle,
    git,
    mesaj,
    onayliDugme,
    gorselYukle,
    baglantiUygun,
    yayinDurumu,
    hataMetni,
    get kullanici() {
      return kullanici;
    },
    kirliYap(d = true) {
      kirli = d;
    },
  };
})();
