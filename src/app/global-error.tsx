"use client";

import { useEffect } from "react";

// Root-level boundary: renders OUTSIDE the locale providers, so it cannot use
// next-intl. Text is intentionally hard-coded (default locale) and self-contained.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "6rem 1.5rem",
          textAlign: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          color: "#0a0a0a",
          background: "#ffffff",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: "#71717a", margin: 0 }}>
          An unexpected error occurred. You can try again or come back in a moment.
        </p>
        {error.digest ? (
          <p style={{ fontSize: "0.75rem", color: "#a1a1aa", margin: 0 }}>#{error.digest}</p>
        ) : null}
        {/* Root error boundary, kök layout'un yerine geçer ve kendi <html>/<body>'sini
            render eder; global CSS / UI bileşenleri burada yüklü olmayabileceğinden
            ham <button> + inline style bilinçli tercihtir. */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            cursor: "pointer",
            borderRadius: "0.5rem",
            border: "none",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "#fafafa",
            background: "#0a0a0a",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
