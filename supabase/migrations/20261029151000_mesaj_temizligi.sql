-- "Uzmana Mesaj Gönder" mesajları en fazla 90 gün saklanır: her gün 03:27 (UTC) eski mesajlar silinir.
select cron.unschedule('mesaj-temizligi') where exists (select 1 from cron.job where jobname = 'mesaj-temizligi');
select cron.schedule('mesaj-temizligi', '27 3 * * *', $$ delete from public.iletisim_mesajlari where olusturulma < now() - interval '90 days' $$);
