-- =====================================================================
-- 10) İLETİŞİM TERCİHLERİ, PLATFORM MESAJLARI, YENİ UNVANLAR, ÜCRETİN KALDIRILMASI
-- =====================================================================

-- ---------------------------------------------------------------------
-- A) Ücret bilgisi platformdan tamamen kaldırılır
-- Arayüzde gösterilmeyen bir bilgiyi herkese açık tabloda tutmak, onu API üzerinden
-- yine de yayımlamak demektir. Bu yüzden sütunlar silinir.
-- ---------------------------------------------------------------------
alter table public.uzmanlar drop column ucret_min, drop column ucret_max;

-- ---------------------------------------------------------------------
-- B) Unvan listesi: "Aile Danışmanı" çıkar, beş yeni meslek eklenir
-- ---------------------------------------------------------------------
alter table public.uzmanlar drop constraint uzmanlar_unvan_check;
alter table public.uzmanlar add constraint uzmanlar_unvan_check check (unvan in (
  'Psikolog', 'Klinik Psikolog', 'Psikolojik Danışman (PDR)',
  'Psikiyatrist', 'Çocuk ve Ergen Psikiyatristi',
  'Sosyal Hizmet Uzmanı', 'Dil ve Konuşma Terapisti', 'Ergoterapist',
  'Özel Eğitim Uzmanı', 'Çocuk Gelişimci'));

-- Yeni meslekler için ihtiyaç kategorisi ve çalışma alanları
alter table public.uzmanlik_alanlari drop constraint uzmanlik_alanlari_kategori_check;
alter table public.uzmanlik_alanlari add constraint uzmanlik_alanlari_kategori_check
  check (kategori in ('kaygi', 'duygudurum', 'travma_yas', 'cocuk_ergen', 'gelisim',
                      'iliski_aile', 'yasam_ozguven', 'diger'));

insert into public.uzmanlik_alanlari (ad, sira, kategori) values
  ('Dil ve Konuşma Güçlükleri', 70, 'gelisim'), ('Kekemelik', 71, 'gelisim'),
  ('Duyu Bütünleme', 72, 'gelisim'), ('Günlük Yaşam Becerileri', 73, 'gelisim'),
  ('Özel Eğitim Programları', 74, 'gelisim'), ('Gelişimsel Değerlendirme', 75, 'gelisim'),
  ('Psikososyal Destek', 80, 'yasam_ozguven'), ('Bakım Veren Desteği', 81, 'yasam_ozguven');

-- ---------------------------------------------------------------------
-- C) İLETİŞİM TERCİHLERİ
-- Uzmanın telefon, WhatsApp ve e-posta bilgileri ile her kanal için "yayımlansın mı?" izni
-- GİZLİ uzman_iletisim tablosunda durur (sadece uzmanın kendisi ve yöneticiler görür).
--
-- Herkese açık uzmanlar tablosundaki telefon / whatsapp / eposta sütunları ise
-- yalnızca İZİN VERİLEN bilgiyi taşır; izin kapalıysa boştur. Bu sütunları kimse elle
-- dolduramaz: Aşağıdaki tetikleyici her değişiklikte izinlere bakıp otomatik doldurur.
-- Böylece izin verilmeyen bir numara ya da adres ne sayfa kaynağında ne de API yanıtında yer alır.
-- ---------------------------------------------------------------------
alter table public.uzmanlar
  add column eposta text check (char_length(eposta) <= 120 and eposta ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$');

create table public.uzman_iletisim (
  uzman_id          uuid primary key references public.uzmanlar (id) on delete cascade,
  telefon           text check (telefon ~ '^0[0-9]{10}$'),
  whatsapp          text check (whatsapp ~ '^0[0-9]{10}$'),
  eposta            text check (char_length(eposta) <= 120 and eposta ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  telefon_yayinda   boolean not null default false,
  whatsapp_yayinda  boolean not null default false,
  eposta_yayinda    boolean not null default false,
  guncellenme       timestamptz not null default now(),
  -- Boş bir bilgi yayımlanamaz
  check (not telefon_yayinda  or telefon  is not null),
  check (not whatsapp_yayinda or whatsapp is not null),
  check (not eposta_yayinda   or eposta   is not null)
);
alter table public.uzman_iletisim enable row level security;

create trigger uzman_iletisim_guncellenme before update on public.uzman_iletisim
  for each row execute function ozel.guncellenme_ayarla();

revoke all on public.uzman_iletisim from anon, authenticated;
grant select, insert, update, delete on public.uzman_iletisim to authenticated;

create policy "uzman_iletisim_okuma" on public.uzman_iletisim for select to authenticated
  using ((select ozel.yonetici_mi())
         or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));
create policy "uzman_iletisim_ekleme" on public.uzman_iletisim for insert to authenticated
  with check ((select ozel.yonetici_mi())
              or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));
