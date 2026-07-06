// bkz. docs/02-business-rules.md Bölüm G — e-posta gönderimi env-gated: yeni
// npm bağımlılığı eklenmeden (CLAUDE.md kısıtı) Resend'in basit REST API'si
// fetch ile çağrılır. RESEND_API_KEY tanımsızsa gönderim atlanır ve akış
// sessizce (loglayarak) devam eder — hiçbir zaman cron döngüsünü düşürmez.
const RESEND_ENDPOINT = "https://api.resend.com/emails";
// Gerçek bir domain doğrulanana kadar Resend'in test göndereni kullanılır;
// prod'a alınırken RESEND_FROM_EMAIL env'i ile değiştirilebilir.
const DEFAULT_FROM = "ClinicRadar <onboarding@resend.dev>";

export interface SendEmailAttachment {
  filename: string;
  /** Base64-encoded içerik — Resend attachments API'sinin beklediği format. */
  content: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: SendEmailAttachment[];
}

export interface SendEmailResult {
  ok: boolean;
  skipped: boolean;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("RESEND_API_KEY tanımlı değil — e-posta gönderimi atlandı (env-gated).", {
      to: input.to,
      subject: input.subject,
    });
    return { ok: false, skipped: true };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.attachments ? { attachments: input.attachments } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Resend e-posta gönderimi başarısız:", response.status, body);
      return { ok: false, skipped: false, error: `resend_http_${String(response.status)}` };
    }

    return { ok: true, skipped: false };
  } catch (err) {
    console.error("Resend e-posta gönderimi sırasında beklenmeyen hata:", err);
    return { ok: false, skipped: false, error: err instanceof Error ? err.message : "unknown_error" };
  }
}
