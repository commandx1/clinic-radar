import type { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ReviewSource } from "@/lib/reviews/types";

import { ReplyDraftPanel } from "./reply-draft-panel";

export type ReviewsTranslator = Awaited<ReturnType<typeof getTranslations<"business.reviews">>>;

// Kaynak adı çeviri anahtarları. Record<ReviewSource, ...> bilinçli: `ReviewSource`
// birliğine yeni bir kaynak eklendiğinde burası derleme hatası verir, böylece
// yorum kartı sessizce "kaynağı bilinmeyen" duruma düşmez.
const SOURCE_LABEL_KEYS: Record<ReviewSource, "sources.google" | "sources.trustpilot" | "sources.facebook"> = {
  google: "sources.google",
  trustpilot: "sources.trustpilot",
  facebook: "sources.facebook",
};

// DB'de `reviews.source` check constraint ile ReviewSource'a kısıtlı, ama üretilen
// Supabase tipleri onu `string` veriyor — bu yüzden burada daraltıyoruz. Bilinmeyen
// bir değer gelirse yanlış kaynak etiketi basmak yerine etiketsiz gösteriyoruz.
function sourceLabelKey(source: string): (typeof SOURCE_LABEL_KEYS)[ReviewSource] | null {
  return source in SOURCE_LABEL_KEYS ? SOURCE_LABEL_KEYS[source as ReviewSource] : null;
}

export function ReviewCard({
  t,
  locale,
  review,
}: {
  t: ReviewsTranslator;
  locale: string;
  review: {
    id: string;
    source: string;
    rating: number | null;
    published_at: string | null;
    owner_reply: string | null;
    review_url: string | null;
    reply_draft: string | null;
    reply_draft_generated_at: string | null;
    reply_marked_at: string | null;
  };
}) {
  const labelKey = sourceLabelKey(review.source);

  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{review.rating ?? "-"} ★</span>
          {labelKey && <Badge variant="outline">{t(labelKey)}</Badge>}
          {review.published_at && (
            <span className="text-xs text-muted-foreground">
              {new Date(review.published_at).toLocaleDateString(locale)}
            </span>
          )}
          <Badge variant={review.owner_reply ? "default" : "secondary"}>
            {review.owner_reply ? t("repliedBadge") : t("notRepliedBadge")}
          </Badge>
        </div>
        {review.review_url && (
          <a
            href={review.review_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            {labelKey ? t("viewOnSource", { source: t(labelKey) }) : t("viewSource")}
          </a>
        )}
        {!review.owner_reply && (
          <ReplyDraftPanel
            reviewId={review.id}
            initialDraft={review.reply_draft}
            initialMarkedAt={review.reply_marked_at}
            reviewUrl={review.review_url}
            sourceLabel={labelKey ? t(labelKey) : null}
            t={t}
          />
        )}
      </CardContent>
    </Card>
  );
}
