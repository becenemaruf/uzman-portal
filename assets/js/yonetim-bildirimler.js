/*
 * YÖNETİM PANELİ — SİSTEM BİLDİRİMLERİ
 *  #bildirimler            → Gönderilen / planlanan / taslak bildirimler ve gönderim durumu
 *  #bildirim/yeni          → Yeni bildirim
 *  #bildirim/takip/<id>    → "Sorun giderildi" takip bildirimi (önceki bildirimden doldurulur)
 *  #bildirim/<id>          → Taslak/planlıysa düzenleme; gönderildiyse ayrıntı ve takip
 *
 * Toplu gönderim tarayıcıdan YAPILMAZ: "Şimdi gönder" yalnızca "bildirim-gonder" sunucu fonksiyonunu çağırır.
 * Fonksiyon bildirimi tek bir kez gönderime alır, alıcı satırlarını oluşturur, e-postaları gönderir ve sonuçları kaydeder.
 */
(() => {
  const sb = Yonetim.sb;
  const TURLER = {
    teknik: "Teknik aksaklık",
    guvenlik: "Güvenlik bildirimi",
    bakim: "Planlı bakım",
    guncelleme: "Sistem güncellemesi",
    genel: "Genel bilgilendirme",
  };
  const ONCELIKLER = { normal: "Normal", onemli: "Önemli", kritik: "Kritik" };
  const HEDEFLER = {
    tum: "Tüm kayıtlı uzmanlar",
    yayinda: "Yalnızca yayındaki uzmanlar",
    incelemede: "Yalnızca inceleme sürecindeki uzmanlar (incelemede / ek belge)",
    secili: "Belirli uzmanlar",
  };
  const DURUMLAR = {
    taslak: { ad: "Taslak", sinif: "taslak" },
    planlandi: { ad: "Planlandı", sinif: "incelemede" },
    gonderiliyor: { ad: "Gönderiliyor", sinif: "incelemede" },
    gonderildi: { ad: "Gönderildi", sinif: "yayinda" },
    iptal: { ad: "Kaldırıldı", sinif: "uyari" },
  };
  const zaman = (t) => (t ? new Date(t).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
  const oncelikRozet = (o) => `<span class="oncelik-rozet oncelik-${esc(o)}">${esc(ONCELIKLER[o] || o)}</span>`;
  const durumRozet = (d) => {
    const x = DURUMLAR[d] || { ad: d, sinif: "" };
    return `<span class="panel-durum ${x.sinif}">${esc(x.ad)}</span>`;
  };

  // Kanal durumu (e-posta / SMS ayarlı mı) — sunucu fonksiyonuna bir kez sorulur
  let kanalSozu = null;
  function kanalDurumu() {
    if (!kanalSozu)
      kanalSozu = sb.functions
        .invoke("bildirim-gonder", { body: { islem: "durum" } })
        .then(({ data, error }) => (error || !data ? { eposta_hazir: true, sms_hazir: false, bilinmiyor: true } : data))
        .catch(() => ({ eposta_hazir: true, sms_hazir: false, bilinmiyor: true }));
    return kanalSozu;
  }

  // ---------- SMS uzunluğu ----------
  // GSM 7-bit temel karakterler. Türkçe ğ ş ı İ Ğ Ş ç, Türkçe karakter desteği olan sağlayıcılarda 155 karakter/SMS
  // (çok parçalıda 150) olarak sayılır. Bunların dışındaki karakterler (ör. emoji) SMS'i Unicode'a çevirir: 70 / 67.
  const GSM = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
  const GSM_EK = "^{}\\[~]|€";
  const TURKCE = "ğĞşŞıİç";
  function smsOlc(metin) {
    let uzunluk = 0;
    let tur = "gsm";
    for (const k of metin) {
      if (GSM.includes(k)) uzunluk += 1;
      else if (GSM_EK.includes(k)) uzunluk += 2;
      else if (TURKCE.includes(k)) {
        uzunluk += 1;
        if (tur === "gsm") tur = "turkce";
      } else {
        tur = "unicode";
      }
    }
    if (tur === "unicode") uzunluk = [...metin].length;
    const [tek, cok] = { gsm: [160, 153], turkce: [155, 150], unicode: [70, 67] }[tur];
    const parca = uzunluk === 0 ? 0 : uzunluk <= tek ? 1 : Math.ceil(uzunluk / cok);
    return { uzunluk, parca, tur, tek, cok };
  }

  // ---------- E-posta önizlemesi (sunucudaki şablonun aynısı) ----------
  function epostaOnizleme(b) {
    const renk = b.oncelik === "kritik" ? "#a33a2b" : b.oncelik === "onemli" ? "#8a6a3d" : "#1c4a66";
    const p = 'style="margin:0 0 12px;font-size:15px;line-height:1.65;"';
    const govde = esc(b.metin || "")
      .split(/\n{2,}/)
      .map((x) => `<p ${p}>${x.replace(/\n/g, "<br>")}</p>`)
      .join("");
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;background:#f5f5f2;font-family:Arial,Helvetica,sans-serif;color:#13202b;">
      <div style="padding:20px 10px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;border:1px solid #e3e4e1;border-top:4px solid ${renk};">
      <div style="padding:22px 28px 4px"><img src="${location.origin}${location.pathname.replace(/[^/]*$/, "")}assets/img/marka/logo-tam.png" width="200" alt="Klinik Psikologlar" style="display:block;max-width:100%;height:auto"></div>
      <div style="padding:12px 28px 4px">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${renk};font-weight:bold;">${esc(TURLER[b.tur] || "")}${b.oncelik !== "normal" ? " · " + esc(ONCELIKLER[b.oncelik]) : ""}</p>
      <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;line-height:1.3;color:#12354b;">${esc(b.baslik || "Başlık")}</h1>
      <p ${p}>Merhaba Dr. Ayşe Örnek,</p>${govde}
      <p style="margin:18px 0"><span style="display:inline-block;padding:11px 22px;background:#1c4a66;color:#fff;border-radius:10px;font-weight:bold;font-size:15px;">Panelimde görüntüle</span></p></div>
      <div style="padding:4px 28px 22px"><p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#56626c;border-top:1px solid #e3e4e1;padding-top:12px;">
      Bu e-posta, klinikpsikologlar.com.tr uzman hesabınız ve platform hizmetleriyle ilgili bir bilgilendirmedir; ticari elektronik ileti değildir.
      Kritik olmayan bildirim e-postalarını panelinizdeki "Bildirim tercihleri" bölümünden kapatabilirsiniz.</p></div></div></div></body></html>`;
  }
  function panelOnizleme(b) {
    return `<div class="bildirim-kart oncelik-${esc(b.oncelik)} acik">
      <div class="bildirim-kart-bas"><span class="bildirim-tur">${esc(TURLER[b.tur] || "")}</span>${b.oncelik !== "normal" ? oncelikRozet(b.oncelik) : ""}</div>
      <strong>${esc(b.baslik || "Başlık")}</strong>
      <p class="on-metin">${esc(b.metin || "")}</p>
    </div>`;
  }

  // ================= LİSTE =================
  Yonetim.bolumEkle("bildirimler", async (alan) => {
    const [bl, al, kanal] = await Promise.all([
      sb.from("sistem_bildirimleri").select("id, baslik, tur, oncelik, hedef, kanal_panel, kanal_eposta, kanal_sms, durum, planlanan_zaman, gonderim_zamani, olusturulma, gonderen_eposta, ust_bildirim_id").order("olusturulma", { ascending: false }),
      sb.from("bildirim_alicilari").select("bildirim_id, okundu_zamani, eposta_durum, sms_durum"),
      kanalDurumu(),
    ]);
    if (bl.error) throw bl.error;
    const istatistik = {};
    (al.data || []).forEach((a) => {
      const s = (istatistik[a.bildirim_id] ||= { alici: 0, okundu: 0, e_ok: 0, e_hata: 0, e_atla: 0, s_ok: 0, s_hata: 0 });
      s.alici++;
      if (a.okundu_zamani) s.okundu++;
      if (a.eposta_durum === "gonderildi") s.e_ok++;
      if (a.eposta_durum === "basarisiz") s.e_hata++;
      if (a.eposta_durum === "atlandi") s.e_atla++;
      if (a.sms_durum === "gonderildi") s.s_ok++;
      if (a.sms_durum === "basarisiz") s.s_hata++;
    });
    let liste = bl.data;

    function satir(b) {
      const s = istatistik[b.id];
      const kanallar = [b.kanal_panel && "Panel", b.kanal_eposta && "E-posta", b.kanal_sms && "SMS"].filter(Boolean).join(" + ");
      return `<li><a href="#bildirim/${b.id}" class="bildirim-satir">
        <span class="yl-ana">
          <span class="bildirim-satir-bas"><strong>${esc(b.baslik)}</strong>${b.oncelik !== "normal" ? oncelikRozet(b.oncelik) : ""}${b.ust_bildirim_id ? '<span class="alan-ipucu">· takip bildirimi</span>' : ""}</span>
          <span class="alan-ipucu">${esc(TURLER[b.tur])} · ${esc(kanallar)} · ${
            b.durum === "planlandi" ? "Planlanan: " + zaman(b.planlanan_zaman) : b.gonderim_zamani ? zaman(b.gonderim_zamani) : "Oluşturuldu: " + zaman(b.olusturulma)
          }</span>
          ${
            s
              ? `<span class="bildirim-istatistik">${s.alici} uzman${b.kanal_panel ? ` · okundu ${s.okundu}/${s.alici}` : ""}${b.kanal_eposta ? ` · e-posta ✓${s.e_ok}${s.e_hata ? ` <b class="hata-yazi">✗${s.e_hata}</b>` : ""}${s.e_atla ? ` (atlanan ${s.e_atla})` : ""}` : ""}${
                  b.kanal_sms ? ` · SMS ✓${s.s_ok}${s.s_hata ? ` <b class="hata-yazi">✗${s.s_hata}</b>` : ""}` : ""
                }</span>`
              : ""
          }
        </span>
        ${durumRozet(b.durum)}
      </a></li>`;
    }

    function ciz() {
      const f = document.getElementById("bDurum").value;
      const ara = document.getElementById("bAra").value.trim().toLocaleLowerCase("tr");
      const g = liste.filter((b) => (!f || b.durum === f) && (!ara || b.baslik.toLocaleLowerCase("tr").includes(ara)));
      document.getElementById("bListe").innerHTML = g.length ? `<ul class="yonetim-liste">${g.map(satir).join("")}</ul>` : `<p class="bos-not">Bildirim yok.</p>`;
    }

    alan.innerHTML = `
      <section class="panel-baslik">
        <div><p class="bolum-ust-yazi">Yönetim paneli</p><h1>Sistem bildirimleri</h1>
          <p class="soluk">Teknik aksaklık, planlı bakım, güvenlik ve önemli güncellemelerde uzmanlara panel içi bildirim ve e-posta ile ulaşın.</p></div>
        <a class="btn btn-ana" href="#bildirim/yeni">+ Yeni bildirim</a>
      </section>
      <div class="kanal-durumu">
        <span>${ikon("onay")} Panel içi bildirim: hazır</span>
        <span>${kanal.eposta_hazir ? ikon("onay") + " E-posta: hazır (Resend)" : "⚠ E-posta servisi ayarlı değil"}</span>
        <span>${kanal.sms_hazir ? ikon("onay") + " SMS: hazır" : "○ SMS: sağlayıcı tanımlı değil — SMS gönderilemez"}</span>
      </div>
      <div class="liste-arac">
        <input class="girdi" type="search" id="bAra" placeholder="Başlıkta ara…" aria-label="Başlıkta ara">
        <select class="girdi" id="bDurum" aria-label="Duruma göre süz">
          <option value="">Tüm durumlar</option>${Object.entries(DURUMLAR).map(([k, d]) => `<option value="${k}">${d.ad}</option>`).join("")}
        </select>
      </div>
      <div id="bListe"></div>
      <details class="metin-ac acil-prosedur">
        <summary>Site ya da Supabase tamamen çalışmazsa ne yapılır?</summary>
        <ol>
          <li><strong>Site açılıyor ama veriler gelmiyorsa</strong> (Supabase erişilemez): GitHub'da <code>assets/durum.json</code> dosyasını düzenleyin
            (<code>"aktif": true</code> ve kısa bir metin). Bu dosya Supabase'e bağlı değildir; sitenin her sayfasının üstünde duyuru şeridi olarak görünür.</li>
          <li><strong>E-posta gönderilemiyorsa:</strong> Resend paneline doğrudan girip <code>bildirim@klinikpsikologlar.com.tr</code> adresinden kısa bir duyuru gönderin.
            Uzman e-posta listesinin güncel bir kopyasını (ayda bir, şifreli olarak) güvenli bir yerde saklayın.</li>
          <li><strong>Güvenlik olaylarında</strong> toplu bildirime teknik ayrıntı, saldırı yöntemi ya da kişisel veri eklemeyin; yalnızca doğrulanmış durumu yazın.
            Gerçek bir kişisel veri ihlali varsa KVKK'ya göre Kurul'a ve ilgili kişilere bildirim yükümlülüğü ayrıca (avukatla) değerlendirilmelidir.</li>
        </ol>
      </details>`;
    document.getElementById("bAra").addEventListener("input", ciz);
    document.getElementById("bDurum").addEventListener("change", ciz);
    ciz();
  });

  // ================= DÜZENLEME / AYRINTI =================
  Yonetim.bolumEkle("bildirim", async (alan, param) => {
    const [ilk, ikinci] = (param || "").split("/");
    let b = { baslik: "", metin: "", sms_metni: "", tur: "genel", oncelik: "normal", hedef: "tum", hedef_uzmanlar: [], kanal_panel: true, kanal_eposta: false, kanal_sms: false, durum: "taslak", bitis: null, planlanan_zaman: null, ust_bildirim_id: null };
    if (ilk === "takip") {
      const { data: ust, error } = await sb.from("sistem_bildirimleri").select("*").eq("id", ikinci).single();
      if (error) throw error;
      Object.assign(b, {
        baslik: `Sorun giderildi: ${ust.baslik}`.slice(0, 120),
        metin: "Daha önce bildirdiğimiz sorun giderilmiştir. Platformu her zamanki gibi kullanabilirsiniz. Anlayışınız için teşekkür ederiz.",
        tur: ust.tur,
        oncelik: "normal",
        hedef: ust.hedef,
        hedef_uzmanlar: ust.hedef_uzmanlar || [],
        kanal_panel: ust.kanal_panel,
        kanal_eposta: ust.kanal_eposta,
        ust_bildirim_id: ust.id,
      });
    } else if (ilk && ilk !== "yeni") {
      const { data, error } = await sb.from("sistem_bildirimleri").select("*").eq("id", ilk).single();
      if (error) throw error;
      b = data;
    }
    if (["gonderildi", "gonderiliyor", "iptal"].includes(b.durum)) return ayrinti(alan, b);
    return form(alan, b);
  });

  // ---------- Form ----------
  async function form(alan, b) {
    const kanal = await kanalDurumu();
    const { data: uzmanlar } = await sb.from("uzmanlar").select("id, ad, soyad, unvan_oneki, durum, ornek, kullanici_id").eq("ornek", false).order("ad");
    const gercek = (uzmanlar || []).filter((u) => u.kullanici_id);
    const yeni = !b.id;
    const yerel = (t) => (t ? new Date(new Date(t).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
    const secenek = (o, sec) => Object.entries(o).map(([k, ad]) => `<option value="${k}" ${k === sec ? "selected" : ""}>${esc(ad)}</option>`).join("");

    alan.innerHTML = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="#bildirimler">Sistem bildirimleri</a></li><li><span aria-current="page">${yeni ? "Yeni bildirim" : esc(b.baslik)}</span></li></ol></nav>
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">Sistem bildirimleri</p><h1>${b.ust_bildirim_id && yeni ? "Takip bildirimi" : yeni ? "Yeni bildirim" : "Bildirimi düzenle"}</h1>
        ${b.durum === "planlandi" ? `<p class="soluk">Bu bildirim <strong>${esc(zaman(b.planlanan_zaman))}</strong> için planlandı.</p>` : ""}</div>${!yeni ? durumRozet(b.durum) : ""}</section>
      <div class="icerik-duzen sayfa-duzen">
        <form class="blok panel-kart" id="bForm" novalidate>
          <div class="form-alani"><label class="alan-etiket" for="fBaslik">Bildirim başlığı *</label>
            <input class="girdi" id="fBaslik" maxlength="120" value="${esc(b.baslik)}" placeholder="Ör. Planlı Sistem Bakımı"></div>
          <div class="form-alani"><label class="alan-etiket" for="fMetin">Bildirim metni *</label>
            <textarea class="girdi" id="fMetin" rows="6" maxlength="3000" placeholder="Ör. Platformumuzda 30 Ekim tarihinde 02.00–03.00 saatleri arasında planlı bakım çalışması gerçekleştirilecektir. Bu süre içerisinde bazı hizmetlere geçici olarak erişilemeyebilir.">${esc(b.metin)}</textarea>
            <p class="alan-ipucu">Boş satır bırakarak paragraf yapabilirsiniz. Güvenlik bildirimlerinde teknik ayrıntı, saldırı yöntemi ya da kişisel veri yazmayın; yalnızca doğrulanmış durumu bildirin.</p></div>
          <div class="iki-sutun">
            <div class="form-alani"><label class="alan-etiket" for="fTur">Bildirim türü</label><select class="girdi" id="fTur">${secenek(TURLER, b.tur)}</select></div>
            <div class="form-alani"><span class="alan-etiket">Öncelik</span>
              <div class="oncelik-secim" role="radiogroup" aria-label="Öncelik">${Object.entries(ONCELIKLER)
                .map(([k, ad]) => `<label class="oncelik-kutu oncelik-${k}"><input type="radio" name="oncelik" value="${k}" ${k === b.oncelik ? "checked" : ""}><span>${ad}</span></label>`)
                .join("")}</div></div>
          </div>
          <p class="mesaj mesaj-uyari" id="kritikNot" hidden>Kritik bildirimler uzman panelinin üstünde ayrıca gösterilir ve e-posta kanalı seçiliyse, bildirim e-postalarını kapatmış uzmanlara da gönderilir. Gönderimden önce ikinci onay istenir.</p>
          <fieldset class="secim-grubu">
            <legend class="alan-etiket">Hedef kitle</legend>
            <div class="kutucuklar">${Object.entries(HEDEFLER)
              .map(([k, ad]) => `<label class="onay-kutusu"><input type="radio" name="hedef" value="${k}" ${k === b.hedef ? "checked" : ""}> <span>${esc(ad)}</span></label>`)
              .join("")}</div>
          </fieldset>
          <div id="seciliAlan" hidden>
            <input class="girdi" type="search" id="uzmanAra" placeholder="Uzman ara…" aria-label="Uzman ara">
            <div class="uzman-secim" id="uzmanSecim">${
              gercek.length
                ? gercek
                    .map(
                      (u) => `<label class="onay-kutusu" data-ad="${esc(`${u.ad} ${u.soyad}`.toLocaleLowerCase("tr"))}"><input type="checkbox" name="secili" value="${u.id}" ${(b.hedef_uzmanlar || []).includes(u.id) ? "checked" : ""}>
                  <span>${esc([u.unvan_oneki, u.ad, u.soyad].filter(Boolean).join(" "))} <small class="alan-ipucu">(${esc(u.durum)})</small></span></label>`
                    )
                    .join("")
                : `<p class="alan-ipucu">Henüz kayıtlı (örnek olmayan) uzman yok.</p>`
            }</div>
          </div>
          <fieldset class="secim-grubu">
            <legend class="alan-etiket">Gönderim kanalları</legend>
            <div class="kutucuklar">
              <label class="onay-kutusu"><input type="checkbox" id="kPanel" ${b.kanal_panel ? "checked" : ""}> <span><strong>Panel içi bildirim</strong> — uzman panelindeki bildirim zilinde görünür</span></label>
              <label class="onay-kutusu"><input type="checkbox" id="kEposta" ${b.kanal_eposta ? "checked" : ""} ${kanal.eposta_hazir ? "" : "disabled"}> <span><strong>E-posta</strong> — uzmanın giriş e-postasına ${kanal.eposta_hazir ? "" : "(e-posta servisi ayarlı değil)"}</span></label>
              <label class="onay-kutusu"><input type="checkbox" id="kSms" ${b.kanal_sms && kanal.sms_hazir ? "checked" : ""} ${kanal.sms_hazir ? "" : "disabled"}> <span><strong>SMS</strong> — yalnızca SMS'e izin vermiş ve numarasını girmiş uzmanlara
                ${kanal.sms_hazir ? "" : `<br><small class="alan-ipucu">SMS sağlayıcısı henüz tanımlı değil; sağlayıcı seçilip anahtarları Supabase'e girildiğinde açılır.</small>`}</span></label>
            </div>
          </fieldset>
          <div class="form-alani" id="smsAlan" hidden>
            <label class="alan-etiket" for="fSms">SMS metni (kısa tutun)</label>
            <textarea class="girdi" id="fSms" rows="3" maxlength="600">${esc(b.sms_metni || "")}</textarea>
            <p class="alan-ipucu" id="smsSayac"></p>
          </div>
          <div class="iki-sutun">
            <div class="form-alani"><label class="alan-etiket" for="fBitis">Panelde gösterim bitişi (isteğe bağlı)</label>
              <input class="girdi" type="datetime-local" id="fBitis" value="${yerel(b.bitis)}">
              <p class="alan-ipucu">Bu tarihten sonra bildirim uzman panelinden kalkar (ör. bakım bitince).</p></div>
            <div class="form-alani"><label class="alan-etiket" for="fPlan">Gönderim zamanı (planlamak için)</label>
              <input class="girdi" type="datetime-local" id="fPlan" value="${yerel(b.planlanan_zaman)}">
              <p class="alan-ipucu">"Gönderimi planla" ile bu zamanda otomatik gönderilir (5 dakikalık aralıklarla kontrol edilir).</p></div>
          </div>
          <div class="gonderim-ozeti" id="ozet" aria-live="polite"></div>
          <div id="onayAlani" hidden class="onay-alani">
            <p><strong>Gönderimi onaylayın.</strong> <span id="onayMetni"></span></p>
            <label class="onay-kutusu"><input type="checkbox" id="onayKutusu"> <span>Hedef kitleyi, kanalları ve metni kontrol ettim.</span></label>
            <div class="karar-dugmeleri"><button class="btn btn-ana" type="button" id="onayGonder" disabled>Onaylıyorum, şimdi gönder</button><button class="btn btn-cizgi" type="button" id="onayVazgec">Vazgeç</button></div>
          </div>
          <div class="mesaj" id="bMesaj" role="status" hidden></div>
          <div class="duzen-alt karar-dugmeleri" style="justify-content:flex-end">
            ${!yeni ? `<button class="btn btn-cizgi btn-kucuk tehlike" type="button" id="bSil">${b.durum === "planlandi" ? "Planı iptal et" : "Taslağı sil"}</button>` : ""}
            <button class="btn btn-cizgi btn-kucuk" type="button" id="bOnizle">${ikon("goz")}Önizle</button>
            <button class="btn btn-cizgi btn-kucuk" type="button" id="bTaslak">Taslak kaydet</button>
            <button class="btn btn-cizgi btn-kucuk" type="button" id="bPlanla">Gönderimi planla</button>
            <button class="btn btn-ana btn-kucuk" type="button" id="bGonder">Şimdi gönder</button>
          </div>
        </form>
        <aside class="blok panel-kart onizleme-kutu" id="onizlemeKutu" hidden>
          <h2>Önizleme</h2>
          <h3>Uzman panelinde</h3>
          <div id="onPanel"></div>
          <h3>E-postada</h3>
          <iframe id="onEposta" class="eposta-onizleme" title="E-posta önizlemesi" sandbox></iframe>
        </aside>
      </div>`;

    const $ = (x) => document.getElementById(x);
    const m = $("bMesaj");
    let ozet = { toplam: 0, eposta: 0, sms: 0 };

    function deger() {
      return {
        baslik: $("fBaslik").value.trim(),
        metin: $("fMetin").value.trim(),
        sms_metni: $("fSms").value.trim() || null,
        tur: $("fTur").value,
        oncelik: alan.querySelector('input[name="oncelik"]:checked').value,
        hedef: alan.querySelector('input[name="hedef"]:checked').value,
        hedef_uzmanlar: [...alan.querySelectorAll('input[name="secili"]:checked')].map((x) => x.value),
        kanal_panel: $("kPanel").checked,
        kanal_eposta: $("kEposta").checked,
        kanal_sms: $("kSms").checked,
        bitis: $("fBitis").value ? new Date($("fBitis").value).toISOString() : null,
        planlanan_zaman: $("fPlan").value ? new Date($("fPlan").value).toISOString() : null,
        ust_bildirim_id: b.ust_bildirim_id || null,
      };
    }
    function denetle(d, planli = false) {
      if (d.baslik.length < 3) return "Başlık en az 3 karakter olmalı.";
      if (d.metin.length < 5) return "Bildirim metnini yazın.";
      if (!d.kanal_panel && !d.kanal_eposta && !d.kanal_sms) return "En az bir gönderim kanalı seçin.";
      if (d.hedef === "secili" && !d.hedef_uzmanlar.length) return "Belirli uzmanlar seçtiniz; en az bir uzman işaretleyin.";
      if (d.kanal_sms && !d.sms_metni) return "SMS metnini yazın.";
      if (d.bitis && new Date(d.bitis) < new Date()) return "Panelde gösterim bitişi geçmiş bir zaman olamaz.";
      if (planli && (!d.planlanan_zaman || new Date(d.planlanan_zaman) < new Date(Date.now() + 60000))) return "Planlamak için ileri bir gönderim zamanı seçin.";
      return null;
    }

    let ozetSayac;
    async function ozetGuncelle() {
      if (!$("ozet")) return;
      const d = deger();
      $("kritikNot").hidden = d.oncelik !== "kritik";
      $("seciliAlan").hidden = d.hedef !== "secili";
      $("smsAlan").hidden = !d.kanal_sms;
      const sms = smsOlc($("fSms").value);
      $("smsSayac").textContent = `${sms.uzunluk} karakter · ${sms.parca} SMS${sms.tur === "turkce" ? " (Türkçe karakterli: SMS başına 155, çok parçalıda 150 karakter)" : sms.tur === "unicode" ? " (özel karakter/emoji var: SMS başına yalnızca 70 karakter — emojileri çıkarın)" : ""}. Kişi başı ${sms.parca} SMS kredisi; tutar sağlayıcıya göre değişir.`;
      clearTimeout(ozetSayac);
      ozetSayac = setTimeout(async () => {
        if (!$("ozet")) return; // sayfadan çıkıldı
        const { data, error } = await sb.rpc("bildirim_hedef_ozeti", { p_hedef: d.hedef, p_secili: d.hedef_uzmanlar, p_kritik: d.oncelik === "kritik" });
        if (!error && data && data[0]) ozet = data[0];
        if (!$("ozet")) return;
        const kanallar = [];
        if (d.kanal_panel) kanallar.push(`<li>Panel içi bildirim: <strong>${ozet.toplam}</strong> uzman</li>`);
        if (d.kanal_eposta)
          kanallar.push(`<li>E-posta: <strong>${ozet.eposta}</strong> uzman${ozet.toplam - ozet.eposta > 0 ? ` (${ozet.toplam - ozet.eposta} uzman bildirim e-postalarını kapatmış)` : ""}</li>`);
        if (d.kanal_sms) kanallar.push(`<li>SMS: <strong>${ozet.sms}</strong> uzman × ${sms.parca} SMS = <strong>${ozet.sms * sms.parca}</strong> SMS kredisi</li>`);
        $("ozet").innerHTML = `<strong>Gönderim özeti</strong> — ${esc(HEDEFLER[d.hedef])}${d.oncelik === "kritik" ? ' · <span class="hata-yazi">KRİTİK</span>' : ""}<ul>${kanallar.join("") || "<li>Kanal seçilmedi</li>"}</ul>
          <span class="alan-ipucu">Örnek (deneme) profiller hiçbir zaman bildirim almaz.</span>`;
      }, 250);
    }
    $("bForm").addEventListener("input", () => {
      Yonetim.kirliYap(true);
      if (m.classList.contains("mesaj-hata")) m.hidden = true;
      ozetGuncelle();
    });
    $("bForm").addEventListener("change", ozetGuncelle);
    $("uzmanAra").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLocaleLowerCase("tr");
      $("uzmanSecim").querySelectorAll("[data-ad]").forEach((l) => (l.hidden = q && !l.dataset.ad.includes(q)));
    });
    ozetGuncelle();

    async function kaydet(durum) {
      const d = deger();
      const satir = { ...d, durum };
      if (durum !== "planlandi") satir.planlanan_zaman = d.planlanan_zaman || null;
      const sorgu = b.id ? sb.from("sistem_bildirimleri").update(satir).eq("id", b.id).select("*").single() : sb.from("sistem_bildirimleri").insert(satir).select("*").single();
      const { data, error } = await sorgu;
      if (error) throw error;
      b = data;
      Yonetim.kirliYap(false);
      return data;
    }
    const islem = (id, fn) =>
      $(id).addEventListener("click", async () => {
        const d = $(id);
        const ilk = d.innerHTML;
        d.disabled = true;
        try {
          await fn();
        } catch (e) {
          console.error(e);
          Yonetim.mesaj(m, Yonetim.hataMetni(e), "hata");
        } finally {
          if (document.body.contains(d)) {
            d.disabled = false;
            d.innerHTML = ilk;
          }
        }
      });

    islem("bOnizle", async () => {
      const d = deger();
      $("onizlemeKutu").hidden = false;
      $("onPanel").innerHTML = panelOnizleme(d);
      $("onEposta").srcdoc = epostaOnizleme(d);
      $("onizlemeKutu").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    islem("bTaslak", async () => {
      const d = deger();
      if (d.baslik.length < 3) return Yonetim.mesaj(m, "Taslak için en az bir başlık yazın.", "hata");
      if (d.hedef === "secili" && !d.hedef_uzmanlar.length) return Yonetim.mesaj(m, "Belirli uzmanlar seçtiniz; en az bir uzman işaretleyin.", "hata");
      if (d.metin.length < 5) return Yonetim.mesaj(m, "Bildirim metnini yazın.", "hata");
      const x = await kaydet("taslak");
      await Yonetim.git(`#bildirim/${x.id}`);
      Yonetim.mesaj(document.getElementById("bMesaj"), "Taslak kaydedildi.", "basari");
    });
    islem("bPlanla", async () => {
      const h = denetle(deger(), true);
      if (h) return Yonetim.mesaj(m, h, "hata");
      const x = await kaydet("planlandi");
      await Yonetim.git(`#bildirim/${x.id}`);
      Yonetim.mesaj(document.getElementById("bMesaj"), `Planlandı: ${zaman(x.planlanan_zaman)}. Zamanı gelince otomatik gönderilecek.`, "basari");
    });
    islem("bGonder", async () => {
      const d = deger();
      const h = denetle(d);
      if (h) return Yonetim.mesaj(m, h, "hata");
      await ozetGuncelle();
      await new Promise((r) => setTimeout(r, 300));
      if (!ozet.toplam) return Yonetim.mesaj(m, "Seçilen hedef kitlede bildirim alabilecek uzman yok.", "hata");
      const kanallar = [d.kanal_panel && "panel içi bildirim", d.kanal_eposta && "e-posta", d.kanal_sms && "SMS"].filter(Boolean).join(", ");
      $("onayMetni").textContent = `${ozet.toplam} uzmana (${HEDEFLER[d.hedef].toLocaleLowerCase("tr")}) ${kanallar} ile gönderilecek.${d.oncelik === "kritik" ? " Bu bir KRİTİK bildirimdir." : ""} Gönderim geri alınamaz.`;
      $("onayAlani").hidden = false;
      $("onayKutusu").checked = false;
      $("onayGonder").disabled = true;
      $("onayAlani").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    $("onayKutusu").addEventListener("change", () => ($("onayGonder").disabled = !$("onayKutusu").checked));
    $("onayVazgec").addEventListener("click", () => ($("onayAlani").hidden = true));
    islem("onayGonder", async () => {
      $("onayGonder").textContent = "Gönderiliyor…";
      const x = await kaydet("taslak");
      const { data, error } = await sb.functions.invoke("bildirim-gonder", { body: { islem: "gonder", bildirim_id: x.id, onay: true } });
      if (error || !data || data.hata) {
        let mesaj = (data && data.hata) || "Gönderilemedi.";
        try {
          const g = error && error.context ? await error.context.json() : null;
          if (g && g.hata) mesaj = g.hata;
        } catch (e) {
          /* yanıt okunamadı */
        }
        throw new Error(mesaj);
      }
      await Yonetim.git(`#bildirim/${x.id}`);
      const e = data.eposta ? ` E-posta: ${data.eposta.gonderildi} gönderildi${data.eposta.basarisiz ? `, ${data.eposta.basarisiz} başarısız` : ""}${data.eposta.atlandi ? `, ${data.eposta.atlandi} atlandı` : ""}.` : "";
      Yonetim.mesaj(document.getElementById("dMesaj"), `Bildirim ${data.alici ?? ""} uzmana gönderildi.${e}${data.uyari ? " " + data.uyari : ""}`, data.uyari ? "uyari" : "basari");
    });
    if ($("bSil"))
      Yonetim.onayliDugme($("bSil"), b.durum === "planlandi" ? "Planı iptal etmek için tekrar basın" : "Silmek için tekrar basın", async () => {
        const { error } = b.durum === "planlandi" ? await sb.from("sistem_bildirimleri").update({ durum: "taslak" }).eq("id", b.id) : await sb.from("sistem_bildirimleri").delete().eq("id", b.id);
        if (error) return Yonetim.mesaj(m, Yonetim.hataMetni(error), "hata");
        await Yonetim.git(b.durum === "planlandi" ? `#bildirim/${b.id}` : "#bildirimler");
      });
  }

  // ---------- Gönderilmiş bildirim: ayrıntı ve takip ----------
  async function ayrinti(alan, b) {
    const { data: alicilar, error } = await sb
      .from("bildirim_alicilari")
      .select("id, okundu_zamani, eposta_durum, eposta_hata, sms_durum, sms_hata, uzmanlar(ad, soyad, unvan_oneki)")
      .eq("bildirim_id", b.id);
    if (error) throw error;
    const say = (f) => alicilar.filter(f).length;
    const basarisiz = alicilar.filter((a) => a.eposta_durum === "basarisiz" || a.sms_durum === "basarisiz");
    const atlanan = alicilar.filter((a) => a.eposta_durum === "atlandi" || a.sms_durum === "atlandi");
    const ad = (a) => esc([a.uzmanlar?.unvan_oneki, a.uzmanlar?.ad, a.uzmanlar?.soyad].filter(Boolean).join(" ") || "Silinmiş uzman");

    alan.innerHTML = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="#bildirimler">Sistem bildirimleri</a></li><li><span aria-current="page">${esc(b.baslik)}</span></li></ol></nav>
      <section class="panel-baslik">
        <div><p class="bolum-ust-yazi">${esc(TURLER[b.tur])}${b.oncelik !== "normal" ? " · " + esc(ONCELIKLER[b.oncelik]) : ""}</p><h1>${esc(b.baslik)}</h1>
          <p class="soluk">Gönderim: ${esc(zaman(b.gonderim_zamani))} · Gönderen: ${esc(b.gonderen_eposta || "—")}${b.guncellendi ? " · metin sonradan düzeltildi" : ""}</p></div>
        ${durumRozet(b.durum)}
      </section>
      <div class="mesaj" id="dMesaj" role="status" hidden></div>
      <section class="blok panel-kart">
        <h2>Gönderim durumu</h2>
        <div class="sayaclar">
          <div class="sayac-kutu"><strong>${alicilar.length}</strong><span>Hedef uzman</span></div>
          ${b.kanal_panel ? `<div class="sayac-kutu"><strong>${say((a) => a.okundu_zamani)}</strong><span>Panelde okudu</span></div>` : ""}
          ${b.kanal_eposta ? `<div class="sayac-kutu"><strong>${say((a) => a.eposta_durum === "gonderildi")}</strong><span>E-posta gönderildi</span></div>` : ""}
          ${b.kanal_eposta || b.kanal_sms ? `<div class="sayac-kutu ${basarisiz.length ? "vurgulu" : ""}"><strong>${basarisiz.length}</strong><span>Başarısız gönderim</span></div>` : ""}
          ${b.kanal_sms ? `<div class="sayac-kutu"><strong>${say((a) => a.sms_durum === "gonderildi")}</strong><span>SMS gönderildi</span></div>` : ""}
        </div>
        <p class="alan-ipucu">Kanallar: ${[b.kanal_panel && "panel içi", b.kanal_eposta && "e-posta", b.kanal_sms && "SMS"].filter(Boolean).join(", ")} · Hedef: ${esc(HEDEFLER[b.hedef])}</p>
        ${
          basarisiz.length
            ? `<h3>Başarısız gönderimler</h3><ul class="gecmis-listesi">${basarisiz
                .map((a) => `<li><strong>${ad(a)}</strong><span class="alan-ipucu">${a.eposta_durum === "basarisiz" ? "E-posta: " + esc(a.eposta_hata || "") : ""} ${a.sms_durum === "basarisiz" ? "SMS: " + esc(a.sms_hata || "") : ""}</span></li>`)
                .join("")}</ul>
               <button class="btn btn-cizgi btn-kucuk" type="button" id="yenidenDene">${ikon("yenile")}Başarısızları yeniden dene</button>`
            : ""
        }
        ${atlanan.length ? `<details class="metin-ac"><summary>${atlanan.length} uzman tercihleri nedeniyle atlandı</summary><ul class="gecmis-listesi">${atlanan.map((a) => `<li>${ad(a)} <span class="alan-ipucu">${esc(a.eposta_hata || a.sms_hata || "")}</span></li>`).join("")}</ul></details>` : ""}
      </section>
      <section class="blok panel-kart">
        <h2>Metin</h2>
        ${
          b.durum === "gonderildi"
            ? `<form id="duzeltForm" novalidate>
                <div class="form-alani"><label class="alan-etiket" for="dBaslik">Başlık</label><input class="girdi" id="dBaslik" maxlength="120" value="${esc(b.baslik)}"></div>
                <div class="form-alani"><label class="alan-etiket" for="dMetin">Metin</label><textarea class="girdi" id="dMetin" rows="5" maxlength="3000">${esc(b.metin)}</textarea>
                  <p class="alan-ipucu">Düzeltme yalnızca uzman panelindeki bildirime yansır; gönderilmiş e-postalar değişmez. Önemli bir değişiklikse takip bildirimi gönderin.</p></div>
                <div class="duzen-alt"><button class="btn btn-cizgi btn-kucuk" type="submit">Metni güncelle</button></div>
              </form>`
            : `<p class="on-metin">${esc(b.metin)}</p>`
        }
      </section>
      ${
        b.durum === "gonderildi"
          ? `<section class="blok panel-kart">
              <h2>Takip</h2>
              <p class="soluk">Sorun çözüldüğünde aynı kitleye "Sorun giderildi" bildirimi gönderebilir ya da bu bildirimi uzman panelinden kaldırabilirsiniz.</p>
              <div class="karar-dugmeleri">
                <a class="btn btn-ana btn-kucuk" href="#bildirim/takip/${b.id}">${ikon("onay")}"Sorun giderildi" bildirimi hazırla</a>
                ${b.kanal_panel ? `<button class="btn btn-cizgi btn-kucuk tehlike" type="button" id="kaldir">Panelden kaldır</button>` : ""}
              </div>
            </section>`
          : ""
      }`;

    const m = document.getElementById("dMesaj");
    const yd = document.getElementById("yenidenDene");
    if (yd)
      Yonetim.onayliDugme(yd, "Yeniden denemek için tekrar basın", async () => {
        const { data, error: e } = await sb.functions.invoke("bildirim-gonder", { body: { islem: "yeniden_dene", bildirim_id: b.id } });
        if (e || !data || data.hata) return Yonetim.mesaj(m, (data && data.hata) || "Yeniden deneme yapılamadı.", "hata");
        await Yonetim.git(`#bildirim/${b.id}`);
        Yonetim.mesaj(document.getElementById("dMesaj"), `Yeniden denendi.${data.eposta ? ` E-posta: ${data.eposta.gonderildi} gönderildi, ${data.eposta.basarisiz} başarısız.` : ""}`, "basari");
      });
    const df = document.getElementById("duzeltForm");
    if (df)
      df.addEventListener("submit", async (e) => {
        e.preventDefault();
        const baslik = document.getElementById("dBaslik").value.trim();
        const metin = document.getElementById("dMetin").value.trim();
        if (baslik.length < 3 || metin.length < 5) return Yonetim.mesaj(m, "Başlık ve metin boş olamaz.", "hata");
        const { error: h } = await sb.from("sistem_bildirimleri").update({ baslik, metin }).eq("id", b.id);
        if (h) return Yonetim.mesaj(m, Yonetim.hataMetni(h), "hata");
        await Yonetim.git(`#bildirim/${b.id}`);
        Yonetim.mesaj(document.getElementById("dMesaj"), "Metin güncellendi; uzman panelinde 'güncellendi' notuyla görünür.", "basari");
      });
    const k = document.getElementById("kaldir");
    if (k)
      Yonetim.onayliDugme(k, "Kaldırmak için tekrar basın", async () => {
        const { error: h } = await sb.from("sistem_bildirimleri").update({ durum: "iptal" }).eq("id", b.id);
        if (h) return Yonetim.mesaj(m, Yonetim.hataMetni(h), "hata");
        await Yonetim.git(`#bildirim/${b.id}`);
        Yonetim.mesaj(document.getElementById("dMesaj"), "Bildirim uzman panellerinden kaldırıldı.", "basari");
      });
  }
})();
