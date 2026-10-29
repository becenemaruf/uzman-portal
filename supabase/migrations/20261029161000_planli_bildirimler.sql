-- Planlı sistem bildirimleri: her 5 dakikada bir zamanı gelenler gönderilir (bildirim-gonder fonksiyonu).
select cron.unschedule('planli-bildirimler') where exists (select 1 from cron.job where jobname = 'planli-bildirimler');
select cron.schedule('planli-bildirimler', '*/5 * * * *', $$ select net.http_post(
  url := 'https://nzkkbnhwxmjcywvghxon.supabase.co/functions/v1/bildirim-gonder',
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body := '{"islem":"planli"}'::jsonb) $$);
