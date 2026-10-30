-- Danışman uyarısı: yabancı anahtarlara dizin
create index if not exists destek_talepleri_uzman_idx on public.destek_talepleri (uzman_id);
create index if not exists sistem_bildirimleri_ust_idx on public.sistem_bildirimleri (ust_bildirim_id);
