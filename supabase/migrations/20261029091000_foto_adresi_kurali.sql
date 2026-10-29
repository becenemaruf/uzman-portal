-- Profil fotoğrafı yalnızca platformun kendi deposundan (ya da sitedeki örnek görsellerden) gelebilir.
-- Böylece bir profile dışarıdan, ziyaretçiyi izleyen ya da uygunsuz bir görsel bağlanamaz.
alter table public.uzmanlar drop constraint if exists uzmanlar_foto_yolu_check;
alter table public.uzmanlar add constraint uzmanlar_foto_yolu_check check (
  char_length(foto_yolu) <= 300
  and foto_yolu ~ '^(https://nzkkbnhwxmjcywvghxon\.supabase\.co/storage/v1/object/public/uzman-fotograflari/[0-9a-f-]{36}/[A-Za-z0-9._-]+|assets/img/uzmanlar/[A-Za-z0-9._-]+)$'
);
