const APIFY_BASE_URL = "https://api.apify.com/v2";

// Server-only ince REST wrapper — apify-client SDK eklenmiyor, tek blocking
// call tipi (run-sync-get-dataset-items) için gereksiz bir bağımlılık olurdu.
export async function runActorSync<T>(
  actorId: string,
  input: Record<string, unknown>,
  { timeoutMs = 100_000 }: { timeoutMs?: number } = {},
): Promise<T[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("apify_not_configured");
  }

  const encodedActorId = actorId.replace("/", "~");
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    // Token URL'de değil Authorization header'ında taşınır — URL'ler access
    // log/proxy kayıtlarında düz metin göründüğü için sızıntı riski oluşturur.
    const res = await fetch(
      `${APIFY_BASE_URL}/acts/${encodedActorId}/run-sync-get-dataset-items`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      throw new Error(`apify_run_failed:${String(res.status)}`);
    }

    return (await res.json()) as T[];
  } finally {
    clearTimeout(timeout);
  }
}
