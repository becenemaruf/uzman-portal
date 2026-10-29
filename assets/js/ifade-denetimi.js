/*
 * İFADE DENETİMİ (reklam dili ve sağlık okuryazarlığı kontrolü)
 *
 * Uzmanın profil metinlerinde, sağlık hizmetleri tanıtım mevzuatı ve sağlık okuryazarlığı açısından
 * sorunlu olabilecek ifadeleri bulur ve bir öneri sunar. Karar vermez, uyarır: Son değerlendirme
 * yönetici onayında yapılır.
 *
 * Kurallar bilinçli olarak geniştir; "yanlış alarm" durumunda uzman metni yine de kaydedebilir.
 * Yeni kural eklemek için KURALLAR dizisine bir satır eklemek yeterlidir.
 */
const IfadeDenetimi = (() => {
  // Türkçe harfleri de "kelime harfi" sayan sınırlar (JavaScript'in \b'si Türkçe harfleri tanımaz).
  const H = "a-zçğıöşüâîû0-9";
  const bas = `(?<![${H}])`;
  const kel = (govde, ek = `[${H}]*`) => new RegExp(`${bas}(${govde})${ek}`, "giu");

  const KURALLAR = [
    // 1) Tıbbi / hastalık odaklı dil
    { desen: kel("muayene"), tur: "Tıbbi dil", neden: "Klinik psikologlar muayene yapmaz; bu ifade yanıltıcı olabilir.", oneri: "\"görüşme\", \"seans\" ya da \"değerlendirme\" deyin." },
    { desen: kel("tedavi"), tur: "Tıbbi dil", neden: "\"Tedavi\" tıbbi bir kavramdır ve sonuç vaadi gibi algılanabilir.", oneri: "\"terapi süreci\", \"psikoterapi\" ya da \"birlikte çalışma\" deyin." },
    { desen: new RegExp(`${bas}(hasta)(?!ne)[${H}]*`, "giu"), tur: "Tıbbi dil", neden: "Psikoterapide başvuran kişiler \"hasta\" olarak anılmaz.", oneri: "\"danışan\" deyin." },
    { desen: kel("şifa|iyileştir|iyileşme garantisi"), tur: "Sonuç vaadi", neden: "İyileşme ya da şifa vaadi tanıtım mevzuatına aykırıdır.", oneri: "Çalışma biçiminizi anlatın; sonuç vaat etmeyin." },

    // 2) Üstünlük ve karşılaştırma
    { desen: kel("en (iyi|başarılı|deneyimli|tecrübeli|uzman|etkili|güvenilir|bilinen)", ""), tur: "Üstünlük iddiası", neden: "Başkalarıyla karşılaştırma ve üstünlük iddiası reklam sayılır.", oneri: "Bu ifadeyi çıkarın; eğitiminizi ve çalışma alanınızı nesnel olarak yazın." },
    { desen: kel("(ilk ve (tek|en)|türkiye['’]?(nin|de|deki)? (ilk|tek|en)|dünyanın (en|ilk)|alanında (öncü|lider|tek)|tek (uzman|yetkili)|bir numara|lider)", ""), tur: "Üstünlük iddiası", neden: "\"İlk, tek, öncü, en\" gibi iddialar reklam dilidir ve doğrulanamaz.", oneri: "Bu ifadeyi çıkarın." },
    { desen: kel("dünyaca (ünlü|tanınmış)|uluslararası (alanda )?(ünlü|tanınmış)|ünlü (hoca|uzman)", ""), tur: "Üstünlük iddiası", neden: "Eğitim aldığınız kişileri ya da kendinizi övmek reklam sayılabilir.", oneri: "Yalnızca eğitimin adını, kurumunu ve yılını yazın." },
    { desen: kel("mükemmel|harika|muhteşem|olağanüstü|eşsiz|benzersiz|mucize"), tur: "Abartılı ifade", neden: "Abartılı sıfatlar tanıtım değil reklam dilidir.", oneri: "Nesnel ve sade bir anlatım kullanın." },

    // 3) Sonuç garantisi
    { desen: kel("garanti"), tur: "Sonuç vaadi", neden: "Psikoterapide sonuç garanti edilemez; bu ifade yasaktır.", oneri: "Bu ifadeyi çıkarın." },
    { desen: kel("kesin (çözüm|sonuç|iyileşme)|kalıcı çözüm|hızlı (sonuç|çözüm)|%\\s?100|yüzde yüz|sorunlarınızdan kurtul", ""), tur: "Sonuç vaadi", neden: "Kesin, kalıcı ya da hızlı sonuç vaadi tanıtım mevzuatına aykırıdır.", oneri: "Sürecin kişiye göre değiştiğini belirtin; sonuç vaat etmeyin." },
    { desen: kel("(\\d+|birkaç|tek|bir) seansta", ""), tur: "Sonuç vaadi", neden: "Belirli sayıda seansta sonuç vaadi yanıltıcıdır.", oneri: "Seans sayısının kişiye göre değiştiğini yazın." },

    // 4) Danışan memnuniyeti ve yorumlar
    { desen: kel("danışan(lar)?(ım|ımız)?( hakkımda| hakkımızda| ne düşünüyor| memnun| yorum)", ""), tur: "Danışan memnuniyeti", neden: "Danışan görüşlerine ve memnuniyetine yer vermek mevzuat gereği yasaktır.", oneri: "Bu bölümü çıkarın." },
    { desen: kel("memnuniyet|teşekkür mesaj|referanslar|başarı hikaye|yorumlar"), tur: "Danışan memnuniyeti", neden: "Memnuniyet, referans ve başarı hikâyeleri reklam niteliğindedir.", oneri: "Bu bölümü çıkarın." },
    { desen: kel("(binlerce|yüzlerce|\\d+[.,]?\\d*\\+?) (danışan|kişi|aile|çift)", ""), tur: "Sayısal iddia", neden: "Danışan sayısı belirtmek reklam ve üstünlük iddiası sayılır.", oneri: "Bu ifadeyi çıkarın." },

    // 5) Ticari teşvik
    { desen: kel("indirim|kampanya|ücretsiz|bedava|hediye|fırsat|fiyat|ücret|\\d+\\s?(tl|₺)", ""), tur: "Ticari ifade", neden: "Fiyat, indirim ve kampanya bilgisi profilde yer alamaz.", oneri: "Bu ifadeyi çıkarın." },

    // 6) İletişim tercihlerini aşan bilgiler
    { desen: /(?:\+?90|0)\s?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g, tur: "İletişim bilgisi", neden: "Telefon numarası metne yazılırsa iletişim tercihleriniz devre dışı kalır.", oneri: "Numarayı \"İletişim tercihleri\" bölümünden ekleyin." },
    { desen: /[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, tur: "İletişim bilgisi", neden: "E-posta adresi metne yazılırsa iletişim tercihleriniz devre dışı kalır.", oneri: "Adresi \"İletişim tercihleri\" bölümünden ekleyin." },
    { desen: /(https?:\/\/|www\.)\S+/gi, tur: "Bağlantı", neden: "Metin içi bağlantılar profilde gösterilmez.", oneri: "Web sitenizi ve hesaplarınızı \"Sosyal medya\" bölümüne ekleyin." },
  ];

  /* Metni tarar; her bulgu: { ifade, tur, neden, oneri } (aynı ifade bir kez listelenir). */
  function tara(metin) {
    const bulgular = [];
    const gorulen = new Set();
    const m = String(metin || "");
    KURALLAR.forEach((k) => {
      k.desen.lastIndex = 0;
      let es;
      while ((es = k.desen.exec(m))) {
        const ifade = es[0].trim();
        const anahtar = k.tur + "|" + ifade.toLocaleLowerCase("tr");
        if (ifade && !gorulen.has(anahtar)) {
          gorulen.add(anahtar);
          bulgular.push({ ifade, tur: k.tur, neden: k.neden, oneri: k.oneri });
        }
        if (es[0].length === 0) k.desen.lastIndex++;
      }
    });
    return bulgular;
  }

  function html(bulgular) {
    if (!bulgular.length) return `<p class="ifade-temiz">${ikon("onay")}Reklam dili ya da tıbbi ifade bulunmadı.</p>`;
    return `<div class="ifade-uyari">
      <strong>${bulgular.length} ifadeyi gözden geçirmenizi öneriyoruz</strong>
      <ul>${bulgular
        .map((b) => `<li><span class="ifade-kelime">“${esc(b.ifade)}”</span> <span class="ifade-tur">${esc(b.tur)}</span><br>${esc(b.neden)} <em>Öneri: ${esc(b.oneri)}</em></li>`)
        .join("")}</ul>
    </div>`;
  }

  return { tara, html };
})();
