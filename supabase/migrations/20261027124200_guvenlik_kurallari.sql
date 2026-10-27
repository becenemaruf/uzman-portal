-- =====================================================================
-- 3) GÜVENLİK KURALLARI
-- Roller:  anon          = giriş yapmamış ziyaretçi (danışan)
--          authenticated = giriş yapmış kullanıcı (uzman ya da yönetici)
-- Yöneticiler de "authenticated" rolündedir; ozel.yonetici_mi() ile ayırt edilir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A) TABLO YETKİLERİ: Önce her şeyi kapat, sonra sadece gerekeni aç.
--    (Hangi SATIRLARIN görüneceğini aşağıdaki RLS kuralları ayrıca belirler.)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- Danışanların ve uzmanların okuyabileceği tablolar
grant select on
  public.uzmanlar, public.uzmanlik_alanlari, public.yaklasimlar,
  public.uzman_uzmanliklar, public.uzman_yaklasimlar, public.uzman_egitimler, public.uzman_sss,
  public.yazilar, public.mansetler
to anon, authenticated;

-- Sadece giriş yapmış kullanıcıların erişebileceği tablolar (hangi satırlar olduğunu RLS belirler)
grant select on public.uzman_gizli, public.dogrulama_belgeleri, public.yoneticiler to authenticated;

grant insert, update, delete on
  public.uzmanlar, public.uzman_gizli, public.uzmanlik_alanlari, public.yaklasimlar,
  public.uzman_uzmanliklar, public.uzman_yaklasimlar, public.uzman_egitimler, public.uzman_sss,
  public.dogrulama_belgeleri, public.yazilar, public.mansetler
to authenticated;

grant usage on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------
-- B) RLS KURALLARI (satır bazında güvenlik)
-- "(select auth.uid())" biçimi bilinçli: Postgres bu değeri sorgu başına bir kez hesaplar, hızlı çalışır.
-- ---------------------------------------------------------------------

-- UZMANLAR
create policy "uzmanlar_okuma" on public.uzmanlar for select to anon, authenticated
  using (durum = 'yayinda' or kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()));
create policy "uzmanlar_ekleme" on public.uzmanlar for insert to authenticated
  with check (kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()));
create policy "uzmanlar_guncelleme" on public.uzmanlar for update to authenticated
  using      (kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))
  with check (kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()));
create policy "uzmanlar_silme" on public.uzmanlar for delete to authenticated
  using ((select ozel.yonetici_mi()));

-- UZMAN_GIZLI: Sadece sahibi ve yönetici görür. Uzman sadece ilk kaydı (KVKK onayları) ekleyebilir,
-- ret nedeni ve yönetici notu yazamaz; sonradan değiştirmeyi sadece yönetici yapar.
create policy "uzman_gizli_okuma" on public.uzman_gizli for select to authenticated
  using ((select ozel.yonetici_mi())
         or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));
create policy "uzman_gizli_ekleme" on public.uzman_gizli for insert to authenticated
  with check ((select ozel.yonetici_mi())
              or (ret_nedeni is null and yonetici_notu is null
                  and exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid()))));
create policy "uzman_gizli_guncelleme" on public.uzman_gizli for update to authenticated
  using ((select ozel.yonetici_mi())) with check ((select ozel.yonetici_mi()));
create policy "uzman_gizli_silme" on public.uzman_gizli for delete to authenticated
  using ((select ozel.yonetici_mi()));

-- ORTAK LİSTELER: Aktif seçenekleri herkes görür, listeyi sadece yönetici değiştirir.
create policy "uzmanlik_alanlari_okuma" on public.uzmanlik_alanlari for select to anon, authenticated
  using (aktif or (select ozel.yonetici_mi()));
create policy "uzmanlik_alanlari_ekleme" on public.uzmanlik_alanlari for insert to authenticated
  with check ((select ozel.yonetici_mi()));
create policy "uzmanlik_alanlari_guncelleme" on public.uzmanlik_alanlari for update to authenticated
  using ((select ozel.yonetici_mi())) with check ((select ozel.yonetici_mi()));
create policy "uzmanlik_alanlari_silme" on public.uzmanlik_alanlari for delete to authenticated
  using ((select ozel.yonetici_mi()));

create policy "yaklasimlar_okuma" on public.yaklasimlar for select to anon, authenticated
  using (aktif or (select ozel.yonetici_mi()));
create policy "yaklasimlar_ekleme" on public.yaklasimlar for insert to authenticated
  with check ((select ozel.yonetici_mi()));
create policy "yaklasimlar_guncelleme" on public.yaklasimlar for update to authenticated
  using ((select ozel.yonetici_mi())) with check ((select ozel.yonetici_mi()));
