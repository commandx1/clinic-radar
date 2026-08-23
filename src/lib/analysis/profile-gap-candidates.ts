import {
  buildReplyRateTaskContent,
  buildWebsiteTaskContent,
} from "@/lib/analysis/profile-gap-templates";
import type { ScoredTaskCandidate } from "@/lib/analysis/task-candidates";
import {
  PROFILE_GAP_MIN_OWN_UNREPLIED,
  PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_RATE,
  PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_REVIEWS,
  PROFILE_GAP_REPLY_RATE_MIN_GAP,
  PROFILE_GAP_WEBSITE_MIN_COMPETITOR_SHARE,
} from "@/lib/constants";
import { computeCompetitiveGapImpactScore } from "@/lib/task-engine/impact-score";

// bkz. docs/02-business-rules.md Bölüm D üçüncü kaynak — "Profil farkı"
// görevleri (source_type='profile_gap'), Aşama 1/2 Claude çağrılarından değil,
// zaten elimizde olan verilerden (reviews.owner_reply, businesses/competitors.website)
// uygulama kodunda deterministik üretilir. AI pipeline başarısız olsa bile
// hesaplanabilir/upsert edilebilir olması bilinçli bir tasarım kararı
// (execute-analysis.ts runStage2AndUpsertTasks).
export interface ProfileGapOwnStats {
  total: number;
  replied: number;
  website: string | null;
}

export interface ProfileGapCompetitorStats {
  id: string;
  name: string;
  total: number;
  replied: number;
  website: string | null;
}

export interface ProfileGapStats {
  own: ProfileGapOwnStats;
  competitors: ProfileGapCompetitorStats[];
  // Analiz penceresinin gerçek gün sayısı (bkz. execute-analysis.ts
  // determineAnalysisWindowDays) — kanıt metninde ("son N günde") kullanılır.
  windowDays: number;
}

function replyRate(stats: { total: number; replied: number }): number {
  return stats.total > 0 ? stats.replied / stats.total : 0;
}

// En yüksek yanıt oranına sahip rakip seçilir (eşitlikte en çok yoruma sahip
// olan kazanır) — `based_on_competitor_id` ve "referans rakip" seçimi bu
// fonksiyonla yapılır (bkz. buildReplyRateCandidate).
function pickHighestRateCompetitor(
  competitors: ProfileGapCompetitorStats[],
): ProfileGapCompetitorStats {
  return competitors.slice().sort((a, b) => {
    const rateDiff = replyRate(b) - replyRate(a);
    return rateDiff !== 0 ? rateDiff : b.total - a.total;
  })[0];
}

