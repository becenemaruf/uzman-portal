-- =====================================================================
-- 8) DÜZELTME: Değişiklik kayıtlarında işlemi yapanın rolü
-- Hata: Kayıt fonksiyonu "security definer" olarak (sahibinin yetkisiyle) çalıştığı için
-- "sistem mi?" kontrolü her zaman "evet" dönüyordu; uzmanların işlemleri "sistem" yazılıyordu.
-- Çözüm: Rol, çalışan yetkiye göre değil, giriş yapmış kullanıcının kimliğine göre belirlenir.
-- (Güvenlik testinin 29. senaryosu bu hatayı yakaladı.)
-- =====================================================================
create or replace function ozel.degisikligi_kaydet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  eski  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  yeni  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  satir jsonb := coalesce(yeni, eski);
  fark  jsonb;
  rol   text;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(k, jsonb_build_object('eski', eski -> k, 'yeni', yeni -> k)), '{}'::jsonb)
      into fark
      from jsonb_object_keys(yeni) as k
     where k <> 'guncellenme' and (eski -> k) is distinct from (yeni -> k);
    if fark = '{}'::jsonb then
      return null;  -- Gerçek bir değişiklik yoksa kayıt tutulmaz
    end if;
  elsif tg_op = 'INSERT' then
    fark := yeni;
  else
    fark := eski;
  end if;

  rol := case when auth.uid() is null   then 'sistem'
              when ozel.yonetici_mi()   then 'yonetici'
              else 'uzman' end;

  insert into public.degisiklik_kayitlari (yapan, yapan_rol, tablo, kayit_id, islem, degisiklikler)
  values (
    auth.uid(), rol, tg_table_name,
    coalesce(satir ->> 'id', satir ->> 'uzman_id', satir ->> 'kullanici_id', '?'),
    case tg_op when 'INSERT' then 'ekleme' when 'UPDATE' then 'guncelleme' else 'silme' end,
    fark
  );
  return null;
end;
$$;
revoke execute on function ozel.degisikligi_kaydet() from public, anon, authenticated;
