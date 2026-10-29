/*
 * YÖNETİM PANELİ — GENEL SİTE AYARLARI (#ayarlar)
 * Tek satırlık "site_ayarlari" tablosu. Gizli anahtarlar ve sistem ayarları burada YOKTUR
 * (onlar Supabase panelindedir). Boş bırakılan alan sitede gösterilmez.
 * Değerler sitede site-icerik.js tarafından uygulanır.
 */
(() => {
  const sb = Yonetim.sb;
  const ALANLAR = [
    {
      bolum: "Kurumsal bilgiler",
      aciklama: "İletişim e-postası İletişim sayfasındaki kartlarda ve sitenin alt bilgisinde gösterilir. Destek e-postası boşsa onun yerine de iletişim e-postası kullanılır.",
      alanlar: [
        { ad: "iletisim_eposta", etiket: "İletişim e-postası", tur: "email", ornek: "iletisim@klinikpsikologlar.com.tr" },
        { ad: "destek_eposta", etiket: "Destek e-postası (teknik sorunlar)", tur: "email", ornek: "destek@klinikpsikologlar.com.tr" },
        { ad: "kurumsal_adres", etiket: "Kurumsal adres", tur: "metin", sinir: 300, ornek: "Mahalle, cadde, no · İlçe / İl" },
      ],
    },
    {
      bolum: "Sosyal medya",
      aciklama: "Doldurulan hesaplar sitenin alt bilgisinde simge olarak görünür. Tam adres yazın (https:// ile başlayan).",
      alanlar: [
        { ad: "instagram", etiket: "Instagram", tur: "url", ornek: "https://www.instagram.com/hesapadi", kalip: /^https:\/\/(www\.)?instagram\.com\/[^\s<>"]+$/ },
        { ad: "facebook", etiket: "Facebook", tur: "url", ornek: "https://www.facebook.com/sayfaadi", kalip: /^https:\/\/(www\.|m\.)?facebook\.com\/[^\s<>"]+$/ },
        { ad: "linkedin", etiket: "LinkedIn", tur: "url", ornek: "https://www.linkedin.com/company/sirketadi", kalip: /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/[^\s<>"]+$/ },
        { ad: "youtube", etiket: "YouTube", tur: "url", ornek: "https://www.youtube.com/@kanaladi", kalip: /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s<>"]+$/ },
      ],
    },
    {
      bolum: "Ana sayfa ve görünüm",
      alanlar: [
        { ad: "ana_sayfa_aciklama", etiket: "Ana sayfa açıklama metni (arama başlığının altındaki cümle)", tur: "uzun", sinir: 300 },
        { ad: "footer_aciklama", etiket: "Alt bilgi (footer) açıklaması", tur: "uzun", sinir: 400 },
        { ad: "manset_goster", etiket: "Ana sayfada manşet (slider) alanını göster", tur: "secim" },
        { ad: "duyurular_goster", etiket: "Ana sayfada duyuru ve tanıtım alanlarını göster", tur: "secim" },
      ],
    },
    {
      bolum: "Arama motoru (SEO) ayarları",
      aciklama:
        "Ana sayfanın Google'da görünen başlığı ve açıklaması. Boş bırakılırsa sayfadaki mevcut başlık kullanılır. Not: Google bu değişiklikleri görür; WhatsApp ve Facebook gibi uygulamaların bağlantı önizlemeleri ise sayfanın dosyadaki hâlini kullanır.",
      alanlar: [
        { ad: "seo_baslik", etiket: "Ana sayfa SEO başlığı (en fazla 70 karakter)", tur: "metin", sinir: 70 },
        { ad: "seo_aciklama", etiket: "Ana sayfa meta açıklaması (en fazla 170 karakter)", tur: "uzun", sinir: 170 },
      ],
    },
  ];

  Yonetim.bolumEkle("ayarlar", async (alan) => {
    const { data, error } = await sb.from("site_ayarlari").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    const a = data || {};
    const girdi = (f) => {
      const id = `a_${f.ad}`;
      const deger = a[f.ad];
      if (f.tur === "secim")
        return `<label class="onay-kutusu"><input type="checkbox" id="${id}" ${deger !== false ? "checked" : ""}> <span>${esc(f.etiket)}</span></label>`;
      const ortak = `class="girdi" id="${id}" ${f.sinir ? `maxlength="${f.sinir}"` : ""} placeholder="${esc(f.ornek || "")}"`;
      return `<div class="form-alani"><label class="alan-etiket" for="${id}">${esc(f.etiket)}</label>
        ${f.tur === "uzun" ? `<textarea ${ortak} rows="3">${esc(deger || "")}</textarea>` : `<input ${ortak} type="${f.tur === "email" ? "email" : f.tur === "url" ? "url" : "text"}" value="${esc(deger || "")}" autocomplete="off" spellcheck="false">`}
      </div>`;
    };

    alan.innerHTML = `
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">İçerik yönetimi</p><h1>Genel site ayarları</h1>
        <p class="soluk">Boş bıraktığınız alan sitede gösterilmez. ${a.guncellenme ? `Son kayıt: ${esc(new Date(a.guncellenme).toLocaleString("tr-TR"))}.` : ""}</p></div></section>
      <form id="ayarFormu" novalidate class="yonetim-icerik">
        ${ALANLAR.map(
          (b) => `<section class="blok panel-kart ayar-bolum"><h2>${esc(b.bolum)}</h2>
            ${b.aciklama ? `<p class="soluk duzen-aciklama">${esc(b.aciklama)}</p>` : ""}
            ${b.alanlar.map(girdi).join("")}</section>`
        ).join("")}
        <p class="yonetim-not">Site adı ve sloganı logo görselinin parçası olduğu için buradan değiştirilmez. Gizli anahtarlar (e-posta, güvenlik doğrulaması vb.) güvenlik nedeniyle yalnızca Supabase panelindedir.</p>
        <div class="mesaj" id="ayarMesaj" role="status" hidden></div>
        <div class="duzen-alt"><button class="btn btn-ana" type="submit" id="ayarKaydet">Ayarları kaydet</button></div>
      </form>`;

    const form = document.getElementById("ayarFormu");
    form.addEventListener("input", () => Yonetim.kirliYap(true));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const m = document.getElementById("ayarMesaj");
      const yeni = {};
      for (const b of ALANLAR)
        for (const f of b.alanlar) {
          const el = document.getElementById(`a_${f.ad}`);
          if (f.tur === "secim") {
            yeni[f.ad] = el.checked;
            continue;
          }
          const v = el.value.trim();
          if (v && f.tur === "email" && !/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(v)) return Yonetim.mesaj(m, `${f.etiket}: geçerli bir e-posta adresi yazın.`, "hata");
          if (v && f.kalip && !f.kalip.test(v)) return Yonetim.mesaj(m, `${f.etiket}: adres geçersiz. Örnek: ${f.ornek}`, "hata");
          yeni[f.ad] = v || null;
        }
      const dugme = document.getElementById("ayarKaydet");
      dugme.disabled = true;
      dugme.textContent = "Kaydediliyor…";
      const { error } = await sb.from("site_ayarlari").update(yeni).eq("id", 1);
      dugme.disabled = false;
      dugme.textContent = "Ayarları kaydet";
      if (error) return Yonetim.mesaj(m, "Kaydedilemedi: " + Yonetim.hataMetni(error), "hata");
      Yonetim.kirliYap(false);
      Yonetim.mesaj(m, "Ayarlar kaydedildi. Sitede hemen geçerli olur (sayfayı yenileyin).", "basari");
    });
  });
})();
