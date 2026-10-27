-- =====================================================================
-- 5) BAŞLANGIÇ LİSTELERİ
-- Uzmanların seçim yapacağı çalışma alanları ve terapi yaklaşımları,
-- ana sayfa için örnek manşetler. Listeler yönetici panelinden genişletilebilir.
-- =====================================================================

insert into public.uzmanlik_alanlari (ad, sira) values
  -- Kaygı ve ilgili sorunlar
  ('Kaygı Bozuklukları', 10), ('Panik Bozukluk', 11), ('Obsesif Kompulsif Bozukluk', 12), ('Sosyal Fobi', 13),
  -- Duygudurum
  ('Depresyon', 20), ('Bipolar Bozukluk', 21), ('Uyku Sorunları', 22),
  -- Travma ve kayıp
  ('Travma', 30), ('Yas ve Kayıp', 31),
  -- Yetişkin genel
  ('Tükenmişlik', 40), ('Özgüven ve Benlik Saygısı', 41), ('Dikkat Eksikliği (Yetişkin)', 42),
  ('Yeme Bozuklukları', 43), ('Bağımlılık', 44), ('Kariyer Danışmanlığı', 45),
  -- Çocuk ve ergen
  ('Çocuk ve Ergen', 50), ('Dikkat Eksikliği ve Hiperaktivite', 51), ('Otizm Spektrum Bozukluğu', 52),
  ('Dikkat ve Öğrenme Güçlükleri', 53), ('Sınav Kaygısı', 54), ('Okul Uyumu', 55),
  ('Ebeveyn Danışmanlığı', 56), ('Ergenlik Dönemi', 57),
  -- İlişki ve aile
  ('Çift Terapisi', 60), ('İlişki Sorunları', 61), ('Aile İçi İletişim', 62), ('Boşanma Süreci', 63),
  ('Öfke Kontrolü', 64);

insert into public.yaklasimlar (ad, sira) values
  ('Bilişsel Davranışçı Terapi (BDT)', 10), ('EMDR', 11), ('Şema Terapi', 12),
  ('Kabul ve Kararlılık Terapisi (ACT)', 13), ('Psikodinamik Terapi', 14),
  ('Çözüm Odaklı Kısa Süreli Terapi', 15), ('Duygu Odaklı Terapi', 16), ('Varoluşçu Terapi', 17),
  ('Sistemik Aile Terapisi', 20), ('Gottman Çift Terapisi', 21),
  ('Oyun Terapisi', 30), ('Ebeveyn Eğitimi', 31),
  ('Psikofarmakoloji', 40), ('Destekleyici Psikoterapi', 41);

insert into public.mansetler (tur, baslik, metin, buton_yazi, buton_adres, tema, gorsel_yolu, sira) values
  ('duyuru',  'Uzman başvuruları açıldı',
   'Profilinizi oluşturun; unvanınız doğrulandıktan sonra profiliniz danışanların karşısına çıksın.',
   'Profilinizi oluşturun', 'giris.html#kayit', 'yesil', 'assets/img/manset-basvuru.svg', 1),
  ('yenilik', 'Yeni filtre: Seans dili',
   'Artık uzmanları görüşme yapabildikleri dile göre de arayabilirsiniz.',
   'Filtreleri aç', '#aramaFormu', 'kum', 'assets/img/manset-dil.svg', 2),
  ('reklam',  'Örnek reklam alanı',
   'Eğitim, kitap ve etkinlik duyuruları bu alanda yer alabilir.',
   'Bilgi alın', '#', 'gri', 'assets/img/manset-etkinlik.svg', 3);
