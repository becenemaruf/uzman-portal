-- =====================================================================
-- SOSYAL MEDYA BAĞLANTILARI (uzmanlar tablosu)
-- Hepsi isteğe bağlıdır. Her alana yalnızca kendi platformunun https adresi yazılabilir;
-- böylece bir profilde "Instagram" adıyla başka bir siteye (ör. kötü amaçlı) bağlantı verilemez.
-- Herkese açık profilde gösterilir (uzman bu alanları yayımlanmak üzere doldurur).
-- =====================================================================
alter table public.uzmanlar
  add column if not exists instagram  text,
  add column if not exists linkedin   text,
  add column if not exists x_hesabi   text,
  add column if not exists youtube    text,
  add column if not exists facebook   text,
  add column if not exists tiktok     text,
  add column if not exists web_sitesi text;

alter table public.uzmanlar
  add constraint uzmanlar_instagram_check check (instagram ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]{1,30}/?$'),
  add constraint uzmanlar_linkedin_check  check (linkedin  ~ '^https://([a-z]{2,3}\.)?linkedin\.com/(in|company)/[A-Za-z0-9_%-]{2,100}/?$'),
  add constraint uzmanlar_x_hesabi_check  check (x_hesabi  ~ '^https://(www\.)?(x|twitter)\.com/[A-Za-z0-9_]{1,15}/?$'),
  add constraint uzmanlar_youtube_check   check (youtube   ~ '^https://(www\.)?youtube\.com/(@[A-Za-z0-9._-]{3,30}|channel/[A-Za-z0-9_-]{10,40}|c/[A-Za-z0-9._-]{1,100})/?$'),
  add constraint uzmanlar_facebook_check  check (facebook  ~ '^https://(www\.)?facebook\.com/([A-Za-z0-9.-]{2,80}|profile\.php\?id=[0-9]{5,20})/?$'),
  add constraint uzmanlar_tiktok_check    check (tiktok    ~ '^https://(www\.)?tiktok\.com/@[A-Za-z0-9._]{2,24}/?$'),
  add constraint uzmanlar_web_sitesi_check check (
    char_length(web_sitesi) <= 250
    and web_sitesi ~* '^https://[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+(/[^\s<>"'']*)?$'
  );

comment on column public.uzmanlar.web_sitesi is 'Uzmanın kendi web sitesi (yalnızca https).';