create policy "yaklasimlar_silme" on public.yaklasimlar for delete to authenticated
  using ((select ozel.yonetici_mi()));

-- PROFİLE BAĞLI TABLOLAR (uzmanlıklar, yaklaşımlar, eğitimler, SSS)
-- Okuma: Bağlı olduğu profili görebilen, bu satırları da görür. (Alt sorgu uzmanlar tablosunun
--        kendi kuralına tabidir; danışan sadece yayındaki profillerin satırlarını görür.)
-- Yazma: Sadece profilin sahibi ve yönetici.
create policy "uzman_uzmanliklar_okuma" on public.uzman_uzmanliklar for select to anon, authenticated
  using (exists (select 1 from public.uzmanlar u where u.id = uzman_id));
create policy "uzman_uzmanliklar_ekleme" on public.uzman_uzmanliklar for insert to authenticated
  with check (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));
create policy "uzman_uzmanliklar_guncelleme" on public.uzman_uzmanliklar for update to authenticated
  using      (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))))
  with check (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));
create policy "uzman_uzmanliklar_silme" on public.uzman_uzmanliklar for delete to authenticated
  using (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                 and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));

create policy "uzman_yaklasimlar_okuma" on public.uzman_yaklasimlar for select to anon, authenticated
  using (exists (select 1 from public.uzmanlar u where u.id = uzman_id));
create policy "uzman_yaklasimlar_ekleme" on public.uzman_yaklasimlar for insert to authenticated
  with check (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));
create policy "uzman_yaklasimlar_guncelleme" on public.uzman_yaklasimlar for update to authenticated
  using      (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))))
  with check (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));
create policy "uzman_yaklasimlar_silme" on public.uzman_yaklasimlar for delete to authenticated
  using (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                 and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));

create policy "uzman_egitimler_okuma" on public.uzman_egitimler for select to anon, authenticated
  using (exists (select 1 from public.uzmanlar u where u.id = uzman_id));
create policy "uzman_egitimler_ekleme" on public.uzman_egitimler for insert to authenticated
  with check (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));
create policy "uzman_egitimler_guncelleme" on public.uzman_egitimler for update to authenticated
  using      (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))))
  with check (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));
create policy "uzman_egitimler_silme" on public.uzman_egitimler for delete to authenticated
  using (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                 and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));

create policy "uzman_sss_okuma" on public.uzman_sss for select to anon, authenticated
  using (exists (select 1 from public.uzmanlar u where u.id = uzman_id));
create policy "uzman_sss_ekleme" on public.uzman_sss for insert to authenticated
  with check (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));
create policy "uzman_sss_guncelleme" on public.uzman_sss for update to authenticated
  using      (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))))
  with check (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                      and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));
create policy "uzman_sss_silme" on public.uzman_sss for delete to authenticated
  using (exists (select 1 from public.uzmanlar u where u.id = uzman_id
                 and (u.kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()))));

-- DOĞRULAMA BELGELERİ: Danışan asla göremez. Uzman kendi belgelerini yükler ve görür,
-- bekleyen belgesini silebilir; inceleme sonucunu sadece yönetici yazar.
create policy "dogrulama_belgeleri_okuma" on public.dogrulama_belgeleri for select to authenticated
  using ((select ozel.yonetici_mi())
         or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));
create policy "dogrulama_belgeleri_ekleme" on public.dogrulama_belgeleri for insert to authenticated
  with check ((select ozel.yonetici_mi())
              or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));
create policy "dogrulama_belgeleri_guncelleme" on public.dogrulama_belgeleri for update to authenticated
  using ((select ozel.yonetici_mi())) with check ((select ozel.yonetici_mi()));
create policy "dogrulama_belgeleri_silme" on public.dogrulama_belgeleri for delete to authenticated
  using ((select ozel.yonetici_mi())
         or (durum = 'bekliyor'
             and exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid()))));

-- YAZILAR: Herkes, yazarı da yayında olan yayındaki yazıları görür. Uzman kendi yazılarını yönetir.
create policy "yazilar_okuma" on public.yazilar for select to anon, authenticated
  using ((durum = 'yayinda' and exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.durum = 'yayinda'))
         or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid()))
         or (select ozel.yonetici_mi()));
create policy "yazilar_ekleme" on public.yazilar for insert to authenticated
  with check ((select ozel.yonetici_mi())
              or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));
create policy "yazilar_guncelleme" on public.yazilar for update to authenticated
  using      ((select ozel.yonetici_mi())
              or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())))
  with check ((select ozel.yonetici_mi())
              or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));
