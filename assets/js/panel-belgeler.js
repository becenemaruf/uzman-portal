/*
 * UZMAN PANELİ — BELGELER VE İNCELEMEYE GÖNDERME (panel.html#belgeler)
 *
 * - Belgeler gizli "dogrulama-belgeleri" deposunda, uzmanın kendi klasöründe tutulur.
 *   Yalnızca uzmanın kendisi ve yöneticiler görebilir; görüntüleme 60 saniyelik geçici bağlantıyla yapılır.
 * - "İncelemeye gönder": Profil eksiksiz ve iki diploma yüklenmişse açılır. Veritabanı da diplomaları ayrıca denetler.
 * - İnceleme sürerken uzman başvurusunu geri çekip düzeltme yapabilir.
 */
const Belgeler = (() => {
  const sb = Oturum.istemci;
  const DEPO = "dogrulama-belgeleri";
  const EN_FAZLA_MB = 10;
  const TURLER = {
    diploma: { ad: "Psikoloji lisans mezuniyeti", zorunlu: true },
    yuksek_lisans: { ad: "Klinik psikoloji yüksek lisans mezuniyeti", zorunlu: true },
    uzmanlik_belgesi: { ad: "Uzmanlık / unvan belgesi (varsa)", zorunlu: false },
    diger: { ad: "Diğer belge (ör. isim değişikliği, denklik)", zorunlu: false },
  };
  const DURUM = {
    bekliyor: { ad: "İnceleme bekliyor", sinif: "incelemede" },
    onaylandi: { ad: "Onaylandı", sinif: "yayinda" },
    reddedildi: { ad: "Kabul edilmedi", sinif: "uyari" },
  };

  let alan, profil, kullanici, belgeler = [], gizli = null;
  const $ = (id) => document.getElementById(id);

  function durumYaz(id, metin, tur = "bilgi") {
    const el = $(id);
    el.className = `mesaj mesaj-${tur}`;
    el.textContent = metin;
    el.hidden = !metin;
  }

  async function yukle() {
    const [p, b, g] = await Promise.all([
      sb.from("uzmanlar").select("id, slug, ad, soyad, unvan, durum").eq("id", profil.id).single(),
      sb.from("dogrulama_belgeleri").select("id, belge_turu, kaynak, dogrulama_kodu, dosya_yolu, durum, yonetici_notu, yuklenme").eq("uzman_id", profil.id).order("yuklenme"),
      sb.from("uzman_gizli").select("ret_nedeni, yonetici_notu").eq("uzman_id", profil.id).maybeSingle(),
    ]);
    if (p.error) throw p.error;
    if (b.error) throw b.error;
    profil = p.data;
    belgeler = b.data;
    gizli = g.data || null;
  }

  const gecerliVar = (tur) => belgeler.some((x) => x.belge_turu === tur && x.durum !== "reddedildi");

  function belgeSatiri(x) {
    const d = DURUM[x.durum] || DURUM.bekliyor;
    const silinebilir = x.durum === "bekliyor" && profil.durum !== "incelemede";
    const dosyaAdi = x.dosya_yolu.split("/").pop();
    return `<li class="belge-satir">
      <div class="belge-bilgi">
        <strong>${esc((TURLER[x.belge_turu] || TURLER.diger).ad)}</strong>
        <span class="alan-ipucu">${x.kaynak === "edevlet" ? `e-Devlet belgesi · doğrulama kodu: <code>${esc(x.dogrulama_kodu || "")}</code>` : "Diploma görüntüsü"} · ${esc(dosyaAdi)} · ${tarihMetni(x.yuklenme)}</span>
        ${x.yonetici_notu ? `<span class="belge-not">Yönetici notu: ${esc(x.yonetici_notu)}</span>` : ""}
      </div>
      <span class="panel-durum ${d.sinif}">${d.ad}</span>
      <div class="belge-dugmeler">
        <button class="btn btn-cizgi btn-kucuk" type="button" data-goster="${esc(x.dosya_yolu)}">Görüntüle</button>
        ${silinebilir ? `<button class="btn btn-cizgi btn-kucuk" type="button" data-sil="${x.id}" data-yol="${esc(x.dosya_yolu)}">Sil</button>` : ""}
      </div>
    </li>`;
  }

  function ciz(eksikler) {
    const incelemede = profil.durum === "incelemede";
    const yayinda = profil.durum === "yayinda";
    const yuklemeAcik = !incelemede;
    const kontrol = [
      ...eksikler.map((e) => ({ tamam: false, metin: e, baglanti: "#profil" })),
      { tamam: gecerliVar("diploma"), metin: TURLER.diploma.ad },
      { tamam: gecerliVar("yuksek_lisans"), metin: TURLER.yuksek_lisans.ad },
    ];
    const hazir = kontrol.every((k) => k.tamam);
    const notlar = [gizli && gizli.ret_nedeni, gizli && gizli.yonetici_notu].filter(Boolean);

    alan.innerHTML = `
      <nav class="kirinti" aria-label="Bulunduğunuz yer">
        <ol><li><a href="panel.html#">Panel</a></li><li><span aria-current="page">Belgeler ve inceleme</span></li></ol>
      </nav>
      <section class="panel-baslik">
        <div>
          <p class="bolum-ust-yazi">Uzman paneli</p>
          <h1>Belgeler ve inceleme</h1>
          <p class="soluk">Unvanınızın doğrulanması için mezuniyet belgelerinizi (e-Devlet ya da diploma) yükleyin ve profilinizi incelemeye gönderin.</p>
        </div>
      </section>

      ${
        notlar.length && ["ek_belge", "reddedildi"].includes(profil.durum)
          ? `<div class="mesaj mesaj-uyari"><strong>Yönetimden not:</strong> ${notlar.map(esc).join("<br>")}</div>`
          : ""
      }

      <div class="duzen-icerik">
        <section class="blok panel-kart">
          <h2>Belgelerim</h2>
          <p class="soluk duzen-aciklama">
            Lisans ve yüksek lisans mezuniyetleriniz için <strong>e-Devlet'ten alınan YÖK mezun belgesini</strong> yüklemenizi öneririz;
            her mezuniyet için ayrı belge oluşturulur. Diploma görüntüsü de kabul edilir (PDF, JPG ya da PNG; en fazla ${EN_FAZLA_MB} MB; tamamı okunur olmalıdır).
            Belgeleriniz <strong>yalnızca unvan doğrulaması için</strong> kullanılır; sitede yayımlanmaz ve yalnızca siz ile platform yönetimi görebilir.
            Ayrıntılar için <a href="kvkk-aydinlatma.html#uzmanlar" target="_blank" rel="noopener">KVKK Aydınlatma Metni</a>.
          </p>
          ${belgeler.length ? `<ul class="belge-listesi">${belgeler.map(belgeSatiri).join("")}</ul>` : `<p class="alan-ipucu">Henüz belge yüklemediniz.</p>`}
          ${
            yuklemeAcik
              ? `<form class="belge-yukle" id="belgeFormu" novalidate>
                  <div class="iki-sutun">
                    <div class="form-alani">
                      <label class="alan-etiket" for="belgeTuru">Belge türü</label>
                      <select class="girdi" id="belgeTuru">${Object.entries(TURLER)
                        .map(([k, v]) => `<option value="${k}">${v.ad}${v.zorunlu ? " *" : ""}</option>`)
                        .join("")}</select>
                    </div>
                    <div class="form-alani">
                      <label class="alan-etiket" for="belgeDosya">Dosya</label>
                      <input class="girdi" type="file" id="belgeDosya" accept="application/pdf,image/jpeg,image/png">
                    </div>
                  </div>
                  <fieldset class="secim-grubu">
                    <legend class="alan-etiket">Belge biçimi</legend>
                    <div class="kutucuklar kaynak-secim">
                      <label class="onay-kutusu"><input type="radio" name="kaynak" value="edevlet" checked> <span><strong>e-Devlet mezun belgesi</strong> (önerilen)<br><small class="alan-ipucu">e-Devlet → "YÖK Mezun Belgesi Sorgulama" → PDF olarak indirin.</small></span></label>
                      <label class="onay-kutusu"><input type="radio" name="kaynak" value="diploma"> <span><strong>Diploma</strong> taraması ya da fotoğrafı<br><small class="alan-ipucu">e-Devlet'te görünmeyen mezuniyetler için (ör. yurt dışı).</small></span></label>
                    </div>
                  </fieldset>
                  <div class="form-alani" id="kodAlani">
                    <label class="alan-etiket" for="belgeKodu">Belge doğrulama kodu</label>
                    <input class="girdi" id="belgeKodu" maxlength="64" autocomplete="off" spellcheck="false" placeholder="ör. YOK1A2B3C4D5E6F7">
                    <p class="alan-ipucu">e-Devlet belgesinin alt kısmında, karekodun yanında yazan "Barkod" ya da "Doğrulama Kodu". Yönetim bu kodla belgenin gerçekliğini e-Devlet üzerinden kontrol eder.</p>
                  </div>
                  <div class="mesaj" id="belgeDurum" role="status" hidden></div>
                  <div class="duzen-alt"><button class="btn btn-ana btn-kucuk" type="submit" id="belgeYukle">Belgeyi yükle</button></div>
                </form>`
              : `<p class="mesaj mesaj-bilgi">Başvurunuz incelenirken belge eklenemez ya da silinemez. Değişiklik yapmak için başvurunuzu geri çekebilirsiniz.</p>`
          }
        </section>

        <section class="blok panel-kart">
          <h2>${yayinda ? "Profiliniz yayında" : incelemede ? "Başvurunuz incelemede" : "İncelemeye gönder"}</h2>
          ${
            yayinda
              ? `<p class="soluk">Unvanınız doğrulandı ve profiliniz danışanlara görünüyor. Yeni bir belge eklemeniz gerekirse yukarıdan yükleyebilirsiniz.</p>`
              : incelemede
                ? `<p class="soluk">Profiliniz ve belgeleriniz yönetim tarafından inceleniyor. Sonuç e-posta ile bildirilecek.
                     Bu sürede profilinizi düzenleyebilirsiniz; ad, soyad ve unvanınız kilitlidir.</p>
                   <div class="mesaj" id="gonderDurum" role="status" hidden></div>
                   <button class="btn btn-cizgi btn-kucuk" type="button" id="geriCek">Başvuruyu geri çek</button>`
                : `<p class="soluk">Göndermeden önce aşağıdakilerin tamamlanmış olması gerekir:</p>
                   <ul class="gonder-kontrol">${kontrol
                     .map((k) => `<li class="${k.tamam ? "tamam" : ""}">${k.tamam ? ikon("onay") : "<span class='bos-daire'></span>"}${esc(k.metin)}${!k.tamam && k.baglanti ? ` <a href="${k.baglanti}">Tamamla</a>` : ""}</li>`)
                     .join("")}</ul>
                   <p class="alan-ipucu">Gönderdikten sonra <strong>ad, soyad ve unvanınız kilitlenir</strong>. Profilinizin diğer bölümlerini düzenlemeye devam edebilirsiniz.</p>
                   <div class="mesaj" id="gonderDurum" role="status" hidden></div>
                   <button class="btn btn-ana" type="button" id="gonder" ${hazir ? "" : "disabled"}>İncelemeye gönder</button>`
          }
        </section>
        <p class="duzen-son"><a class="btn btn-cizgi" href="panel.html#">Panele dön</a></p>
      </div>`;

    // İlk eksik zorunlu belge türü seçili gelsin
    const sec = $("belgeTuru");
    if (sec) {
      const ilkEksik = Object.keys(TURLER).find((k) => TURLER[k].zorunlu && !gecerliVar(k));
      if (ilkEksik) sec.value = ilkEksik;
    }
    baglaOlaylar();
  }

  function baglaOlaylar() {
    const form = $("belgeFormu");
    if (form) {
      form.addEventListener("submit", belgeYukle);
      const kodGoster = () => ($("kodAlani").hidden = form.querySelector('input[name="kaynak"]:checked').value !== "edevlet");
      form.querySelectorAll('input[name="kaynak"]').forEach((k) => k.addEventListener("change", kodGoster));
      kodGoster();
    }

    alan.querySelectorAll("[data-goster]").forEach((d) =>
      d.addEventListener("click", async () => {
        // Pencere önce açılır (açılır pencere engelleyicisi için), adres sonra verilir.
        const pencere = window.open("", "_blank");
        const { data, error } = await sb.storage.from(DEPO).createSignedUrl(d.dataset.goster, 60);
        if (error || !data) {
          if (pencere) pencere.close();
          if ($("belgeDurum")) durumYaz("belgeDurum", "Belge açılamadı. Lütfen tekrar deneyin.", "hata");
          return;
        }
        if (pencere) pencere.location = data.signedUrl;
        else location.href = data.signedUrl;
      })
    );

    alan.querySelectorAll("[data-sil]").forEach((d) => {
      let onay = false;
      d.addEventListener("click", async () => {
        if (!onay) {
          onay = true;
          d.textContent = "Silmek için tekrar basın";
          return;
        }
        d.disabled = true;
        const { error } = await sb.from("dogrulama_belgeleri").delete().eq("id", d.dataset.sil);
        if (!error) await sb.storage.from(DEPO).remove([d.dataset.yol]);
        await yenile();
      });
    });

    const gonder = $("gonder");
    if (gonder) {
      let onay = false;
      gonder.addEventListener("click", async () => {
        if (!onay) {
          onay = true;
          gonder.textContent = "Onaylıyorum, gönder";
          durumYaz("gonderDurum", "Bilgilerinizin doğru olduğundan emin olun. Göndermek için düğmeye tekrar basın.", "uyari");
          return;
        }
        gonder.disabled = true;
        const { error } = await sb.from("uzmanlar").update({ durum: "incelemede" }).eq("id", profil.id);
        if (error) {
          gonder.disabled = false;
          durumYaz("gonderDurum", error.message && /diploma/i.test(error.message) ? error.message : "Gönderilemedi. Lütfen tekrar deneyin.", "hata");
          return;
        }
        await yenile();
        durumYaz("gonderDurum", "Başvurunuz incelemeye gönderildi. Sonuç e-posta ile bildirilecek.", "basari");
      });
    }

    const geriCek = $("geriCek");
    if (geriCek) {
      let onay = false;
      geriCek.addEventListener("click", async () => {
        if (!onay) {
          onay = true;
          geriCek.textContent = "Geri çekmek için tekrar basın";
          return;
        }
        geriCek.disabled = true;
        const { error } = await sb.from("uzmanlar").update({ durum: "taslak" }).eq("id", profil.id);
        if (error) {
          geriCek.disabled = false;
          durumYaz("gonderDurum", "İşlem yapılamadı. Lütfen tekrar deneyin.", "hata");
          return;
        }
        await yenile();
      });
    }
  }

  async function belgeYukle(e) {
    e.preventDefault();
    const tur = $("belgeTuru").value;
    const kaynak = document.querySelector('input[name="kaynak"]:checked').value;
    const kod = $("belgeKodu").value.replace(/\s+/g, "").trim();
    const dosya = $("belgeDosya").files[0];
    const dugme = $("belgeYukle");
    if (!dosya) return durumYaz("belgeDurum", "Önce bir dosya seçin.", "hata");
    if (kaynak === "edevlet" && !/^[A-Za-z0-9-]{4,64}$/.test(kod))
      return durumYaz("belgeDurum", "e-Devlet belgesindeki doğrulama kodunu yazın (yalnızca harf, rakam ve tire).", "hata");
    if (!/^(application\/pdf|image\/jpeg|image\/png)$/.test(dosya.type)) return durumYaz("belgeDurum", "Yalnızca PDF, JPG ya da PNG yükleyebilirsiniz.", "hata");
    if (dosya.size > EN_FAZLA_MB * 1024 * 1024) return durumYaz("belgeDurum", `Dosya ${EN_FAZLA_MB} MB'tan büyük olamaz. Telefonla çektiyseniz daha düşük çözünürlükte deneyin ya da PDF'e çevirin.`, "hata");
    const uzanti = dosya.type === "application/pdf" ? "pdf" : dosya.type === "image/png" ? "png" : "jpg";
    const yol = `${kullanici.id}/${tur}-${Date.now()}.${uzanti}`;
    dugme.disabled = true;
    dugme.textContent = "Yükleniyor…";
    try {
      const { error: yErr } = await sb.storage.from(DEPO).upload(yol, dosya, { contentType: dosya.type, upsert: false });
      if (yErr) throw yErr;
      const { error } = await sb.from("dogrulama_belgeleri").insert({ uzman_id: profil.id, belge_turu: tur, dosya_yolu: yol, kaynak, dogrulama_kodu: kaynak === "edevlet" ? kod : null });
      if (error) {
        await sb.storage.from(DEPO).remove([yol]);
        throw error;
      }
      await yenile();
      durumYaz("belgeDurum", "Belge yüklendi.", "basari");
    } catch (h) {
      console.error(h);
      durumYaz("belgeDurum", "Belge yüklenemedi. Lütfen tekrar deneyin.", "hata");
      dugme.disabled = false;
      dugme.textContent = "Belgeyi yükle";
    }
  }

  async function yenile() {
    await yukle();
    const eksik = await ProfilDuzenle.eksikler(profil.id).catch(() => []);
    ciz(eksik);
  }

  async function ac(hedef, p, kul) {
    alan = hedef;
    profil = p;
    kullanici = kul;
    alan.innerHTML = `<p role="status">Belgeleriniz yükleniyor…</p>`;
    await yenile();
  }

  return { ac };
})();
