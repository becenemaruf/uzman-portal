-- Manşet (slider) telefonlarda gösterilsin mi (yönetim > Genel site ayarları)
alter table public.site_ayarlari add column if not exists manset_mobil_goster boolean not null default true;
