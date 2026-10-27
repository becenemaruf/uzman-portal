# uzman-portal

Ruh sağlığı uzmanlarının (psikolog, klinik psikolog, psikolojik danışman/PDR, psikiyatrist vb.) profil oluşturup danışanlara görünürlüklerini artırabildikleri portal.

> Marka adı henüz belirlenmedi. Geçici ad `assets/js/ayarlar.js` dosyasındaki `SITE.ad` satırından tek yerden değiştirilir.

## Yol haritası

| Aşama | İçerik | Durum |
|---|---|---|
| 1 | Proje iskeleti ve klasör yapısı | ✅ Tamam |
| 2 | Herkese açık uzman dizini (arama, filtreler, kartlar) ve profil sayfası — örnek verilerle | ✅ İlk taslak |
| 3 | Uzman Girişi ekranları: giriş, kayıt, e-posta doğrulama, şifremi unuttum, CAPTCHA yeri | ✅ İlk taslak (sunucusuz) |
| 4 | Uzman paneli: profil düzenleme, fotoğraf, yazılar, görünürlük istatistikleri | — |
| 5 | Yönetici paneli: unvan/diploma doğrulama, profil onayı | — |
| 6a | Veritabanı kurulumu (Supabase, Frankfurt): tablolar, güvenlik kuralları, dosya depoları — 22 senaryoluk testten geçti | ✅ Tamam |
| 6b | Siteyi veritabanına bağlama: örnek verilerin aktarımı, gerçek kayıt, giriş, CAPTCHA | ⏳ Sırada |
| 7 | Google'da bulunabilirlik: her uzmana kalıcı adres (`/uzman/elif-aydin`), sayfa başlıkları, paylaşım önizlemesi, site haritası. GitHub Actions ile otomatik sayfa üretimi (framework değişikliği gerekmez) | — |
| 8 | Bildirim sistemi: "Bu profilde sorun var" (taklit profil, yanlış unvan, güncel olmayan bilgi); CAPTCHA'lı, kayıtlı, itiraz hakkı olan süreç | — |
| 9 | Alan adı, güvenlik başlıkları (Cloudflare), Pro plan (yedekleme, sızdırılmış şifre kontrolü) ve yayına alma | — |

## Temel kararlar

- **Üyelik yalnızca uzmanlara açık:** Danışanlar için hiçbir üyelik yok; siteyi üye olmadan kullanırlar.
- **Kimler profil açabilir:** Tüm ruh sağlığı uzmanları; profiller unvan doğrulamasından sonra yayına girer. Doğrulanmamış profiller danışanlara hiç gösterilmez.
- **İletişim:** Profilde, uzman eklediyse WhatsApp mesaj butonu ve/veya telefonla arama butonu bulunur.
- **Danışan yorumu yok:** Yorumlar taraflıdır ve sağlık okuryazarlığını zedeler; platformda yorum ya da puanlama bulunmaz.
- **Ücretli öne çıkarma yok, platform içi mesajlaşma yok.**
- **Adil sıralama:** Uzmanlar, yeni danışan kabul edenler önde olmak üzere her gün değişen ama gün içinde sabit kalan bir sırayla listelenir. Alfabetik sıra kullanılmaz. Ücret, üyelik, yazı sayısı ve profil doluluk oranı sıralamayı **etkilemez**.
- **Güncellik:** "Yeni danışan kabul ediyor" bilgisi 60 günden uzun süre güncellenmezse "Kabul durumu bir süredir güncellenmedi" olarak gösterilir.
- **İhtiyaç kategorileri tanı değildir:** Danışanın günlük dille arama yapması içindir; tanı koymak ya da yönlendirmek için kullanılmaz.
- **Var olmayan hizmet vaat edilmez** (ör. bekleme listesi). Henüz çalışmayan özellikler çalışıyormuş gibi gösterilmez.
- **Örnek veriler gerçek uzman gibi sunulmaz:** Veritabanında `ornek = true` olarak işaretlidir ve yayın öncesi topluca silinir.
- **Veri katmanı ayrı tutulur:** Sayfalar verileri yalnızca `veri.js` üzerinden ister. Veritabanına geçişte sadece bu dosya değişir.
- **Gizli bilgi koda yazılmaz:** Repo herkese açık olduğu için şifre, gizli anahtar vb. hiçbir zaman bu dosyalarda yer almaz.

## Dosya yapısı

