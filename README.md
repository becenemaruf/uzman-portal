# Klinik Psikologlar (klinikpsikologlar.com.tr)

Türkiye'nin klinik psikolog rehberi: Unvanı doğrulanmış klinik psikologların profil oluşturup danışanlara görünürlüklerini artırabildikleri platform.

> **Kapsam kararı (28 Ekim 2026):** Platform yalnızca klinik psikologlarla yayına başlıyor. Altyapı diğer meslekleri (psikolog, PDR, psikiyatrist, sosyal hizmet uzmanı, dil ve konuşma terapisti, ergoterapist, özel eğitim uzmanı, çocuk gelişimci) desteklemeye devam ediyor; bunlar **silinmedi, gizlendi**. Yeni bir mesleğe açılmak için `assets/js/ayarlar.js` içindeki `AKTIF_UNVANLAR` listesine eklemek ve veritabanında ilgili çalışma alanlarını `aktif = true` yapmak yeterli (`supabase/ornek-veri/klinik_psikolog_donusumu.sql`).

## Yol haritası

| Aşama | İçerik | Durum |
|---|---|---|
| 1 | Proje iskeleti ve klasör yapısı | ✅ Tamam |
| 2 | Herkese açık uzman dizini (arama, filtreler, kartlar) ve profil sayfası — örnek verilerle | ✅ İlk taslak |
| 3 | Uzman Girişi ekranları: giriş, kayıt, e-posta doğrulama, şifremi unuttum, CAPTCHA yeri | ✅ İlk taslak (sunucusuz) |
| 4 | Uzman paneli: profil düzenleme, fotoğraf, yazılar, görünürlük istatistikleri | — |
| 5 | Yönetici paneli: unvan/diploma doğrulama, profil onayı | — |
| 6a | Veritabanı kurulumu (Supabase, Frankfurt): tablolar, güvenlik kuralları, dosya depoları — 22 senaryoluk testten geçti | ✅ Tamam |
| 6b | Siteyi veritabanına bağlama: örnek verilerin aktarımı ✅, liste/profil/blog/manşet veritabanından ✅, mesaj formu ✅; gerçek kayıt, giriş, CAPTCHA | ⏳ Kayıt ve giriş sırada |
| 7 | Google'da bulunabilirlik: her uzmana kalıcı adres (`/uzman/elif-aydin`), sayfa başlıkları, paylaşım önizlemesi, site haritası. GitHub Actions ile otomatik sayfa üretimi (framework değişikliği gerekmez) | — |
| 8 | Bildirim sistemi: "Bu profilde sorun var" (taklit profil, yanlış unvan, güncel olmayan bilgi); CAPTCHA'lı, kayıtlı, itiraz hakkı olan süreç | — |
| 9 | Alan adı, güvenlik başlıkları (Cloudflare), Pro plan (yedekleme, sızdırılmış şifre kontrolü) ve yayına alma | — |

## Temel kararlar

