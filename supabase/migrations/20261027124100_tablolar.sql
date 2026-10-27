-- =====================================================================
-- 2) TABLOLAR
-- Uzman profilleri, ortak listeler, blog yazıları ve manşetler
-- =====================================================================

-- ---------------------------------------------------------------------
-- UZMANLAR: Danışanların gördüğü profil bilgileri.
-- Gizli bilgiler (KVKK onayları, ret nedeni, yönetici notu) burada DEĞİL,
-- aşağıdaki uzman_gizli tablosunda durur.
-- kullanici_id boş olabilir: Yönetici, henüz hesabı olmayan bir uzmanın profilini hazırlayabilir.
-- ---------------------------------------------------------------------
create table public.uzmanlar (
  id                 uuid primary key default gen_random_uuid(),
  kullanici_id       uuid unique references auth.users (id) on delete set null,
  slug               text not null unique
                     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  unvan_oneki        text check (unvan_oneki in ('Uzm.', 'Dr.', 'Uzm. Dr.', 'Doç. Dr.', 'Prof. Dr.')),
  ad                 text not null check (char_length(ad) between 1 and 60),
  soyad              text not null check (char_length(soyad) between 1 and 60),
  unvan              text not null check (unvan in (
                       'Psikolog', 'Klinik Psikolog', 'Psikolojik Danışman (PDR)',
                       'Psikiyatrist', 'Çocuk ve Ergen Psikiyatristi', 'Aile Danışmanı')),
  foto_yolu          text check (char_length(foto_yolu) <= 300),
  sehir              text check (char_length(sehir) <= 40),
  ilce               text check (char_length(ilce) <= 40),
  gorusme_online     boolean not null default false,
  gorusme_yuzyuze    boolean not null default false,
  yeni_danisan       boolean not null default true,
  deneyim_yili       smallint check (deneyim_yili between 0 and 70),
  cinsiyet           text check (cinsiyet in ('Kadın', 'Erkek')),
  diller             text[] not null default array['Türkçe']::text[],
  yas_gruplari       text[] not null default '{}'::text[]
                     check (yas_gruplari <@ array['Çocuk', 'Ergen', 'Yetişkin', 'Çift', 'Aile']::text[]),
  ucret_min          integer check (ucret_min > 0),
  ucret_max          integer check (ucret_max >= ucret_min),
  kisa_tanitim       text check (char_length(kisa_tanitim) <= 200),
  hakkinda           text check (char_length(hakkinda) <= 5000),
  seans_suresi       text check (char_length(seans_suresi) <= 40),
  online_platform    text check (char_length(online_platform) <= 60),
  muayenehane_adres  text check (char_length(muayenehane_adres) <= 200),
  whatsapp           text check (whatsapp ~ '^0[0-9]{10}$'),
  telefon            text check (telefon ~ '^0[0-9]{10}$'),
  durum              public.uzman_durumu not null default 'taslak',
  yayin_tarihi       timestamptz,
  olusturulma        timestamptz not null default now(),
  guncellenme        timestamptz not null default now()
);
create index uzmanlar_durum_sehir_idx on public.uzmanlar (durum, sehir);

