/*
 * YÖNETİM PANELİ — ÖZET VE UZMAN BAŞVURULARI
 *  #             → Özet: sayılar, yayındaki profillerdeki son değişiklikler
 *  #basvurular   → Başvuru listesi (durum filtresi + arama)
 *  #basvuru/<id> → Başvuru ayrıntısı: belgeler, e-Devlet kodu, ifade denetimi, karar
 *
 * Kararlar:
 *  - Onayla ve yayına al → profil "yayinda", bekleyen belgeler "onaylandi"
 *  - Ek belge iste        → profil "ek_belge", not uzmana gösterilir
 *  - Reddet               → profil "reddedildi", bekleyen belgeler "reddedildi", not uzmana gösterilir
 *  - Askıya al / yeniden yayına al (yayındaki profiller için)
 * Her karardan sonra uzmana e-posta gider (sunucu fonksiyonu "karar-bildir").
 * Belge dosyaları karardan 30 gün sonra otomatik silinir (belge-temizle); doğrulama kaydı kalır.
 */
(() => {
  const sb = Yonetim.sb;
  const DURUMLAR = {
    incelemede: { ad: "İnceleme bekliyor", sinif: "incelemede" },
    ek_belge: { ad: "Ek belge istendi", sinif: "uyari" },
    yayinda: { ad: "Yayında", sinif: "yayinda" },
    taslak: { ad: "Taslak", sinif: "taslak" },
    reddedildi: { ad: "Reddedildi", sinif: "uyari" },
    askida: { ad: "Askıda", sinif: "uyari" },
  };
  const BELGE_TURLERI = {
    diploma: "Lisans mezuniyeti (Psikoloji ya da PDR)",
    yuksek_lisans: "Klinik psikoloji yüksek lisans mezuniyeti",
    saglik_bakanligi: "Sağlık Bakanlığı sağlık personeli belgesi",
    uzmanlik_belgesi: "Uzmanlık / unvan belgesi",
    diger: "Diğer belge",
  };
  const BELGE_DURUM = {
    bekliyor: { ad: "İnceleme bekliyor", sinif: "incelemede" },
    onaylandi: { ad: "Kabul edildi", sinif: "yayinda" },
    reddedildi: { ad: "Kabul edilmedi", sinif: "uyari" },
  };
  const EDEVLET_DOGRULAMA = "https://www.turkiye.gov.tr/belge-dogrulama";
  const tamAd = (u) => [u.unvan_oneki, u.ad, u.soyad].filter(Boolean).join(" ");
  const durumRozet = (d) => {
    const x = DURUMLAR[d] || { ad: d, sinif: "" };
    return `<span class="panel-durum ${x.sinif}">${esc(x.ad)}</span>`;
  };
  const ALAN_ADLARI = {
    kisa_tanitim: "Kısa tanıtım", hakkinda: "Hakkımda", foto_yolu: "Fotoğraf", sehir: "Şehir", ilce: "İlçe",
    deneyim_yili: "Mesleki aktif süre", seans_suresi: "Seans süresi", online_platform: "Online platform",
    muayenehane_adres: "Çalışma adresi", gorusme_online: "Online görüşme", gorusme_yuzyuze: "Yüz yüze görüşme",
    yeni_danisan: "Yeni danışan kabulü", diller: "Diller", yas_gruplari: "Yaş grupları", cinsiyet: "Cinsiyet",
    instagram: "Instagram", linkedin: "LinkedIn", x_hesabi: "X", youtube: "YouTube", facebook: "Facebook",
    tiktok: "TikTok", web_sitesi: "Web sitesi", telefon: "Telefon", whatsapp: "WhatsApp", eposta: "E-posta",
    ad: "Ad", soyad: "Soyad", unvan: "Unvan", unvan_oneki: "Unvan öneki", durum: "Durum",
  };
  const METIN_ALANLARI = ["kisa_tanitim", "hakkinda"];

  // ================= ÖZET =================
  Yonetim.bolumEkle("", async (alan) => {
    const { data, error } = await sb.from("uzmanlar").select("id, durum, ornek");
    if (error) throw error;
    const gercek = data.filter((x) => !x.ornek);
    const say = (d) => gercek.filter((x) => x.durum === d).length;
    const kutu = (sayi, etiket, filtre, vurgu) =>
      `<a class="sayac-kutu ${vurgu ? "vurgulu" : ""}" href="#basvurular/${filtre}"><strong>${sayi}</strong><span>${etiket}</span></a>`;

    // Yayındaki profillerde uzmanın kendi yaptığı son değişiklikler
    const yayindakiler = new Map();
    const { data: yUzm } = await sb.from("uzmanlar").select("id, ad, soyad, unvan_oneki").eq("durum", "yayinda").eq("ornek", false);
    (yUzm || []).forEach((u) => yayindakiler.set(u.id, u));
    let degisiklikler = [];
    if (yayindakiler.size) {
      const { data: k } = await sb
        .from("degisiklik_kayitlari")
        .select("zaman, kayit_id, degisiklikler")
        .eq("tablo", "uzmanlar")
        .eq("islem", "guncelleme")
        .eq("yapan_rol", "uzman")
        .in("kayit_id", [...yayindakiler.keys()])
        .order("zaman", { ascending: false })
        .limit(20);
      degisiklikler = (k || []).filter((x) => Object.keys(x.degisiklikler || {}).some((a) => a !== "kabul_durumu_guncellenme" && a !== "yeni_danisan"));
    }

    alan.innerHTML = `
      <section class="panel-baslik">
        <div><p class="bolum-ust-yazi">Yönetim paneli</p><h1>Özet</h1><p class="soluk">${esc(Yonetim.kullanici.email)}</p></div>
        <span class="rozet yonetici-rozet">${ikon("kilit")}Yönetici hesabı</span>
      </section>
      <section class="blok panel-kart">
        <h2>Uzman profilleri</h2>
        <div class="sayaclar">
          ${kutu(say("incelemede"), "İnceleme bekliyor", "incelemede", say("incelemede") > 0)}
          ${kutu(say("ek_belge"), "Ek belge istendi", "ek_belge")}
          ${kutu(say("yayinda"), "Yayında", "yayinda")}
          ${kutu(say("taslak"), "Taslak", "taslak")}
          ${kutu(say("reddedildi") + say("askida"), "Reddedilen / askıda", "reddedildi")}
        </div>
        <p class="alan-ipucu">Sayılara örnek (deneme) profiller dahil değildir (${data.length - gercek.length} örnek profil var).</p>
      </section>
      <section class="blok panel-kart">
        <h2>Yayındaki profillerde son değişiklikler</h2>
        <p class="soluk duzen-aciklama">Onaylanmış uzmanların profillerinde kendilerinin yaptığı değişiklikler. Metin değişikliklerinde reklam dili denetimi sonucu da gösterilir.</p>
        ${
          degisiklikler.length
            ? `<ul class="degisiklik-listesi">${degisiklikler
                .map((d) => {
                  const u = yayindakiler.get(d.kayit_id);
                  const alanlar = Object.keys(d.degisiklikler).filter((a) => a !== "kabul_durumu_guncellenme");
                  const metin = METIN_ALANLARI.map((a) => (d.degisiklikler[a] ? d.degisiklikler[a].yeni || "" : "")).join("\n");
                  const bulgular = metin.trim() ? IfadeDenetimi.tara(metin) : [];
                  return `<li>
                    <div><a href="#basvuru/${esc(d.kayit_id)}"><strong>${esc(tamAd(u))}</strong></a>
                      <span class="alan-ipucu">${new Date(d.zaman).toLocaleString("tr-TR")}</span></div>
                    <div class="alan-ipucu">Değişen: ${alanlar.map((a) => esc(ALAN_ADLARI[a] || a)).join(", ")}</div>
                    ${bulgular.length ? `<div class="ifade-ozet">${ikon("bilgi")}${bulgular.length} ifade gözden geçirilmeli</div>` : ""}
                  </li>`;
                })
                .join("")}</ul>`
            : `<p class="alan-ipucu">Henüz değişiklik yok.</p>`
        }
      </section>
      <section class="blok panel-kart">
        <h2>İçerik yönetimi</h2>
        <div class="hizli-baglantilar">
          <a class="btn btn-cizgi btn-kucuk" href="#mansetler">Manşetler</a>
          <a class="btn btn-cizgi btn-kucuk" href="#duyurular">Duyurular</a>
          <a class="btn btn-cizgi btn-kucuk" href="#sayfalar">Sabit sayfalar</a>
          <a class="btn btn-cizgi btn-kucuk" href="#ayarlar">Site ayarları</a>
        </div>
      </section>`;
  });

  // ================= LİSTE =================
  Yonetim.bolumEkle("basvurular", async (alan, filtre) => {
    filtre = filtre || "incelemede";
    const { data, error } = await sb
      .from("uzmanlar")
      .select("id, slug, ad, soyad, unvan_oneki, unvan, sehir, durum, ornek, guncellenme, dogrulama_belgeleri(id)")
      .order("guncellenme", { ascending: false });
    if (error) throw error;

    const sekmeler = [
      ["incelemede", "İnceleme bekliyor"],
      ["ek_belge", "Ek belge istendi"],
      ["yayinda", "Yayında"],
      ["taslak", "Taslak"],
      ["reddedildi", "Reddedilen / askıda"],
      ["tumu", "Tümü"],
    ];
    const uygun = (u) =>
      filtre === "tumu" ? true : filtre === "reddedildi" ? ["reddedildi", "askida"].includes(u.durum) : u.durum === filtre;

    alan.innerHTML = `
      <section class="panel-baslik"><div><p class="bolum-ust-yazi">Yönetim paneli</p><h1>Uzman başvuruları</h1></div></section>
      <div class="sekme-satiri" role="tablist">
        ${sekmeler
          .map(([k, ad]) => {
            const n = data.filter((u) => !u.ornek && (k === "tumu" || (k === "reddedildi" ? ["reddedildi", "askida"].includes(u.durum) : u.durum === k))).length;
            return `<a role="tab" href="#basvurular/${k}" aria-selected="${k === filtre}">${esc(ad)} <span class="sekme-sayi">${n}</span></a>`;
          })
          .join("")}
      </div>
      <div class="liste-arac">
        <input class="girdi" type="search" id="basvuruAra" placeholder="Ad, soyad ya da şehir ara…" aria-label="Başvurularda ara">
        <label class="onay-kutusu"><input type="checkbox" id="ornekGoster"> <span>Örnek profilleri de göster</span></label>
      </div>
      <div id="basvuruListesi"></div>`;

    function ciz() {
      const ara = document.getElementById("basvuruAra").value.trim().toLocaleLowerCase("tr");
      const ornek = document.getElementById("ornekGoster").checked;
      const liste = data.filter(uygun).filter((u) => (ornek || !u.ornek) && (!ara || `${tamAd(u)} ${u.sehir || ""}`.toLocaleLowerCase("tr").includes(ara)));
      document.getElementById("basvuruListesi").innerHTML = liste.length
        ? `<ul class="yonetim-liste">${liste
            .map(
              (u) => `<li>
                <a href="#basvuru/${u.id}">
                  <span class="yl-ana"><strong>${esc(tamAd(u))}</strong>${u.ornek ? ' <span class="ornek-rozet">Örnek</span>' : ""}
                    <span class="alan-ipucu">${esc(u.unvan || "")}${u.sehir ? " · " + esc(u.sehir) : ""} · ${(u.dogrulama_belgeleri || []).length} belge · ${tarihMetni(u.guncellenme)}</span></span>
                  ${durumRozet(u.durum)}
                </a></li>`
            )
            .join("")}</ul>`
        : `<p class="bos-not">Bu grupta başvuru yok.</p>`;
    }
    document.getElementById("basvuruAra").addEventListener("input", ciz);
    document.getElementById("ornekGoster").addEventListener("change", ciz);
    ciz();
  });

  // ================= AYRINTI =================
  Yonetim.bolumEkle("basvuru", async (alan, id) => {
    async function yukle() {
      const [u, b, g, k] = await Promise.all([
        sb
          .from("uzmanlar")
          .select("*, uzman_egitimler(tur, metin, sira), uzman_sss(soru, cevap, sira)")
          .eq("id", id)
          .single(),
        sb.from("dogrulama_belgeleri").select("*").eq("uzman_id", id).order("yuklenme"),
        sb.from("uzman_gizli").select("ret_nedeni, yonetici_notu").eq("uzman_id", id).maybeSingle(),
        sb.from("degisiklik_kayitlari").select("zaman, yapan_rol, islem, degisiklikler").eq("tablo", "uzmanlar").eq("kayit_id", id).order("zaman", { ascending: false }).limit(15),
      ]);
      if (u.error) throw u.error;
      if (b.error) throw b.error;
      return { u: u.data, belgeler: b.data, gizli: g.data || {}, gecmis: k.data || [] };
    }

    let veri = await yukle();

    function ciz() {
      const { u, belgeler, gizli, gecmis } = veri;
      const gecerli = (t) => belgeler.some((x) => x.belge_turu === t && x.durum !== "reddedildi");
      const yol1 = gecerli("diploma") && gecerli("yuksek_lisans");
      const yol2 = gecerli("saglik_bakanligi");
      const egitim = (u.uzman_egitimler || []).sort((a, b) => a.sira - b.sira);
      const sss = (u.uzman_sss || []).sort((a, b) => a.sira - b.sira);
      const metinler = [
        ["Kısa tanıtım", u.kisa_tanitim],
        ["Hakkımda", u.hakkinda],
        ["Eğitim ve sertifikalar", egitim.map((e) => e.metin).join("\n")],
        ["Sık sorulan sorular", sss.map((s) => `${s.soru}\n${s.cevap}`).join("\n")],
      ];
      const denetim = metinler.map(([ad, m]) => ({ ad, bulgular: m ? IfadeDenetimi.tara(m) : [], bos: !m }));
      const toplamBulgu = denetim.reduce((t, d) => t + d.bulgular.length, 0);
      const yayinda = u.durum === "yayinda";
      const askida = u.durum === "askida";

      alan.innerHTML = `
        <nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="#basvurular">Uzman başvuruları</a></li><li><span aria-current="page">${esc(tamAd(u))}</span></li></ol></nav>
        <section class="panel-baslik">
          <div>
            <p class="bolum-ust-yazi">${esc(u.unvan || "")}${u.sehir ? " · " + esc(u.sehir) : ""}${u.ornek ? " · Örnek profil" : ""}</p>
            <h1>${esc(tamAd(u))}</h1>
            <p class="soluk">Son güncelleme: ${tarihMetni(u.guncellenme)} · Profil adresi: ${esc(u.slug)}</p>
          </div>
          <div class="profil-araclar">
            ${durumRozet(u.durum)}
            <a class="btn btn-cizgi btn-kucuk" href="uzman.html?id=${encodeURIComponent(u.slug)}&onizleme=1" target="_blank" rel="noopener">${ikon("goz")}Profili önizle</a>
          </div>
        </section>

        <section class="blok panel-kart">
          <h2>Doğrulama belgeleri</h2>
          <div class="belge-yollari">
            <div class="belge-yolu ${yol1 ? "tamam" : ""}"><strong>${yol1 ? ikon("onay") : ""}1. yol: Mezuniyet belgeleri</strong>
              <ul><li>${gecerli("diploma") ? "✓" : "○"} Lisans (Psikoloji / PDR)</li><li>${gecerli("yuksek_lisans") ? "✓" : "○"} Klinik psikoloji yüksek lisans</li></ul></div>
            <span class="belge-yollari-ya">ya da</span>
            <div class="belge-yolu ${yol2 ? "tamam" : ""}"><strong>${yol2 ? ikon("onay") : ""}2. yol: Sağlık Bakanlığı kaydı</strong>
              <ul><li>${yol2 ? "✓" : "○"} Sağlık personeli belgesi</li></ul></div>
          </div>
          ${
            belgeler.length
              ? `<ul class="belge-listesi">${belgeler
                  .map((x) => {
                    const d = BELGE_DURUM[x.durum] || BELGE_DURUM.bekliyor;
                    return `<li class="belge-satir yonetici-belge">
                      <div class="belge-bilgi">
                        <strong>${esc(BELGE_TURLERI[x.belge_turu] || x.belge_turu)}</strong>
                        <span class="alan-ipucu">${x.kaynak === "edevlet" ? "e-Devlet belgesi" : "Diploma / belge görüntüsü"} · ${tarihMetni(x.yuklenme)}${x.inceleme_tarihi ? " · karar: " + tarihMetni(x.inceleme_tarihi) : ""}</span>
                        ${
                          x.dogrulama_kodu
                            ? `<span class="kod-satiri">Doğrulama kodu: <code>${esc(x.dogrulama_kodu)}</code>
                                <button class="link-buton" type="button" data-kopyala="${esc(x.dogrulama_kodu)}">Kopyala</button>
                                <a href="${EDEVLET_DOGRULAMA}" target="_blank" rel="noopener">e-Devlet'te doğrula ↗</a></span>`
                            : ""
                        }
                        ${x.yonetici_notu ? `<span class="belge-not">Not: ${esc(x.yonetici_notu)}</span>` : ""}
                      </div>
                      <span class="panel-durum ${d.sinif}">${d.ad}</span>
                      <div class="belge-dugmeler">
                        ${x.dosya_silindi ? `<span class="alan-ipucu">Dosya silindi (saklama süresi doldu)</span>` : `<button class="btn btn-cizgi btn-kucuk" type="button" data-goster="${esc(x.dosya_yolu)}">Görüntüle</button>`}
                        ${x.durum !== "onaylandi" ? `<button class="btn btn-cizgi btn-kucuk" type="button" data-belge="${x.id}" data-karar="onaylandi">Kabul et</button>` : ""}
                        ${x.durum !== "reddedildi" ? `<button class="btn btn-cizgi btn-kucuk" type="button" data-belge="${x.id}" data-karar="reddedildi">Kabul etme</button>` : ""}
                      </div>
                    </li>`;
                  })
                  .join("")}</ul>
                 <p class="alan-ipucu">e-Devlet belgesini doğrulamak için kodu kopyalayıp e-Devlet'in "Barkodlu Belge Doğrulama" sayfasına yapıştırın; açılan belgenin yüklenen belgeyle aynı olduğunu kontrol edin.
                 "Kabul etme" derseniz isteğe bağlı not yazabilirsiniz; not uzmanın panelinde görünür.</p>`
              : `<p class="alan-ipucu">Bu uzman henüz belge yüklemedi.</p>`
          }
          <div class="mesaj" id="belgeMesaj" role="status" hidden></div>
        </section>

        <section class="blok panel-kart">
          <h2>Profil metinleri — ifade denetimi</h2>
          <p class="soluk duzen-aciklama">Reklam dili, tıbbi ifade ve sonuç vaadi taraması. Karar sizindir; uyarılar yalnızca yol göstericidir.</p>
          ${denetim
            .map((d) => `<div class="denetim-satir"><h3>${esc(d.ad)}</h3>${d.bos ? `<p class="alan-ipucu">Boş.</p>` : IfadeDenetimi.html(d.bulgular)}</div>`)
            .join("")}
          <details class="metin-ac"><summary>Profil metinlerini burada oku</summary>
            ${metinler.filter(([, m]) => m).map(([ad, m]) => `<h3>${esc(ad)}</h3><p class="on-metin">${esc(m)}</p>`).join("")}
          </details>
        </section>

        <section class="blok panel-kart">
          <h2>Karar</h2>
          ${gizli.ret_nedeni || gizli.yonetici_notu ? `<div class="mesaj mesaj-bilgi">Mevcut not (uzman görüyor): ${esc(gizli.ret_nedeni || gizli.yonetici_notu)}</div>` : ""}
          <div class="form-alani">
            <label class="alan-etiket" for="kararNotu">Uzmana not ${yayinda ? "(askıya alma nedeni)" : "(ek belge ya da ret için zorunlu)"}</label>
            <textarea class="girdi" id="kararNotu" rows="3" maxlength="1000" placeholder="Ör. Yüksek lisans belgenizde bölüm adı okunmuyor; e-Devlet mezun belgesini yükleyebilir misiniz?"></textarea>
            <p class="alan-ipucu">Not uzmanın panelinde görünür ve bilgilendirme e-postasına eklenir. Onayda not gönderilmez.</p>
          </div>
          ${toplamBulgu ? `<p class="mesaj mesaj-uyari">Profil metinlerinde ${toplamBulgu} ifade gözden geçirilmeli. Onaylamadan önce bakmanızı öneririz.</p>` : ""}
          <div class="karar-dugmeleri">
            ${
              yayinda
                ? `<button class="btn btn-cizgi" type="button" id="askiyaAl">Askıya al (yayından kaldır)</button>`
                : askida
                  ? `<button class="btn btn-ana" type="button" id="onayla">${ikon("onay")}Yeniden yayına al</button>`
                  : `<button class="btn btn-ana" type="button" id="onayla" ${yol1 || yol2 ? "" : "disabled"}>${ikon("onay")}Onayla ve yayına al</button>
                     <button class="btn btn-cizgi" type="button" id="ekBelge">Ek belge iste</button>
                     <button class="btn btn-cizgi tehlike" type="button" id="reddet">Reddet</button>`
            }
          </div>
          ${!yayinda && !askida && !(yol1 || yol2) ? `<p class="alan-ipucu">Onay için doğrulama yollarından biri tamamlanmış olmalı (kabul edilmemiş belgeler sayılmaz).</p>` : ""}
          ${u.durum !== "incelemede" && !yayinda && !askida ? `<p class="alan-ipucu">Bu profil şu an "${esc((DURUMLAR[u.durum] || {}).ad || u.durum)}" durumunda; uzman henüz incelemeye göndermemiş olabilir.</p>` : ""}
          <div class="mesaj" id="kararMesaj" role="status" hidden></div>
        </section>

        <section class="blok panel-kart">
          <h2>Geçmiş</h2>
          ${
            gecmis.length
              ? `<ul class="gecmis-listesi">${gecmis
                  .map((g) => {
                    const alanlar = Object.keys(g.degisiklikler || {}).filter((a) => a !== "kabul_durumu_guncellenme");
                    const durum = g.degisiklikler && g.degisiklikler.durum;
                    return `<li><span class="alan-ipucu">${new Date(g.zaman).toLocaleString("tr-TR")} · ${g.yapan_rol === "yonetici" ? "Yönetici" : g.yapan_rol === "uzman" ? "Uzman" : "Sistem"}</span>
                      ${
                        g.islem === "ekleme"
                          ? "Profil oluşturuldu"
                          : durum && durum.yeni
                            ? `Durum: ${esc((DURUMLAR[durum.eski] || {}).ad || durum.eski || "—")} → <strong>${esc((DURUMLAR[durum.yeni] || {}).ad || durum.yeni)}</strong>`
                            : `Değişen: ${alanlar.map((a) => esc(ALAN_ADLARI[a] || a)).join(", ")}`
                      }</li>`;
                  })
                  .join("")}</ul>`
              : `<p class="alan-ipucu">Kayıt yok.</p>`
          }
        </section>`;
      baglaOlaylar();
    }

    async function yenile(mesajId, metin, tur) {
      veri = await yukle();
      ciz();
      if (metin) Yonetim.mesaj(document.getElementById(mesajId), metin, tur);
    }

    async function bildir(karar, not) {
      try {
        const { data, error } = await sb.functions.invoke("karar-bildir", { body: { uzman_id: id, karar, not } });
        if (error) throw error;
        if (data && data.gonderildi) return " Uzmana bilgilendirme e-postası gönderildi.";
        if (data && data.neden === "ornek") return " (Örnek profil olduğu için e-posta gönderilmedi.)";
        return " Ancak bilgilendirme e-postası gönderilemedi; gerekirse uzmana ayrıca haber verin.";
      } catch (e) {
        console.error(e);
        return " Ancak bilgilendirme e-postası gönderilemedi; gerekirse uzmana ayrıca haber verin.";
      }
    }

    async function kararVer(karar) {
      const not = document.getElementById("kararNotu").value.trim();
      const m = document.getElementById("kararMesaj");
      if (["ek_belge", "reddedildi", "askida"].includes(karar) && not.length < 5) {
        Yonetim.mesaj(m, "Bu karar için uzmana kısa bir not yazın (en az 5 karakter).", "hata");
        document.getElementById("kararNotu").focus();
        return;
      }
      try {
        // 1) Uzmanın göreceği not
        const gizli = { uzman_id: id, ret_nedeni: null, yonetici_notu: null };
        if (karar === "reddedildi") gizli.ret_nedeni = not;
        if (karar === "ek_belge" || karar === "askida") gizli.yonetici_notu = not;
        const g = await sb.from("uzman_gizli").upsert(gizli, { onConflict: "uzman_id" });
        if (g.error) throw g.error;
        // 2) Bekleyen belgeler
        if (karar === "yayinda" || karar === "reddedildi") {
          const b = await sb
            .from("dogrulama_belgeleri")
            .update({ durum: karar === "yayinda" ? "onaylandi" : "reddedildi" })
            .eq("uzman_id", id)
            .eq("durum", "bekliyor");
          if (b.error) throw b.error;
        }
        // 3) Profil durumu
        const u = await sb.from("uzmanlar").update({ durum: karar }).eq("id", id);
        if (u.error) throw u.error;
        const ek = await bildir(karar, not);
        const ad = { yayinda: "Profil yayına alındı.", ek_belge: "Ek belge istendi.", reddedildi: "Başvuru reddedildi.", askida: "Profil askıya alındı." }[karar];
        await yenile("kararMesaj", ad + ek, "basari");
      } catch (e) {
        console.error(e);
        Yonetim.mesaj(m, "İşlem yapılamadı: " + Yonetim.hataMetni(e), "hata");
      }
    }

    function baglaOlaylar() {
      alan.querySelectorAll("[data-kopyala]").forEach((d) =>
        d.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(d.dataset.kopyala);
            d.textContent = "Kopyalandı";
          } catch (e) {
            d.textContent = "Kopyalanamadı";
          }
          setTimeout(() => (d.textContent = "Kopyala"), 2000);
        })
      );
      alan.querySelectorAll("[data-goster]").forEach((d) =>
        d.addEventListener("click", async () => {
          const pencere = window.open("", "_blank");
          const { data, error } = await sb.storage.from("dogrulama-belgeleri").createSignedUrl(d.dataset.goster, 60);
          if (error || !data) {
            if (pencere) pencere.close();
            Yonetim.mesaj(document.getElementById("belgeMesaj"), "Belge açılamadı. Dosya silinmiş olabilir.", "hata");
            return;
          }
          if (pencere) pencere.location = data.signedUrl;
          else location.href = data.signedUrl;
        })
      );
      alan.querySelectorAll("[data-belge]").forEach((d) =>
        d.addEventListener("click", async () => {
          const karar = d.dataset.karar;
          const not = karar === "reddedildi" ? document.getElementById("kararNotu").value.trim() || null : null;
          d.disabled = true;
          const { error } = await sb.from("dogrulama_belgeleri").update({ durum: karar, yonetici_notu: not }).eq("id", d.dataset.belge);
          if (error) {
            d.disabled = false;
            Yonetim.mesaj(document.getElementById("belgeMesaj"), "Belge güncellenemedi: " + Yonetim.hataMetni(error), "hata");
            return;
          }
          await yenile("belgeMesaj", karar === "onaylandi" ? "Belge kabul edildi." : "Belge kabul edilmedi olarak işaretlendi." + (not ? " (Karar notu belgeye eklendi.)" : ""), "basari");
        })
      );
      const bagla = (dugmeId, onayMetni, karar) => {
        const d = document.getElementById(dugmeId);
        if (d) Yonetim.onayliDugme(d, onayMetni, () => kararVer(karar));
      };
      bagla("onayla", "Emin misiniz? Onaylamak için tekrar basın", "yayinda");
      bagla("ekBelge", "Ek belge istemek için tekrar basın", "ek_belge");
      bagla("reddet", "Reddetmek için tekrar basın", "reddedildi");
      bagla("askiyaAl", "Askıya almak için tekrar basın", "askida");
    }

    ciz();
  });
})();