create policy "uzman_iletisim_guncelleme" on public.uzman_iletisim for update to authenticated
  using ((select ozel.yonetici_mi())
         or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())))
  with check ((select ozel.yonetici_mi())
              or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));
create policy "uzman_iletisim_silme" on public.uzman_iletisim for delete to authenticated
  using ((select ozel.yonetici_mi())
         or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));

-- İzinleri herkese açık profile yansıtan tetikleyici.
-- "security definer": Uzmanın doğrudan yazamadığı sütunları, yalnızca bu kurala göre doldurabilmek için.
create or replace function ozel.iletisimi_yayina_yansit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.uzmanlar set telefon = null, whatsapp = null, eposta = null where id = old.uzman_id;
    return old;
  end if;
  update public.uzmanlar set
    telefon  = case when new.telefon_yayinda  then new.telefon  end,
    whatsapp = case when new.whatsapp_yayinda then new.whatsapp end,
    eposta   = case when new.eposta_yayinda   then new.eposta   end
  where id = new.uzman_id;
  return new;
end;
$$;
revoke execute on function ozel.iletisimi_yayina_yansit() from public, anon, authenticated;

create trigger uzman_iletisim_yansit after insert or update or delete on public.uzman_iletisim
  for each row execute function ozel.iletisimi_yayina_yansit();
create trigger uzman_iletisim_kayit after insert or update or delete on public.uzman_iletisim
  for each row execute function ozel.degisikligi_kaydet();