-- UZMAN_GIZLI: Sadece uzmanın kendisinin ve yöneticilerin görebileceği bilgiler.
create table public.uzman_gizli (
  uzman_id          uuid primary key references public.uzmanlar (id) on delete cascade,
  kvkk_onay_tarihi  timestamptz,
  acik_riza_tarihi  timestamptz,
  ret_nedeni        text check (char_length(ret_nedeni) <= 1000),
  yonetici_notu     text check (char_length(yonetici_notu) <= 2000),
  guncellenme       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ORTAK LİSTELER: Uzmanlar buradan seçim yapar, listeyi yönetici yönetir.
-- "aktif = false" yapılan bir seçenek listeden kalkar ama geçmiş kayıtlar bozulmaz.
-- ---------------------------------------------------------------------
create table public.uzmanlik_alanlari (
  id     smallint generated always as identity primary key,
  ad     text not null unique check (char_length(ad) between 2 and 60),
  aktif  boolean not null default true,
  sira   smallint not null default 0
);

create table public.yaklasimlar (
  id     smallint generated always as identity primary key,
  ad     text not null unique check (char_length(ad) between 2 and 80),
  aktif  boolean not null default true,
  sira   smallint not null default 0
);

-- Uzmanın seçtiği alanlar ve yaklaşımlar. "sira": İlk seçilen alan kartın vurgu rengini belirler.
create table public.uzman_uzmanliklar (
  uzman_id  uuid not null references public.uzmanlar (id) on delete cascade,
  alan_id   smallint not null references public.uzmanlik_alanlari (id),
  sira      smallint not null default 0,
  primary key (uzman_id, alan_id)
);
create index uzman_uzmanliklar_alan_idx on public.uzman_uzmanliklar (alan_id);

create table public.uzman_yaklasimlar (
  uzman_id     uuid not null references public.uzmanlar (id) on delete cascade,
  yaklasim_id  smallint not null references public.yaklasimlar (id),
  sira         smallint not null default 0,
  primary key (uzman_id, yaklasim_id)
);
create index uzman_yaklasimlar_yaklasim_idx on public.uzman_yaklasimlar (yaklasim_id);

-- Eğitim ve sertifika satırları
create table public.uzman_egitimler (
  id        bigint generated always as identity primary key,
  uzman_id  uuid not null references public.uzmanlar (id) on delete cascade,
  tur       text not null check (tur in ('egitim', 'sertifika')),
  metin     text not null check (char_length(metin) between 2 and 300),
  sira      smallint not null default 0
);
create index uzman_egitimler_uzman_idx on public.uzman_egitimler (uzman_id);

-- Uzmanın kendi sık sorulan soruları
create table public.uzman_sss (
  id        bigint generated always as identity primary key,
  uzman_id  uuid not null references public.uzmanlar (id) on delete cascade,
  soru      text not null check (char_length(soru) between 5 and 200),
  cevap     text not null check (char_length(cevap) between 2 and 1500),
  sira      smallint not null default 0
);
create index uzman_sss_uzman_idx on public.uzman_sss (uzman_id);

-- ---------------------------------------------------------------------
-- DOĞRULAMA BELGELERİ: Diploma vb. Dosyanın kendisi gizli dosya deposunda durur,
-- burada sadece yolu ve inceleme durumu tutulur.
-- ---------------------------------------------------------------------
create table public.dogrulama_belgeleri (
  id               bigint generated always as identity primary key,
  uzman_id         uuid not null references public.uzmanlar (id) on delete cascade,
  belge_turu       text not null check (belge_turu in ('diploma', 'yuksek_lisans', 'uzmanlik_belgesi', 'diger')),
  dosya_yolu       text not null check (char_length(dosya_yolu) <= 300),
  durum            public.belge_durumu not null default 'bekliyor',
  yonetici_notu    text check (char_length(yonetici_notu) <= 1000),
  yuklenme         timestamptz not null default now(),
  inceleme_tarihi  timestamptz,
  inceleyen        uuid references auth.users (id) on delete set null
);
create index dogrulama_belgeleri_uzman_idx on public.dogrulama_belgeleri (uzman_id);
create index dogrulama_belgeleri_inceleyen_idx on public.dogrulama_belgeleri (inceleyen);

-- ---------------------------------------------------------------------
-- BLOG YAZILARI
-- ---------------------------------------------------------------------
create table public.yazilar (
  id            uuid primary key default gen_random_uuid(),
  uzman_id      uuid not null references public.uzmanlar (id) on delete cascade,
  slug          text not null unique
                check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 120),
  baslik        text not null check (char_length(baslik) between 5 and 150),
  ozet          text check (char_length(ozet) <= 400),
  icerik        text check (char_length(icerik) <= 40000),
  kategori      text check (char_length(kategori) <= 60),
  kapak_yolu    text check (char_length(kapak_yolu) <= 300),
  okuma_dakika  smallint check (okuma_dakika between 1 and 120),
  durum         public.yazi_durumu not null default 'taslak',
  ret_nedeni    text check (char_length(ret_nedeni) <= 1000),
  yayin_tarihi  timestamptz,
  olusturulma   timestamptz not null default now(),
  guncellenme   timestamptz not null default now()
);
create index yazilar_uzman_idx on public.yazilar (uzman_id);
create index yazilar_durum_tarih_idx on public.yazilar (durum, yayin_tarihi desc);

-- ---------------------------------------------------------------------
-- MANŞETLER (ana sayfadaki kayan alan)
-- ---------------------------------------------------------------------
create table public.mansetler (
  id            bigint generated always as identity primary key,
  tur           public.manset_turu not null default 'duyuru',
  baslik        text not null check (char_length(baslik) between 3 and 100),
  metin         text check (char_length(metin) <= 220),
  buton_yazi    text check (char_length(buton_yazi) <= 40),
  buton_adres   text check (char_length(buton_adres) <= 500),
  tema          text not null default 'yesil' check (tema in ('yesil', 'kum', 'gri')),
  gorsel_yolu   text check (char_length(gorsel_yolu) <= 300),
  baslangic     date,
  bitis         date check (bitis >= baslangic),
  sira          smallint not null default 0,
  aktif         boolean not null default true,
  olusturulma   timestamptz not null default now(),
  guncellenme   timestamptz not null default now()
);

-- "guncellenme" sütunlarını otomatik güncelleyen tetikleyiciler
create trigger uzmanlar_guncellenme    before update on public.uzmanlar    for each row execute function ozel.guncellenme_ayarla();
create trigger uzman_gizli_guncellenme before update on public.uzman_gizli for each row execute function ozel.guncellenme_ayarla();
create trigger yazilar_guncellenme     before update on public.yazilar     for each row execute function ozel.guncellenme_ayarla();
create trigger mansetler_guncellenme   before update on public.mansetler   for each row execute function ozel.guncellenme_ayarla();
