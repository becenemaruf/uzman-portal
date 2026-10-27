-- =====================================================================
-- 4) DOSYA DEPOLARI
-- Klasör kuralı: Her kullanıcı dosyalarını kendi hesap numarasıyla adlandırılmış
-- klasöre yükler:  <kullanici_id>/dosya-adi.jpg
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  -- Herkese açık: profil fotoğrafları (en fazla 2 MB)
  ('uzman-fotograflari',  'uzman-fotograflari',  true,  2097152,
     array['image/jpeg', 'image/png', 'image/webp']),
  -- Herkese açık: blog yazısı kapak görselleri (en fazla 3 MB)
  ('yazi-kapaklari',      'yazi-kapaklari',      true,  3145728,
     array['image/jpeg', 'image/png', 'image/webp']),
  -- GİZLİ: diploma ve doğrulama belgeleri (en fazla 10 MB)
  ('dogrulama-belgeleri', 'dogrulama-belgeleri', false, 10485760,
     array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Açık depolardaki dosyalar, herkese açık adresleri üzerinden kimseye kural gerekmeden görünür.
-- Aşağıdaki okuma kuralı sadece dosya LİSTESİ içindir: Herkes yalnızca kendi klasörünü listeleyebilir.
create policy "depolar_okuma" on storage.objects for select to authenticated
  using (bucket_id in ('uzman-fotograflari', 'yazi-kapaklari', 'dogrulama-belgeleri')
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select ozel.yonetici_mi())));

create policy "depolar_yukleme" on storage.objects for insert to authenticated
  with check (bucket_id in ('uzman-fotograflari', 'yazi-kapaklari', 'dogrulama-belgeleri')
              and ((storage.foldername(name))[1] = (select auth.uid())::text or (select ozel.yonetici_mi())));

-- Değiştirme sadece açık depolarda: Yüklenmiş bir doğrulama belgesi sonradan değiştirilemez,
-- yanlışsa silinip yenisi yüklenir.
create policy "depolar_guncelleme" on storage.objects for update to authenticated
  using      (bucket_id in ('uzman-fotograflari', 'yazi-kapaklari')
              and ((storage.foldername(name))[1] = (select auth.uid())::text or (select ozel.yonetici_mi())))
  with check (bucket_id in ('uzman-fotograflari', 'yazi-kapaklari')
              and ((storage.foldername(name))[1] = (select auth.uid())::text or (select ozel.yonetici_mi())));

create policy "depolar_silme" on storage.objects for delete to authenticated
  using (bucket_id in ('uzman-fotograflari', 'yazi-kapaklari', 'dogrulama-belgeleri')
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select ozel.yonetici_mi())));
