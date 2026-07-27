import { type SupabaseClient } from "@supabase/supabase-js";

import { extractHost, resolveTrustpilotDomain } from "@/lib/reviews/sources/trustpilot-domain";
import type { Database } from "@/types/database.types";

type AnalysisSupabaseClient = SupabaseClient<Database>;

interface TrustpilotProbeRow {
  id: string;
  website: string | null;
  trustpilot_domain: string | null;
  trustpilot_checked_at: string | null;
}

// Trustpilot domain çözümlemesini `executeAnalysis` için hazırlar — bkz.
// docs/02-business-rules.md "Trustpilot'a özgü kurallar".
//
// Cache semantiği (bkz. migration 20260727000001_trustpilot_source.sql):
// `trustpilot_checked_at` doluysa probe YAPILMAZ, kayıtlı `trustpilot_domain`
// (null olabilir — "profil yok" demektir) olduğu gibi kullanılır. Bu, aynı
// işletme/rakip için her analiz döngüsünde tekrar Apify çağrısı yapılmasını
// (ve masrafını) önler.
//
// Own-önce-gating kuralı: kullanıcının kendi işletmesinin Trustpilot domain'i
// çözülemediyse (own null ise — probe'dan ya da cache'ten fark etmez),
// rakipler için HİÇ probe yapılmaz ve boş bir sonuç döner. Gerekçe (ölçüm
// sonucu, docs/02-business-rules.md): yurt içi hasta odaklı kliniklerin
// Trustpilot profili çoğunlukla hiç yok; kendi işletmesinin profili yoksa
// rakiplerinde olma ihtimali de düşük, bu yüzden boşa Apify çağrısı
// yapılmaz.
//
// Bu fonksiyon çağıranı (executeAnalysis) asla throw ile bloklamaz — hem
// `resolveTrustpilotDomain` hem de buradaki DB update'leri kendi hatalarını
// yakalar/loglar, Trustpilot çözümlemesi tüm analizi düşürmemelidir.
export async function resolveTrustpilotRefs(
  supabase: AnalysisSupabaseClient,
  business: TrustpilotProbeRow,
  competitors: TrustpilotProbeRow[],
  opts?: { timeoutMs?: number },
): Promise<{ ownDomain: string | null; byCompetitorId: Map<string, string> }> {
  const ownDomain = await resolveAndPersist(supabase, "businesses", business, opts);

  const byCompetitorId = new Map<string, string>();
  if (!ownDomain) {
    // Kendi işletmenin Trustpilot profili yoksa rakipler hiç probe edilmez.
    return { ownDomain: null, byCompetitorId };
  }

  // Apify rate limit/maliyet kontrolü için rakipler sırayla işlenir
  // (Promise.all DEĞİL) — bkz. trustpilot-domain.ts'teki aynı gerekçe.
  for (const competitor of competitors) {
    const domain = await resolveAndPersist(supabase, "competitors", competitor, opts);
    if (domain) {
      byCompetitorId.set(competitor.id, domain);
    }
  }

  return { ownDomain, byCompetitorId };
}

async function resolveAndPersist(
  supabase: AnalysisSupabaseClient,
  table: "businesses" | "competitors",
  row: TrustpilotProbeRow,
  opts?: { timeoutMs?: number },
): Promise<string | null> {
  // Cache kuralı: daha önce bakılmışsa (checked_at dolu) probe atlanır,
  // kayıtlı domain (null olabilir) olduğu gibi kullanılır.
  if (row.trustpilot_checked_at !== null) {
    return row.trustpilot_domain;
  }

  // Website yoksa/parse edilemiyorsa ORTADA BİR KONTROL YOK: Apify çağrısı
  // hiç yapılmadı, dolayısıyla checked_at yazılmaz. Aksi halde bu satır
  // "bakıldı, profil yok" diye kalıcı olarak işaretlenirdi ve website sonradan
  // dolduğunda (Apify enrichment `businesses.website`'i sonradan yazabiliyor,
  // bkz. enrich-from-apify.ts; migration öncesi eklenmiş rakip satırlarında da
  // website null) bir daha ASLA probe edilmezdi. Burada cache'lememenin
  // maliyeti sıfır — extractHost saf bir string parse'ı, Apify çağrısı değil.
  if (extractHost(row.website) === null) {
    return null;
  }

  const domain = await resolveTrustpilotDomain(row.website, opts);

  // Sonuç null olsa bile checked_at yazılır — gerçekten probe edildi ve
  // "profil yok" bulundu; aksi halde her analiz döngüsünde tekrarlanırdı.
  const { error } = await supabase
    .from(table)
    .update({ trustpilot_domain: domain, trustpilot_checked_at: new Date().toISOString() })
    .eq("id", row.id);

  if (error) {
    console.error(`Trustpilot domain kaydedilemedi (${table}, id: ${row.id}):`, error);
  }

  return domain;
}
