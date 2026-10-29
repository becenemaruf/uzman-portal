-- Yeni tablolarda anon/authenticated rollerine TRUNCATE, REFERENCES ve TRIGGER yetkisi otomatik verilmesin.
-- (TRUNCATE satır güvenliği kurallarını atlar; bu yetki hiçbir ziyaretçiye ya da uzmana gerekmez.)
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;
