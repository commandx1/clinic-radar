"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

export type ReplyTone = "warm" | "formal";

async function postReplyDraft(reviewId: string, tone: ReplyTone): Promise<{ reply_draft: string }> {
  const res = await fetch(`/api/reviews/${reviewId}/reply-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tone }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "genericError");
  }

  return res.json() as Promise<{ reply_draft: string }>;
}

async function patchReplyMarked(
  reviewId: string,
  replyMarked: boolean,
): Promise<{ review: { reply_marked_at: string | null } }> {
  const res = await fetch(`/api/reviews/${reviewId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replyMarked }),
  });

  if (!res.ok) {
    throw new Error("genericError");
  }

  return res.json() as Promise<{ review: { reply_marked_at: string | null } }>;
}

// bkz. review-card.tsx / reply-draft-panel.tsx — CLAUDE.md "colocated hook
// pattern": component sadece render eder, state/mutasyon mantığı burada.
export function useReplyDraft(reviewId: string, initialDraft: string | null, initialMarkedAt: string | null) {
  const [tone, setTone] = useState<ReplyTone>("warm");
  const [draftText, setDraftText] = useState<string | null>(initialDraft);
  const [markedAt, setMarkedAt] = useState<string | null>(initialMarkedAt);

  const generateMutation = useMutation({
    mutationFn: () => postReplyDraft(reviewId, tone),
    onSuccess: (data) => {
      setDraftText(data.reply_draft);
    },
  });

  const markMutation = useMutation({
    mutationFn: (next: boolean) => patchReplyMarked(reviewId, next),
    onSuccess: (data) => {
      setMarkedAt(data.review.reply_marked_at);
    },
  });

  return {
    tone,
    setTone,
    draftText,
    setDraftText,
    markedAt,
    generate: () => {
      generateMutation.mutate();
    },
    isGenerating: generateMutation.isPending,
    generateErrorCode: generateMutation.error?.message ?? null,
    toggleMarked: () => {
      markMutation.mutate(markedAt === null);
    },
    isMarking: markMutation.isPending,
  };
}
