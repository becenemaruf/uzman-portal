-- =====================================================================
-- UZMANIN KENDİ HESABINI SİLMESİ (KVKK: silme hakkı)
-- "hesap-sil" sunucu fonksiyonu önce uzmanın dosyalarını (fotoğraf, belgeler) siler,
-- sonra uzmanın KENDİ oturumuyla bu fonksiyonu çağırır, en son giriş hesabını siler.
-- Profil silinince bağlı her şey (eğitim, SSS, iletişim, belgeler, mesajlar, yazılar) birlikte silinir.
-- Yönetici hesapları bu yolla silinemez.
-- =====================================================================
create or replace function public.profilimi_sil()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_sayi integer;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli.' using errcode = '42501';
  end if;
  if ozel.yonetici_mi() then
    raise exception 'Yönetici hesabı bu yolla silinemez.' using errcode = '42501';
  end if;
  delete from public.uzmanlar where kullanici_id = auth.uid();
  get diagnostics v_sayi = row_count;
  return v_sayi;
end;
$$;
revoke execute on function public.profilimi_sil() from public, anon;
grant execute on function public.profilimi_sil() to authenticated;
