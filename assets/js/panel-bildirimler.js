/*
 * UZMAN PANELİ — BİLDİRİM MERKEZİ (panel.html#bildirimler)
 *  - Üst menüde bildirim zili ve okunmamış sayısı
 *  - Okunmamış KRİTİK bildirimler panelin üstünde şerit olarak (paneli kullanmayı engellemeden)
 *  - Bildirim listesi, açınca okundu, "tümünü okundu işaretle"
 *  - Bildirim tercihleri: e-posta (kritik olmayanlar için kapatılabilir), SMS (açık izin + numara)
 * Uzman yalnızca kendisine gönderilmiş, kaldırılmamış ve süresi dolmamış bildirimleri görür (veritabanı kuralı).
 */
const Bildirimler = (() => {
  const sb = Oturum.istemci;
  const TURLER = { teknik: "Teknik aksaklık", guvenlik: "Güvenlik bildirimi", bakim: "Planlı bakım", guncelleme: "Sistem güncellemesi", genel: "Genel bilgilendirme" };
  const ONCELIK = { onemli: "Önemli", kritik: "Kritik" };
  const zaman = (t) => new Date(t).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  async function getir(uzmanId) {
    const { data, error } = await sb
      .from("bildirim_alicilari")
      .select("id, okundu_zamani, sistem_bildirimleri!inner(id, baslik, metin, tur, oncelik, gonderim_zamani, guncellendi, kanal_panel)")
      .eq("uzman_id", uzmanId)
      .eq("sistem_bildirimleri.kanal_panel", true);
    if (error) throw error;
    return (data || [])
      .map((a) => ({ alici: a.id, okundu: !!a.okundu_zamani, ...a.sistem_bildirimleri }))
      .sort((a, b) => String(b.gonderim_zamani).localeCompare(String(a.gonderim_zamani)));
  }

  async function okunduYap(aliciIdleri) {
    if (!aliciIdleri.length) return true;
    const { error } = await sb.from("bildirim_alicilari").update({ okundu_zamani: new Date().toISOString() }).in("id", aliciIdleri);
    return !error;
  }

  // ---------- Üst menüdeki zil ----------
  function zilCiz(sayi) {
    const kutu = document.querySelector(".menu-butonlar");
    if (!kutu) return;
    let zil = document.getElementById("bildirimZili");
    if (!zil) {
      zil = document.createElement("a");
      zil.id = "bildirimZili";
      zil.className = "zil-dugme";
      zil.href = "panel.html#bildirimler";
      kutu.prepend(zil);
    }
    zil.innerHTML = `${ikon("zil")}<span class="zil-yazi">Bildirimler</span>${sayi ? `<span class="zil-sayi">${sayi > 9 ? "9+" : sayi}</span>` : ""}`;
    zil.setAttribute("aria-label", sayi ? `Bildirimler, ${sayi} okunmamış` : "Bildirimler");
    // Mobilde zil menünün içinde kalır; menü düğmesinde küçük bir işaret gösterilir.
    const menu = document.querySelector(".menu-dugme");
    if (menu) menu.classList.toggle("bildirim-var", sayi > 0);
  }

  // ---------- Panelin üstünde kritik bildirim şeridi ----------
  function kritikSerit(alan, liste) {
    const eski = document.getElementById("kritikSerit");
    if (eski) eski.remove();
    const kritik = liste.filter((b) => b.oncelik === "kritik" && !b.okundu);
    if (!kritik.length || location.hash === "#bildirimler") return;
    const b = kritik[0];
    const serit = document.createElement("section");
    serit.id = "kritikSerit";
    serit.className = "kritik-serit";
    serit.setAttribute("role", "region");
    serit.setAttribute("aria-label", "Kritik bildirim");
    serit.innerHTML = `
      <div class="kritik-serit-ic">
        <span class="kritik-ikon" aria-hidden="true">${ikon("zil")}</span>
        <div><strong>${esc(b.baslik)}</strong><p>${esc(b.metin.length > 220 ? b.metin.slice(0, 220) + "…" : b.metin)}</p></div>
      </div>
      <div class="kritik-dugmeler">
        <a class="btn btn-cizgi btn-kucuk" href="#bildirimler">${kritik.length > 1 ? `Tümünü gör (${kritik.length})` : "Ayrıntı"}</a>
        <button class="btn btn-ana btn-kucuk" type="button" data-okudum="${b.alici}">Okudum</button>
      </div>`;
    alan.prepend(serit);
    serit.querySelector("[data-okudum]").addEventListener("click", async () => {
      if (await okunduYap([b.alici])) {
        b.okundu = true;
        kritikSerit(alan, liste);
        zilCiz(liste.filter((x) => !x.okundu).length);
      }
    });
  }

  // Her panel görünümünden sonra çağrılır: zil + kritik şerit
  async function guncelle(alan, profil) {
    try {
      const liste = await getir(profil.id);
      zilCiz(liste.filter((b) => !b.okundu).length);
      kritikSerit(alan, liste);
    } catch (e) {
      console.warn("Bildirimler okunamadı:", e);
    }
  }

  // ---------- Bildirim merkezi ----------
  async function ac(alan, profil) {
    alan.innerHTML = `<p role="status">Bildirimleriniz yükleniyor…</p>`;
    const [liste, t] = await Promise.all([getir(profil.id), sb.from("uzman_bildirim_tercihleri").select("*").eq("uzman_id", profil.id).maybeSingle()]);
    const tercih = t.data || { eposta: true, sms: false, sms_telefon: null };

    function kart(b) {
      return `<li class="bildirim-kart oncelik-${esc(b.oncelik)} ${b.okundu ? "" : "okunmamis"}" data-alici="${b.alici}">
        <details>
          <summary>
            <span class="bildirim-kart-bas">
              ${b.okundu ? "" : `<span class="yeni-nokta" aria-hidden="true"></span><span class="gorunmez">Okunmamış: </span>`}
              <span class="bildirim-tur">${esc(TURLER[b.tur] || "")}</span>
              ${ONCELIK[b.oncelik] ? `<span class="oncelik-rozet oncelik-${esc(b.oncelik)}">${ONCELIK[b.oncelik]}</span>` : ""}
              <span class="alan-ipucu">${esc(zaman(b.gonderim_zamani))}</span>
            </span>
            <strong>${esc(b.baslik)}</strong>
          </summary>
          <div class="bildirim-govde"><p class="on-metin">${esc(b.metin)}</p>${b.guncellendi ? `<p class="alan-ipucu">Bu bildirim yönetim tarafından güncellendi.</p>` : ""}</div>
        </details>
      </li>`;
    }

    function ciz() {
      const okunmamis = liste.filter((b) => !b.okundu).length;
      alan.innerHTML = `
        <nav class="kirinti" aria-label="Bulunduğunuz yer"><ol><li><a href="panel.html#">Panel</a></li><li><span aria-current="page">Bildirimler</span></li></ol></nav>
        <section class="panel-baslik">
          <div><p class="bolum-ust-yazi">Uzman paneli</p><h1>Bildirimler</h1>
            <p class="soluk">Platform yönetiminden gelen sistem bildirimleri: teknik aksaklıklar, planlı bakımlar, güvenlik ve önemli güncellemeler.</p></div>
          ${okunmamis ? `<button class="btn btn-cizgi btn-kucuk" type="button" id="tumunuOku">Tümünü okundu işaretle (${okunmamis})</button>` : ""}
        </section>
        ${liste.length ? `<ul class="bildirim-listesi">${liste.map(kart).join("")}</ul>` : `<p class="bos-not">Henüz bildiriminiz yok.</p>`}

        <form class="blok panel-kart" id="tercihFormu" novalidate>
          <h2>Bildirim tercihleri</h2>
          <p class="soluk duzen-aciklama">Bu bildirimler hesabınız ve platform hizmetiyle ilgili bilgilendirmelerdir; reklam ya da ticari ileti gönderilmez.</p>
          <label class="anahtar anahtar-genis"><input type="checkbox" id="tEposta" ${tercih.eposta ? "checked" : ""}>
            <span><strong>Bildirimleri e-postayla da al</strong><small>Kapatırsanız normal ve önemli bildirimler yalnızca panelinizde görünür. Güvenliğinizi ilgilendiren <strong>kritik</strong> bildirimler her durumda e-postayla gönderilir.</small></span></label>
          <hr class="ayrac">
          <label class="anahtar anahtar-genis"><input type="checkbox" id="tSms" ${tercih.sms ? "checked" : ""}>
            <span><strong>Önemli ve kritik bildirimleri SMS ile almak istiyorum</strong><small>İsteğe bağlıdır. İzin verdiğiniz an kaydedilir; istediğiniz zaman kapatabilirsiniz. Numaranız yalnızca bu amaçla kullanılır ve profilinizde görünmez.</small></span></label>
          <div class="form-alani" id="smsNumara" ${tercih.sms ? "" : "hidden"}>
            <label class="alan-etiket" for="tTelefon">SMS gönderilecek cep telefonu</label>
            <input class="girdi" id="tTelefon" type="tel" inputmode="tel" autocomplete="tel" placeholder="05xx xxx xx xx" value="${esc(tercih.sms_telefon || "")}">
          </div>
          <div class="mesaj" id="tDurum" role="status" hidden></div>
          <div class="duzen-alt"><button class="btn btn-ana btn-kucuk" type="submit">Tercihleri kaydet</button></div>
        </form>
        <p class="duzen-son"><a class="btn btn-cizgi" href="panel.html#">Panele dön</a></p>`;
      bagla();
    }

    function bagla() {
      alan.querySelectorAll(".bildirim-kart details").forEach((d) =>
        d.addEventListener("toggle", async () => {
          if (!d.open) return;
          const li = d.closest(".bildirim-kart");
          const b = liste.find((x) => String(x.alici) === li.dataset.alici);
          if (!b || b.okundu) return;
          if (await okunduYap([b.alici])) {
            b.okundu = true;
            li.classList.remove("okunmamis");
            li.querySelectorAll(".yeni-nokta, .gorunmez").forEach((x) => x.remove());
            zilCiz(liste.filter((x) => !x.okundu).length);
          }
        })
      );
      const tum = document.getElementById("tumunuOku");
      if (tum)
        tum.addEventListener("click", async () => {
          tum.disabled = true;
          if (await okunduYap(liste.filter((b) => !b.okundu).map((b) => b.alici))) {
            liste.forEach((b) => (b.okundu = true));
            zilCiz(0);
            ciz();
          } else tum.disabled = false;
        });
      document.getElementById("tSms").addEventListener("change", (e) => (document.getElementById("smsNumara").hidden = !e.target.checked));
      document.getElementById("tercihFormu").addEventListener("submit", async (e) => {
        e.preventDefault();
        const d = document.getElementById("tDurum");
        const yaz = (metin, tur) => {
          d.className = `mesaj mesaj-${tur}`;
          d.textContent = metin;
          d.hidden = false;
        };
        const sms = document.getElementById("tSms").checked;
        let tel = document.getElementById("tTelefon").value.replace(/\D/g, "");
        if (tel.startsWith("90") && tel.length === 12) tel = "0" + tel.slice(2);
        if (tel.length === 10 && tel.startsWith("5")) tel = "0" + tel;
        if (sms && !/^05\d{9}$/.test(tel)) return yaz("SMS için geçerli bir cep telefonu yazın (05xx xxx xx xx).", "hata");
        const kayit = { uzman_id: profil.id, eposta: document.getElementById("tEposta").checked, sms, sms_telefon: sms ? tel : null };
        const { error } = await sb.from("uzman_bildirim_tercihleri").upsert(kayit, { onConflict: "uzman_id" });
        if (error) return yaz("Kaydedilemedi. Lütfen tekrar deneyin.", "hata");
        Object.assign(tercih, kayit);
        yaz("Bildirim tercihleriniz kaydedildi.", "basari");
      });
    }

    ciz();
    zilCiz(liste.filter((b) => !b.okundu).length);
  }

  return { ac, guncelle };
})();
