-- =====================================================================
-- SİSTEM BİLDİRİMLERİ (yönetim → uzmanlar)
--  sistem_bildirimleri       : bildirimin kendisi (yalnızca yönetici yazar)
--  bildirim_alicilari        : her alıcı için bir satır — okundu bilgisi, e-posta ve SMS gönderim durumu.
--                              (bildirim, uzman) çifti tekildir: aynı bildirim aynı uzmana iki kez gitmez.
--  uzman_bildirim_tercihleri : uzmanın e-posta / SMS tercihi. Kayıt yoksa: e-posta açık, SMS kapalı.
-- Gönderim yalnızca "bildirim-gonder" sunucu fonksiyonu üzerinden yapılır (tarayıcıdan toplu gönderim yok).
-- =====================================================================

create table public.sistem_bildirimleri (
  id                bigint generated always as identity primary key,
  baslik            text not null check (char_length(baslik) between 3 and 120),
  metin             text not null check (char_length(metin) between 5 and 3000),
  sms_metni         text check (char_length(sms_metni) <= 600),
  tur               text not null check (tur in ('teknik', 'guvenlik', 'bakim', 'guncelleme', 'genel')),
  oncelik           text not null default 'normal' check (oncelik in ('normal', 'onemli', 'kritik')),
  hedef             text not null default 'tum' check (hedef in ('tum', 'yayinda', 'incelemede', 'secili')),
  hedef_uzmanlar    uuid[] not null default '{}',
  kanal_panel       boolean not null default true,
  kanal_eposta      boolean not null default false,
  kanal_sms         boolean not null default false,
  durum             text not null default 'taslak' check (durum in ('taslak', 'planlandi', 'gonderiliyor', 'gonderildi', 'iptal')),
  planlanan_zaman   timestamptz,
  gonderim_zamani   timestamptz,
  bitis             timestamptz,                 -- panelde gösterim bitişi (isteğe bağlı)
  ust_bildirim_id   bigint references public.sistem_bildirimleri(id) on delete set null,  -- "Sorun giderildi" takibi
  olusturan         uuid default auth.uid(),
  gonderen_eposta   text,
  guncellendi       boolean not null default false, -- gönderildikten sonra metni düzeltildi mi
  olusturulma       timestamptz not null default now(),
  guncellenme       timestamptz not null default now(),
  constraint en_az_bir_kanal check (kanal_panel or kanal_eposta or kanal_sms),
  constraint secili_hedef_dolu check (hedef <> 'secili' or cardinality(hedef_uzmanlar) > 0),
  constraint planli_zaman check (durum <> 'planlandi' or planlanan_zaman is not null)
);
create index sistem_bildirimleri_durum_idx on public.sistem_bildirimleri (durum, planlanan_zaman);
create trigger sistem_bildirimleri_guncellenme before update on public.sistem_bildirimleri for each row execute function ozel.guncellenme_ayarla();
create trigger sistem_bildirimleri_kayit after insert or update or delete on public.sistem_bildirimleri for each row execute function ozel.degisikligi_kaydet();

create table public.bildirim_alicilari (
  id              bigint generated always as identity primary key,
  bildirim_id     bigint not null references public.sistem_bildirimleri(id) on delete cascade,
  uzman_id        uuid not null references public.uzmanlar(id) on delete cascade,
  okundu_zamani   timestamptz,
  eposta_durum    text not null default 'yok' check (eposta_durum in ('yok', 'bekliyor', 'gonderildi', 'basarisiz', 'atlandi')),
  eposta_hata     text check (char_length(eposta_hata) <= 300),
  eposta_zamani   timestamptz,
  sms_durum       text not null default 'yok' check (sms_durum in ('yok', 'bekliyor', 'gonderildi', 'basarisiz', 'atlandi')),
  sms_hata        text check (char_length(sms_hata) <= 300),
  sms_zamani      timestamptz,
  olusturulma     timestamptz not null default now(),
  unique (bildirim_id, uzman_id)
);
create index bildirim_alicilari_uzman_idx on public.bildirim_alicilari (uzman_id, bildirim_id);

