-- =====================================================================
-- KLİNİK PSİKOLOG DÖNÜŞÜMÜ (28 Ekim 2026)
-- Platform yalnızca klinik psikologlarla yayına başlıyor. Diğer meslekler SİLİNMEDİ:
--  - Unvan kuralı tüm meslekleri kabul etmeye devam ediyor (ileride açılabilir).
--  - Diğer mesleklere özgü çalışma alanları ve yaklaşımlar "aktif = false" yapıldı.
--  - Yalnızca ÖRNEK (ornek = true) profiller klinik psikoloğa dönüştürüldü.
-- Geri almak için: ilgili satırlarda aktif = true yapmak yeterlidir.
-- =====================================================================

-- 1) Diğer mesleklere özgü alan ve yaklaşımlar pasif
update public.uzmanlik_alanlari set aktif = false
 where kategori = 'gelisim' or ad in ('Psikososyal Destek', 'Bakım Veren Desteği');
update public.yaklasimlar set aktif = false where ad = 'Psikofarmakoloji';

-- 2) Örnek profillerde pasif alan bağlantılarını kaldır, yerlerine klinik alanlar ekle
create temp table _ek_alan (slug text, ad text, sira smallint);
insert into _ek_alan values
  ('alper-aksoy','Çocuk ve Ergen',1), ('alper-aksoy','Dikkat Eksikliği ve Hiperaktivite',2),
  ('nazli-polat','Çocuk ve Ergen',1), ('nazli-polat','Dikkat Eksikliği ve Hiperaktivite',2),
  ('gamze-coskun','Çocuk ve Ergen',1), ('gamze-coskun','Ebeveyn Danışmanlığı',2),
  ('asli-aydemir','Çocuk ve Ergen',1), ('asli-aydemir','Ebeveyn Danışmanlığı',2),
  ('ugur-kurt','Okul Uyumu',2), ('tugba-bozkurt','Okul Uyumu',2),
  ('busra-yilmaz','Çocuk ve Ergen',0), ('levent-bozkurt','Çocuk ve Ergen',0),
  ('gamze-polat','Tükenmişlik',0), ('gamze-polat','Depresyon',1),
  ('asli-ozkan','Tükenmişlik',0), ('asli-ozkan','Depresyon',1),
  ('burak-yildiz','Çift Terapisi',0);

delete from public.uzman_uzmanliklar uu
 using public.uzmanlar z, public.uzmanlik_alanlari a
 where uu.uzman_id = z.id and uu.alan_id = a.id and z.ornek and not a.aktif;

insert into public.uzman_uzmanliklar (uzman_id, alan_id, sira)
select z.id, a.id, e.sira
  from _ek_alan e
  join public.uzmanlar z on z.slug = e.slug and z.ornek
  join public.uzmanlik_alanlari a on a.ad = e.ad
on conflict do nothing;

-- 3) Psikofarmakoloji yerine terapi yaklaşımı (çocuk-ergen çalışanlara oyun terapisi)
insert into public.uzman_yaklasimlar (uzman_id, yaklasim_id, sira)
select z.id, y.id, 9
  from public.uzmanlar z
  join public.yaklasimlar y on y.ad = case when z.unvan = 'Çocuk ve Ergen Psikiyatristi' then 'Oyun Terapisi'
                                           else 'Bilişsel Davranışçı Terapi (BDT)' end
 where z.ornek and exists (
   select 1 from public.uzman_yaklasimlar uy join public.yaklasimlar p on p.id = uy.yaklasim_id
    where uy.uzman_id = z.id and p.ad = 'Psikofarmakoloji')
on conflict do nothing;

delete from public.uzman_yaklasimlar uy
 using public.uzmanlar z, public.yaklasimlar y
 where uy.uzman_id = z.id and uy.yaklasim_id = y.id and z.ornek and not y.aktif;

-- Yaklaşımı olmayan (eski dil-konuşma, ergoterapi, özel eğitim) örnek profillere yaklaşım
insert into public.uzman_yaklasimlar (uzman_id, yaklasim_id, sira)
select z.id, y.id, 0
  from public.uzmanlar z
  join public.yaklasimlar y on y.ad = case when z.slug in ('alper-aksoy','nazli-polat','gamze-coskun','asli-aydemir')
                                           then 'Oyun Terapisi' else 'Bilişsel Davranışçı Terapi (BDT)' end
 where z.ornek and not exists (select 1 from public.uzman_yaklasimlar uy where uy.uzman_id = z.id)
on conflict do nothing;

