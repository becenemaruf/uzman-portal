-- Sunucu fonksiyonunun (form talepleri) "bildirildi" işaretini tetikleyici sıfırlamasın;
-- oturumlu eklemelerde (panel/yönetim) her zaman false başlar.
create or replace function ozel.destek_mesaji_denetle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_talep public.destek_talepleri;
begin
  select * into v_talep from public.destek_talepleri where id = new.talep_id;
  if auth.uid() is not null then
    if ozel.yonetici_mi() then
      new.yazan := 'yonetim';
    else
      if v_talep.kullanici_id is distinct from auth.uid() then
        raise exception 'Bu talebe yazamazsınız.' using errcode = '42501';
      end if;
      new.yazan := 'kullanici';
      new.ic_not := false;
    end if;
    new.yazan_id := auth.uid();
    new.bildirildi := false;
  end if;
  new.olusturulma := now();
  if not new.ic_not then
    update public.destek_talepleri
       set durum = case when new.yazan = 'yonetim' then 'yanitlandi' else 'acik' end,
           son_hareket = now()
     where id = new.talep_id;
  end if;
  return new;
end;
$$;
