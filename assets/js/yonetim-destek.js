/*
 * YÖNETİM PANELİ — DESTEK TALEPLERİ
 *  #destek            → Talep listesi (durum sekmeleri + arama)
 *  #destek/<talep no> → Yazışma, yanıt, iç not, durum
 * Yanıt kaydedildikten sonra talep sahibine e-posta "destek" sunucu fonksiyonuyla gider.
 * İç notlar yalnızca yönetimde görünür; talep sahibine hiçbir zaman gösterilmez ya da gönderilmez.
 */
(() => {
  const sb = Yonetim.sb;
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
    acik: { ad: "Yanıt bekliyor", sinif: "incelemede" },
    yanitlandi: { ad: "Yanıtlandı", sinif: "yayinda" },
    kapandi: { ad: "Kapatıldı", sinif: "" },
  };
  const rozet = (d) => `<span class="panel-durum ${(DURUM[d] || {}).sinif || ""}">${esc((DURUM[d] || {}).ad || d)}</span>`;
  const zaman = (t) => new Date(t).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  Yonetim.bolumEkle("destek", async (alan, param) => {
    const [ilk, ikinci] = (param || "").split("/");
    if (/^\d+$/.test(ilk || "")) return ayrinti(alan, ilk);
    const filtre = ilk || "acik";
    const { data, error } = await sb.from("destek_talepleri").select("id, kod, kaynak, ad, eposta, kayitli_hesap, kategori, baslik, durum, son_hareket").order("son_hareket", { ascending: false });
    if (error) throw error;
    const sekmeler = [["acik", "Yanıt bekleyen"], ["yanitlandi", "Yanıtlanan"], ["kapandi", "Kapatılan"], ["tumu", "Tümü"]];
    alan.innerHTML = `
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">Yönetim paneli</p><h1>Destek talepleri</h1>
        <p class="soluk">Uzman panelinden ve giriş yapamayanlar için destek sayfasından gelen talepler. Yanıtınız talep sahibine e-postayla bildirilir.</p></div></section>
      <div class="sekme-satiri" role="tablist">${sekmeler
        .map(([k, ad]) => `<a role="tab" href="#destek/${k}" aria-selected="${k === filtre}">${ad} <span class="sekme-sayi">${data.filter((t) => k === "tumu" || t.durum === k).length}</span></a>`)
        .join("")}</div>
      <div class="liste-arac"><input class="girdi" type="search" id="dAra" placeholder="Kod, başlık, ad ya da e-posta ara…" aria-label="Taleplerde ara"></div>
      <div id="dListe"></div>`;
    function ciz() {
      const q = document.getElementById("dAra").value.trim().toLocaleLowerCase("tr");
      const g = data.filter((t) => (filtre === "tumu" || t.durum === filtre) && (!q || `${t.kod} ${t.baslik} ${t.ad || ""} ${t.eposta || ""}`.toLocaleLowerCase("tr").includes(q)));
      document.getElementById("dListe").innerHTML = g.length
        ? `<ul class="yonetim-liste">${g
            .map(
              (t) => `<li><a href="#destek/${t.id}"><span class="yl-ana"><strong>${esc(t.baslik)}</strong>
                <span class="alan-ipucu">${esc(t.kod)} · ${esc(KATEGORILER[t.kategori] || "")} · ${esc(t.ad || "")} · ${t.kaynak === "panel" ? "uzman panelinden" : t.kayitli_hesap ? "giriş yapmadan (kayıtlı e-posta)" : "giriş yapmadan"} · ${esc(tarihMetni(t.son_hareket))}</span></span>${rozet(t.durum)}</a></li>`
            )
            .join("")}</ul>`
        : `<p class="bos-not">Bu grupta talep yok.</p>`;
    }
    document.getElementById("dAra").addEventListener("input", ciz);
    ciz();
  });

  async function ayrinti(alan, id) {
    const [t, m] = await Promise.all([
      sb.from("destek_talepleri").select("*").eq("id", id).single(),
      sb.from("destek_mesajlari").select("id, yazan, metin, ic_not, olusturulma").eq("talep_id", id).order("olusturulma"),
    ]);
    if (t.error) throw t.error;
    const talep = t.data;
    alan.innerHTML = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="#destek">Destek talepleri</a></li><li><span aria-current="page">${esc(talep.kod)}</span></li></ol></nav>
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">${esc(talep.kod)} · ${esc(KATEGORILER[talep.kategori] || "")}</p><h1>${esc(talep.baslik)}</h1>
        <p class="soluk">${esc(talep.ad || "")} · ${esc(talep.eposta || "")} · açıldı: ${esc(zaman(talep.olusturulma))}</p></div>${rozet(talep.durum)}</section>
      <div class="mesaj" id="dMesaj" role="status" hidden></div>
      ${
        talep.kaynak === "form"
          ? `<div class="mesaj mesaj-uyari"><strong>Kimlik doğrulanmadı.</strong> Bu talep giriş yapılmadan, destek sayfasından gönderildi${
              talep.kayitli_hesap ? "; e-posta adresi kayıtlı bir hesaba ait" : "; bu e-posta ile kayıtlı bir hesap yok"
            }. Hesapla ilgili bir işlem yapmadan (e-posta değiştirme, profil kaldırma vb.) önce kişinin hesabın sahibi olduğunu doğrulayın —
              örneğin yalnızca kayıtlı e-posta adresine şifre yenileme bağlantısı gönderin. Hesap bilgilerini bu yazışmada paylaşmayın.</div>`
          : `<div class="mesaj mesaj-bilgi">Bu talep uzman panelinden, giriş yapılmış hesaptan açıldı.${talep.uzman_id ? ` <a href="#basvuru/${talep.uzman_id}">Uzmanın başvuru sayfasını aç</a>` : ""}</div>`
      }
      <section class="blok panel-kart">
        <h2>Yazışma</h2>
        <ol class="yazisma">${(m.data || [])
          .map(
            (x) => `<li class="yazisma-mesaj ${x.ic_not ? "ic-not" : x.yazan === "yonetim" ? "sizden" : "yonetimden"}">
              <span class="yazisma-kim">${x.ic_not ? "İç not (yalnızca yönetim)" : x.yazan === "yonetim" ? "Yönetim" : esc(talep.ad || "Talep sahibi")} · ${esc(new Date(x.olusturulma).toLocaleString("tr-TR"))}</span>
              <p class="on-metin">${esc(x.metin)}</p></li>`
          )
          .join("")}</ol>
        <form id="yanitFormu" novalidate>
          <div class="form-alani"><label class="alan-etiket" for="yMetin">Yanıtınız</label>
            <textarea class="girdi" id="yMetin" rows="5" maxlength="5000"></textarea></div>
          <label class="onay-kutusu"><input type="checkbox" id="yIcNot"> <span><strong>İç not</strong> — yalnızca yönetim görür; talep sahibine gönderilmez</span></label>
          <label class="onay-kutusu"><input type="checkbox" id="yKapat"> <span>Yanıtla birlikte talebi kapat</span></label>
          <div class="duzen-alt"><button class="btn btn-ana btn-kucuk" type="submit" id="yGonder">Gönder</button></div>
        </form>
      </section>
      <section class="blok panel-kart">
        <h2>Talep</h2>
        <div class="iki-sutun">
          <div class="form-alani"><label class="alan-etiket" for="tKategori">Konu</label>
            <select class="girdi" id="tKategori">${Object.entries(KATEGORILER).map(([k, a]) => `<option value="${k}" ${k === talep.kategori ? "selected" : ""}>${a}</option>`).join("")}</select></div>
          <div class="form-alani"><span class="alan-etiket">Durum</span>
            <div class="karar-dugmeleri">${
              talep.durum === "kapandi"
                ? `<button class="btn btn-cizgi btn-kucuk" type="button" data-durum="acik">Yeniden aç</button>`
                : `<button class="btn btn-cizgi btn-kucuk" type="button" data-durum="kapandi">Talebi kapat</button>`
            }</div></div>
        </div>
      </section>`;
    const msj = (metin, tur) => Yonetim.mesaj(document.getElementById("dMesaj"), metin, tur);
    document.getElementById("yIcNot").addEventListener("change", (e) => {
      document.getElementById("yGonder").textContent = e.target.checked ? "İç notu kaydet" : "Gönder";
    });
    document.getElementById("yanitFormu").addEventListener("submit", async (e) => {
      e.preventDefault();
      const metin = document.getElementById("yMetin").value.trim();
      const icNot = document.getElementById("yIcNot").checked;
      const kapat = document.getElementById("yKapat").checked;
      if (metin.length < 2) return msj("Yanıtınızı yazın.", "hata");
      const dugme = document.getElementById("yGonder");
      dugme.disabled = true;
      const { data: x, error } = await sb.from("destek_mesajlari").insert({ talep_id: talep.id, yazan: "yonetim", metin, ic_not: icNot }).select("id").single();
      if (error) {
        dugme.disabled = false;
        return msj("Kaydedilemedi: " + Yonetim.hataMetni(error), "hata");
      }
      let bilgi = icNot ? "İç not kaydedildi." : "Yanıt kaydedildi.";
      if (!icNot) {
        const { data: b } = await sb.functions.invoke("destek", { body: { islem: "bildir", mesaj_id: x.id } }).catch(() => ({ data: null }));
        bilgi += b && b.gonderildi ? " Talep sahibine e-posta gönderildi." : " E-posta gönderilemedi; talep sahibi yanıtı panelinden ya da takip bağlantısından görebilir.";
      }
      if (kapat) await sb.from("destek_talepleri").update({ durum: "kapandi" }).eq("id", talep.id);
      await Yonetim.git(`#destek/${talep.id}`);
      Yonetim.mesaj(document.getElementById("dMesaj"), bilgi + (kapat ? " Talep kapatıldı." : ""), "basari");
    });
    document.getElementById("tKategori").addEventListener("change", async (e) => {
      const { error } = await sb.from("destek_talepleri").update({ kategori: e.target.value }).eq("id", talep.id);
      msj(error ? "Konu değiştirilemedi." : "Konu güncellendi.", error ? "hata" : "basari");
    });
    alan.querySelectorAll("[data-durum]").forEach((d) =>
      d.addEventListener("click", async () => {
        const { error } = await sb.from("destek_talepleri").update({ durum: d.dataset.durum }).eq("id", talep.id);
        if (error) return msj("Durum değiştirilemedi.", "hata");
        await Yonetim.git(`#destek/${talep.id}`);
        Yonetim.mesaj(document.getElementById("dMesaj"), d.dataset.durum === "kapandi" ? "Talep kapatıldı." : "Talep yeniden açıldı.", "basari");
      })
    );
  }
})();