- **Üyelik yalnızca uzmanlara açık:** Danışanlar için hiçbir üyelik yok; siteyi üye olmadan kullanırlar.
- **Kimler profil açabilir:** Tüm ruh sağlığı uzmanları; profiller unvan doğrulamasından sonra yayına girer. Doğrulanmamış profiller danışanlara hiç gösterilmez.
- **İletişim:** Profilin sağ panelinde üç buton bulunur: **Uzmanı Ara** (bordo), **WhatsApp ile İletişim** (yeşil), **E-posta Gönder** (mor). Her biri, uzmanın iletişim tercihlerinde verdiği izne göre bağımsız olarak aktif (renkli, tıklanabilir) ya da pasif (gri, bağlantısız) görünür.
- **İzin verilmeyen bilgi hiçbir yerde yer almaz:** Uzmanın yayımlanmasına izin vermediği numara ya da adres sayfanın kaynak kodunda da, herkese açık API yanıtlarında da bulunmaz. Bu kural veritabanında zorlanır.
- **Hiçbir kanal açık değilse "Uzmana Mesaj Gönder":** Ziyaretçi hesap açmadan, CAPTCHA'lı bir formla mesaj bırakır; mesaj platform üzerinden yalnızca o uzmana iletilir. En az bir kanal açıksa bu buton gösterilmez. Bu, sohbet tarzı bir mesajlaşma sistemi değildir; tek yönlü bir iletişim talebidir.
- **Ücret bilgisi gösterilmez:** Seans ücreti, ücret aralığı ya da fiyat bilgisi platformda yer almaz; veritabanında da tutulmaz.
- **Danışan yorumu yok:** Yorumlar taraflıdır ve sağlık okuryazarlığını zedeler; platformda yorum ya da puanlama bulunmaz.
- **Ücretli öne çıkarma yok.**
- **Adil sıralama:** Uzmanlar, yeni danışan kabul edenler önde olmak üzere her gün değişen ama gün içinde sabit kalan bir sırayla listelenir. Alfabetik sıra kullanılmaz. Üyelik, yazı sayısı ve profil doluluk oranı sıralamayı **etkilemez**.
- **Güncellik:** "Yeni danışan kabul ediyor" bilgisi 60 günden uzun süre güncellenmezse "Kabul durumu bir süredir güncellenmedi" olarak gösterilir.
- **İhtiyaç kategorileri tanı değildir:** Danışanın günlük dille arama yapması içindir; tanı koymak ya da yönlendirmek için kullanılmaz.
- **Var olmayan hizmet vaat edilmez** (ör. bekleme listesi). Henüz çalışmayan özellikler çalışıyormuş gibi gösterilmez.
- **Örnek veriler gerçek uzman gibi sunulmaz:** Veritabanında `ornek = true` olarak işaretlidir ve yayın öncesi tek komutla silinir: `delete from public.uzmanlar where ornek;`
- **Veri katmanı ayrı tutulur:** Sayfalar verileri yalnızca `veri.js` üzerinden ister. Veritabanına geçişte sadece bu dosya değişir.
- **Gizli bilgi koda yazılmaz:** Repo herkese açık olduğu için şifre, gizli anahtar vb. hiçbir zaman bu dosyalarda yer almaz.

## Dosya yapısı

```
index.html            Uzman listesi (ana sayfa)
uzman.html            Uzman profil sayfası  →  uzman.html?id=elif-aydin
giris.html            Uzman girişi / kayıt / şifre yenileme (Supabase Auth)
panel.html            Uzman paneli (başlangıç: profil durumu ve adımlar)
yazi.html             Yazı okuma sayfası    →  yazi.html?id=panik-atak-beden
giris.html            Uzman Girişi: giriş / kayıt / doğrulama / şifremi unuttum
assets/css/stil.css   Tüm sayfaların ortak tasarımı (renkler en üstte)
assets/js/ayarlar.js  Marka adı ve sabit listeler (unvanlar, yaş grupları…)
assets/js/veri.js     Veri katmanı — sayfaların veriye (Supabase) ulaştığı tek kapı
assets/js/ortak.js    Ortak yardımcılar ve ikonlar
assets/js/liste.js    Uzman listesi: arama, filtreler, sayfalama, kutu/liste görünümü
assets/js/manset.js   Ana sayfadaki kayan manşet alanı
assets/js/blog.js     Ana sayfadaki "Uzmanlarımızdan yazılar" alanı
assets/img/           Manşet çizimleri ve temsili uzman portreleri
assets/img/marka/     Logo (üst menü: logo.webp, alt bilgi: logo-tam.webp) ve sekme simgeleri
favicon.ico           Tarayıcı sekmesi simgesi
assets/js/profil.js   Profil sayfası (iletişim, paylaş, yol tarifi, SEO etiketleri, hata/yeniden dene)
assets/js/yazi.js     Yazı okuma sayfası
assets/js/oturum.js   Supabase oturumu, Türkçe hata mesajları, Turnstile (CAPTCHA)
assets/js/panel.js    Uzman paneli
assets/vendor/supabase/  supabase-js 2.45.4 (yerel kopya, MIT lisansı)
assets/js/mesaj-formu.js  "Uzmana Mesaj Gönder" penceresi
assets/js/giris.js    Giriş/kayıt ekranlarının kodu
supabase/migrations/  Veritabanının kurulum adımları (sırayla uygulanan SQL dosyaları)
supabase/tests/       Güvenlik kurallarını deneyen test (SQL Editor'da çalıştırılır)
supabase/ornek-veri/  Veritabanına aktarılan 49 hayali örnek uzman ve 6 yazı (hepsi ornek = true)
supabase/functions/mesaj-gonder/  Mesaj formunu CAPTCHA ve gönderim sınırıyla kaydeden sunucu fonksiyonu
supabase/functions/haberler/      aktuelpsikoloji.com RSS beslemesini sade JSON'a çeviren sunucu fonksiyonu (15 dk önbellek)
hakkimizda.html, kvkk-aydinlatma.html, gizlilik-politikasi.html, cerez-politikasi.html  Kurumsal ve yasal sayfalar (taslak; sarı etiketli alanlar yayın öncesi tamamlanacak)
assets/js/haberler.js Ana sayfadaki "Psikoloji gündeminden" haber önizlemeleri
```

