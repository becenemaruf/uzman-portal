-- pg_net eklentisi "public" yerine "extensions" şemasına taşındı (Supabase güvenlik önerisi).
-- Zamanlanmış görevler net.http_post'u "net" şeması üzerinden çağırdığı için etkilenmez.
drop extension if exists pg_net;
create extension pg_net schema extensions;
