/*
 * GÜVENLİ HTML
 * Yönetici panelinde düzenlenen sayfa metinleri hem KAYDEDİLMEDEN önce hem de sitede
 * GÖSTERİLMEDEN önce DOMPurify ile temizlenir. Yalnızca düz metin biçimlendirmesine
 * (başlık, paragraf, kalın, italik, liste, bağlantı, tablo) izin verilir; betik, form,
 * gömülü içerik, stil ve olay öznitelikleri (onclick vb.) her zaman silinir.
 * Gerekli dosya: assets/vendor/dompurify/purify.min.js
 */
const GuvenliHtml = (() => {
  const AYAR = {
    ALLOWED_TAGS: [
      "h2", "h3", "h4", "p", "br", "hr", "strong", "b", "em", "i", "u", "small", "span", "div", "section",
      "ul", "ol", "li", "a", "blockquote", "table", "caption", "thead", "tbody", "tr", "th", "td", "time", "code",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "id", "class", "scope", "colspan", "rowspan", "datetime", "title", "data-ayar", "data-ayar-yoksa"],
    ALLOW_DATA_ATTR: false,
    // Bağlantılar: http(s), e-posta, telefon, sayfa içi çapa ya da sitenin kendi sayfaları
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/|mailto:|tel:|#|[a-z0-9-]+\.html(?:[?#]|$))/i,
  };

  let kancaKuruldu = false;
  function kancaKur() {
    if (kancaKuruldu || !window.DOMPurify) return;
    // Yeni sekmede açılan bağlantılara her zaman güvenli "rel" eklenir.
    DOMPurify.addHook("afterSanitizeAttributes", (dugum) => {
      if (dugum.tagName === "A" && dugum.getAttribute("target")) {
        dugum.setAttribute("target", "_blank");
        dugum.setAttribute("rel", "noopener noreferrer");
      }
      // Sınıf adlarında yalnızca harf, rakam, tire
      if (dugum.hasAttribute && dugum.hasAttribute("class")) {
        const temiz = dugum.getAttribute("class").split(/\s+/).filter((c) => /^[a-z0-9-]{1,40}$/i.test(c)).join(" ");
        if (temiz) dugum.setAttribute("class", temiz);
        else dugum.removeAttribute("class");
      }
    });
    kancaKuruldu = true;
  }

  function temizle(html) {
    if (!window.DOMPurify) throw new Error("Güvenlik kitaplığı yüklenemedi.");
    kancaKur();
    return DOMPurify.sanitize(String(html || ""), AYAR);
  }

  // Word ya da başka bir siteden yapıştırılan içerik: yalnızca yapı kalır (sınıf, kimlik, tablo düzeni gelmez).
  function yapistirilaniTemizle(html) {
    if (!window.DOMPurify) throw new Error("Güvenlik kitaplığı yüklenemedi.");
    kancaKur();
    const temiz = DOMPurify.sanitize(String(html || ""), {
      ...AYAR,
      ALLOWED_TAGS: ["h2", "h3", "p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "blockquote"],
      ALLOWED_ATTR: ["href"],
    });
    return temiz.replace(/<p>\s*(?:&nbsp;)?\s*<\/p>/g, "");
  }

  return { temizle, yapistirilaniTemizle };
})();
