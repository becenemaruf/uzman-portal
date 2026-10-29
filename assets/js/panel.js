/*
 * UZMAN PANELİ (başlangıç sürümü)
 *  - Giriş yapılmamışsa giriş sayfasına yönlendirir.
 *  - İlk girişte, kayıt sırasında verilen ad/soyad/unvan ile "taslak" profil oluşturur
 *    (veritabanı kuralı gereği taslak profil herkese açık değildir; yalnızca uzman ve yönetici görür).
 *  - Profil durumunu ve sıradaki adımları gösterir.
 * Profil düzenleme, belge yükleme ve mesajlar bir sonraki adımda bu sayfaya eklenecek.
 */
(function () {
  const sb = Oturum.istemci;
  const alan = document.getElementById("panelIcerik");

  const DURUMLAR = {
    taslak: { etiket: "Taslak", sinif: "taslak", metin: "Profiliniz henüz yayında değil. Bilgilerinizi doldurup diplomalarınızı yükledikten sonra incelemeye gönderebilirsiniz." },
    incelemede: { etiket: "İncelemede", sinif: "incelemede", metin: "Profiliniz ve belgeleriniz yönetim tarafından inceleniyor. Sonuç e-posta ile bildirilecek." },
    ek_belge: { etiket: "Ek belge bekleniyor", sinif: "uyari", metin: "İnceleme için ek belge istendi. Yönetici notunu okuyup belgeyi yükledikten sonra tekrar incelemeye gönderin." },
    yayinda: { etiket: "Yayında", sinif: "yayinda", metin: "Profiliniz doğrulandı ve danışanlar tarafından görülebiliyor." },
    reddedildi: { etiket: "Reddedildi", sinif: "uyari", metin: "Başvurunuz onaylanmadı. Ayrıntılar için yönetim notuna bakın; bilgilerinizi düzelterek tekrar başvurabilirsiniz." },
    askida: { etiket: "Askıya alındı", sinif: "uyari", metin: "Profiliniz geçici olarak yayından kaldırıldı. Ayrıntı için yönetimle iletişime geçin." },
  };

  // "Ayşe Gül Şahin" → "ayse-gul-sahin"
  function kisaAd(metin) {
    const harita = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
    return metin
      .toLocaleLowerCase("tr")
      .replace(/[çğıiöşüâîû]/g, (h) => harita[h] || h)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  async function profilGetir(kullaniciId) {
    const { data, error } = await sb
      .from("uzmanlar")
      .select("id, slug, ad, soyad, unvan, durum, olusturulma, guncellenme, yeni_danisan")
      .eq("kullanici_id", kullaniciId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // İlk girişte taslak profil. Kısa ad (adres) başka bir uzmanla çakışırsa sonuna sayı eklenir.
  async function taslakOlustur(kullanici) {
    const m = kullanici.user_metadata || {};
    const ad = String(m.ad || "").trim().slice(0, 60);
    const soyad = String(m.soyad || "").trim().slice(0, 60);
    const unvan = UNVANLAR.includes(m.unvan) ? m.unvan : UNVANLAR[0];
    if (!ad || !soyad) return null;
    let temel = kisaAd(`${ad} ${soyad}`);
    if (temel.length < 3) temel = `uzman-${temel || "profil"}`;
    for (let deneme = 0; deneme < 6; deneme++) {
      const ek = deneme === 0 ? "" : `-${deneme < 3 ? deneme + 1 : Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await sb
        .from("uzmanlar")
        .insert({ slug: temel + ek, ad, soyad, unvan, kullanici_id: kullanici.id })
        .select("id, slug, ad, soyad, unvan, durum, olusturulma, guncellenme, yeni_danisan")
        .single();
      if (!error) return data;
      if (error.code !== "23505") throw error; // 23505: aynı kısa ad zaten var → yeniden dene
      // Aynı kullanıcı için profil zaten oluşmuşsa (iki sekme) onu döndür.
      const mevcut = await profilGetir(kullanici.id);
      if (mevcut) return mevcut;
    }
    throw new Error("Profil adresi oluşturulamadı.");
  }

  async function yoneticiMi(kullaniciId) {
    const { data } = await sb.from("yoneticiler").select("kullanici_id").eq("kullanici_id", kullaniciId).maybeSingle();
    return !!data;
  }

  function adimlar(p) {
    const yayinda = p.durum === "yayinda";
    const gonderildi = ["incelemede", "yayinda"].includes(p.durum);
    const liste = [
      { baslik: "E-posta adresinizi doğrulayın", tamam: true },
      { baslik: "Profil bilgilerinizi doldurun", metin: "Fotoğraf, tanıtım, çalışma alanları, eğitim, görüşme, iletişim ve sosyal medya.", tamam: gonderildi || p._eksik === 0, baglanti: { adres: "#profil", yazi: "Profilimi düzenle" } },
      { baslik: "Diplomalarınızı yükleyin", metin: "Psikoloji lisans ve klinik psikoloji yüksek lisans diplomaları (PDF ya da fotoğraf).", tamam: gonderildi, yakinda: true },
      { baslik: "İncelemeye gönderin", metin: "Yönetim belgelerinizi inceler; gerekirse ek belge ister.", tamam: gonderildi, yakinda: true },
      { baslik: "Profiliniz yayında", metin: "Unvanınız doğrulanınca profiliniz ve onay işaretiniz danışanlara görünür.", tamam: yayinda },
    ];
    return `<ol class="panel-adimlar">${liste
      .map(
        (a, i) => `<li class="${a.tamam ? "tamam" : ""}">
          <span class="adim-no" aria-hidden="true">${a.tamam ? ikon("onay") : i + 1}</span>
          <div><strong>${a.baslik}</strong>${a.tamam ? '<span class="gorunmez"> (tamamlandı)</span>' : ""}
            ${a.metin ? `<p>${a.metin}</p>` : ""}
            ${a.baglanti ? `<a class="btn btn-cizgi btn-kucuk adim-baglanti" href="${a.baglanti.adres}">${a.baglanti.yazi}</a>` : ""}
            ${a.yakinda && !a.tamam ? `<span class="yakinda-etiket">Bu bölüm çok yakında açılacak</span>` : ""}
          </div>
        </li>`
      )
      .join("")}</ol>`;
  }

  function ciz(kullanici, p, yonetici, eksik = []) {
    p._eksik = eksik.length;
    const d = DURUMLAR[p.durum] || DURUMLAR.taslak;
    const tamAd = `${p.ad} ${p.soyad}`;
    alan.innerHTML = `
      <section class="panel-baslik">
        <div>
          <p class="bolum-ust-yazi">Uzman paneli</p>
          <h1>Hoş geldiniz, ${esc(p.ad)}</h1>
          <p class="soluk">${esc(kullanici.email)}</p>
        </div>
        ${yonetici ? `<span class="rozet yonetici-rozet">${ikon("kilit")}Yönetici hesabı</span>` : ""}
      </section>

      <div class="panel-izgara">
        <section class="blok panel-kart">
          <h2>Profil durumu</h2>
          <p><span class="panel-durum ${d.sinif}">${d.etiket}</span></p>
          <p class="soluk">${d.metin}</p>
          <dl class="panel-bilgi">
            <div><dt>Ad soyad</dt><dd>${esc(tamAd)}</dd></div>
            <div><dt>Unvan</dt><dd>${esc(p.unvan)}</dd></div>
            <div><dt>Profil adresi</dt><dd><code>uzman.html?id=${esc(p.slug)}</code></dd></div>
          </dl>
          <div class="panel-dugmeler">
            <a class="btn btn-ana btn-kucuk" href="#profil">Profilimi düzenle</a>
            ${p.durum === "yayinda" ? `<a class="btn btn-cizgi btn-kucuk" href="uzman.html?id=${encodeURIComponent(p.slug)}">Profilimi görüntüle</a>` : ""}
          </div>
          ${
            eksik.length
              ? `<div class="eksik-kutu"><strong>Profilinizde eksik olanlar</strong><ul>${eksik.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`
              : `<p class="mesaj mesaj-basari" style="margin-top:14px">Profil bilgileriniz tamam görünüyor.</p>`
          }
          <hr class="ayrac">
          <label class="anahtar anahtar-genis">
            <input type="checkbox" id="yeniDanisan" ${p.yeni_danisan ? "checked" : ""}>
            <span><strong>Yeni danışan kabul ediyorum</strong><small>Profilinizde ve listede görünür. Kapatırsanız danışanlar şu an yeni danışan almadığınızı görür.</small></span>
          </label>
          <p class="mesaj" id="yeniDanisanDurum" role="status" hidden></p>
        </section>

        <section class="blok panel-kart">
          <h2>Yayına giden adımlar</h2>
          ${adimlar(p)}
        </section>
      </div>

      <section class="blok panel-kart panel-guvenlik">
        <h2>Hesap</h2>
        <p class="soluk">Şifrenizi değiştirmek için çıkış yapıp giriş ekranındaki "Şifremi unuttum" bağlantısını kullanabilirsiniz.</p>
        <button class="btn btn-cizgi btn-kucuk" type="button" data-cikis>Çıkış yap</button>
      </section>`;
    alan.querySelectorAll("[data-cikis]").forEach((b) => b.addEventListener("click", cikis));

    const anahtar = document.getElementById("yeniDanisan");
    anahtar.addEventListener("change", async () => {
      const durum = document.getElementById("yeniDanisanDurum");
      anahtar.disabled = true;
      const { error } = await sb.from("uzmanlar").update({ yeni_danisan: anahtar.checked }).eq("id", p.id);
      anahtar.disabled = false;
      if (error) {
        anahtar.checked = !anahtar.checked;
        durum.className = "mesaj mesaj-hata";
        durum.textContent = "Kaydedilemedi. Lütfen tekrar deneyin.";
      } else {
        p.yeni_danisan = anahtar.checked;
        durum.className = "mesaj mesaj-basari";
        durum.textContent = anahtar.checked ? "Yeni danışan kabul ettiğiniz kaydedildi." : "Şu an yeni danışan almadığınız kaydedildi.";
      }
      durum.hidden = false;
    });
  }

  // Yönetici görünümü: profil sayıları. Onay ekranı bir sonraki adımda eklenecek.
  async function yoneticiCiz(kullanici) {
    const { data, error } = await sb.from("uzmanlar").select("durum, ornek");
    if (error) throw error;
    const gercek = data.filter((x) => !x.ornek);
    const say = (d) => gercek.filter((x) => x.durum === d).length;
    const kutu = (sayi, etiket, vurgu) =>
      `<div class="sayac-kutu ${vurgu ? "vurgulu" : ""}"><strong>${sayi}</strong><span>${etiket}</span></div>`;
    alan.innerHTML = `
      <section class="panel-baslik">
        <div>
          <p class="bolum-ust-yazi">Yönetici paneli</p>
          <h1>Hoş geldiniz</h1>
          <p class="soluk">${esc(kullanici.email)}</p>
        </div>
        <span class="rozet yonetici-rozet">${ikon("kilit")}Yönetici hesabı</span>
      </section>
      <section class="blok panel-kart">
        <h2>Uzman profilleri</h2>
        <div class="sayaclar">
          ${kutu(say("incelemede"), "İnceleme bekliyor", say("incelemede") > 0)}
          ${kutu(say("ek_belge"), "Ek belge istendi")}
          ${kutu(say("yayinda"), "Yayında")}
          ${kutu(say("taslak"), "Taslak")}
          ${kutu(say("reddedildi") + say("askida"), "Reddedilen / askıda")}
        </div>
        <p class="soluk" style="margin-top:14px">Sayılara örnek (deneme) profiller dahil değildir (${data.length - gercek.length} örnek profil var).</p>
        <span class="yakinda-etiket">Profil ve diploma onay ekranı çok yakında açılacak</span>
      </section>
      <section class="blok panel-kart panel-guvenlik">
        <h2>Hesap</h2>
        <button class="btn btn-cizgi btn-kucuk" type="button" data-cikis>Çıkış yap</button>
      </section>`;
    alan.querySelectorAll("[data-cikis]").forEach((b) => b.addEventListener("click", cikis));
  }

  function hata(metin) {
    alan.innerHTML = `
      <div class="bos-durum" role="alert" style="margin:32px 0 48px">
        <h1 class="bos-baslik">Panel yüklenemedi</h1>
        <p>${esc(metin)}</p>
        <div class="bos-durum-butonlar">
          <button class="btn btn-ana" type="button" onclick="location.reload()">${ikon("yenile")}Yeniden dene</button>
          <button class="btn btn-cizgi" type="button" data-cikis>Çıkış yap</button>
        </div>
      </div>`;
    alan.querySelectorAll("[data-cikis]").forEach((b) => b.addEventListener("click", cikis));
  }

  async function cikis() {
    await Oturum.cikis();
    location.replace("giris.html");
  }
  const ustCikis = document.getElementById("cikisDugme");
  if (ustCikis) ustCikis.addEventListener("click", cikis);

  // Sayfa içi yönlendirme: panel.html → özet, panel.html#profil → profil düzenleme.
  let aktif = null;
  async function goster() {
    if (!aktif) return;
    const { kullanici, profil, yonetici } = aktif;
    try {
      if (location.hash === "#profil") {
        await ProfilDuzenle.ac(alan, profil.id, kullanici);
      } else {
        const guncel = (await profilGetir(kullanici.id)) || profil;
        const eksik = await ProfilDuzenle.eksikler(profil.id).catch(() => []);
        ciz(kullanici, guncel, yonetici, eksik);
      }
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      hata("Sunucuya ulaşılamadı ya da bir hata oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    }
  }
  window.addEventListener("hashchange", goster);

  (async () => {
    const oturum = await Oturum.oturum();
    if (!oturum) {
      location.replace("giris.html");
      return;
    }
    // E-posta doğrulama bağlantısından gelindiyse adresteki anahtarları temizle.
    if (location.hash.includes("access_token")) history.replaceState(null, "", location.pathname);
    const kullanici = oturum.user;
    try {
      const yonetici = await yoneticiMi(kullanici.id);
      let profil = await profilGetir(kullanici.id);
      // Yönetici hesaplarına otomatik uzman profili açılmaz (kimse kendi profilini onaylayamasın).
      if (!profil && yonetici) {
        await yoneticiCiz(kullanici);
        return;
      }
      if (!profil) profil = await taslakOlustur(kullanici);
      if (!profil) {
        hata("Hesabınıza ait ad ve soyad bilgisi bulunamadı. Lütfen yönetimle iletişime geçin.");
        return;
      }
      aktif = { kullanici, profil, yonetici };
      await goster();
    } catch (e) {
      console.error(e);
      hata("Sunucuya ulaşılamadı ya da bir hata oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    }
  })();
})();
