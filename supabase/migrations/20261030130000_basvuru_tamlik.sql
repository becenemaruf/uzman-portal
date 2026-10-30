-- Uzman, profilini incelemeye gönderirken (durum → incelemede) profil yeterince dolu olmalı.
-- Kurallar uzman panelindeki kontrolle aynıdır (ProfilDuzenle.eksikler). Yönetici ve sistem işlemleri etkilenmez.
create or replace function ozel.basvuru_tamligini_denetle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_alan integer;
  v_egitim integer;
  v_eksik text[] := '{}';
begin
  if new.durum <> 'incelemede' or old.durum = 'incelemede' or ozel.sistem_mi() or ozel.yonetici_mi() then
    return new;
  end if;
  select count(*) into v_alan from public.uzman_uzmanliklar where uzman_id = new.id;
  select count(*) into v_egitim from public.uzman_egitimler where uzman_id = new.id and tur = 'egitim';
  if new.foto_yolu is null then v_eksik := v_eksik || 'profil fotoğrafı'; end if;
  if new.sehir is null then v_eksik := v_eksik || 'şehir'; end if;
  if char_length(coalesce(btrim(new.kisa_tanitim), '')) < 80 then v_eksik := v_eksik || 'kısa tanıtım (en az 80 karakter)'; end if;
  if char_length(coalesce(btrim(new.hakkinda), '')) < 400 then v_eksik := v_eksik || 'hakkımda yazısı (en az 400 karakter)'; end if;
  if not coalesce(new.gorusme_online, false) and not coalesce(new.gorusme_yuzyuze, false) then v_eksik := v_eksik || 'görüşme şekli'; end if;
  if v_alan < 3 then v_eksik := v_eksik || 'en az 3 çalışma alanı'; end if;
  if v_egitim < 2 then v_eksik := v_eksik || 'akademik eğitim (lisans ve yüksek lisans)'; end if;
  if array_length(v_eksik, 1) > 0 then
    raise exception 'Profiliniz incelemeye gönderilemedi. Eksik: %', array_to_string(v_eksik, ', ') using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger uzmanlar_tamlik before update of durum on public.uzmanlar
  for each row execute function ozel.basvuru_tamligini_denetle();
