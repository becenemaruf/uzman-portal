-- =====================================================================
-- GÜVENLİK KURALLARI TESTİ
-- Üç sahte kullanıcı (Uzman A, Uzman B, Yönetici) ve danışan (giriş yapmamış ziyaretçi)
-- rolleriyle 42 senaryoyu dener.
--
-- NASIL ÇALIŞTIRILIR: Supabase panelindeki SQL Editor'a yapıştırıp çalıştırın.
-- Sonuç bir "hata" olarak görünür: Bu bilinçlidir. Rapor hata olarak döndürüldüğü için
-- testin oluşturduğu her şey (kullanıcılar, profiller, yazılar) otomatik olarak geri alınır;
-- veritabanında hiçbir iz kalmaz. Raporda tüm satırlar ✅ olmalıdır.
-- =====================================================================
do $test$
declare
  a  uuid := gen_random_uuid();
  b  uuid := gen_random_uuid();
  y  uuid := gen_random_uuid();
  pa uuid; yz uuid; n int; d text; t boolean; r text := '';
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-a@ornek.test'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-b@ornek.test'),
    (y, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-y@ornek.test');
  insert into public.yoneticiler (kullanici_id) values (y);

  -- 1) Uzman A, kendini "yayinda" ve B'nin hesabına bağlı eklemeye çalışır
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.uzmanlar (kullanici_id, slug, ad, soyad, unvan, durum, kisa_tanitim)
    values (b, 'test-uzman-a', 'Test', 'Uzman', 'Psikolog', 'yayinda', 'ilk')
    returning id, durum::text, (kullanici_id = a) into pa, d, t;
  r := r || case when d = 'taslak' and t then '✅' else '❌' end
         || format(' 1) Uzman kendini "yayında" eklemeye çalıştı → durum: %s, kendi hesabına bağlandı: %s', d, t) || E'\n';

  -- 2) Danışan taslak profili göremez
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into n from public.uzmanlar;
  r := r || case when n = 0 then '✅' else '❌' end || format(' 2) Danışan taslak profili görebiliyor mu? görünen: %s', n) || E'\n';

  -- 3) Uzman kendini yayına alamaz
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.uzmanlar set durum = 'yayinda' where id = pa;
    r := r || '❌ 3) Uzman kendini yayına alabildi!' || E'\n';
  exception when others then
    r := r || '✅ 3) Uzman kendini yayına alamadı → "' || sqlerrm || '"' || E'\n';
  end;

  -- 4) Uzman incelemeye gönderebilir
  update public.uzmanlar set durum = 'incelemede' where id = pa returning durum::text into d;
  r := r || case when d = 'incelemede' then '✅' else '❌' end || ' 4) Uzman profilini incelemeye gönderdi → ' || coalesce(d, 'yok') || E'\n';

  -- 5) Uzman B, A'nın profilini değiştiremez
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.uzmanlar set kisa_tanitim = 'B değiştirdi' where id = pa;
  get diagnostics n = row_count;
  r := r || case when n = 0 then '✅' else '❌' end || format(' 5) Başka uzman A''nın profilini değiştirebildi mi? etkilenen satır: %s', n) || E'\n';

  -- 6) Yönetici yayına alır, yayın tarihi otomatik yazılır
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.uzmanlar set durum = 'yayinda' where id = pa returning durum::text, (yayin_tarihi is not null) into d, t;
  r := r || case when d = 'yayinda' and t then '✅' else '❌' end || format(' 6) Yönetici yayına aldı → durum: %s, yayın tarihi yazıldı: %s', d, t) || E'\n';

  -- 7) Danışan artık profili görür
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into n from public.uzmanlar;
  r := r || case when n = 1 then '✅' else '❌' end || format(' 7) Yayına alınan profili danışan görüyor mu? görünen: %s', n) || E'\n';

  -- 8) Danışan gizli bilgileri okuyamaz
  begin
    select count(*) into n from public.uzman_gizli;
    r := r || '❌ 8) Danışan gizli tabloyu okuyabildi!' || E'\n';
  exception when others then
    r := r || '✅ 8) Danışan gizli tabloyu okuyamadı → "' || sqlerrm || '"' || E'\n';
  end;

  -- 9) Danışan doğrulama belgelerini okuyamaz
  begin
    select count(*) into n from public.dogrulama_belgeleri;
    r := r || '❌ 9) Danışan belgeleri okuyabildi!' || E'\n';
  exception when others then
    r := r || '✅ 9) Danışan belgeleri okuyamadı → "' || sqlerrm || '"' || E'\n';
  end;

  -- 10-11) Yayındaki uzman unvanını değiştiremez, tanıtımını değiştirebilir
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.uzmanlar set unvan = 'Klinik Psikolog' where id = pa;
    r := r || '❌ 10) Uzman doğrulanmış unvanını değiştirebildi!' || E'\n';
  exception when others then
    r := r || '✅ 10) Uzman doğrulanmış unvanını değiştiremedi → "' || sqlerrm || '"' || E'\n';
  end;
  update public.uzmanlar set kisa_tanitim = 'güncel tanıtım' where id = pa returning kisa_tanitim into d;
  r := r || case when d = 'güncel tanıtım' then '✅' else '❌' end || ' 11) Uzman tanıtım metnini güncelleyebildi' || E'\n';

  -- 12-13) Gizli tabloya ret nedeni yazamaz, KVKK onayını yazabilir
  begin
    insert into public.uzman_gizli (uzman_id, ret_nedeni) values (pa, 'kendim yazdım');
    r := r || '❌ 12) Uzman kendine ret nedeni yazabildi!' || E'\n';
  exception when others then
    r := r || '✅ 12) Uzman gizli tabloya ret nedeni yazamadı' || E'\n';
  end;
  insert into public.uzman_gizli (uzman_id, kvkk_onay_tarihi, acik_riza_tarihi) values (pa, now(), now());
  r := r || '✅ 13) Uzman KVKK ve açık rıza onayını kaydedebildi' || E'\n';

  -- 14-15) Belge "onaylandı" olarak yüklenemez, uzman kendi belgesini onaylayamaz
  insert into public.dogrulama_belgeleri (uzman_id, belge_turu, dosya_yolu, durum)
    values (pa, 'diploma', a::text || '/diploma.pdf', 'onaylandi') returning durum::text into d;
  r := r || case when d = 'bekliyor' then '✅' else '❌' end || ' 14) Uzman belgeyi "onaylandı" yüklemeye çalıştı → durum: ' || d || E'\n';
  update public.dogrulama_belgeleri set durum = 'onaylandi' where uzman_id = pa;
  get diagnostics n = row_count;
  r := r || case when n = 0 then '✅' else '❌' end || format(' 15) Uzman kendi belgesini onaylayabildi mi? etkilenen satır: %s', n) || E'\n';

  -- 16-19) Blog: yazı taslak başlar, yönetici yayınlar, düzenlenince yeniden incelemeye düşer
  insert into public.yazilar (uzman_id, slug, baslik, durum) values (pa, 'test-yazi', 'Test yazısı başlığı', 'yayinda')
    returning id, durum::text into yz, d;
  r := r || case when d = 'taslak' then '✅' else '❌' end || ' 16) Uzman yazıyı "yayında" eklemeye çalıştı → durum: ' || d || E'\n';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.yazilar set durum = 'yayinda' where id = yz;

  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into n from public.yazilar;
  r := r || case when n = 1 then '✅' else '❌' end || format(' 17) Yönetici yayınladıktan sonra danışan yazıyı görüyor mu? görünen: %s', n) || E'\n';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.yazilar set baslik = 'Sessizce değiştirilmiş başlık' where id = yz returning durum::text into d;
  r := r || case when d = 'incelemede' then '✅' else '❌' end || ' 18) Yayındaki yazı düzenlendi → yeni durum: ' || d || E'\n';

  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into n from public.yazilar;
  r := r || case when n = 0 then '✅' else '❌' end || format(' 19) Düzenlenen yazı danışandan gizlendi mi? görünen: %s', n) || E'\n';

  -- 20) Uzman B, A'nın profiline eğitim satırı ekleyemez
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.uzman_egitimler (uzman_id, tur, metin) values (pa, 'egitim', 'Sahte diploma');
    r := r || '❌ 20) Başka uzman A''nın profiline eğitim ekleyebildi!' || E'\n';
  exception when others then
    r := r || '✅ 20) Başka uzman A''nın profiline eğitim ekleyemedi' || E'\n';
  end;

  -- 21) Uzman kendini yönetici yapamaz
  begin
    insert into public.yoneticiler (kullanici_id) values (b);
    r := r || '❌ 21) Uzman kendini yönetici yapabildi!' || E'\n';
  exception when others then
    r := r || '✅ 21) Uzman kendini yönetici yapamadı' || E'\n';
  end;

  -- 22) Danışan listeleri ve manşetleri görür
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select (select count(*) from public.uzmanlik_alanlari) * 1000 + (select count(*) from public.mansetler) into n;
  r := r || case when n / 1000 > 0 and n % 1000 > 0 then '✅' else '❌' end
         || format(' 22) Danışan listeleri ve manşetleri görüyor → %s alan, %s manşet', n / 1000, n % 1000) || E'\n';

  -- 23-24) Uzman kendini "örnek" işaretleyemez; kabul durumu tarihini geriye alamaz
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.uzmanlar set ornek = true where id = pa;
    r := r || '❌ 23) Uzman profilini "örnek" olarak işaretleyebildi!' || E'\n';
  exception when others then
    r := r || '✅ 23) Uzman "örnek" işaretini değiştiremedi' || E'\n';
  end;
  update public.uzmanlar set kabul_durumu_guncellenme = '2020-01-01' where id = pa
    returning (kabul_durumu_guncellenme > now() - interval '1 minute') into t;
  r := r || case when t then '✅' else '❌' end || ' 24) Uzman kabul tarihini 2020''ye çekmeye çalıştı → tarih "şimdi" olarak yazıldı: ' || t || E'\n';

  -- 25) "Ek belge gerekli" durumundan uzman yeniden incelemeye gönderebilir
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.uzmanlar set durum = 'ek_belge' where id = pa;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.uzmanlar set durum = 'incelemede' where id = pa returning durum::text into d;
  r := r || case when d = 'incelemede' then '✅' else '❌' end || ' 25) Ek belge istenen uzman yeniden incelemeye gönderdi → ' || d || E'\n';

  -- 26) "Düzeltme istendi" yazısı yeniden incelemeye gönderilebilir
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.yazilar set durum = 'duzeltme_istendi' where id = yz;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.yazilar set durum = 'incelemede' where id = yz returning durum::text into d;
  r := r || case when d = 'incelemede' then '✅' else '❌' end || ' 26) Düzeltme istenen yazı yeniden incelemeye gönderildi → ' || d || E'\n';

  -- 27) Uzman değişiklik kayıtlarını okuyamaz
  select count(*) into n from public.degisiklik_kayitlari;
  r := r || case when n = 0 then '✅' else '❌' end || format(' 27) Uzman değişiklik kayıtlarını görebiliyor mu? görünen: %s', n) || E'\n';

  -- 28) Danışan değişiklik kayıtlarını okuyamaz
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    select count(*) into n from public.degisiklik_kayitlari;
    r := r || '❌ 28) Danışan değişiklik kayıtlarını okuyabildi!' || E'\n';
  exception when others then
    r := r || '✅ 28) Danışan değişiklik kayıtlarını okuyamadı' || E'\n';
  end;

  -- 29) Yönetici kayıtları görür; yapan kişi ve rolü doğru yazılmış
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.degisiklik_kayitlari
   where tablo = 'uzmanlar' and kayit_id = pa::text
     and ((yapan = a and yapan_rol = 'uzman') or (yapan = y and yapan_rol = 'yonetici'));
  r := r || case when n >= 5 then '✅' else '❌' end
         || format(' 29) Yönetici, profilin değişiklik geçmişini görüyor (yapan ve rol doğru) → %s kayıt', n) || E'\n';
  select count(*) into n from public.degisiklik_kayitlari
   where tablo = 'uzmanlar' and kayit_id = pa::text and degisiklikler ? 'durum'
     and degisiklikler -> 'durum' ->> 'yeni' = 'yayinda';
  r := r || case when n >= 1 then '✅' else '❌' end || ' 29b) "Yayına alındı" kaydı eski/yeni değeriyle tutulmuş' || E'\n';

  -- 30) Yönetici bile değişiklik kayıtlarını silemez ya da değiştiremez
  begin
    delete from public.degisiklik_kayitlari;
    get diagnostics n = row_count;
    r := r || case when n = 0 then '✅ 30) Yönetici kayıtları silemedi' else '❌ 30) Kayıtlar silinebildi!' end || E'\n';
  exception when others then
    r := r || '✅ 30) Yönetici kayıtları silemedi' || E'\n';
  end;

  -- 31) Danışan, çalışma alanlarının ihtiyaç kategorisini görebilir
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into n from public.uzmanlik_alanlari where kategori <> 'diger';
  r := r || case when n > 0 then '✅' else '❌' end || format(' 31) Danışan ihtiyaç kategorilerini görüyor → kategorili alan: %s', n) || E'\n';

  -- ===== İLETİŞİM TERCİHLERİ VE MESAJLAR =====
  -- Hazırlık: Yönetici A'nın profilini yayına alır
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.uzmanlar set durum = 'yayinda' where id = pa;

  -- 32) Uzman, herkese açık telefon sütununa doğrudan yazamaz
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.uzmanlar set telefon = '00000002233' where id = pa;
    r := r || '❌ 32) Uzman yayındaki telefonu doğrudan yazabildi!' || E'\n';
  exception when others then
    r := r || '✅ 32) Uzman yayındaki telefonu doğrudan yazamadı → "' || sqlerrm || '"' || E'\n';
  end;

  -- 33) Uzman iletişim bilgilerini kaydeder; yalnızca WhatsApp'a izin verir
  insert into public.uzman_iletisim (uzman_id, telefon, whatsapp, eposta, whatsapp_yayinda)
    values (pa, '00000002233', '00000002244', 'uzman-a@ornek.test', true);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select telefon is null and eposta is null and whatsapp = '00000002244' into t from public.uzmanlar where id = pa;
  r := r || case when t then '✅' else '❌' end || ' 33) Danışan yalnızca izin verilen WhatsApp''ı görüyor; telefon ve e-posta boş' || E'\n';

  -- 34) Danışan gizli iletişim tablosunu okuyamaz
  begin
    select count(*) into n from public.uzman_iletisim;
    r := r || case when n = 0 then '✅' else '❌' end || format(' 34) Danışan gizli iletişim bilgilerini görüyor mu? görünen: %s', n) || E'\n';
  exception when others then
    r := r || '✅ 34) Danışan gizli iletişim tablosuna erişemedi' || E'\n';
  end;

  -- 35) Uzman B, A'nın gizli iletişim bilgilerini göremez ve değiştiremez
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.uzman_iletisim where uzman_id = pa;
  update public.uzman_iletisim set telefon_yayinda = true where uzman_id = pa;
  get diagnostics d = row_count;
  r := r || case when n = 0 and d = '0' then '✅' else '❌' end || format(' 35) Uzman B, A''nın iletişim bilgilerini görüyor: %s, değiştirdi: %s', n, d) || E'\n';

  -- 36) İzin değişikliği anında yansır: A telefonu açar, WhatsApp'ı kapatır
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.uzman_iletisim set telefon_yayinda = true, whatsapp_yayinda = false where uzman_id = pa;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select telefon = '00000002233' and whatsapp is null into t from public.uzmanlar where id = pa;
  r := r || case when t then '✅' else '❌' end || ' 36) İzin değişikliği herkese açık profile anında yansıdı' || E'\n';

  -- 37) Boş bir bilgi yayımlanamaz
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.uzman_iletisim set eposta = null, eposta_yayinda = true where uzman_id = pa;
    r := r || '❌ 37) Boş e-posta yayımlanabildi!' || E'\n';
  exception when others then
    r := r || '✅ 37) Boş e-posta yayımlanamadı' || E'\n';
  end;

  -- 38) Danışan mesaj tablosuna doğrudan yazamaz (yalnızca CAPTCHA'lı sunucu fonksiyonu yazabilir)
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    insert into public.iletisim_mesajlari (uzman_id, gonderen_ad, gonderen_eposta, mesaj, ip_ozeti)
      values (pa, 'Bot', 'bot@ornek.test', repeat('x', 30), repeat('0', 64));
    r := r || '❌ 38) Danışan mesaj tablosuna doğrudan yazabildi!' || E'\n';
  exception when others then
    r := r || '✅ 38) Danışan mesaj tablosuna doğrudan yazamadı' || E'\n';
  end;

  -- Hazırlık: Sunucu fonksiyonu yerine sistem olarak bir mesaj eklenir
  reset role;
  insert into public.iletisim_mesajlari (uzman_id, gonderen_ad, gonderen_eposta, mesaj, ip_ozeti)
    values (pa, 'Danışan', 'danisan@ornek.test', 'Görüşme için uygun saatlerinizi öğrenebilir miyim?', repeat('a', 64));

  -- 39) Danışan ve Uzman B mesajları okuyamaz
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    select count(*) into n from public.iletisim_mesajlari;
  exception when others then n := 0;
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select n + count(*) into n from public.iletisim_mesajlari;
  r := r || case when n = 0 then '✅' else '❌' end || format(' 39) Danışan ve başka uzman mesajları görüyor mu? görünen: %s', n) || E'\n';

  -- 40) Uzman A kendi mesajını okur ve "okundu" işaretler
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.iletisim_mesajlari where uzman_id = pa;
  update public.iletisim_mesajlari set okundu = true where uzman_id = pa;
  get diagnostics d = row_count;
  r := r || case when n = 1 and d = '1' then '✅' else '❌' end || format(' 40) Uzman kendi mesajını görüyor (%s) ve okundu işaretledi (%s)', n, d) || E'\n';

  -- 41) Uzman mesajın içeriğini ya da gönderen bilgisini değiştiremez
  begin
    update public.iletisim_mesajlari set mesaj = 'Değiştirildi: ' || repeat('x', 20) where uzman_id = pa;
    r := r || '❌ 41) Uzman mesaj içeriğini değiştirebildi!' || E'\n';
  exception when others then
    r := r || '✅ 41) Uzman mesaj içeriğini değiştiremedi' || E'\n';
  end;

  -- 42) "Aile Danışmanı" artık seçilemez, yeni unvanlar seçilebilir
  reset role;
  begin
    update public.uzmanlar set unvan = 'Aile Danışmanı' where id = pa;
    r := r || '❌ 42) Kaldırılan unvan hâlâ seçilebiliyor!' || E'\n';
  exception when others then
    update public.uzmanlar set unvan = 'Dil ve Konuşma Terapisti' where id = pa returning unvan into d;
    r := r || case when d = 'Dil ve Konuşma Terapisti' then '✅' else '❌' end || ' 42) Kaldırılan unvan reddedildi, yeni unvan kabul edildi' || E'\n';
  end;

  reset role;
  -- Rapor hata olarak döndürülür: böylece testin yaptığı her şey otomatik olarak geri alınır.
  raise exception E'TEST RAPORU (tüm test verileri geri alındı)\n%', r;
end
$test$;