create table public.uzman_bildirim_tercihleri (
  uzman_id        uuid primary key references public.uzmanlar(id) on delete cascade,
  eposta          boolean not null default true,
  sms             boolean not null default false,
  sms_telefon     text check (sms_telefon ~ '^05[0-9]{9}$'),
  sms_izin_zamani timestamptz,
  guncellenme     timestamptz not null default now(),
  constraint sms_icin_telefon check (not sms or sms_telefon is not null)
);
create trigger uzman_bildirim_tercihleri_guncellenme before update on public.uzman_bildirim_tercihleri for each row execute function ozel.guncellenme_ayarla();

-- SMS izni verildiği an kaydedilir (izin kanıtı)
create or replace function ozel.sms_izin_zamani()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.sms and (tg_op = 'INSERT' or not old.sms) then new.sms_izin_zamani := now(); end if;
  if not new.sms then new.sms_izin_zamani := null; end if;
  return new;
end;
$$;
create trigger uzman_bildirim_tercihleri_izin before insert or update on public.uzman_bildirim_tercihleri for each row execute function ozel.sms_izin_zamani();

-- ---------------------------------------------------------------------
-- GÜVENLİK KURALLARI
-- ---------------------------------------------------------------------
alter table public.sistem_bildirimleri enable row level security;
alter table public.bildirim_alicilari enable row level security;
alter table public.uzman_bildirim_tercihleri enable row level security;

revoke all on public.sistem_bildirimleri, public.bildirim_alicilari, public.uzman_bildirim_tercihleri from anon, authenticated;
grant select, insert, update, delete on public.sistem_bildirimleri to authenticated;
grant select on public.bildirim_alicilari to authenticated;
grant update (okundu_zamani) on public.bildirim_alicilari to authenticated;
grant select, insert, update on public.uzman_bildirim_tercihleri to authenticated;

-- Bildirimler: yönetici her şeyi; uzman yalnızca KENDİSİNE gönderilmiş, iptal edilmemiş ve süresi dolmamış olanları okur.
create policy "bildirim_okuma" on public.sistem_bildirimleri for select to authenticated using (
  (select ozel.yonetici_mi())
  or (durum = 'gonderildi' and kanal_panel and (bitis is null or bitis > now())
      and exists (select 1 from public.bildirim_alicilari a join public.uzmanlar u on u.id = a.uzman_id
                  where a.bildirim_id = sistem_bildirimleri.id and u.kullanici_id = (select auth.uid())))
);
create policy "bildirim_ekleme" on public.sistem_bildirimleri for insert to authenticated with check ((select ozel.yonetici_mi()));
create policy "bildirim_guncelleme" on public.sistem_bildirimleri for update to authenticated
  using ((select ozel.yonetici_mi())) with check ((select ozel.yonetici_mi()));
-- Yalnızca taslaklar silinebilir; gönderilmiş bildirimler kayıt olarak kalır (iptal edilebilir).
create policy "bildirim_silme" on public.sistem_bildirimleri for delete to authenticated
  using ((select ozel.yonetici_mi()) and durum = 'taslak');

