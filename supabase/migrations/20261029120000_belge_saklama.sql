-- =====================================================================
-- DOĞRULAMA BELGELERİNİN SAKLAMA SÜRESİ
-- Belge dosyası, inceleme kararından 30 gün sonra "belge-temizle" fonksiyonuyla silinir.
-- Kayıt kalır; dosyanın silindiği an "dosya_silindi" sütununa yazılır.
-- Zamanlama: her gün 03:17 (UTC) — pg_cron + pg_net.
-- =====================================================================
alter table public.dogrulama_belgeleri add column if not exists dosya_silindi timestamptz;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('belge-temizle') where exists (select 1 from cron.job where jobname = 'belge-temizle');
select cron.schedule(
  'belge-temizle',
  '17 3 * * *',
  $$ select net.http_post(
       url := 'https://nzkkbnhwxmjcywvghxon.supabase.co/functions/v1/belge-temizle',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);

-- Temizlik fonksiyonu (service_role) yalnızca ihtiyaç duyduğu sütunları okuyup "dosya_silindi"yi yazabilir.
grant select (id, dosya_yolu, durum, inceleme_tarihi, dosya_silindi) on public.dogrulama_belgeleri to service_role;
grant update (dosya_silindi) on public.dogrulama_belgeleri to service_role;
-- Tablodaki tetikleyiciler "ozel" şemasındaki yardımcı fonksiyonları çağırır; service_role'ün bunlara erişmesi gerekir.
grant usage on schema ozel to service_role;
grant execute on function ozel.sistem_mi() to service_role;
grant execute on function ozel.yonetici_mi() to service_role;
