-- =====================================================================
-- 1) TEMEL YAPI
-- Yardımcı şema, durum türleri, yönetici tablosu ve yardımcı fonksiyonlar
-- =====================================================================

-- "ozel" şeması: Sadece veritabanının kendi içinde kullanılan yardımcı fonksiyonlar burada durur.
-- Bu şema internete (API'ye) açık değildir; dışarıdan çağrılamaz.
create schema if not exists ozel;
grant usage on schema ozel to anon, authenticated;

-- Durum türleri: Bir kaydın alabileceği değerler sabit bir listeyle sınırlanır,
-- böylece yazım hatası ya da beklenmeyen bir değer veritabanına giremez.
create type public.uzman_durumu as enum ('taslak', 'incelemede', 'yayinda', 'reddedildi', 'askida');
create type public.yazi_durumu  as enum ('taslak', 'incelemede', 'yayinda', 'reddedildi');
create type public.belge_durumu as enum ('bekliyor', 'onaylandi', 'reddedildi');
create type public.manset_turu  as enum ('duyuru', 'yenilik', 'reklam');

-- Yöneticiler: Bu tabloda kaydı olan hesaplar yönetici yetkisine sahiptir.
-- İnternet üzerinden yönetici eklenemez; ekleme yalnızca veritabanı yöneticisi tarafından yapılır.
create table public.yoneticiler (
  kullanici_id uuid primary key references auth.users (id) on delete cascade,
  eklenme      timestamptz not null default now()
);

-- Şu an giriş yapmış kişi yönetici mi?
-- "security definer": Fonksiyon, yoneticiler tablosunu okuyabilmek için kendi sahibinin yetkisiyle çalışır.
-- Ama sadece evet/hayır döndürür; tablonun içeriğini kimseye göstermez.
create or replace function ozel.yonetici_mi()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.yoneticiler where kullanici_id = (select auth.uid())
  );
$$;
revoke execute on function ozel.yonetici_mi() from public;
grant execute on function ozel.yonetici_mi() to anon, authenticated;

-- İşlemi yapan, internetten gelen bir kullanıcı değil de sistemin kendisi mi?
-- (Veritabanı yöneticisi ya da sunucu tarafı işlemler: migration, toplu veri aktarımı vb.)
create or replace function ozel.sistem_mi()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user not in ('anon', 'authenticated');
$$;
revoke execute on function ozel.sistem_mi() from public;
grant execute on function ozel.sistem_mi() to anon, authenticated;

-- Bir kayıt her güncellendiğinde "guncellenme" sütununu otomatik olarak şimdiki zamana ayarlar.
create or replace function ozel.guncellenme_ayarla()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.guncellenme := now();
  return new;
end;
$$;