-- Koruma tetikleyicisi: Uzman, yayındaki iletişim sütunlarını doğrudan değiştiremez.
create or replace function ozel.uzman_degisikligini_denetle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Yönetici ya da sistem her alanı değiştirebilir. Yayına alınırken yayın tarihi otomatik yazılır.
  if ozel.sistem_mi() or ozel.yonetici_mi() then
    if new.durum = 'yayinda' and new.yayin_tarihi is null then
      new.yayin_tarihi := now();
    end if;
    if tg_op = 'UPDATE' and new.yeni_danisan is distinct from old.yeni_danisan then
      new.kabul_durumu_guncellenme := now();
    end if;
    return new;
  end if;

  -- Uzman yeni profil oluşturuyor
  if tg_op = 'INSERT' then
    new.kullanici_id             := auth.uid();
    new.durum                    := 'taslak';
    new.yayin_tarihi             := null;
    new.ornek                    := false;
    new.kabul_durumu_guncellenme := now();
    -- Yayındaki iletişim bilgileri yalnızca uzman_iletisim tablosundaki izinlerden doldurulur.
    new.telefon  := null;
    new.whatsapp := null;
    new.eposta   := null;
    return new;
  end if;

  -- Uzman kendi profilini güncelliyor:
  if new.kullanici_id is distinct from old.kullanici_id
     or new.slug is distinct from old.slug
     or new.yayin_tarihi is distinct from old.yayin_tarihi
     or new.ornek is distinct from old.ornek then
    raise exception 'Bu alanı değiştirme yetkiniz yok.' using errcode = '42501';
  end if;

  -- Yayındaki iletişim bilgileri doğrudan değiştirilemez; iletişim tercihleri bölümünden
  -- (uzman_iletisim tablosu) yönetilir ve buraya otomatik yansır.
  if (new.telefon, new.whatsapp, new.eposta) is distinct from (old.telefon, old.whatsapp, old.eposta) then
    raise exception 'İletişim bilgileri profil ayarlarındaki "İletişim tercihleri" bölümünden değiştirilir.'
      using errcode = '42501';
  end if;

  -- Durum: Uzman sadece "incelemeye gönder" ve "geri çek" yapabilir.
  if new.durum is distinct from old.durum
     and not (old.durum in ('taslak', 'reddedildi', 'ek_belge') and new.durum = 'incelemede')
     and not (old.durum = 'incelemede' and new.durum = 'taslak') then
    raise exception 'Profil durumunu yalnızca yöneticiler değiştirebilir.' using errcode = '42501';
  end if;

  -- Kimlik bilgileri doğrulamadan geçtikten sonra uzman tarafından değiştirilemez.
  if old.durum not in ('taslak', 'reddedildi', 'ek_belge')
     and (new.ad, new.soyad, new.unvan, new.unvan_oneki)
         is distinct from (old.ad, old.soyad, old.unvan, old.unvan_oneki) then
    raise exception 'Ad, soyad ve unvan bilgileri doğrulamadan sonra değiştirilemez. Lütfen yönetimle iletişime geçin.'
      using errcode = '42501';
  end if;

  -- Kabul durumu tarihi elle ileri/geri alınamaz: Uzman kabul durumunu değiştirir ya da
  -- "hâlâ geçerli" diye onaylarsa tarih her zaman "şimdi" olarak yazılır.
  if new.yeni_danisan is distinct from old.yeni_danisan
     or new.kabul_durumu_guncellenme is distinct from old.kabul_durumu_guncellenme then
    new.kabul_durumu_guncellenme := now();
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- D) PLATFORM ÜZERİNDEN MESAJ ("Uzmana Mesaj Gönder")
-- Yalnızca hiçbir doğrudan iletişim kanalı açık olmayan uzmanlar için.
-- Ziyaretçiler bu tabloya DOĞRUDAN yazamaz (anon/authenticated için ekleme yetkisi yok).
-- Mesajları yalnızca "mesaj-gonder" sunucu fonksiyonu ekler; o da önce CAPTCHA'yı doğrular,
-- gönderim sınırını uygular ve uzmanın gerçekten tüm kanalları kapalı olduğunu kontrol eder.
--
-- Kişisel veri: Gönderenin IP adresi saklanmaz; yalnızca kötüye kullanımı sınırlamak için
-- geri döndürülemez bir özeti (ip_ozeti) tutulur. Mesajlar 90 gün sonra silinir.
-- ---------------------------------------------------------------------
create table public.iletisim_mesajlari (
  id                uuid primary key default gen_random_uuid(),
  uzman_id          uuid not null references public.uzmanlar (id) on delete cascade,
  gonderen_ad       text not null check (char_length(gonderen_ad) between 2 and 60),
  gonderen_eposta   text check (char_length(gonderen_eposta) <= 120 and gonderen_eposta ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  gonderen_telefon  text check (gonderen_telefon ~ '^0[0-9]{10}$'),
  mesaj             text not null check (char_length(mesaj) between 20 and 1000),
  ip_ozeti          text not null check (char_length(ip_ozeti) = 64),
  okundu            boolean not null default false,
  olusturulma       timestamptz not null default now(),
  check (gonderen_eposta is not null or gonderen_telefon is not null)
);
alter table public.iletisim_mesajlari enable row level security;
create index iletisim_mesajlari_uzman_idx on public.iletisim_mesajlari (uzman_id, olusturulma desc);
create index iletisim_mesajlari_ip_idx on public.iletisim_mesajlari (ip_ozeti, olusturulma);

revoke all on public.iletisim_mesajlari from anon, authenticated;
grant select, delete on public.iletisim_mesajlari to authenticated;
grant update (okundu) on public.iletisim_mesajlari to authenticated;  -- uzman sadece "okundu" işaretleyebilir

create policy "mesaj_okuma" on public.iletisim_mesajlari for select to authenticated
  using ((select ozel.yonetici_mi())
         or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));
create policy "mesaj_okundu" on public.iletisim_mesajlari for update to authenticated
  using (exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())))
  with check (exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));
create policy "mesaj_silme" on public.iletisim_mesajlari for delete to authenticated
  using ((select ozel.yonetici_mi())
         or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));
