import { fetchTrustpilotReviews } from "@/lib/apify/trustpilot-reviews";

// Trustpilot domain-çözümleme (probe) — bkz. migration
// 20260727000001_trustpilot_source.sql.
//
// Trustpilot'ta şirket kimliği domain'dir ve kayıt "www." konusunda
// TUTARSIZ (canlı ölçüm):
//   - natural.clinic          -> çalışıyor
//     www.natural.clinic      -> boş
//   - veraclinic.net          -> boş
//     www.veraclinic.net      -> çalışıyor
//   - dinamikdis.com          -> boş (her iki varyantta da) = profil yok
// Bu yüzden `resolveTrustpilotDomain` iki varyantı da sırayla dener.
//
// `null` dönüşü "profil yok" anlamına gelir — bir hata değil, bir bulgu.
// Çağıran taraf yine de `trustpilot_checked_at`'i doldurmalıdır (bkz. yukarıdaki
// migration'ın yorumu): aksi halde her analiz döngüsünde aynı işletme için
// probe tekrar tekrar çalışır ve gereksiz Apify çağrısına/masrafına yol açar.

export function extractHost(website: string | null): string | null {
  if (!website) {
    return null;
  }
  const withScheme = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  try {
    return new URL(withScheme).host.toLowerCase();
  } catch {
    return null;
  }
}

// Kullanıcının işletme düzenleme formunda elle girdiği Trustpilot domain'ini
// normalize eder (bkz. business-edit-form.tsx). Üç girdi biçimini kabul eder:
// ham domain ("natural.clinic"), site URL'i ("https://www.veraclinic.net/tr")
// ve Trustpilot profil URL'i ("https://www.trustpilot.com/review/natural.clinic").
// Son biçim `extractHost` ile YANLIŞ sonuç verir (host trustpilot.com'un
// kendisi olur), bu yüzden `trustpilot.com/review/<domain>` kalıbı host
// çözümlemesinden ÖNCE özel olarak yakalanır. www korunur (silinmez) — bkz.
// yukarıdaki dosya yorumu, Trustpilot'ta www kaydı tutarsız/kimlik belirleyici.
export function normalizeTrustpilotDomainInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Trustpilot profil URL'i: .../review/<domain> — "/reviews/" değil, tekil
  // "/review/" profil sayfası kalıbıdır. Query/hash varsa domain'e dahil etme.
  const profileMatch = /trustpilot\.[a-z.]+\/review\/([^/?#]+)/i.exec(trimmed);
  if (profileMatch) {
    const domain = profileMatch[1].trim().toLowerCase();
    return domain || null;
  }

  return extractHost(trimmed);
}

export async function resolveTrustpilotDomain(
  website: string | null,
  opts: { timeoutMs?: number } = {},
): Promise<string | null> {
  const host = extractHost(website);
  if (!host) {
    return null;
  }

  const withoutWww = host.startsWith("www.") ? host.slice(4) : host;
  const withWww = `www.${withoutWww}`;
  const variants = [withoutWww, withWww];

  for (const variant of variants) {
    try {
      // maxPages: 1 — probe yalnızca "profil var mı" sorusunu sorar; actor
      // pay-per-result olduğu için varsayılan 2 sayfayı çekip atmak boşa
      // ödeme demektir (owner başına en fazla 2 probe × 1 sayfa).
      const reviews = await fetchTrustpilotReviews([variant], 1, { ...opts, maxPages: 1 });
      if (reviews.length > 0) {
        return variant;
      }
    } catch (error) {
      // Bir varyantın probe çağrısı hata fırlatırsa yakalanır ve diğer
      // varyantla devam edilir — probe hatası tüm analizi düşürmemeli
      // (bkz. fetch-all.ts'teki hata izolasyonu felsefesi).
      console.error(`Trustpilot domain probe başarısız (${variant}):`, error);
    }
  }

  return null;
}