## Veritabanı (Supabase)

Proje: `uzman-portal` · Bölge: Central EU (Frankfurt) · PostgreSQL 17

| Tablo | İçerik | Danışan görür mü? |
|---|---|---|
| `uzmanlar` | Profil bilgileri ve yayın durumu | Sadece yayındakiler |
| `uzman_gizli` | KVKK/açık rıza onay tarihleri, ret nedeni, yönetici notu | **Hayır** |
| `uzman_iletisim` | Uzmanın telefon, WhatsApp, e-posta bilgisi ve her kanal için yayın izni | **Hayır** (izin verilenler `uzmanlar` tablosuna otomatik yansır) |
| `iletisim_mesajlari` | "Uzmana Mesaj Gönder" ile bırakılan mesajlar; 90 gün sonra silinir | **Hayır** (yalnızca ilgili uzman) |
| `uzmanlik_alanlari`, `yaklasimlar` | Uzmanların seçtiği ortak listeler (yönetici yönetir) | Aktif olanlar |
| `uzman_uzmanliklar`, `uzman_yaklasimlar`, `uzman_egitimler`, `uzman_sss` | Profile bağlı satırlar | Profil yayındaysa |
| `dogrulama_belgeleri` | Diploma vb. belgelerin kaydı ve inceleme durumu | **Hayır** |
| `yazilar` | Blog yazıları | Yazı ve yazarı yayındaysa |
| `mansetler` | Ana sayfa manşetleri | Aktif ve tarihi uygunsa |
| `yoneticiler` | Yönetici hesapları | **Hayır** |

**Dosya depoları:** `uzman-fotograflari` ve `yazi-kapaklari` herkese açık; `dogrulama-belgeleri` gizli. Her kullanıcı yalnızca kendi klasörüne (`<kullanici_id>/...`) yükleyebilir.

**Veritabanının kendisinde zorlanan kurallar:**
- Uzman profilini yalnızca taslak olarak oluşturabilir; kendini yayına alamaz, sadece incelemeye gönderebilir.
- Ad, soyad, unvan ve unvan öneki doğrulamadan sonra uzman tarafından değiştirilemez.
- Yayındaki bir yazı düzenlenirse otomatik olarak yeniden incelemeye düşer.
- Uzman doğrulama belgesinin durumunu değiştiremez; yüklenmiş belge sonradan değiştirilemez, sadece silinebilir.
- Hiçbir kullanıcı internet üzerinden kendini yönetici yapamaz.
- "Ek belge gerekli" ve "Düzeltme istendi" durumlarından uzman yeniden incelemeye gönderebilir.
- Kabul durumu tarihi elle geriye ya da ileriye alınamaz; her güncellemede "şimdi" yazılır.
- Herkese açık profildeki telefon/WhatsApp/e-posta sütunlarını kimse elle dolduramaz; yalnızca uzmanın izin verdiği bilgiler otomatik yansır, izin kapanınca anında silinir.
- Ziyaretçiler mesaj tablosuna doğrudan yazamaz; mesajı yalnızca CAPTCHA'yı doğrulayan sunucu fonksiyonu kaydeder. Uzman mesajın içeriğini değiştiremez, sadece "okundu" işaretleyebilir ya da silebilir.
- **Değişiklik kayıtları** (`degisiklik_kayitlari`): Profil, gizli bilgi, eğitim, belge, yazı ve yönetici tablolarındaki her değişiklik; kimin (uzman/yönetici/sistem), ne zaman, hangi alanı eskiden neye çevirdiği ile kaydedilir. Sadece yöneticiler okuyabilir; kimse silemez ya da değiştiremez.

