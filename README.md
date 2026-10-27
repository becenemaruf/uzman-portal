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
| 6b | Siteyi veritabanına bağlama: gerçek kayıt, giriş, CAPTCHA, fotoğraf yükleme | ⏳ Sırada |
| 7 | Alan adı bağlantısı ve yayına alma | — |

## Temel kararlar

- **Üyelik yalnızca uzmanlara açık:** Danışanlar için hiçbir üyelik yok; siteyi üye olmadan kullanırlar.
- **Kimler profil açabilir:** Tüm ruh sağlığı uzmanları; profiller unvan doğrulamasından sonra yayına girer. Doğrulanmamış profiller danışanlara hiç gösterilmez.
- **İletişim:** Profilde, uzman eklediyse WhatsApp mesaj butonu ve/veya telefonla arama butonu bulunur.
- **Danışan yorumu yok:** Yorumlar taraflıdır ve sağlık okuryazarlığını zedeler; platformda yorum ya da puanlama bulunmaz.
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

## Yayın

Site GitHub Pages üzerinden yayınlanacak; ilerleyen aşamada markaya ait alan adı bağlanacak.
