-- =====================================================================
-- 6) YENİ DURUMLAR
-- "Reddedildi" tek seçenekken gereğinden sertti. Yumuşak ara durumlar eklenir:
--  - ek_belge          : Yönetici, profili onaylamak için ek belge istiyor
--  - duzeltme_istendi  : Editör, yazının yayımlanması için düzeltme istiyor
-- (Yeni enum değerleri ayrı bir adımda eklenir; PostgreSQL bunları aynı adımda kullanmaya izin vermez.)
-- =====================================================================
alter type public.uzman_durumu add value if not exists 'ek_belge' after 'incelemede';
alter type public.yazi_durumu  add value if not exists 'duzeltme_istendi' after 'incelemede';
