-- e-Devlet (YÖK) mezun belgesi desteği: belgenin biçimi ve doğrulama kodu.
-- Yönetici, doğrulama kodunu e-Devlet belge doğrulama hizmetinde kontrol eder.
alter table public.dogrulama_belgeleri
  add column if not exists kaynak text not null default 'diploma',
  add column if not exists dogrulama_kodu text;
alter table public.dogrulama_belgeleri
  add constraint dogrulama_belgeleri_kaynak_check check (kaynak in ('edevlet', 'diploma', 'diger')),
  add constraint dogrulama_belgeleri_kod_check check (dogrulama_kodu ~ '^[A-Za-z0-9-]{4,64}$'),
  add constraint dogrulama_belgeleri_edevlet_kod_check check (kaynak <> 'edevlet' or dogrulama_kodu is not null);
comment on column public.dogrulama_belgeleri.dogrulama_kodu is 'e-Devlet belgesindeki doğrulama (barkod) kodu.';