-- Yönetici tarayıcıdan durumu "gonderildi"/"gonderiliyor" yapamaz; bunu yalnızca gönderim fonksiyonu yapar.
create or replace function ozel.bildirim_degisikligini_denetle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if ozel.sistem_mi() and auth.uid() is null then return new; end if;  -- sunucu fonksiyonu (service_role)
  if tg_op = 'INSERT' then
    if new.durum not in ('taslak', 'planlandi') then
      raise exception 'Bildirim yalnızca taslak ya da planlı olarak oluşturulabilir.' using errcode = '42501';
    end if;
    new.olusturan := auth.uid();
    new.gonderim_zamani := null;
    new.gonderen_eposta := null;
    return new;
  end if;
  if new.durum is distinct from old.durum
     and not (old.durum in ('taslak', 'planlandi') and new.durum in ('taslak', 'planlandi', 'iptal'))
     and not (old.durum = 'gonderildi' and new.durum = 'iptal') then
    raise exception 'Bu durum değişikliği yalnızca gönderim fonksiyonuyla yapılabilir.' using errcode = '42501';
  end if;
  if old.durum in ('gonderiliyor', 'gonderildi', 'iptal') then
    -- Gönderilmiş bildirimde yalnızca başlık/metin düzeltilebilir, bitiş ve iptal ayarlanabilir; hedef ve kanallar değişmez.
    if (new.hedef, new.hedef_uzmanlar, new.kanal_panel, new.kanal_eposta, new.kanal_sms, new.tur, new.oncelik, new.gonderim_zamani, new.gonderen_eposta)
       is distinct from (old.hedef, old.hedef_uzmanlar, old.kanal_panel, old.kanal_eposta, old.kanal_sms, old.tur, old.oncelik, old.gonderim_zamani, old.gonderen_eposta) then
      raise exception 'Gönderilmiş bir bildirimin hedefi, kanalları, türü ve önceliği değiştirilemez.' using errcode = '42501';
    end if;
    if (new.baslik, new.metin) is distinct from (old.baslik, old.metin) then new.guncellendi := true; end if;
  end if;
  return new;
end;
$$;
create trigger sistem_bildirimleri_denetim before insert or update on public.sistem_bildirimleri
  for each row execute function ozel.bildirim_degisikligini_denetle();

-- Alıcı satırları: yönetici hepsini, uzman yalnızca kendisininkini görür; uzman yalnızca "okundu" işaretleyebilir.
create policy "alici_okuma" on public.bildirim_alicilari for select to authenticated using (
  (select ozel.yonetici_mi())
  or exists (select 1 from public.uzmanlar u where u.id = bildirim_alicilari.uzman_id and u.kullanici_id = (select auth.uid()))
);
create policy "alici_okundu" on public.bildirim_alicilari for update to authenticated
  using (exists (select 1 from public.uzmanlar u where u.id = bildirim_alicilari.uzman_id and u.kullanici_id = (select auth.uid())))
  with check (exists (select 1 from public.uzmanlar u where u.id = bildirim_alicilari.uzman_id and u.kullanici_id = (select auth.uid())));

-- Tercihler: yalnızca uzmanın kendisi (ve yönetici okuma)
create policy "tercih_okuma" on public.uzman_bildirim_tercihleri for select to authenticated using (
  (select ozel.yonetici_mi())
  or exists (select 1 from public.uzmanlar u where u.id = uzman_bildirim_tercihleri.uzman_id and u.kullanici_id = (select auth.uid()))
);
create policy "tercih_ekleme" on public.uzman_bildirim_tercihleri for insert to authenticated with check (
  exists (select 1 from public.uzmanlar u where u.id = uzman_bildirim_tercihleri.uzman_id and u.kullanici_id = (select auth.uid()))
);
create policy "tercih_guncelleme" on public.uzman_bildirim_tercihleri for update to authenticated
  using (exists (select 1 from public.uzmanlar u where u.id = uzman_bildirim_tercihleri.uzman_id and u.kullanici_id = (select auth.uid())))
  with check (exists (select 1 from public.uzmanlar u where u.id = uzman_bildirim_tercihleri.uzman_id and u.kullanici_id = (select auth.uid())));

-- ---------------------------------------------------------------------
-- HEDEF KİTLE
-- Örnek (deneme) profiller hiçbir zaman hedef olmaz. "Tüm kayıtlı uzmanlar" = hesabı olan tüm gerçek uzmanlar.
-- ---------------------------------------------------------------------
create or replace function ozel.hedef_uzmanlar(p_hedef text, p_secili uuid[])
returns table (uzman_id uuid) language sql stable security definer set search_path = '' as $$
  select u.id from public.uzmanlar u
   where not u.ornek and u.kullanici_id is not null
     and case p_hedef
           when 'tum' then true
           when 'yayinda' then u.durum = 'yayinda'
           when 'incelemede' then u.durum in ('incelemede', 'ek_belge')
           when 'secili' then u.id = any (p_secili)
           else false end;
$$;