-- 4) Tanıtım metinleri (mesleğe özgü ifadeler içerenler)
update public.uzmanlar z set kisa_tanitim = t.metin
  from (values
    ('alper-aksoy',   'Otizm spektrumu, dikkat eksikliği ve gelişimsel güçlükler yaşayan çocuklar ve aileleriyle çalışıyorum.'),
    ('nazli-polat',   'Otizm spektrumu, dikkat eksikliği ve gelişimsel güçlükler yaşayan çocuklar ve aileleriyle çalışıyorum.'),
    ('gamze-coskun',  'Çocukluk dönemi kaygıları, otizm spektrumu ve ebeveynlik konularında çocuklar ve ailelerle çalışıyorum.'),
    ('asli-aydemir',  'Çocukluk dönemi kaygıları, otizm spektrumu ve ebeveynlik konularında çocuklar ve ailelerle çalışıyorum.'),
    ('ugur-kurt',     'Öğrenme güçlüğü, dikkat sorunları ve okul uyumu konularında çocuk ve ergenlerle çalışıyorum.'),
    ('tugba-bozkurt', 'Öğrenme güçlüğü, dikkat sorunları ve okul uyumu konularında çocuk ve ergenlerle çalışıyorum.'),
    ('busra-yilmaz',  'Okul öncesi ve okul çağındaki çocuklar ve ebeveynleriyle uyum, kaygı ve davranış konularında çalışıyorum.'),
    ('levent-bozkurt','Okul öncesi ve okul çağındaki çocuklar ve ebeveynleriyle uyum, kaygı ve davranış konularında çalışıyorum.'),
    ('gamze-polat',   'Bakım veren aile üyeleri, tükenmişlik ve aile içi iletişim konularında yetişkinlerle çalışıyorum.'),
    ('asli-ozkan',    'Bakım veren aile üyeleri, tükenmişlik ve aile içi iletişim konularında yetişkinlerle çalışıyorum.'),
    ('burak-yildiz',  'Boşanma süreci ve aile içi iletişim konularında çiftler ve ailelerle çalışıyorum.'),
    ('deniz-koc',     'Dikkat eksikliği ve hiperaktivite, otizm spektrumu ve çocukluk kaygılarında psikolojik değerlendirme ve terapi.'),
    ('murat-kaya',    'Depresyon, bipolar bozukluk ve yetişkin dikkat eksikliğinde psikolojik değerlendirme ve psikoterapi.')
  ) as t(slug, metin)
 where z.slug = t.slug and z.ornek;

-- Murat Kaya (önceden psikiyatrist örneği): hakkında metni, seans süresi
update public.uzmanlar set
  hakkinda = 'On dört yıldır klinik psikolog olarak yetişkin ve ergenlerle çalışıyorum. Psikolojik değerlendirme, bilişsel davranışçı terapi ve destekleyici psikoterapi yöntemlerini kullanıyorum.' || E'\n\n' ||
             'İlaç tedavisi gerektiren durumlarda danışanlarımı psikiyatrist meslektaşlarımla birlikte takip ediyorum.',
  seans_suresi = '50 dakika'
 where slug = 'murat-kaya' and ornek;

-- 5) Eğitim bilgileri (klinik psikoloji yüksek lisansı)
delete from public.uzman_egitimler e using public.uzmanlar z
 where e.uzman_id = z.id and z.ornek and z.slug in ('murat-kaya', 'zeynep-sahin');
insert into public.uzman_egitimler (uzman_id, tur, metin, sira)
select z.id, 'egitim', v.metin, v.sira
  from (values
    ('murat-kaya',   'Lisans — Psikoloji, Hacettepe Üniversitesi (2008)', 0),
    ('murat-kaya',   'Yüksek Lisans — Klinik Psikoloji, Ankara Üniversitesi (2011)', 1),
    ('murat-kaya',   'Doktora — Klinik Psikoloji, Hacettepe Üniversitesi (2017)', 2),
    ('zeynep-sahin', 'Lisans — Psikoloji, Ege Üniversitesi (2013)', 0),
    ('zeynep-sahin', 'Yüksek Lisans — Klinik Psikoloji (Çocuk ve Ergen), Ege Üniversitesi (2015)', 1),
    ('can-ozturk',   'Yüksek Lisans — Klinik Psikoloji, Bursa Uludağ Üniversitesi (2022)', 1)
  ) as v(slug, metin, sira)
  join public.uzmanlar z on z.slug = v.slug and z.ornek;

-- Murat Kaya'nın sık sorulan sorusu
update public.uzman_sss s set
  soru = 'Klinik psikolog ile psikiyatrist arasındaki fark nedir?',
  cevap = 'Psikiyatristler tıp eğitimi almış hekimlerdir ve ilaç tedavisi düzenleyebilir. Klinik psikologlar ise psikolojik değerlendirme ve psikoterapi yapar; gerektiğinde psikiyatristlerle birlikte çalışır.'
  from public.uzmanlar z
 where s.uzman_id = z.id and z.slug = 'murat-kaya' and z.ornek;

-- 6) İlaç tedavisi üzerine olan örnek blog yazısı
update public.yazilar set
  baslik = 'Depresyonda psikoterapi: sık sorulan sorular',
  ozet = 'Terapi ne kadar sürer, etkisi ne zaman hissedilir, ilaç tedavisiyle birlikte yürütülebilir mi? Psikoterapiye başlamadan önce merak edilenler.'
 where slug = 'depresyon-ilac';

-- 7) Unvan ve unvan öneki (Uzm. Dr. hekimlere özgüdür)
update public.uzmanlar set unvan = 'Klinik Psikolog', unvan_oneki = case when slug = 'murat-kaya' then 'Dr.' else null end
 where ornek and (unvan <> 'Klinik Psikolog' or unvan_oneki is not null);
drop table _ek_alan;
