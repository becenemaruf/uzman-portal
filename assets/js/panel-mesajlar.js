/*
 * UZMAN PANELİ — MESAJLARIM (panel.html#mesajlar)
 * Profilde "Uzmana Mesaj Gönder" formu (uzman tüm iletişim kanallarını kapattığında çıkar) ile
 * gelen mesajlar burada okunur. Uzman danışana doğrudan, danışanın bıraktığı e-posta ya da telefonla döner;
 * platform üzerinden yanıt gönderilmez. Mesajlar 90 gün sonra otomatik silinir; uzman daha önce silebilir.
 * Yalnızca uzmanın kendisi okuyabilir (veritabanı güvenlik kuralı).
 */
const Mesajlar = (() => {
  const sb = Oturum.istemci;
  const SAKLAMA_GUN = 90;

  async function okunmamisSayisi(uzmanId) {
    const { count, error } = await sb
      .from("iletisim_mesajlari")
      .select("id", { count: "exact", head: true })
      .eq("uzman_id", uzmanId)
      .eq("okundu", false);
    if (error) return 0;
    return count || 0;
  }

  const telefonYaz = (t) => String(t || "").replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4");
  const kalanGun = (t) => Math.max(0, SAKLAMA_GUN - Math.floor((Date.now() - new Date(t).getTime()) / 86400000));

  async function ac(alan, profil) {
    alan.innerHTML = `<p role="status">Mesajlarınız yükleniyor…</p>`;
    const { data, error } = await sb
      .from("iletisim_mesajlari")
      .select("id, gonderen_ad, gonderen_eposta, gonderen_telefon, mesaj, okundu, olusturulma")
      .eq("uzman_id", profil.id)
      .order("olusturulma", { ascending: false });
    if (error) throw error;
    let mesajlar = data;

    function satir(m) {
      const tel = m.gonderen_telefon ? String(m.gonderen_telefon).replace(/\D/g, "") : "";
      const wa = tel ? (tel.startsWith("0") ? "90" + tel.slice(1) : tel) : "";
      return `<li class="mesaj-kart ${m.okundu ? "" : "okunmamis"}" data-id="${esc(m.id)}">
        <details ${m.okundu ? "" : ""}>
          <summary>
            <span class="mesaj-kart-bas">
              ${m.okundu ? "" : `<span class="yeni-nokta" aria-hidden="true"></span><span class="gorunmez">Okunmamış: </span>`}
              <strong>${esc(m.gonderen_ad || "İsimsiz")}</strong>
              <span class="alan-ipucu">${new Date(m.olusturulma).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
            </span>
            <span class="mesaj-onizleme">${esc(String(m.mesaj || "").slice(0, 90))}${String(m.mesaj || "").length > 90 ? "…" : ""}</span>
          </summary>
          <div class="mesaj-govde">
            <p class="on-metin">${esc(m.mesaj || "")}</p>
            <div class="mesaj-donus">
              ${m.gonderen_eposta ? `<a class="btn btn-ana btn-kucuk" href="mailto:${esc(m.gonderen_eposta)}?subject=${encodeURIComponent("Mesajınız hakkında")}">${ikon("posta")}E-posta ile yanıtla</a>` : ""}
              ${tel ? `<a class="btn btn-cizgi btn-kucuk" href="tel:${esc(tel)}">${ikon("telefon")}${esc(telefonYaz(tel))}</a>` : ""}
              ${wa ? `<a class="btn btn-cizgi btn-kucuk" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">${ikon("mesaj")}WhatsApp</a>` : ""}
              <button class="btn btn-cizgi btn-kucuk tehlike" type="button" data-sil="${esc(m.id)}">Sil</button>
            </div>
            <p class="alan-ipucu">${m.gonderen_eposta ? esc(m.gonderen_eposta) : ""}${m.gonderen_eposta && tel ? " · " : ""}${tel ? esc(telefonYaz(tel)) : ""}
              · Bu mesaj ${kalanGun(m.olusturulma)} gün sonra otomatik silinecek.</p>
          </div>
        </details>
      </li>`;
    }

    function ciz() {
      const okunmamis = mesajlar.filter((m) => !m.okundu).length;
      alan.innerHTML = `
        <nav class="kirinti" aria-label="Bulunduğunuz yer">
          <ol><li><a href="panel.html#">Panel</a></li><li><span aria-current="page">Mesajlarım</span></li></ol>
        </nav>
        <section class="panel-baslik">
          <div>
            <p class="bolum-ust-yazi">Uzman paneli</p>
            <h1>Mesajlarım</h1>
            <p class="soluk">${mesajlar.length ? `${mesajlar.length} mesaj${okunmamis ? `, ${okunmamis} okunmamış` : ""}.` : "Henüz mesajınız yok."}</p>
          </div>
        </section>
        <div class="mesaj mesaj-bilgi">
          Bu mesajlar profilinizdeki <strong>"Uzmana Mesaj Gönder"</strong> formundan gelir. Form, iletişim tercihlerinde hiçbir kanalı (telefon, WhatsApp, e-posta)
          açmadığınızda profilinizde görünür. Danışana, bıraktığı e-posta ya da telefonla <strong>doğrudan siz</strong> dönersiniz.
          Mesajlar ${SAKLAMA_GUN} gün sonra otomatik silinir. Mesajlarda sağlık bilgisi olabilir; lütfen ekran görüntüsü alıp paylaşmayın.
        </div>
        ${mesajlar.length ? `<ul class="mesaj-listesi">${mesajlar.map(satir).join("")}</ul>` : `<p class="bos-not">Yeni mesaj geldiğinde burada görünecek ve size e-postayla haber verilecek.</p>`}
        <div class="mesaj" id="mesajDurum" role="status" hidden></div>
        <p class="duzen-son"><a class="btn btn-cizgi" href="panel.html#">Panele dön</a></p>`;
      baglaOlaylar();
    }

    function baglaOlaylar() {
      alan.querySelectorAll(".mesaj-kart details").forEach((d) =>
        d.addEventListener("toggle", async () => {
          if (!d.open) return;
          const li = d.closest(".mesaj-kart");
          const m = mesajlar.find((x) => x.id === li.dataset.id);
          if (!m || m.okundu) return;
          const { error } = await sb.from("iletisim_mesajlari").update({ okundu: true }).eq("id", m.id);
          if (!error) {
            m.okundu = true;
            li.classList.remove("okunmamis");
            li.querySelectorAll(".yeni-nokta, .gorunmez").forEach((x) => x.remove());
          }
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
          const { error } = await sb.from("iletisim_mesajlari").delete().eq("id", d.dataset.sil);
          if (error) {
            d.disabled = false;
            const k = document.getElementById("mesajDurum");
            k.className = "mesaj mesaj-hata";
            k.textContent = "Mesaj silinemedi. Lütfen tekrar deneyin.";
            k.hidden = false;
            return;
          }
          mesajlar = mesajlar.filter((x) => x.id !== d.dataset.sil);
          ciz();
        });
      });
    }

    ciz();
  }

  return { ac, okunmamisSayisi };
})();