**Test:** `supabase/tests/guvenlik_testi.sql` — 42 senaryo.

## Güvenlik planı (büyük portallardan derlenen)

Taslakta ekranları hazır olanlar ✅, veritabanı aşamasında eklenecekler ⏳ ile işaretli.

| Önlem | Ne işe yarar | Durum |
|---|---|---|
| CAPTCHA (Cloudflare Turnstile) | Giriş, kayıt ve şifre sıfırlamada botları durdurur | ✅ yeri hazır, ⏳ bağlantı |
| E-posta doğrulama | Hesap, sahibi e-postasını doğrulamadan açılmaz | ✅ ekran, ⏳ gönderim |
| Güçlü şifre kuralları | En az 10 karakter, büyük/küçük harf, rakam | ✅ |
| Belirsiz hata mesajları | "E-posta veya şifre hatalı" — hangisinin yanlış olduğu söylenmez; şifre sıfırlamada adresin kayıtlı olup olmadığı açık edilmez | ✅ |
| Süreli ve tek kullanımlık bağlantılar | Doğrulama bağlantısı 24 saat, şifre yenileme 1 saat geçerli | ⏳ |
| Deneme sınırı | Arka arkaya hatalı girişlerde hesap geçici olarak beklemeye alınır | ⏳ |
| Sızdırılmış şifre kontrolü | Daha önce internete sızmış şifreler kabul edilmez | ⏳ |
| İki adımlı doğrulama (isteğe bağlı) | Şifreye ek olarak telefon uygulamasından kod | ⏳ |
| Güvenlik bildirimleri | Yeni cihazdan giriş, şifre veya e-posta değişikliğinde uzmana e-posta | ⏳ |
| Oturum yönetimi | Uzun süre işlem yapılmazsa çıkış; "tüm cihazlardan çıkış yap" | ⏳ |
| E-posta değişikliğinde çift onay | Hem eski hem yeni adres onaylamadan değişmez | ⏳ |
| KVKK onayı ve açık rıza | Kayıtta zorunlu | ✅ |

## Karar ve hukuki inceleme bekleyen konular

Bu konular yayına geçmeden önce netleşmeli. Kesinliği olmayan hukuki varsayımlar koda dönüştürülmedi.

| Konu | Neden önemli | Durum |
|---|---|---|
| Seans ücreti gösterimi | Sağlık hizmetlerinde tanıtım ve reklam sınırlamaları | ✅ Karar verildi: Ücret gösterilmez, tutulmaz |
| KVKK: açık rıza ile hizmet şartı | Profilin yayınlanması sözleşmenin ifası kapsamında olabilir; açık rızanın kayıt şartına bağlanması sorunlu olabilir. Veri işleme amaçlarına göre hukuki dayanaklar ayrı belirlenmeli | KVKK avukatı görüşü gerekli |
| Yurt dışı veri aktarımı | Supabase (Frankfurt) ve Cloudflare yurt dışında; 2024 değişiklikleri sonrası aktarım yolları (ör. standart sözleşme) | KVKK avukatı görüşü gerekli |
| Meslek bazında doğrulama matrisi | Her unvan için hangi belgenin isteneceği, nasıl doğrulanacağı, hangi faaliyetlerin ayrı yetki gerektirdiği | Resmî kaynaklarla araştırılmalı |
| Unvan listesi | ✅ Karar verildi: "Aile Danışmanı" çıkarıldı; PDR, Sosyal Hizmet Uzmanı, Dil ve Konuşma Terapisti, Ergoterapist, Özel Eğitim Uzmanı, Çocuk Gelişimci eklendi. Her unvan için istenecek belge ve "terapi" ifadesinin kullanımı doğrulama matrisinde netleşmeli | Doğrulama matrisiyle birlikte |
| Mesaj formu (KVKK) | Ziyaretçinin adı, iletişim bilgisi ve mesajı işleniyor; mesajda sağlık verisi (özel nitelikli veri) yer alabilir. Formda sağlık bilgisi yazılmaması isteniyor; aydınlatma metni ve saklama süresi (taslak: 90 gün) netleşmeli | KVKK avukatı görüşü gerekli |
| Reklam manşetleri | Sağlık hizmeti reklamı sınırlamaları; hangi içeriklerin reklam alanında yer alabileceği | Hukuki görüş gerekli |
| Doğrulama rozeti metni | "Neyi doğruladık, neyi doğrulamadık" açıklaması taslak olarak eklendi | Hukuki gözden geçirme |
| Belge saklama ve silme süresi | Diplomalar ve değişiklik kayıtları ne kadar süre tutulacak | Karar gerekli |