```
index.html            Uzman listesi (ana sayfa)
uzman.html            Uzman profil sayfası  →  uzman.html?id=elif-aydin
giris.html            Uzman Girişi: giriş / kayıt / doğrulama / şifremi unuttum
assets/css/stil.css   Tüm sayfaların ortak tasarımı (renkler en üstte)
assets/js/ayarlar.js  Marka adı ve sabit listeler (unvanlar, yaş grupları…)
assets/js/ornek-veri.js  Örnek uzmanlar, manşetler ve blog yazıları — veritabanı bağlanınca silinecek
assets/js/ornek-veri-deneme.js  Sayfalamayı denemek için otomatik üretilmiş 40 hayali uzman — silinecek
assets/js/veri.js     Veri katmanı — sayfaların veriye ulaştığı tek kapı
assets/js/ortak.js    Ortak yardımcılar ve ikonlar
assets/js/liste.js    Uzman listesi: arama, filtreler, sayfalama, kutu/liste görünümü
assets/js/manset.js   Ana sayfadaki kayan manşet alanı
assets/js/blog.js     Ana sayfadaki "Uzmanlarımızdan yazılar" alanı
assets/img/           Manşet çizimleri ve temsili uzman portreleri
assets/js/profil.js   Profil sayfasını oluşturan kod
assets/js/giris.js    Giriş/kayıt ekranlarının kodu
supabase/migrations/  Veritabanının kurulum adımları (sırayla uygulanan SQL dosyaları)
supabase/tests/       Güvenlik kurallarını deneyen test (SQL Editor'da çalıştırılır)
```

## Veritabanı (Supabase)

Proje: `uzman-portal` · Bölge: Central EU (Frankfurt) · PostgreSQL 17

| Tablo | İçerik | Danışan görür mü? |
|---|---|---|
| `uzmanlar` | Profil bilgileri ve yayın durumu | Sadece yayındakiler |
| `uzman_gizli` | KVKK/açık rıza onay tarihleri, ret nedeni, yönetici notu | **Hayır** |
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
- **Değişiklik kayıtları** (`degisiklik_kayitlari`): Profil, gizli bilgi, eğitim, belge, yazı ve yönetici tablolarındaki her değişiklik; kimin (uzman/yönetici/sistem), ne zaman, hangi alanı eskiden neye çevirdiği ile kaydedilir. Sadece yöneticiler okuyabilir; kimse silemez ya da değiştiremez.

**Test:** `supabase/tests/guvenlik_testi.sql` — 31 senaryo, tamamı geçiyor.

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
| Seans ücreti gösterimi | Sağlık hizmetlerinde tanıtım ve reklam sınırlamaları; özellikle hekim olan psikiyatristler için ayrıca değerlendirilmeli | Hukuki görüş gerekli. Ücret alanı ve filtresi prototipte açık, yayında kapatılabilir |
| KVKK: açık rıza ile hizmet şartı | Profilin yayınlanması sözleşmenin ifası kapsamında olabilir; açık rızanın kayıt şartına bağlanması sorunlu olabilir. Veri işleme amaçlarına göre hukuki dayanaklar ayrı belirlenmeli | KVKK avukatı görüşü gerekli |
| Yurt dışı veri aktarımı | Supabase (Frankfurt) ve Cloudflare yurt dışında; 2024 değişiklikleri sonrası aktarım yolları (ör. standart sözleşme) | KVKK avukatı görüşü gerekli |
| Meslek bazında doğrulama matrisi | Her unvan için hangi belgenin isteneceği, nasıl doğrulanacağı, hangi faaliyetlerin ayrı yetki gerektirdiği | Resmî kaynaklarla araştırılmalı |
| "Aile Danışmanı" ve PDR unvanları | Sağlık meslekleriyle aynı dizinde sunulmaları ve "terapi" ifadelerinin kullanımı | Karar ve hukuki görüş gerekli |
| Reklam manşetleri | Sağlık hizmeti reklamı sınırlamaları; hangi içeriklerin reklam alanında yer alabileceği | Hukuki görüş gerekli |
| Doğrulama rozeti metni | "Neyi doğruladık, neyi doğrulamadık" açıklaması taslak olarak eklendi | Hukuki gözden geçirme |
| Belge saklama ve silme süresi | Diplomalar ve değişiklik kayıtları ne kadar süre tutulacak | Karar gerekli |

## Yayın

Site GitHub Pages üzerinden yayınlanacak; ilerleyen aşamada markaya ait alan adı bağlanacak.