-- Yönetici ekranı: gönderim öncesi hedef sayıları (toplam / e-posta alabilecek / SMS alabilecek)
create or replace function public.bildirim_hedef_ozeti(p_hedef text, p_secili uuid[] default '{}', p_kritik boolean default false)
returns table (toplam integer, eposta integer, sms integer) language plpgsql stable security definer set search_path = '' as $$
begin
  if not ozel.yonetici_mi() then raise exception 'Yetkiniz yok.' using errcode = '42501'; end if;
  return query
    select count(*)::int,
           count(*) filter (where coalesce(t.eposta, true) or p_kritik)::int,
           count(*) filter (where coalesce(t.sms, false) and t.sms_telefon is not null)::int
      from ozel.hedef_uzmanlar(p_hedef, p_secili) h
      left join public.uzman_bildirim_tercihleri t on t.uzman_id = h.uzman_id;
end;
$$;
revoke execute on function public.bildirim_hedef_ozeti(text, uuid[], boolean) from public, anon;
grant execute on function public.bildirim_hedef_ozeti(text, uuid[], boolean) to authenticated;

-- Gönderim fonksiyonu (yalnızca service_role): alıcı satırlarını oluşturur (tekrar çalışırsa yeni satır açmaz)
create or replace function public.bildirim_alicilarini_olustur(p_bildirim bigint)
returns integer language plpgsql security definer set search_path = '' as $$
declare b public.sistem_bildirimleri; v integer;
begin
  select * into b from public.sistem_bildirimleri where id = p_bildirim;
  if b.id is null then raise exception 'Bildirim bulunamadı.'; end if;
  insert into public.bildirim_alicilari (bildirim_id, uzman_id, eposta_durum, sms_durum)
  select b.id, h.uzman_id,
         case when b.kanal_eposta then 'bekliyor' else 'yok' end,
         case when b.kanal_sms then 'bekliyor' else 'yok' end
    from ozel.hedef_uzmanlar(b.hedef, b.hedef_uzmanlar) h
  on conflict (bildirim_id, uzman_id) do nothing;
  get diagnostics v = row_count;
  return v;
end;
$$;

-- Gönderim fonksiyonu (yalnızca service_role): bekleyen alıcıların iletişim bilgileri ve tercihleri.
-- E-posta adresi giriş hesabından okunur; tarayıcıya hiç gönderilmez.
create or replace function public.bildirim_gonderim_listesi(p_bildirim bigint, p_kanal text)
returns table (alici_id bigint, uzman_id uuid, ad text, eposta text, eposta_izin boolean, sms_telefon text, sms_izin boolean)
language sql stable security definer set search_path = '' as $$
  select a.id, u.id, trim(concat_ws(' ', u.unvan_oneki, u.ad, u.soyad)), au.email::text,
         coalesce(t.eposta, true), t.sms_telefon, coalesce(t.sms, false)
    from public.bildirim_alicilari a
    join public.uzmanlar u on u.id = a.uzman_id
    left join auth.users au on au.id = u.kullanici_id
    left join public.uzman_bildirim_tercihleri t on t.uzman_id = u.id
   where a.bildirim_id = p_bildirim
     and ((p_kanal = 'eposta' and a.eposta_durum in ('bekliyor', 'basarisiz'))
       or (p_kanal = 'sms' and a.sms_durum in ('bekliyor', 'basarisiz')));
$$;
revoke execute on function public.bildirim_alicilarini_olustur(bigint), public.bildirim_gonderim_listesi(bigint, text) from public, anon, authenticated;
grant execute on function public.bildirim_alicilarini_olustur(bigint), public.bildirim_gonderim_listesi(bigint, text) to service_role;

-- Gönderim fonksiyonunun (service_role) tablolara erişimi
grant select, update on public.sistem_bildirimleri to service_role;
grant select, update on public.bildirim_alicilari to service_role;
grant select on public.uzman_bildirim_tercihleri to service_role;
grant execute on function ozel.hedef_uzmanlar(text, uuid[]) to service_role;

-- Hedef listesi yalnızca güvenlik kurallarının ve fonksiyonların içinde kullanılır.
revoke execute on function ozel.hedef_uzmanlar(text, uuid[]) from public, anon, authenticated;
