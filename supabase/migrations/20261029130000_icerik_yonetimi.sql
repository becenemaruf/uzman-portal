-- =====================================================================
-- İÇERİK YÖNETİMİ (yönetici paneli)
--  1) Manşetler: mobil görsel + güvenli görsel/bağlantı kuralları
--  2) Duyurular (ana sayfadaki üç alan)
--  3) Sabit sayfa sürümleri (Hakkımızda, İletişim, KVKK, Gizlilik, Çerez) — sürüm geçmişiyle
--  4) Genel site ayarları (tek satır)
--  5) "site-gorselleri" deposu (yalnızca yönetici yükler, herkes görür)
-- Ziyaretçiler yalnızca yayımlanmış içerikleri okuyabilir; ekleme/değiştirme/silme yalnızca yöneticidedir.
-- =====================================================================

-- Ortak kurallar: görseller yalnızca kendi depomuzdan ya da sitenin kendi klasöründen gelebilir;
-- bağlantılar yalnızca http(s), site içi sayfa ya da sayfa içi çapa olabilir (javascript: vb. engellenir).
create or replace function ozel.gorsel_adresi_uygun(adres text)
returns boolean language sql immutable set search_path = '' as $$
  select adres is null
      or adres ~ '^https://nzkkbnhwxmjcywvghxon\.supabase\.co/storage/v1/object/public/site-gorselleri/[A-Za-z0-9/_.-]+$'
      or adres ~ '^assets/img/[A-Za-z0-9/_.-]+$';
$$;
create or replace function ozel.baglanti_uygun(adres text)
returns boolean language sql immutable set search_path = '' as $$
  select adres is null
      or adres ~ '^https?://[^\s<>"''`]+$'
      or adres ~ '^#[A-Za-z0-9_-]*$'
      or adres ~ '^[a-z0-9-]+\.html([?#][^\s<>"''`]*)?$'
      or adres ~ '^mailto:[^\s<>"''`]+$';
$$;
grant execute on function ozel.gorsel_adresi_uygun(text), ozel.baglanti_uygun(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1) MANŞETLER
-- ---------------------------------------------------------------------
alter table public.mansetler add column if not exists gorsel_mobil_yolu text check (char_length(gorsel_mobil_yolu) <= 300);
alter table public.mansetler add constraint mansetler_gorsel_kurali
  check (ozel.gorsel_adresi_uygun(gorsel_yolu) and ozel.gorsel_adresi_uygun(gorsel_mobil_yolu));
alter table public.mansetler add constraint mansetler_baglanti_kurali check (ozel.baglanti_uygun(buton_adres));

create trigger mansetler_kayit after insert or update or delete on public.mansetler
  for each row execute function ozel.degisikligi_kaydet();

-- ---------------------------------------------------------------------
-- 2) DUYURULAR
-- ---------------------------------------------------------------------
create table public.duyurular (
  id           bigint generated always as identity primary key,
  baslik       text not null check (char_length(baslik) between 3 and 100),
  metin        text check (char_length(metin) <= 300),
  gorsel_yolu  text check (char_length(gorsel_yolu) <= 300 and ozel.gorsel_adresi_uygun(gorsel_yolu)),
  buton_yazi   text check (char_length(buton_yazi) <= 40),
  buton_adres  text check (char_length(buton_adres) <= 500 and ozel.baglanti_uygun(buton_adres)),
  konum        text not null check (konum in ('arama_alti', 'liste_arasi', 'sayfa_alti')),
  baslangic    date,
  bitis        date check (bitis >= baslangic),
  sira         smallint not null default 0,
  aktif        boolean not null default false,
  olusturulma  timestamptz not null default now(),
  guncellenme  timestamptz not null default now()
);
create index duyurular_konum_idx on public.duyurular (konum, sira);
create trigger duyurular_guncellenme before update on public.duyurular for each row execute function ozel.guncellenme_ayarla();
create trigger duyurular_kayit after insert or update or delete on public.duyurular
  for each row execute function ozel.degisikligi_kaydet();

alter table public.duyurular enable row level security;
grant select on public.duyurular to anon, authenticated;
grant insert, update, delete on public.duyurular to authenticated;
create policy "duyurular_okuma" on public.duyurular for select to anon, authenticated
  using ((aktif and (baslangic is null or baslangic <= current_date) and (bitis is null or bitis >= current_date))
         or (select ozel.yonetici_mi()));
create policy "duyurular_ekleme" on public.duyurular for insert to authenticated with check ((select ozel.yonetici_mi()));
create policy "duyurular_guncelleme" on public.duyurular for update to authenticated
  using ((select ozel.yonetici_mi())) with check ((select ozel.yonetici_mi()));
