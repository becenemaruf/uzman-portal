// =====================================================================
// BELGE TEMİZLE (Supabase Edge Function)
// Doğrulama belgelerinin DOSYALARINI, inceleme kararından (onay ya da ret) 30 gün sonra siler.
// Veritabanındaki doğrulama KAYDI kalır: belge türü, e-Devlet doğrulama kodu, karar, karar tarihi
// ve dosyanın silindiği tarih. Böylece "kim, ne zaman, hangi belgeyle doğrulandı" bilgisi korunur,
// ama kimlik numarası gibi ayrıntılar içeren belge görüntüsü elimizde birikmez (KVKK: ölçülülük).
//
// Her gün veritabanındaki zamanlanmış görev (pg_cron) tarafından çağrılır.
// Yalnızca süresi dolmuş dosyaları siler; başka hiçbir şey yapmaz. Bu yüzden dışarıdan
// çağrılması zarar vermez (en kötü ihtimalle zaten yapılacak temizliği erken yapar).
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından otomatik sağlanır.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SAKLAMA_GUN = 30;
const DEPO = "dogrulama-belgeleri";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Yalnızca POST", { status: 405 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sinir = new Date(Date.now() - SAKLAMA_GUN * 24 * 60 * 60 * 1000).toISOString();

  const { data: belgeler, error } = await db
    .from("dogrulama_belgeleri")
    .select("id, dosya_yolu")
    .in("durum", ["onaylandi", "reddedildi"])
    .lt("inceleme_tarihi", sinir)
    .is("dosya_silindi", null)
    .limit(500);
  if (error) {
    console.error("Belgeler okunamadı:", error.message);
    return new Response(JSON.stringify({ hata: "okuma" }), { status: 500 });
  }
  if (!belgeler?.length) return new Response(JSON.stringify({ silinen: 0 }), { headers: { "content-type": "application/json" } });

  const { error: dErr } = await db.storage.from(DEPO).remove(belgeler.map((b) => b.dosya_yolu));
  if (dErr) {
    console.error("Dosyalar silinemedi:", dErr.message);
    return new Response(JSON.stringify({ hata: "silme" }), { status: 500 });
  }
  const { error: gErr } = await db
    .from("dogrulama_belgeleri")
    .update({ dosya_silindi: new Date().toISOString() })
    .in("id", belgeler.map((b) => b.id));
  if (gErr) console.error("Kayıtlar güncellenemedi:", gErr.message);

  return new Response(JSON.stringify({ silinen: belgeler.length }), { headers: { "content-type": "application/json" } });
});