// Kural A: own tarafında rakiplere kıyasla belirgin derecede düşük yorum
// yanıt oranı. Görev, İKİ yoldan biriyle tetiklenir (bkz. constants.ts
// PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_RATE üzerindeki not, docs/02-business-rules.md
// Bölüm D): (a) rakip ortalama yanıt oranı eşiği geçerse (eski davranış), YA
// DA (b) hacim eşiğini (PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_REVIEWS)
// geçen rakiplerden en az biri TEK BAŞINA eşiği geçerse — gerçek veride
// (Mersin pilotu) 3 rakipten biri 169/169 yanıtlarken diğer ikisi 0 yanıt
// verince ortalama (%33) eşiğin altında kalıp bu gerçek fırsatı gizliyordu.
function buildReplyRateCandidate(stats: ProfileGapStats): ScoredTaskCandidate | null {
  const eligibleCompetitors = stats.competitors.filter((c) => c.total >= 1);
  if (eligibleCompetitors.length === 0) {
    return null;
  }

  const ownRate = replyRate(stats.own);
  const ownUnreplied = stats.own.total - stats.own.replied;
  const competitorAvgRate =
    eligibleCompetitors.reduce((sum, c) => sum + replyRate(c), 0) / eligibleCompetitors.length;

  // Hacim eşiğini geçen rakipler (potansiyel "referans rakip" havuzu) — az
  // yorumlu bir rakibin şans eseri yüksek orana sahip olması (ör. 3/3) tek
  // başına referans olamaz, gürültü sayılır.
  const volumeQualifiedCompetitors = eligibleCompetitors.filter(
    (c) => c.total >= PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_REVIEWS,
  );

  // Referans rakip ve oranı: hacim eşiğini geçen rakip varsa aralarında en
  // yüksek orana sahip olan seçilir ve KENDİ oranı referans oran olur; yoksa
  // eski davranışa (rakip ortalaması, en yüksek orana sahip rakip based_on
  // olarak) düşülür.
  const basedOnCompetitor =
    volumeQualifiedCompetitors.length > 0
      ? pickHighestRateCompetitor(volumeQualifiedCompetitors)
      : pickHighestRateCompetitor(eligibleCompetitors);
  const referenceRate =
    volumeQualifiedCompetitors.length > 0 ? replyRate(basedOnCompetitor) : competitorAvgRate;

  const meanEligible = competitorAvgRate >= PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_RATE;
  const volumeEligible =
    volumeQualifiedCompetitors.length > 0 && referenceRate >= PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_RATE;

  const eligible =
    (meanEligible || volumeEligible) &&
    referenceRate - ownRate >= PROFILE_GAP_REPLY_RATE_MIN_GAP &&
    ownUnreplied >= PROFILE_GAP_MIN_OWN_UNREPLIED;

  if (!eligible) {
    return null;
  }

  // Reuse edilen formül: prevalence = referans rakibin yanıt oranı
  // (kullanıcının gerçekte karşılaştırıldığı sayı), deficiency = own
  // yanıtsız oranı — bkz. docs/09-task-engine.md "profile_gap impact eşlemesi".
  const { score, breakdown } = computeCompetitiveGapImpactScore(
    {
      positive_mentions: Math.round(referenceRate * 100),
      negative_mentions: Math.round((1 - referenceRate) * 100),
    },
    {
      positive_mentions: Math.round(ownRate * 100),
      negative_mentions: Math.round((1 - ownRate) * 100),
    },
    null,
  );

  const { title, description, checklist } = buildReplyRateTaskContent({
    unrepliedCount: ownUnreplied,
    ownRatePct: Math.round(ownRate * 100),
    competitorRatePct: Math.round(referenceRate * 100),
    competitorName: basedOnCompetitor.name,
    competitorCount: basedOnCompetitor.total,
    windowDays: stats.windowDays,
  });

  return {
    title,
    description,
    source_type: "profile_gap",
    based_on_competitor_id: basedOnCompetitor.id,
    theme: "profile:reply_rate",
    effort_score: 1,
    checklist,
    impact_score: score,
    impact_score_breakdown: breakdown,
  };
}

// Kural B: own'un website'ı yok ama rakiplerin çoğunluğunun var.
function buildWebsiteCandidate(stats: ProfileGapStats): ScoredTaskCandidate | null {
  const hasOwnWebsite = Boolean(stats.own.website && stats.own.website.trim() !== "");
  if (hasOwnWebsite || stats.competitors.length === 0) {
    return null;
  }

  const withWebsite = stats.competitors.filter((c) => c.website && c.website.trim() !== "");
  const share = withWebsite.length / stats.competitors.length;
  if (share < PROFILE_GAP_WEBSITE_MIN_COMPETITOR_SHARE) {
    return null;
  }

  // own teması yok (undefined) → tam eksiklik (100), bkz. impact-score.ts.
  const { score, breakdown } = computeCompetitiveGapImpactScore(
    { positive_mentions: Math.round(share * 100), negative_mentions: Math.round((1 - share) * 100) },
    undefined,
    null,
  );

  const { title, description, checklist } = buildWebsiteTaskContent({
    competitorSharePct: Math.round(share * 100),
  });

  return {
    title,
    description,
    source_type: "profile_gap",
    based_on_competitor_id: null,
    theme: "profile:website",
    effort_score: 2,
    checklist,
    impact_score: score,
    impact_score_breakdown: breakdown,
  };
}

export function buildProfileGapCandidates(stats: ProfileGapStats): ScoredTaskCandidate[] {
  return [buildReplyRateCandidate(stats), buildWebsiteCandidate(stats)].filter(
    (candidate): candidate is ScoredTaskCandidate => candidate !== null,
  );
}
