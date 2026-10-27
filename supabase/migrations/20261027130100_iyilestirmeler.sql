-- =====================================================================
-- 7) İYİLEŞTİRMELER (ürün değerlendirmesi sonrası)
-- =====================================================================

-- ---------------------------------------------------------------------
-- A) Danışan dilinde ihtiyaç kategorileri
-- Danışanlar klinik terimleri bilmeyebilir. Her çalışma alanı, günlük dille ifade edilen
-- bir ihtiyaç kategorisine bağlanır. Bu kategoriler tanı koymak için DEĞİL, aramayı
-- kolaylaştırmak için kullanılır.
-- ---------------------------------------------------------------------
alter table public.uzmanlik_alanlari
  add column kategori text not null default 'diger'
  check (kategori in ('kaygi', 'duygudurum', 'travma_yas', 'cocuk_ergen', 'iliski_aile', 'yasam_ozguven', 'diger'));

update public.uzmanlik_alanlari set kategori = case
  when ad in ('Kaygı Bozuklukları', 'Panik Bozukluk', 'Obsesif Kompulsif Bozukluk', 'Sosyal Fobi') then 'kaygi'
  when ad in ('Depresyon', 'Bipolar Bozukluk', 'Uyku Sorunları') then 'duygudurum'
  when ad in ('Travma', 'Yas ve Kayıp') then 'travma_yas'
  when ad in ('Çocuk ve Ergen', 'Dikkat Eksikliği ve Hiperaktivite', 'Otizm Spektrum Bozukluğu',
              'Dikkat ve Öğrenme Güçlükleri', 'Sınav Kaygısı', 'Okul Uyumu', 'Ebeveyn Danışmanlığı',
              'Ergenlik Dönemi') then 'cocuk_ergen'
  when ad in ('Çift Terapisi', 'İlişki Sorunları', 'Aile İçi İletişim', 'Boşanma Süreci', 'Öfke Kontrolü') then 'iliski_aile'
  when ad in ('Tükenmişlik', 'Özgüven ve Benlik Saygısı', 'Kariyer Danışmanlığı', 'Dikkat Eksikliği (Yetişkin)') then 'yasam_ozguven'
  else 'diger'
end;

-- ---------------------------------------------------------------------
-- B) Uzman profiline iki yeni alan
--  - kabul_durumu_guncellenme: "Yeni danışan kabul ediyor" bilgisinin en son ne zaman
--    doğrulandığı. Uzun süre güncellenmeyen bilgi sitede "güncel değil" olarak gösterilir.
--  - ornek: Tasarım denemesi için eklenmiş hayali profiller. Gerçek uzman gibi sunulmaz,
--    yayın öncesi topluca silinir.
-- ---------------------------------------------------------------------
alter table public.uzmanlar
  add column kabul_durumu_guncellenme timestamptz not null default now(),
  add column ornek boolean not null default false;

-- ---------------------------------------------------------------------
-- C) Koruma tetikleyicileri: yeni durumlar ve yeni alanlar için güncellenmiş kurallar
-- ---------------------------------------------------------------------
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
    return new;
  end if;

  -- Uzman kendi profilini güncelliyor:
  if new.kullanici_id is distinct from old.kullanici_id
     or new.slug is distinct from old.slug
     or new.yayin_tarihi is distinct from old.yayin_tarihi
     or new.ornek is distinct from old.ornek then
    raise exception 'Bu alanı değiştirme yetkiniz yok.' using errcode = '42501';
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

create or replace function ozel.yazi_degisikligini_denetle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if ozel.sistem_mi() or ozel.yonetici_mi() then
    if new.durum = 'yayinda' and new.yayin_tarihi is null then
      new.yayin_tarihi := now();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.durum        := 'taslak';
    new.yayin_tarihi := null;
    new.ret_nedeni   := null;
    return new;
  end if;

  if new.uzman_id is distinct from old.uzman_id
     or new.yayin_tarihi is distinct from old.yayin_tarihi
     or new.ret_nedeni is distinct from old.ret_nedeni then
    raise exception 'Bu alanı değiştirme yetkiniz yok.' using errcode = '42501';
  end if;

  if new.durum is distinct from old.durum
     and not (old.durum in ('taslak', 'reddedildi', 'duzeltme_istendi') and new.durum = 'incelemede')
     and not (old.durum = 'incelemede' and new.durum = 'taslak') then
    raise exception 'Yazının durumunu yalnızca yöneticiler değiştirebilir.' using errcode = '42501';
  end if;

  -- Yayındaki bir yazının içeriği değişirse yazı yeniden incelemeye düşer.
  if old.durum = 'yayinda'
     and (new.slug, new.baslik, new.ozet, new.icerik, new.kategori, new.kapak_yolu)
         is distinct from (old.slug, old.baslik, old.ozet, old.icerik, old.kategori, old.kapak_yolu) then
    new.durum := 'incelemede';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- D) DEĞİŞİKLİK KAYITLARI
-- Kim, neyi, ne zaman değiştirdi? Şikâyet, itiraz ve denetim için kalıcı iz.
-- Güncellemelerde sadece DEĞİŞEN alanlar saklanır: {"unvan": {"eski": "...", "yeni": "..."}}
-- Bu tabloyu sadece yöneticiler okuyabilir; kimse elle yazamaz, değiştiremez, silemez.
-- ---------------------------------------------------------------------
create table public.degisiklik_kayitlari (
  id             bigint generated always as identity primary key,
  zaman          timestamptz not null default now(),
  yapan          uuid,
  yapan_rol      text not null check (yapan_rol in ('yonetici', 'uzman', 'sistem')),
  tablo          text not null,
  kayit_id       text not null,
  islem          text not null check (islem in ('ekleme', 'guncelleme', 'silme')),
  degisiklikler  jsonb not null default '{}'::jsonb
);
create index degisiklik_kayitlari_kayit_idx on public.degisiklik_kayitlari (tablo, kayit_id, zaman desc);
create index degisiklik_kayitlari_yapan_idx on public.degisiklik_kayitlari (yapan, zaman desc);

revoke all on public.degisiklik_kayitlari from anon, authenticated;
grant select on public.degisiklik_kayitlari to authenticated;
create policy "degisiklik_kayitlari_okuma" on public.degisiklik_kayitlari for select to authenticated
  using ((select ozel.yonetici_mi()));

-- Kaydı oluşturan fonksiyon. "security definer": Kimsenin yazma yetkisi olmayan tabloya
-- sadece bu fonksiyon, kendi sahibinin yetkisiyle yazabilir.
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

  rol := case when ozel.yonetici_mi() then 'yonetici'
              when ozel.sistem_mi()   then 'sistem'
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

-- Kayıt tutulacak tablolar: kimlik, doğrulama ve yayın açısından önemli olanlar
create trigger uzmanlar_kayit            after insert or update or delete on public.uzmanlar
  for each row execute function ozel.degisikligi_kaydet();
create trigger uzman_gizli_kayit         after insert or update or delete on public.uzman_gizli
  for each row execute function ozel.degisikligi_kaydet();
create trigger uzman_egitimler_kayit     after insert or update or delete on public.uzman_egitimler
  for each row execute function ozel.degisikligi_kaydet();
create trigger dogrulama_belgeleri_kayit after insert or update or delete on public.dogrulama_belgeleri
  for each row execute function ozel.degisikligi_kaydet();
create trigger yazilar_kayit             after insert or update or delete on public.yazilar
  for each row execute function ozel.degisikligi_kaydet();
create trigger yoneticiler_kayit         after insert or update or delete on public.yoneticiler
  for each row execute function ozel.degisikligi_kaydet();
