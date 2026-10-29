/*
 * UZMAN PANELİ — DESTEK (panel.html#destek, #destek/<talep no>)
 * Uzman kendi destek taleplerini açar, yönetimin yanıtlarını görür ve yazışmayı sürdürür.
 * Kayıt uzmanın kendi oturumuyla yapılır (güvenlik kuralları: yalnızca kendi talepleri). Karşı tarafa e-posta,
 * "destek" sunucu fonksiyonu ("bildir") ile gider. Yönetimin iç notlarını uzman göremez.
 */
const Destek = (() => {
  const sb = Oturum.istemci;
  const KATEGORILER = {
    giris: "Giriş / şifre sorunu",
    belge: "Belge ve doğrulama",
    profil: "Profil düzenleme",
    mesaj: "Mesajlar ve iletişim",
    teknik: "Teknik sorun",
    kvkk: "Kişisel veri (KVKK) başvurusu",
    diger: "Diğer",
  };
  const DURUM = {
    acik: { ad: "Yanıt bekleniyor", sinif: "incelemede" },
    yanitlandi: { ad: "Yanıtlandı", sinif: "yayinda" },
    kapandi: { ad: "Kapatıldı", sinif: "" },
  };
  const rozet = (d) => `<span class="panel-durum ${(DURUM[d] || {}).sinif || ""}">${esc((DURUM[d] || {}).ad || d)}</span>`;
  const yaz = (el, metin, tur) => {
    el.className = `mesaj mesaj-${tur}`;
    el.textContent = metin;
    el.hidden = !metin;
  };
  // E-posta bildirimi: başarısız olsa da mesaj kaydedilmiştir (yönetim panelde görür)
  const bildir = (mesajId) => sb.functions.invoke("destek", { body: { islem: "bildir", mesaj_id: mesajId } }).catch(() => null);

  async function ac(alan, profil, param) {
    if (param) return ayrinti(alan, param);
    const { data, error } = await sb.from("destek_talepleri").select("id, kod, baslik, kategori, durum, son_hareket").order("son_hareket", { ascending: false });
    if (error) throw error;
    alan.innerHTML = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="panel.html#">Panel</a></li><li><span aria-current="page">Destek</span></li></ol></nav>
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">Uzman paneli</p><h1>Destek</h1>
        <p class="soluk">Hesabınız, belgeleriniz ya da sitenin kullanımıyla ilgili sorularınız için platform yönetimine yazın. Yanıtımız e-postanıza da bildirilir.</p></div></section>
      ${
        data.length
          ? `<ul class="yonetim-liste">${data
              .map(
                (t) => `<li><a href="#destek/${t.id}"><span class="yl-ana"><strong>${esc(t.baslik)}</strong>
                  <span class="alan-ipucu">${esc(t.kod)} · ${esc(KATEGORILER[t.kategori] || "")} · ${esc(tarihMetni(t.son_hareket))}</span></span>${rozet(t.durum)}</a></li>`
              )
              .join("")}</ul>`
          : `<p class="bos-not">Henüz destek talebiniz yok.</p>`
      }
      <form class="blok panel-kart" id="talepFormu" novalidate>
        <h2>Yeni destek talebi</h2>
        <div class="iki-sutun">
          <div class="form-alani"><label class="alan-etiket" for="tKategori">Konu</label>
            <select class="girdi" id="tKategori">${Object.entries(KATEGORILER).map(([k, a]) => `<option value="${k}">${a}</option>`).join("")}</select></div>
          <div class="form-alani"><label class="alan-etiket" for="tBaslik">Kısa başlık</label><input class="girdi" id="tBaslik" maxlength="120"></div>
        </div>
        <div class="form-alani"><label class="alan-etiket" for="tMetin">Mesajınız</label>
          <textarea class="girdi" id="tMetin" rows="5" maxlength="5000"></textarea>
          <p class="alan-ipucu">Şifrenizi, kimlik numaranızı, sağlık bilgisi ya da danışan bilgisi yazmayın.</p></div>
        <div class="mesaj" id="tDurum" role="status" hidden></div>
        <div class="duzen-alt"><button class="btn btn-ana btn-kucuk" type="submit" id="tGonder">Talebi gönder</button></div>
      </form>
      <p class="duzen-son"><a class="btn btn-cizgi" href="panel.html#">Panele dön</a></p>`;
    document.getElementById("talepFormu").addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = document.getElementById("tDurum");
      const baslik = document.getElementById("tBaslik").value.trim();
      const metin = document.getElementById("tMetin").value.trim();
      if (baslik.length < 3) return yaz(d, "Kısa bir başlık yazın (en az 3 karakter).", "hata");
      if (metin.length < 10) return yaz(d, "Sorununuzu biraz daha ayrıntılı anlatın.", "hata");
      const dugme = document.getElementById("tGonder");
      dugme.disabled = true;
      const { data: t, error: hata } = await sb.from("destek_talepleri").insert({ kategori: document.getElementById("tKategori").value, baslik }).select("id").single();
      if (hata) {
        dugme.disabled = false;
        return yaz(d, /çok fazla/.test(hata.message) ? hata.message : "Talep oluşturulamadı. Lütfen tekrar deneyin.", "hata");
      }
      const { data: m, error: mh } = await sb.from("destek_mesajlari").insert({ talep_id: t.id, yazan: "kullanici", metin }).select("id").single();
      if (!mh && m) await bildir(m.id);
      location.hash = `#destek/${t.id}`;
    });
  }

  async function ayrinti(alan, id) {
    const [t, m] = await Promise.all([
      sb.from("destek_talepleri").select("*").eq("id", id).single(),
      sb.from("destek_mesajlari").select("id, yazan, metin, olusturulma").eq("talep_id", id).order("olusturulma"),
    ]);
    if (t.error) throw t.error;
    const talep = t.data;
    alan.innerHTML = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="panel.html#">Panel</a></li><li><a href="#destek">Destek</a></li><li><span aria-current="page">${esc(talep.kod)}</span></li></ol></nav>
      <section class="blok panel-kart">
        <div class="destek-ust"><div><h1 class="destek-baslik">${esc(talep.baslik)}</h1><p class="alan-ipucu">${esc(talep.kod)} · ${esc(KATEGORILER[talep.kategori] || "")} · ${esc(tarihMetni(talep.olusturulma))}</p></div>${rozet(talep.durum)}</div>
        <ol class="yazisma">${(m.data || [])
          .map(
            (x) => `<li class="yazisma-mesaj ${x.yazan === "yonetim" ? "yonetimden" : "sizden"}">
              <span class="yazisma-kim">${x.yazan === "yonetim" ? "Klinik Psikologlar destek" : "Siz"} · ${esc(new Date(x.olusturulma).toLocaleString("tr-TR"))}</span>
              <p class="on-metin">${esc(x.metin)}</p></li>`
          )
          .join("")}</ol>
        <form id="yanitFormu" novalidate>
          <div class="form-alani"><label class="alan-etiket" for="yMetin">${talep.durum === "kapandi" ? "Talep kapatıldı. Yeniden yazarsanız talep tekrar açılır." : "Yeni mesaj"}</label>
            <textarea class="girdi" id="yMetin" rows="4" maxlength="5000"></textarea></div>
          <div class="mesaj" id="yDurum" role="status" hidden></div>
          <div class="duzen-alt"><button class="btn btn-ana btn-kucuk" type="submit" id="yGonder">Gönder</button></div>
        </form>
      </section>
      <p class="duzen-son"><a class="btn btn-cizgi" href="#destek">Tüm taleplerim</a></p>`;
    document.getElementById("yanitFormu").addEventListener("submit", async (e) => {
      e.preventDefault();
      const metin = document.getElementById("yMetin").value.trim();
      const d = document.getElementById("yDurum");
      if (metin.length < 2) return yaz(d, "Mesajınızı yazın.", "hata");
      const dugme = document.getElementById("yGonder");
      dugme.disabled = true;
      const { data: x, error } = await sb.from("destek_mesajlari").insert({ talep_id: talep.id, yazan: "kullanici", metin }).select("id").single();
      if (error) {
        dugme.disabled = false;
        return yaz(d, "Mesajınız gönderilemedi. Lütfen tekrar deneyin.", "hata");
      }
      await bildir(x.id);
      await ayrinti(alan, id);
      yaz(document.getElementById("yDurum"), "Mesajınız iletildi.", "basari");
    });
  }

  return { ac };
})();