create policy "yazilar_silme" on public.yazilar for delete to authenticated
  using ((select ozel.yonetici_mi())
         or exists (select 1 from public.uzmanlar u where u.id = uzman_id and u.kullanici_id = (select auth.uid())));

-- MANŞETLER: Herkes sadece aktif ve tarihi uygun olanları görür; yönetimi yöneticide.
create policy "mansetler_okuma" on public.mansetler for select to anon, authenticated
  using ((aktif and (baslangic is null or baslangic <= current_date) and (bitis is null or bitis >= current_date))
         or (select ozel.yonetici_mi()));
create policy "mansetler_ekleme" on public.mansetler for insert to authenticated
  with check ((select ozel.yonetici_mi()));
create policy "mansetler_guncelleme" on public.mansetler for update to authenticated
  using ((select ozel.yonetici_mi())) with check ((select ozel.yonetici_mi()));
create policy "mansetler_silme" on public.mansetler for delete to authenticated
  using ((select ozel.yonetici_mi()));

-- YÖNETİCİLER: Sadece yöneticiler listeyi görür, kişi kendi kaydını görebilir.
-- İnternet üzerinden ekleme/silme kuralı bilerek YOK.
create policy "yoneticiler_okuma" on public.yoneticiler for select to authenticated
  using (kullanici_id = (select auth.uid()) or (select ozel.yonetici_mi()));

-- ---------------------------------------------------------------------
-- C) KORUMA TETİKLEYİCİLERİ
-- RLS "hangi satır" sorusunu cevaplar; tetikleyiciler ise "o satırda neyi değiştirebilirsin"
-- sorusunu cevaplar.
-- ---------------------------------------------------------------------

-- Uzman profili
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
    return new;
  end if;

  -- Uzman yeni profil oluşturuyor: Profil her zaman taslak başlar ve uzmanın kendi hesabına bağlanır.
  if tg_op = 'INSERT' then
    new.kullanici_id := auth.uid();
    new.durum        := 'taslak';
    new.yayin_tarihi := null;
    return new;
  end if;

  -- Uzman kendi profilini güncelliyor:
  if new.kullanici_id is distinct from old.kullanici_id
     or new.slug is distinct from old.slug
     or new.yayin_tarihi is distinct from old.yayin_tarihi then
    raise exception 'Bu alanı değiştirme yetkiniz yok.' using errcode = '42501';
  end if;

  -- Durum: Uzman sadece "incelemeye gönder" (taslak/reddedildi → incelemede)
  -- ve "geri çek" (incelemede → taslak) yapabilir.
  if new.durum is distinct from old.durum
     and not (old.durum in ('taslak', 'reddedildi') and new.durum = 'incelemede')
     and not (old.durum = 'incelemede' and new.durum = 'taslak') then
    raise exception 'Profil durumunu yalnızca yöneticiler değiştirebilir.' using errcode = '42501';
  end if;

  -- Kimlik bilgileri doğrulamadan geçtikten sonra uzman tarafından değiştirilemez.
  if old.durum not in ('taslak', 'reddedildi')
     and (new.ad, new.soyad, new.unvan, new.unvan_oneki)
         is distinct from (old.ad, old.soyad, old.unvan, old.unvan_oneki) then
    raise exception 'Ad, soyad ve unvan bilgileri doğrulamadan sonra değiştirilemez. Lütfen yönetimle iletişime geçin.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
create trigger uzmanlar_denetim
  before insert or update on public.uzmanlar
  for each row execute function ozel.uzman_degisikligini_denetle();

-- Blog yazısı
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
     and not (old.durum in ('taslak', 'reddedildi') and new.durum = 'incelemede')
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
create trigger yazilar_denetim
  before insert or update on public.yazilar
  for each row execute function ozel.yazi_degisikligini_denetle();

-- Doğrulama belgesi
create or replace function ozel.belge_degisikligini_denetle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and not (ozel.sistem_mi() or ozel.yonetici_mi()) then
    -- Uzmanın yüklediği belge her zaman "bekliyor" olarak başlar.
    new.durum           := 'bekliyor';
    new.yonetici_notu   := null;
    new.inceleme_tarihi := null;
    new.inceleyen       := null;
  elsif tg_op = 'UPDATE' and new.durum is distinct from old.durum then
    -- İnceleme sonucu girildiğinde kimin, ne zaman incelediği otomatik kaydedilir.
    new.inceleme_tarihi := now();
    new.inceleyen       := auth.uid();
  end if;
  return new;
end;
$$;
create trigger dogrulama_belgeleri_denetim
  before insert or update on public.dogrulama_belgeleri
  for each row execute function ozel.belge_degisikligini_denetle();