create policy "duyurular_silme" on public.duyurular for delete to authenticated using ((select ozel.yonetici_mi()));

-- ---------------------------------------------------------------------
-- 3) SABİT SAYFA SÜRÜMLERİ
-- Her kayıt bir sürümdür ve içeriği sonradan değişmez (kaydet = yeni sürüm).
-- Bir sayfanın aynı anda en fazla bir "yayinda" sürümü olur; yayında sürüm yoksa sitedeki
-- orijinal (HTML dosyasındaki) metin görünür.
-- ---------------------------------------------------------------------
create table public.sayfa_surumleri (
  id             bigint generated always as identity primary key,
  sayfa          text not null check (sayfa in ('hakkimizda', 'iletisim', 'kvkk-aydinlatma', 'gizlilik-politikasi', 'cerez-politikasi')),
  baslik         text not null check (char_length(baslik) between 2 and 160),
  giris          text check (char_length(giris) <= 1500),
  icerik         text not null check (char_length(icerik) <= 200000),
  meta_baslik    text check (char_length(meta_baslik) <= 70),
  meta_aciklama  text check (char_length(meta_aciklama) <= 170),
  surum_notu     text check (char_length(surum_notu) <= 200),
  durum          text not null default 'taslak' check (durum in ('taslak', 'yayinda', 'arsiv')),
  olusturan      uuid default auth.uid(),
  olusturulma    timestamptz not null default now(),
  yayin_tarihi   timestamptz,
  -- Ek güvenlik kemeri: içerik tarayıcıda zaten temizleniyor; yine de çalıştırılabilir kod veritabanına giremez.
  constraint sayfa_icerik_guvenli check (
    icerik !~* '<\s*/?\s*(script|iframe|object|embed|style|form|input|button|textarea|select|meta|link|base|svg|math)\b'
    and icerik !~* '<[^>]*\son[a-z]+\s*='
    and icerik !~* '<[^>]*=\s*["'']?\s*(javascript|vbscript|data)\s*:'
  )
);
create unique index sayfa_surumleri_tek_yayin on public.sayfa_surumleri (sayfa) where durum = 'yayinda';
create index sayfa_surumleri_sayfa_idx on public.sayfa_surumleri (sayfa, olusturulma desc);

create or replace function ozel.sayfa_surumu_denetle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.durum := 'taslak';
    new.yayin_tarihi := null;
    new.olusturan := auth.uid();
    new.olusturulma := now();
    return new;
  end if;
  -- Sürüm içeriği değişmez; yalnızca durumu değişebilir.
  if (new.sayfa, new.baslik, new.giris, new.icerik, new.meta_baslik, new.meta_aciklama, new.olusturan, new.olusturulma)
     is distinct from (old.sayfa, old.baslik, old.giris, old.icerik, old.meta_baslik, old.meta_aciklama, old.olusturan, old.olusturulma) then
    raise exception 'Kaydedilmiş bir sürüm değiştirilemez; yeni sürüm olarak kaydedin.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger sayfa_surumleri_denetim before insert or update on public.sayfa_surumleri
  for each row execute function ozel.sayfa_surumu_denetle();
create trigger sayfa_surumleri_kayit after update or delete on public.sayfa_surumleri
  for each row execute function ozel.degisikligi_kaydet();

alter table public.sayfa_surumleri enable row level security;
grant select on public.sayfa_surumleri to anon, authenticated;
grant insert, delete on public.sayfa_surumleri to authenticated;
create policy "sayfa_surumleri_okuma" on public.sayfa_surumleri for select to anon, authenticated
  using (durum = 'yayinda' or (select ozel.yonetici_mi()));
create policy "sayfa_surumleri_ekleme" on public.sayfa_surumleri for insert to authenticated
  with check ((select ozel.yonetici_mi()));
-- Yalnızca hiç yayımlanmamış taslaklar silinebilir; yayımlanmış/arşiv sürümler hukuki iz olarak kalır.
create policy "sayfa_surumleri_silme" on public.sayfa_surumleri for delete to authenticated
  using ((select ozel.yonetici_mi()) and durum = 'taslak' and yayin_tarihi is null);

