-- =====================================================================
-- MENÜLER (yönetim panelinden düzenlenebilir)
--  konum: 'ust' → sitenin üst menüsü (Uzman Girişi / Profil Oluştur düğmeleri sabittir, burada değildir)
--         'alt' → alt bilgideki bağlantılar
-- Ziyaretçi yalnızca aktif öğeleri okur; ekleme/değiştirme/silme yalnızca yöneticidedir.
-- Bağlantı kuralı manşet/duyurularla aynıdır (ozel.baglanti_uygun): http(s), site içi .html sayfa,
-- sayfa içi çapa ya da mailto — javascript: vb. engellenir.
-- Hiç kayıt okunamazsa sayfa dosyasındaki menü olduğu gibi görünür.
-- =====================================================================
create table public.menu_ogeleri (
  id           bigint generated always as identity primary key,
  konum        text not null check (konum in ('ust', 'alt')),
  etiket       text not null check (char_length(btrim(etiket)) between 1 and 40),
  baglanti     text not null check (char_length(baglanti) <= 500 and ozel.baglanti_uygun(baglanti)),
  yeni_sekme   boolean not null default false,
  aktif        boolean not null default true,
  sira         integer not null default 0,
  olusturulma  timestamptz not null default now(),
  guncellenme  timestamptz not null default now()
);
create index menu_ogeleri_konum_idx on public.menu_ogeleri (konum, sira);
create trigger menu_ogeleri_guncellenme before update on public.menu_ogeleri for each row execute function ozel.guncellenme_ayarla();
create trigger menu_ogeleri_kayit after insert or update or delete on public.menu_ogeleri
  for each row execute function ozel.degisikligi_kaydet();

alter table public.menu_ogeleri enable row level security;
grant select on public.menu_ogeleri to anon, authenticated;
grant insert, update, delete on public.menu_ogeleri to authenticated;
create policy "menu_okuma" on public.menu_ogeleri for select to anon, authenticated
  using (aktif or (select ozel.yonetici_mi()));
create policy "menu_ekleme" on public.menu_ogeleri for insert to authenticated with check ((select ozel.yonetici_mi()));
create policy "menu_guncelleme" on public.menu_ogeleri for update to authenticated
  using ((select ozel.yonetici_mi())) with check ((select ozel.yonetici_mi()));
create policy "menu_silme" on public.menu_ogeleri for delete to authenticated using ((select ozel.yonetici_mi()));

-- Başlangıç: sitedeki mevcut menüler
insert into public.menu_ogeleri (konum, etiket, baglanti, sira) values
  ('ust', 'Klinik Psikolog Bul', 'index.html#aramaFormu', 1),
  ('ust', 'Blog', 'index.html#yazilar', 2),
  ('ust', 'Hakkımızda', 'hakkimizda.html', 3),
  ('ust', 'İletişim', 'iletisim.html', 4),
  ('alt', 'Hakkımızda', 'hakkimizda.html', 1),
  ('alt', 'KVKK Aydınlatma Metni', 'kvkk-aydinlatma.html', 2),
  ('alt', 'Gizlilik Politikası', 'gizlilik-politikasi.html', 3),
  ('alt', 'Çerez Politikası', 'cerez-politikasi.html', 4),
  ('alt', 'İletişim', 'iletisim.html', 5),
  ('alt', 'Destek', 'destek.html', 6);
