-- Otomatik RLS yardımcı fonksiyonu yalnızca veritabanının kendi tetikleyicisi tarafından çalıştırılmalı;
-- internet üzerinden (API) çağrılabilir olmasına gerek yok.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