## Yayın

Site GitHub Pages üzerinden yayınlanacak; ilerleyen aşamada markaya ait alan adı bağlanacak.

## Yol haritası (sıradaki işler)

1. **Uzman paneli — profil düzenleme:** fotoğraf, tanıtım, çalışma alanları, yaklaşımlar, eğitim, seans bilgileri, iletişim tercihleri ve **sosyal medya** (Instagram, LinkedIn, X, YouTube, Facebook, TikTok, kişisel web sitesi; isteğe bağlı, yalnızca ilgili sitenin adresini kabul eder, profilde iletişim kutusunun altında küçük simgeler).
2. **Diploma yükleme ve "İncelemeye gönder"** (psikoloji lisans + klinik psikoloji yüksek lisans).
3. **Yönetici onay ekranı:** belge inceleme, onay / ek belge / ret, içerik denetimi.
4. **Kartvizit profili:** profil sayfasının kendisi kartvizit olarak kullanılır (ayrı site değil).
   - Kısa kalıcı adres: `klinikpsikologlar.com.tr/ad-soyad` (her uzman için sabit sayfa üretilir; Google ve WhatsApp önizlemeleri için)
   - QR kod indirme, "Rehbere kaydet" (vCard — yalnızca izin verilen bilgiler), yazdırılabilir kartvizit görünümü
   - Şablon sabit, içerik onaydan geçer; profil yayından kalkarsa adres bir süre "artık aktif değil" sayfasına gider
5. **Alet Çantası** (uzman panelinde, herkese açık profilde değil): Yönetici panelinden yüklenen dokümanlar (onam formu, öykü alma formu, seans notu şablonu vb.; PDF ve Word) yalnızca unvanı doğrulanmış ve yayında olan uzmanların panelinde "Dokümanlar" bölümünde görünür.
   - Tek yönlü: yönetim → uzman. Uzmanlar doldurulmuş danışan formu yükleyemez (özel nitelikli sağlık verisi).
   - Telifli ölçek/test konmaz; şablonlar avukat kontrolünden geçer, sürüm tarihi ve "şablondur, uyarlayınız" notu taşır.
   - Gizli depo, kısa süreli indirme bağlantısı; önemli belgelerde indiren uzmanın adıyla filigran (isteğe bağlı).
6. **Meslektaş davet bağlantısı:** Onaylanmış uzmanlar, yalnızca klinik psikolog meslektaşlarını davet edebilecekleri kişisel bir bağlantı paylaşır (WhatsApp/kopyala). Davet edilen kişi yine diploma doğrulamasından geçer; daveti kimin yaptığı kaydedilir, panelde "davetinizle katılanlar" görünür. Davet, sıralamada öne çıkma gibi bir ayrıcalık sağlamaz.
7. **Gerçek e-posta servisi** (Resend, `@klinikpsikologlar.com.tr`) ve Türkçe e-posta şablonları.
8. KVKK metnindeki eksikler (avukatla), gerçek İletişim sayfası, 90 günlük mesaj temizliği için günlük iş.
