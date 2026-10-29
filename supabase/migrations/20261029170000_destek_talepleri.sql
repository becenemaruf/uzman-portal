-- =====================================================================
-- DESTEK TALEPLERİ (ticket)
--  destek_talepleri : talebin kendisi. İki kaynak:
--                     "panel" → giriş yapmış uzman panelinden açar (kendi oturumuyla, güvenlik kurallarıyla)
--                     "form"  → giriş yapamayan kişi destek.html'den açar (yalnızca "destek" sunucu fonksiyonu, CAPTCHA'lı)
--  destek_mesajlari : yazışma. "ic_not" = yalnızca yönetimin gördüğü not.
--  destek_erisim    : form talepleri için takip bağlantısı anahtarı. Yalnızca sunucu fonksiyonu okur.
-- Durumlar: acik (yönetimin yanıtı bekleniyor) · yanitlandi (yönetim yanıtladı) · kapandi
-- =====================================================================

create table public.destek_talepleri (
  id            bigint generated always as identity primary key,
  kod           text not null unique default ('D-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))),
  kaynak        text not null default 'panel' check (kaynak in ('panel', 'form')),
  kullanici_id  uuid references auth.users(id) on delete set null,
  uzman_id      uuid references public.uzmanlar(id) on delete set null,
  ad            text check (char_length(ad) <= 120),
  eposta        text check (eposta ~* '^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$'),
  kayitli_hesap boolean not null default false,  -- form talebindeki e-posta kayıtlı bir hesaba ait mi (kimlik DOĞRULANMIŞ değildir)
  kategori      text not null check (kategori in ('giris', 'belge', 'profil', 'mesaj', 'teknik', 'kvkk', 'diger')),
  baslik        text not null check (char_length(baslik) between 3 and 120),
  durum         text not null default 'acik' check (durum in ('acik', 'yanitlandi', 'kapandi')),
  ip_ozeti      text,
  olusturulma   timestamptz not null default now(),
  son_hareket   timestamptz not null default now(),
  guncellenme   timestamptz not null default now()
);
create index destek_talepleri_durum_idx on public.destek_talepleri (durum, son_hareket desc);
create index destek_talepleri_kullanici_idx on public.destek_talepleri (kullanici_id);
create trigger destek_talepleri_guncellenme before update on public.destek_talepleri for each row execute function ozel.guncellenme_ayarla();

create table public.destek_mesajlari (
  id            bigint generated always as identity primary key,
  talep_id      bigint not null references public.destek_talepleri(id) on delete cascade,
  yazan         text not null check (yazan in ('kullanici', 'yonetim')),
  yazan_id      uuid,
  metin         text not null check (char_length(metin) between 1 and 5000),
  ic_not        boolean not null default false,
  bildirildi    boolean not null default false,   -- karşı tarafa e-posta gitti mi (çift e-posta olmasın)
  olusturulma   timestamptz not null default now(),
  constraint ic_not_yonetim check (not ic_not or yazan = 'yonetim')
);
create index destek_mesajlari_talep_idx on public.destek_mesajlari (talep_id, olusturulma);

create table public.destek_erisim (
  talep_id   bigint primary key references public.destek_talepleri(id) on delete cascade,
  anahtar    text not null,
  olusturulma timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tetikleyiciler
-- ---------------------------------------------------------------------
-- Talep açılırken: panel taleplerinde kimlik, ad ve e-posta oturumdan doldurulur; kişi başı en fazla 5 açık talep.
create or replace function ozel.destek_talebi_denetle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_acik integer;
begin
  if auth.uid() is null then return new; end if;  -- sunucu fonksiyonu (form talepleri)
  if tg_op = 'INSERT' then
    if ozel.yonetici_mi() then
      raise exception 'Yönetici hesabı destek talebi açamaz.' using errcode = '42501';
    end if;
    select count(*) into v_acik from public.destek_talepleri where kullanici_id = auth.uid() and durum <> 'kapandi';
    if v_acik >= 5 then
      raise exception 'Açık destek talebiniz çok fazla. Lütfen mevcut taleplerinizden devam edin.' using errcode = 'P0001';
    end if;
    new.kaynak := 'panel';
    new.kullanici_id := auth.uid();
    new.durum := 'acik';
    new.kayitli_hesap := true;
    new.ip_ozeti := null;
    select u.id, trim(concat_ws(' ', u.unvan_oneki, u.ad, u.soyad)) into new.uzman_id, new.ad
      from public.uzmanlar u where u.kullanici_id = auth.uid() limit 1;
    select au.email into new.eposta from auth.users au where au.id = auth.uid();
    new.olusturulma := now();
    new.son_hareket := now();
    return new;
  end if;
  -- Güncelleme yalnızca yöneticide (güvenlik kuralı); yönetici yalnızca durumu ve kategoriyi değiştirir.
  if (new.kod, new.kaynak, new.kullanici_id, new.eposta, new.olusturulma) is distinct from (old.kod, old.kaynak, old.kullanici_id, old.eposta, old.olusturulma) then
    raise exception 'Bu alan değiştirilemez.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger destek_talepleri_denetim before insert or update on public.destek_talepleri
  for each row execute function ozel.destek_talebi_denetle();

-- Mesaj eklenince: yazan doğrulanır, talebin durumu ve son hareket zamanı güncellenir.
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
  end if;
  new.bildirildi := false;
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
create trigger destek_mesajlari_denetim before insert on public.destek_mesajlari
  for each row execute function ozel.destek_mesaji_denetle();

-- ---------------------------------------------------------------------
-- Güvenlik kuralları
-- ---------------------------------------------------------------------
alter table public.destek_talepleri enable row level security;
alter table public.destek_mesajlari enable row level security;
alter table public.destek_erisim enable row level security;

revoke all on public.destek_talepleri, public.destek_mesajlari, public.destek_erisim from anon, authenticated;
grant select, insert on public.destek_talepleri to authenticated;
grant update (durum, kategori) on public.destek_talepleri to authenticated;
grant select, insert on public.destek_mesajlari to authenticated;
-- destek_erisim: anon/authenticated için hiçbir yetki yok (yalnızca sunucu fonksiyonu)

create policy "talep_okuma" on public.destek_talepleri for select to authenticated
  using ((select ozel.yonetici_mi()) or kullanici_id = (select auth.uid()));
create policy "talep_acma" on public.destek_talepleri for insert to authenticated
  with check (kullanici_id = (select auth.uid()));
create policy "talep_guncelleme" on public.destek_talepleri for update to authenticated
  using ((select ozel.yonetici_mi())) with check ((select ozel.yonetici_mi()));

create policy "mesaj_okuma" on public.destek_mesajlari for select to authenticated using (
  (select ozel.yonetici_mi())
  or (not ic_not and exists (select 1 from public.destek_talepleri t where t.id = destek_mesajlari.talep_id and t.kullanici_id = (select auth.uid())))
);
create policy "mesaj_yazma" on public.destek_mesajlari for insert to authenticated with check (
  (select ozel.yonetici_mi())
  or (not ic_not and exists (select 1 from public.destek_talepleri t where t.id = destek_mesajlari.talep_id and t.kullanici_id = (select auth.uid())))
);

-- Sunucu fonksiyonu (service_role) yetkileri
grant select, insert, update on public.destek_talepleri, public.destek_mesajlari to service_role;
grant select, insert on public.destek_erisim to service_role;

-- Sunucu fonksiyonu: bir e-posta kayıtlı bir hesaba ait mi (yalnızca service_role)
create or replace function public.destek_hesap_var_mi(p_eposta text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where lower(email) = lower(p_eposta));
$$;
revoke execute on function public.destek_hesap_var_mi(text) from public, anon, authenticated;
grant execute on function public.destek_hesap_var_mi(text) to service_role;

-- Destek fonksiyonu yönetimin destek e-posta adresini site ayarlarından okur
grant select on public.site_ayarlari to service_role;
