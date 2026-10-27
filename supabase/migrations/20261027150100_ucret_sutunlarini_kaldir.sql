-- =====================================================================
-- 11) ÜCRET BİLGİSİNİN KALDIRILMASI
-- Arayüzde gösterilmeyen bir bilgiyi herkese açık tabloda tutmak, onu API üzerinden
-- yine de yayımlamak demektir. Bu yüzden sütunlar silinir.
-- =====================================================================
alter table public.uzmanlar drop column ucret_min, drop column ucret_max;
