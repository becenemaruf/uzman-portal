-- =====================================================================
-- BLOG MODÜLÜ
--  İki tür yazı:
--   tur = 'uzman'    → uzmanın kendi panelinden yazdığı yazı. Uzman yalnızca taslak ↔ incelemede arasında
--                      geçiş yapabilir; yayınlama / düzeltme isteme / reddetme yöneticidedir (tetikleyici).
--   tur = 'platform' → yönetimin bilgilendirme yazısı (uzman_id yok). Yalnızca yönetici ekler/değiştirir.
--                      hedef: 'uzmanlar' (yalnızca uzman panelindeki "Mesleki Gelişim"),
--                             'herkes'   (herkese açık blog), 'ikisi'.
--  Okuma kuralı:
--   - herkes: yayında uzman yazıları (yazarı yayındaysa) + yayında, hedefi herkes/ikisi olan platform yazıları
--   - giriş yapmış uzman: ek olarak hedefi uzmanlar/ikisi olan yayında platform yazıları ve kendi yazılarının tamamı
--   - yönetici: hepsi
-- =====================================================================
alter table public.yazilar alter column uzman_id drop not null;
alter table public.yazilar add column if not exists tur text not null default 'uzman' check (tur in ('uzman', 'platform'));
alter table public.yazilar add column if not exists hedef text check (hedef in ('herkes', 'uzmanlar', 'ikisi'));
alter table public.yazilar add column if not exists yazar_adi text check (char_length(yazar_adi) <= 80);
alter table public.yazilar add constraint yazilar_tur_tutarliligi check (
  (tur = 'uzman' and uzman_id is not null and hedef is null)
  or (tur = 'platform' and uzman_id is null and hedef is not null)
);
create index if not exists yazilar_tur_idx on public.yazilar (tur, durum, yayin_tarihi desc);

-- Tetikleyici: uzmanın yetkileri (tür/hedef/yazar adı değiştiremez, platform yazısı açamaz)
create or replace function ozel.yazi_degisikligini_denetle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if ozel.sistem_mi() or ozel.yonetici_mi() then
    if new.durum = 'yayinda' and new.yayin_tarihi is null then
      new.yayin_tarihi := now();
    end if;
    if new.durum = 'yayinda' then
      new.ret_nedeni := null;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.tur          := 'uzman';
    new.hedef        := null;
    new.yazar_adi    := null;
    new.durum        := case when new.durum = 'incelemede' then 'incelemede'::public.yazi_durumu else 'taslak'::public.yazi_durumu end;
    new.yayin_tarihi := null;
    new.ret_nedeni   := null;
    return new;
  end if;

  if new.uzman_id is distinct from old.uzman_id
     or new.tur is distinct from old.tur
     or new.hedef is distinct from old.hedef
     or new.yazar_adi is distinct from old.yazar_adi
     or new.yayin_tarihi is distinct from old.yayin_tarihi
     or new.ret_nedeni is distinct from old.ret_nedeni then
    raise exception 'Bu alanı değiştirme yetkiniz yok.' using errcode = '42501';
  end if;

  if new.durum is distinct from old.durum
     and not (old.durum in ('taslak', 'reddedildi', 'duzeltme_istendi') and new.durum = 'incelemede')
     and not (old.durum = 'incelemede' and new.durum = 'taslak') then
    raise exception 'Yazının durumunu yalnızca yöneticiler değiştirebilir.' using errcode = '42501';
  end if;

  -- Yayındaki yazı değiştirilirse yeniden incelemeye düşer
  if old.durum = 'yayinda'
     and (new.slug, new.baslik, new.ozet, new.icerik, new.kategori, new.kapak_yolu)
         is distinct from (old.slug, old.baslik, old.ozet, old.icerik, old.kategori, old.kapak_yolu) then
    new.durum := 'incelemede';
  end if;

  return new;
end;
$$;

-- Okuma kuralı
drop policy if exists "yazilar_okuma" on public.yazilar;
create policy "yazilar_okuma" on public.yazilar for select to anon, authenticated using (
  (durum = 'yayinda' and tur = 'uzman'
     and exists (select 1 from public.uzmanlar u where u.id = yazilar.uzman_id and u.durum = 'yayinda'))
  or (durum = 'yayinda' and tur = 'platform' and hedef in ('herkes', 'ikisi'))
  or (durum = 'yayinda' and tur = 'platform' and hedef in ('uzmanlar', 'ikisi')
     and exists (select 1 from public.uzmanlar u where u.kullanici_id = (select auth.uid())))
  or exists (select 1 from public.uzmanlar u where u.id = yazilar.uzman_id and u.kullanici_id = (select auth.uid()))
  or (select ozel.yonetici_mi())
);
