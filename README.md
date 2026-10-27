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
| 5 | Yönetici paneli: unvan/diploma doğrulama, profil ve yorum onayı | — |
| 6 | Veritabanı bağlantısı (Supabase önerisi): gerçek kayıt, giriş, fotoğraf depolama | — |
| 7 | Alan adı bağlantısı ve yayına alma | — |

## Temel kararlar

- **Üyelik yalnızca uzmanlara açık:** Danışanlar için hiçbir üyelik yok; siteyi üye olmadan kullanırlar.
- **Kimler profil açabilir:** Tüm ruh sağlığı uzmanları; profiller unvan doğrulamasından sonra yayına girer. Doğrulanmamış profiller danışanlara hiç gösterilmez.
- **İletişim:** Profilde, uzman eklediyse WhatsApp mesaj butonu ve/veya telefonla arama butonu bulunur.
- **Danışan yorumları:** Yönetici onayından geçmeden yayınlanmaz, yıldız puanı yoktur, uzman isterse kendi profilinde kapatabilir.
- **Veri katmanı ayrı tutulur:** Sayfalar verileri yalnızca `veri.js` üzerinden ister. Veritabanına geçişte sadece bu dosya değişir.
- **Gizli bilgi koda yazılmaz:** Repo herkese açık olduğu için şifre, gizli anahtar vb. hiçbir zaman bu dosyalarda yer almaz.

## Dosya yapısı

```
index.html            Uzman listesi (ana sayfa)
uzman.html            Uzman profil sayfası  →  uzman.html?id=elif-aydin
giris.html            Uzman Girişi: giriş / kayıt / doğrulama / şifremi unuttum
assets/css/stil.css   Tüm sayfaların ortak tasarımı (renkler en üstte)
assets/js/ayarlar.js  Marka adı ve sabit listeler (unvanlar, yaş grupları…)
assets/js/ornek-veri.js  Örnek uzmanlar — veritabanı bağlanınca silinecek
assets/js/veri.js     Veri katmanı — sayfaların veriye ulaştığı tek kapı
assets/js/ortak.js    Ortak yardımcılar ve ikonlar
assets/js/liste.js    Liste sayfasının arama ve filtre kodu
assets/js/profil.js   Profil sayfasını oluşturan kod
assets/js/giris.js    Giriş/kayıt ekranlarının kodu
```

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
