-- =====================================================================
-- SAĞLIK BAKANLIĞI BELGESİ
-- Unvan doğrulaması için iki yol kabul edilir:
--   a) Lisans (Psikoloji ya da PDR) + Klinik psikoloji yüksek lisans mezuniyet belgesi
--   b) Sağlık Bakanlığı sağlık personeli kaydını gösteren belge (klinik psikolog)
-- =====================================================================
alter table public.dogrulama_belgeleri drop constraint if exists dogrulama_belgeleri_belge_turu_check;
alter table public.dogrulama_belgeleri add constraint dogrulama_belgeleri_belge_turu_check
  check (belge_turu in ('diploma', 'yuksek_lisans', 'saglik_bakanligi', 'uzmanlik_belgesi', 'diger'));

create or replace function ozel.uzman_degisikligini_denetle()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if ozel.sistem_mi() or ozel.yonetici_mi() then
    if new.durum = 'yayinda' and new.yayin_tarihi is null then
      new.yayin_tarihi := now();
    end if;
    if tg_op = 'UPDATE' and new.yeni_danisan is distinct from old.yeni_danisan then
      new.kabul_durumu_guncellenme := now();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.kullanici_id             := auth.uid();
    new.durum                    := 'taslak';
    new.yayin_tarihi             := null;
    new.ornek                    := false;
    new.kabul_durumu_guncellenme := now();
    new.telefon  := null;
    new.whatsapp := null;
    new.eposta   := null;
    return new;
  end if;

  if new.kullanici_id is distinct from old.kullanici_id
     or new.slug is distinct from old.slug
     or new.yayin_tarihi is distinct from old.yayin_tarihi
     or new.ornek is distinct from old.ornek then
    raise exception 'Bu alanı değiştirme yetkiniz yok.' using errcode = '42501';
  end if;

  if (new.telefon, new.whatsapp, new.eposta) is distinct from (old.telefon, old.whatsapp, old.eposta) then
    raise exception 'İletişim bilgileri profil ayarlarındaki "İletişim tercihleri" bölümünden değiştirilir.'
      using errcode = '42501';
  end if;

  if new.durum is distinct from old.durum
     and not (old.durum in ('taslak', 'reddedildi', 'ek_belge') and new.durum = 'incelemede')
     and not (old.durum = 'incelemede' and new.durum = 'taslak') then
    raise exception 'Profil durumunu yalnızca yöneticiler değiştirebilir.' using errcode = '42501';
  end if;

  -- İncelemeye göndermeden önce şu iki yoldan biri tamamlanmış olmalı (reddedilmemiş belgelerle):
  --   a) Lisans (Psikoloji ya da PDR) + Klinik psikoloji yüksek lisans mezuniyet belgeleri
  --   b) Sağlık Bakanlığı sağlık personeli kaydı (klinik psikolog)
  if new.durum = 'incelemede' and old.durum is distinct from 'incelemede' then
    if not exists (select 1 from public.dogrulama_belgeleri b where b.uzman_id = new.id and b.belge_turu = 'saglik_bakanligi' and b.durum <> 'reddedildi')
       and (
         not exists (select 1 from public.dogrulama_belgeleri b where b.uzman_id = new.id and b.belge_turu = 'diploma' and b.durum <> 'reddedildi')
         or not exists (select 1 from public.dogrulama_belgeleri b where b.uzman_id = new.id and b.belge_turu = 'yuksek_lisans' and b.durum <> 'reddedildi')
       ) then
      raise exception 'İncelemeye göndermek için lisans ve klinik psikoloji yüksek lisans mezuniyet belgelerinizi ya da Sağlık Bakanlığı sağlık personeli belgenizi yükleyin.'
        using errcode = 'P0001';
    end if;
  end if;

  if old.durum not in ('taslak', 'reddedildi', 'ek_belge')
     and (new.ad, new.soyad, new.unvan, new.unvan_oneki)
         is distinct from (old.ad, old.soyad, old.unvan, old.unvan_oneki) then
    raise exception 'Ad, soyad ve unvan bilgileri doğrulamadan sonra değiştirilemez. Lütfen yönetimle iletişime geçin.'
      using errcode = '42501';
  end if;

  if new.yeni_danisan is distinct from old.yeni_danisan
     or new.kabul_durumu_guncellenme is distinct from old.kabul_durumu_guncellenme then
    new.kabul_durumu_guncellenme := now();
  end if;

  return new;
end;
$function$;

