-- =====================================================================
-- İNCELEMEYE GÖNDERME KURALLARI
-- 1) Uzman profilini ancak psikoloji lisans ve klinik psikoloji yüksek lisans diplomalarını
--    yükledikten sonra "incelemede" durumuna geçirebilir (panel de kontrol eder; bu, sunucu tarafı güvencedir).
-- 2) Uzmanın eklediği belge kaydı yalnızca kendi klasöründeki bir dosyayı gösterebilir.
-- =====================================================================
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

  -- İncelemeye göndermeden önce iki diploma yüklenmiş olmalı (reddedilmemiş).
  if new.durum = 'incelemede' and old.durum is distinct from 'incelemede' then
    if not exists (select 1 from public.dogrulama_belgeleri b where b.uzman_id = new.id and b.belge_turu = 'diploma' and b.durum <> 'reddedildi')
       or not exists (select 1 from public.dogrulama_belgeleri b where b.uzman_id = new.id and b.belge_turu = 'yuksek_lisans' and b.durum <> 'reddedildi') then
      raise exception 'İncelemeye göndermek için psikoloji lisans ve klinik psikoloji yüksek lisans diplomalarınızı yükleyin.'
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

create or replace function ozel.belge_degisikligini_denetle()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' and not (ozel.sistem_mi() or ozel.yonetici_mi()) then
    if new.dosya_yolu not like (auth.uid())::text || '/%' then
      raise exception 'Belge yalnızca kendi klasörünüzden eklenebilir.' using errcode = '42501';
    end if;
    new.durum           := 'bekliyor';
    new.yonetici_notu   := null;
    new.inceleme_tarihi := null;
    new.inceleyen       := null;
  elsif tg_op = 'UPDATE' and new.durum is distinct from old.durum then
    new.inceleme_tarihi := now();
    new.inceleyen       := auth.uid();
  end if;
  return new;
end;
$function$;