-- Yayımlama ve yayından kaldırma tek adımda (aynı anda iki yayında sürüm oluşmasın diye)
create or replace function public.sayfa_surumu_yayimla(p_surum bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sayfa text;
begin
  if not ozel.yonetici_mi() then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.' using errcode = '42501';
  end if;
  select sayfa into v_sayfa from public.sayfa_surumleri where id = p_surum;
  if v_sayfa is null then
    raise exception 'Sürüm bulunamadı.';
  end if;
  update public.sayfa_surumleri set durum = 'arsiv' where sayfa = v_sayfa and durum = 'yayinda' and id <> p_surum;
  update public.sayfa_surumleri set durum = 'yayinda', yayin_tarihi = now() where id = p_surum;
end;
$$;
create or replace function public.sayfa_yayindan_kaldir(p_sayfa text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not ozel.yonetici_mi() then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.' using errcode = '42501';
  end if;
  update public.sayfa_surumleri set durum = 'arsiv' where sayfa = p_sayfa and durum = 'yayinda';
end;
$$;
revoke execute on function public.sayfa_surumu_yayimla(bigint), public.sayfa_yayindan_kaldir(text) from public, anon;
grant execute on function public.sayfa_surumu_yayimla(bigint), public.sayfa_yayindan_kaldir(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4) GENEL SİTE AYARLARI (tek satır; gizli anahtar ya da sistem ayarı İÇERMEZ)
-- ---------------------------------------------------------------------
create table public.site_ayarlari (
  id                  smallint primary key default 1 check (id = 1),
  iletisim_eposta     text check (iletisim_eposta ~* '^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$'),
  destek_eposta       text check (destek_eposta ~* '^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$'),
  kurumsal_adres      text check (char_length(kurumsal_adres) <= 300),
  instagram           text check (instagram ~ '^https://(www\.)?instagram\.com/[^\s<>"]+$'),
  facebook            text check (facebook ~ '^https://(www\.|m\.)?facebook\.com/[^\s<>"]+$'),
  linkedin            text check (linkedin ~ '^https://([a-z]{2,3}\.)?linkedin\.com/[^\s<>"]+$'),
  youtube             text check (youtube ~ '^https://(www\.)?(youtube\.com|youtu\.be)/[^\s<>"]+$'),
  ana_sayfa_aciklama  text check (char_length(ana_sayfa_aciklama) <= 300),
  footer_aciklama     text check (char_length(footer_aciklama) <= 400),
  manset_goster       boolean not null default true,
  duyurular_goster    boolean not null default true,
  seo_baslik          text check (char_length(seo_baslik) <= 70),
  seo_aciklama        text check (char_length(seo_aciklama) <= 170),
  paylasim_gorseli    text check (char_length(paylasim_gorseli) <= 300 and ozel.gorsel_adresi_uygun(paylasim_gorseli)),
  guncellenme         timestamptz not null default now()
);
insert into public.site_ayarlari (id) values (1) on conflict do nothing;
create trigger site_ayarlari_guncellenme before update on public.site_ayarlari for each row execute function ozel.guncellenme_ayarla();
create trigger site_ayarlari_kayit after update on public.site_ayarlari for each row execute function ozel.degisikligi_kaydet();

alter table public.site_ayarlari enable row level security;
grant select on public.site_ayarlari to anon, authenticated;
grant update on public.site_ayarlari to authenticated;
create policy "site_ayarlari_okuma" on public.site_ayarlari for select to anon, authenticated using (true);
create policy "site_ayarlari_guncelleme" on public.site_ayarlari for update to authenticated
  using ((select ozel.yonetici_mi())) with check ((select ozel.yonetici_mi()));

-- ---------------------------------------------------------------------
-- 5) SİTE GÖRSELLERİ DEPOSU (manşet, duyuru ve paylaşım görselleri)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-gorselleri', 'site-gorselleri', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "site_gorselleri_yukleme" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-gorselleri' and (select ozel.yonetici_mi()));
create policy "site_gorselleri_guncelleme" on storage.objects for update to authenticated
  using (bucket_id = 'site-gorselleri' and (select ozel.yonetici_mi()))
  with check (bucket_id = 'site-gorselleri' and (select ozel.yonetici_mi()));
create policy "site_gorselleri_silme" on storage.objects for delete to authenticated
  using (bucket_id = 'site-gorselleri' and (select ozel.yonetici_mi()));
create policy "site_gorselleri_listeleme" on storage.objects for select to authenticated
  using (bucket_id = 'site-gorselleri' and (select ozel.yonetici_mi()));

-- Varsayılan yetkiler yeni tablolara TRUNCATE/REFERENCES/TRIGGER da veriyor; TRUNCATE güvenlik kurallarını (RLS) atlar.
-- Bu yüzden önce hepsi kapatılır, yalnızca gerekenler yeniden açılır.
revoke all on public.duyurular, public.sayfa_surumleri, public.site_ayarlari from anon, authenticated;
grant select on public.duyurular, public.sayfa_surumleri, public.site_ayarlari to anon, authenticated;
grant insert, update, delete on public.duyurular to authenticated;
grant insert, delete on public.sayfa_surumleri to authenticated;
grant update on public.site_ayarlari to authenticated;
