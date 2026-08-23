"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import type { ReviewsTranslator } from "./review-card";
import { useReplyDraft, type ReplyTone } from "./use-reply-draft";

function ToneToggle({
  tone,
  onChange,
  t,
}: {
  tone: ReplyTone;
  onChange: (tone: ReplyTone) => void;
  t: ReviewsTranslator;
}) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>{t("replyDraft.toneLabel")}:</span>
      {(["warm", "formal"] as const).map((option) => (
        <Button
          key={option}
          type="button"
          variant={tone === option ? "secondary" : "ghost"}
          size="xs"
          onClick={() => {
            onChange(option);
          }}
        >
          {t(option === "warm" ? "replyDraft.toneWarm" : "replyDraft.toneFormal")}
        </Button>
      ))}
    </div>
  );
}

function ReplyDraftErrorMessage({ errorCode, t }: { errorCode: string; t: ReviewsTranslator }) {
  if (errorCode === "quota_exceeded") {
    return (
      <p className="text-xs text-destructive">
        {t("replyDraft.quotaUpsell")}{" "}
        <Link href="/business/billing" className="underline underline-offset-4">
          {t("replyDraft.quotaUpsellLink")}
        </Link>
      </p>
    );
  }

  // bkz. use-task-list-actions.ts — bilinmeyen hata kodu genericError'a düşer.
  const key = `replyDraft.errors.${errorCode}`;
  const message = t.has(key) ? t(key) : t("replyDraft.errors.genericError");

  return <p className="text-xs text-destructive">{message}</p>;
}

function MarkedAsRepliedControl({
  markedAt,
  onToggle,
  isMarking,
  t,
}: {
  markedAt: string | null;
  onToggle: () => void;
  isMarking: boolean;
  t: ReviewsTranslator;
}) {
  if (markedAt) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="default">{t("replyDraft.markedBadge")}</Badge>
        <Button type="button" variant="ghost" size="xs" onClick={onToggle} disabled={isMarking}>
          {t("replyDraft.undoMarkedButton")}
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onToggle} disabled={isMarking}>
      {t("replyDraft.markAsRepliedButton")}
    </Button>
  );
}

export function ReplyDraftPanel({
  reviewId,
  initialDraft,
  initialMarkedAt,
  reviewUrl,
  sourceLabel,
  t,
}: {
  reviewId: string;
  initialDraft: string | null;
  initialMarkedAt: string | null;
  reviewUrl: string | null;
  sourceLabel: string | null;
  t: ReviewsTranslator;
}) {
  const { tone, setTone, draftText, setDraftText, markedAt, generate, isGenerating, generateErrorCode, toggleMarked, isMarking } =
    useReplyDraft(reviewId, initialDraft, initialMarkedAt);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (draftText === null) {
      return;
    }
    await navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-2">
      {draftText === null ? (
        <div className="flex flex-wrap items-center gap-2">
          <ToneToggle tone={tone} onChange={setTone} t={t} />
          <Button type="button" size="sm" onClick={generate} disabled={isGenerating}>
            {isGenerating ? t("replyDraft.generating") : t("replyDraft.generateButton")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label={t("replyDraft.textareaLabel")}
            value={draftText}
            onChange={(event) => {
              setDraftText(event.target.value);
            }}
            rows={4}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
              {copied ? t("replyDraft.copied") : t("replyDraft.copyButton")}
            </Button>
            {reviewUrl && (
              <a
                href={reviewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline-offset-4 hover:underline"
              >
                {sourceLabel
                  ? t("replyDraft.openSourceLink", { source: sourceLabel })
                  : t("replyDraft.openSourceLinkGeneric")}
              </a>
            )}
            <MarkedAsRepliedControl markedAt={markedAt} onToggle={toggleMarked} isMarking={isMarking} t={t} />
          </div>
        </div>
      )}
      {generateErrorCode && <ReplyDraftErrorMessage errorCode={generateErrorCode} t={t} />}
    </div>
  );
}
