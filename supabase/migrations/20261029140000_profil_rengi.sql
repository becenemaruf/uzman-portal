-- Uzmanın profil sayfasında kullanılacak tema rengi (hazır listeden; boşsa sitenin varsayılan laciverti)
alter table public.uzmanlar add column if not exists profil_rengi text
  check (profil_rengi in ('lacivert', 'mor', 'yesil', 'turkuaz', 'bordo', 'altin', 'gri'));
