# uzman-portal

Ruh sağlığı uzmanlarının (psikolog, klinik psikolog, psikolojik danışman/PDR, psikiyatrist vb.) profil oluşturup danışanlara görünürlüklerini artırabildikleri portal.

> Marka adı henüz belirlenmedi. Proje adı geçici olarak `uzman-portal`.

## Yol haritası

| Aşama | İçerik | Durum |
|---|---|---|
| 1 | Proje iskeleti ve klasör yapısı | ⏳ Sırada |
| 2 | Herkese açık uzman dizini: arama, filtreler (il/ilçe, uzmanlık, online/yüz yüze), profil sayfası — örnek verilerle | — |
| 3 | Uzman paneli: kayıt, giriş, profil düzenleme, KVKK onayı | — |
| 4 | Profil özellikleri: iletişim/randevu talebi, seans ücreti, uzman yazıları (blog), danışan yorumları | — |
| 5 | Yönetici paneli: unvan/diploma doğrulama, profil ve yorum onayı | — |
| 6 | Veritabanı bağlantısı (Supabase önerisi): gerçek kayıt, giriş, fotoğraf depolama | — |
| 7 | Alan adı bağlantısı ve yayına alma | — |

## Temel kararlar

- **Kimler profil açabilir:** Tüm ruh sağlığı uzmanları; profiller unvan doğrulamasından sonra yayına girer.
- **Danışan yorumları:** Yönetici onayından geçmeden yayınlanmaz, yıldız puanı yoktur, uzman isterse kendi profilinde kapatabilir.
- **Veri katmanı ayrı tutulur:** İlk aşamalarda örnek verilerle çalışılır; veritabanına geçişte yalnızca bu katman değişir, sayfalar yeniden yazılmaz.
- **Gizli bilgi koda yazılmaz:** Repo herkese açık olduğu için şifre, gizli anahtar vb. hiçbir zaman bu dosyalarda yer almaz.

## Yayın

Site GitHub Pages üzerinden yayınlanacak; ilerleyen aşamada markaya ait alan adı bağlanacak.
