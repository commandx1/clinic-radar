## Proje

    ClinicRadar — herhangi bir ülkedeki sağlık/estetik işletmeleri (diş klinikleri, estetik merkezleri vb. — kapalı bir kategori listesi değil) için rakip analizi + görev motoru SaaS'ı. Google Maps yorumlarını kullanıcının işletmesi ve seçtiği 3-10 rakip için toplar, Claude ile tema/duygu analizi yapar, rekabet açığını hesaplar ve az sayıda önceliklendirilmiş, tamamlanabilir göreve dönüştürür. North star metrik: kullanıcı başına haftalık tamamlanan görev sayısı.

    ## Kaynak of Truth
    Tüm ürün kararları, DB şeması, API sözleşmeleri, iş kuralları, formüller ve roadmap `docs/` klasöründe tanımlıdır. Kod yazmadan önce ilgili dosyayı oku, sayıları/eşikleri (ör. opportunity score formülü, 14/60 günlük re-priority kuralları, cache TTL'leri) buraya kopyalamak yerine oradan referans al — drift riskini önler.

    - `docs/01-product-vision.md` — ürün vizyonu, north star, Phase 1 kapsam dışıları
    - `docs/02-business-rules.md` — plan limitleri, rakip keşif algoritması, cache/refetch kuralları, dedup/cap kuralları
    - `docs/03-database.md` — şema, alan adları, indeksler
    - `docs/04-api.md` — endpoint sözleşmeleri
    - `docs/05-ai-pipeline.md` — Claude çağrı aşamaları
    - `docs/06-prompts.md` — prompt şemaları
    - `docs/07-ui.md`, `docs/08-dashboard.md` — akışlar ve dashboard tasarımı
      - `docs/09-task-engine.md` — priority/score formülleri
      - `docs/10-roadmap.md` — faz sıralaması

      ## Stack
      - Next.js (App Router, TypeScript, strict mode)
      - Supabase (Postgres + Auth + Row Level Security)
      - Claude API (Anthropic) — AI pipeline (tema/duygu çıkarımı, gap analizi, görev üretimi). **Geçici durum:** Anthropic hesabındaki kredi bakiyesi tükendiği için `AI_PROVIDER=gemini` ile Google Gemini'ye geçildi (bkz. `src/lib/ai-pipeline/provider.ts`, `src/lib/gemini/`). Claude implementasyonu (`src/lib/claude/`) dokunulmadan duruyor — kredi yenilenince `AI_PROVIDER=claude`'a dönmek yeterli. Yeni AI pipeline kodu yazarken Zod şema/prompt mantığını `src/lib/ai-pipeline/*-schema.ts`'te (sağlayıcıdan bağımsız) tut, sadece "modele nasıl sorulur" kısmını `src/lib/claude/` veya `src/lib/gemini/`'ye ekle.
      - Apify — Google Maps scraping (sonraki fazda entegre edilecek)
      - LemonSqueezy — billing (Merchant of Record; Stripe TR'den hesap açmaya izin vermediği için tercih edildi, sonraki fazda entegre edilecek)
      - next-intl — arayüz i18n (cihaz diline göre otomatik seçim, URL öneki yok, Faz 1'den itibaren global — bkz. `docs/07-ui.md`)
      - TanStack Query (@tanstack/react-query) — client-side mutasyonlar için (bkz. Kod Kuralları)
      - shadcn/ui — primitive UI bileşenleri (`src/components/ui/`, Base UI + Tailwind, `npx shadcn add` ile üretilir)
      - `@react-pdf/renderer` — Monthly Report PDF export (`src/lib/reports/`, bkz. `docs/08-dashboard.md`)

      **Node sürümü:** `.nvmrc` + `package.json engines` → `18 || 20 || >=22`. `nvm`'in varsayılanı 21.x ise bazı bağımlılıklar (`@supabase/supabase-js` realtime client'ı native `WebSocket` bekler, Node 21'de yok) ve `npm install` sırasında EBADENGINE uyarıları çıkar — `nvm use 22` (veya `.nvmrc` otomatik algılamasıyla) çalıştır.

      ## Mimari Kurallar
    - RLS her zaman açık; hiçbir tabloya `user_id` bypass eden bir servis-rol sorgusu authenticated context dışında yazılmaz. **Dar istisna:** `CRON_SECRET` korumalı `src/app/api/cron/**` route'ları — kullanıcı oturumu olmadan çalıştıkları için service-role kullanır, o da yalnızca `src/lib/supabase/admin.ts` üzerinden.
      - Ham yorum metni (`reviews.text`) asla UI'da birebir gösterilmez — sadece Claude'un paraphrase edilmiş özeti (`theme_summary`) gösterilir. Bu bir iş kuralı, güvenlik/telif nedeniyle var — bkz. `docs/02-business-rules.md`.
      - AI pipeline çıktıları her zaman saf JSON (prose wrapper yok), çıktı dili parametrik — kullanıcının arayüz diline göre üretilir (bkz. `docs/06-prompts.md`), sabit Türkçe değil.
      - Arayüz metinleri hardcode edilmez, `messages/{locale}.json` üzerinden next-intl ile çevrilir — yeni bir sayfa/bileşen yazarken çeviri anahtarı ekle, doğrudan string yazma.
      - Eşik/filtreleme mantığı (ör. "≥5 mention") prompt içine gömülmez, application code'da uygulanır (test edilebilirlik için) — `docs/06-prompts.md`.
      - `priority` alanı AI tarafından set edilmez, kod tarafında `impact_score/effort_score` formülünden türetilir — `docs/09-task-engine.md`.

## Kod Kuralları

- TypeScript strict, `any` yok.
- Supabase client'ları server/browser context'e göre ayrı helper'lardan alınır, route handler'larda service-role key kullanılmaz (RLS'e güveniyoruz). **Dar istisna:** service-role yalnızca `src/lib/supabase/admin.ts`'te tanımlanır ve yalnızca `CRON_SECRET` korumalı `src/app/api/cron/**` route'larında ve elle çalıştırılan tek seferlik bakım script'lerinde (`scripts/*.ts`, ör. `backfill-task-checklists.ts` — kullanıcı oturumu olmadan tüm işletmeler üzerinde toplu işlem yapar) kullanılır — başka hiçbir yerde import edilmez.
- **`rolbypassrls` GRANT yerine geçmez.** `service_role`'ün `rolbypassrls=true` olması sadece RLS policy'lerini atlar, tablo düzeyindeki `GRANT`'ı atlamaz — her ikisi de gerekir. Yeni bir tablo eklerken `authenticated`'a verdiğin `grant`'ların service-role tarafından da (cron/script erişiyorsa) gerekip gerekmediğini kontrol et (bkz. `20260711000000_service_role_grants.sql` — bu tam olarak eksik olduğu için "permission denied" veren bir bug'ı düzeltti).
- Migration'lar SQL dosyaları olarak `supabase/migrations/` altında, her migration tek bir mantıksal değişiklik içerir.
- Yeni bir tablo/alan eklerken önce `docs/03-database.md`'yi güncelle, sonra migration yaz — döküman kod ile senkron kalmalı.
  - Faz 1 kapsamı dışındaki şeyleri (otomatik yorum isteme SMS/email, çok dilli **yorum analizi**/tercüme, doctor/treatment breakdown, agency panel) şimdi implemente etme — `docs/10-roadmap.md`. (Arayüz i18n'i bu kapsamın dışında, Faz 1'de.)

### UI/Frontend standartları

- **Component'leri küçük tut.** Bir component fonksiyonu büyüdüğünde (lint: `max-lines-per-function`, `src/app/**` ve `src/components/**` için 100 satır uyarı eşiği, `src/components/ui/` hariç) mantığı bir custom hook'a çıkar.
- **UI ve logic ayrımı — colocated hook pattern.** Bir component'te state/fetch/mutasyon mantığı varsa, aynı klasörde `use-<şey>.ts` adında bir hook dosyasına taşı (örnek: `business-form.tsx` + `use-business-form.ts`, `login/page.tsx` + `use-login-form.ts`). Component dosyası sadece JSX render eder, hook state ve davranışı yönetir.
- **SSR öncelikli, TanStack Query sadece client mutasyonlarında.** İlk veri yüklemesi (sayfa açılışında okunan veri) her zaman Server Component + doğrudan Supabase sorgusu ile yapılır (bkz. `business/page.tsx`). `@tanstack/react-query`'nin `useMutation`'ı sadece kullanıcı etkileşimiyle tetiklenen client-side yazma işlemlerinde kullanılır (form submit, login/signup, task tamamlama vb.) — `useQuery` ile server-fetch edilebilecek bir veriyi client'ta tekrar çekme.
- **Primitive UI bileşenleri — shadcn/ui.** Ham `<input>`/`<button>` kullanımı `src/components/ui/` dışında lint hatası verir (`no-restricted-syntax`). Yeni bir primitive gerektiğinde `npx shadcn add <bileşen>` ile ekle, elle yazma. Var olan primitive'i (Button, Input, Label, Card) kullanmadan aynı Tailwind class'larını tekrar tekrar yazma.
- **Kod tekrarı yok.** `eslint-plugin-sonarjs` (`no-identical-functions`, `no-duplicated-branches` vb.) bunu kısmen otomatik yakalar; ama iki yerde aynı mantık/JSX bloğu görürsen bunu bir fonksiyon/component/hook'a çıkar, kopyalama.
- **Global client state — Zustand, Redux değil.** Önce şunu sor: bu state gerçekten birden fazla ekran/component ağacı arasında paylaşılıyor mu? Hayırsa Zustand da gerekmez, `useState`/colocated hook yeterli (bkz. yukarıdaki UI/Logic maddesi). Server'dan gelen veri asla Zustand'a kopyalanmaz — o TanStack Query'nin işi. Zustand sadece gerçekten çok ekranlı/çok component'li client-only state için (ör. dashboard task filtreleri). Henüz böyle bir ekran yok — kütüphaneyi ilk ihtiyaç doğduğunda ekle, önceden kurma.
- **Prop drilling yok — 3 seviye kuralı.** Bir prop 3'ten fazla component'ten geçerek aşağı taşınıyorsa (A → B → C → D, B ve C sadece iletiyor, kullanmıyor), prop drilling'i sürdürme:
  - Prop iletimi tek bir feature/ekranın component ağacı içinde kalıyorsa (ör. bir wizard'ın adımları arası state) → o feature'a özel, **scoped bir React Context** aç (`<Feature>Context` + `use<Feature>()` hook, feature'ın kendi klasöründe colocate edilir — global bir yere koyma).
  - State birden fazla, ilişkisiz ekran/route'tan erişilmesi gerekiyorsa, ya da sık değişen bir state'in sadece onu kullanan component'i re-render etmesi (selector) önemliyse → yukarıdaki Zustand kuralına göre karar ver.
  - Bunu lint otomatik yakalayamaz (prop drilling derinliğini statik ölçen güvenilir bir ESLint kuralı yok) — code review'da dikkat edilecek bir konu.
- **Atomic decomposition.** "Component'leri küçük tut" kuralını pekiştirir: bir component büyüdüğünde önce küçük alt-component'lere böl (shadcn primitives = atom katmanı, `src/components/ui/`), sonra prop iletimi karmaşıklaşıyorsa yukarıdaki Context/Zustand kararını ver. Yeni bir atoms/molecules klasör taksonomisi zorlamıyoruz — mevcut `components/ui/` (atom) + feature klasörleri (composition) yeterli.

  ## Test/Doğrulama
  - DB değişikliklerinde RLS politikalarını farklı `user_id`'ler ile manuel test et (bir kullanıcı başka kullanıcının business/task satırını göremiyor olmalı).
  - AI pipeline değişikliklerinde şema validasyonu (Zod/JSON schema) zorunlu; validasyon başarısızsa bir kez retry, yine başarısızsa o business'ın analizi "pending" olarak işaretlenir, asla yarım/yanlış veri gösterilmez.
  - **`supabase db reset` kullanıcıya sormadan ÇALIŞTIRILMAZ.** Lokal DB'deki gerçek veriyi (reviews, theme_summary, tasks, kullanıcı hesapları vb.) siler; bu veri `supabase/seed.sql`'de değil (seed sadece test kullanıcısı/business/competitor fixture'larını kapsar, canlı Apify/AI çıktısını değil). Yeni bir migration eklerken mevcut veriyi koruyan `supabase migration up` kullanılır. `db reset` gerçekten kaçınılmazsa (ör. migration sırası bozulmuşsa) önce kullanıcıya sorulur, ardından reviews/theme_summary/tasks `pg_dump` ile yedeklenip reset sonrası geri yüklenir.

## Orchestration philosophy

Default to the coding model assigned to the current session, doing the work directly. For most day-to-day engineering tasks, the session's default coding model is sufficient. Escalate only when the reasoning complexity clearly exceeds its strengths.

Do not treat orchestration as mandatory per task. Escalation is the exception, not the front door.

## Default route: default model, direct

The default model handles, without asking permission or explaining routing:

- boilerplate, CRUD, small features
- tests
- formatting and lint fixes
- small-to-medium refactors with clear acceptance criteria
- well-specified implementation tasks
- routine documentation
- straightforward bug fixes with an obvious cause

For these, just do the work. No plan-and-confirm step, no "Route:/Reason:" preamble, no delegation brief. Overhead here costs more than the task itself.

## Escalation triggers (when to bring in a stronger model)

Escalate to a deep-reasoner / top-tier model ONLY when at least one of these is true:

- an architecture or system-design decision with real long-term cost if wrong
- a bug that has survived one direct diagnosis attempt, or spans multiple files/subsystems with a non-obvious cause
- an algorithmic or performance trade-off where correctness/edge cases are hard to reason about
- a refactor that touches shared/critical code and is hard to reverse
- security-sensitive authentication or authorization changes
- database schema or migration decisions that are difficult to roll back
- public API contract changes
- concurrency, race-condition, or distributed-system issues
- multiple plausible implementations exist and the trade-offs cannot be resolved confidently from the available context

Before escalating for the last reason, first try to resolve it by gathering more context (read more of the codebase, check existing conventions, ask the user a clarifying question) — prefer solving with better context over escalating to a stronger model. Escalating doesn't help if the real gap is missing information, not reasoning power.

When escalating, state in one line why (which trigger above applies), then hand off. Don't pre-emptively escalate "just in case" — if unsure whether it qualifies, attempt it directly first and escalate only if you hit a wall.

## Respect existing architecture and scope

- Do not introduce new abstractions, patterns, or frameworks unless the task explicitly requires them or they are necessary to satisfy the acceptance criteria.
- Follow existing naming, file organization, error-handling, and architectural conventions unless the task explicitly requires changing them.
- Fix root causes when they are clearly identifiable and within the requested scope.
- Avoid masking bugs with defensive code unless explicitly requested.
- Existing public behavior remains unchanged unless the task explicitly requires a behavior change.
- No unnecessary refactoring. If the task doesn't require touching something, don't touch it, even if you think it could be "better."
- If you notice unrelated issues while working, mention them separately in your summary instead of fixing them, unless they block the requested task.

## Delegation route (Sonnet worker)

Use a Sonnet worker (`general-purpose` subagent, `model: "sonnet"`) for:

- well-specified implementation tasks that are large/mechanical enough to benefit from an isolated brief
- codebase investigation
- terminal/build/lint/test verification
- independent review of your own output before accepting it, on anything escalation-worthy

Delegation brief format (only needed when actually delegating, not for direct work):

Task:
[One clear task sentence.]

Files / area:
[Relevant files, folders, components, or system area.]

Constraints:

- Do not touch unrelated files.
- Do not add new dependencies unless explicitly approved.
- Preserve existing behavior outside the requested scope.
- Keep the change as small as safely possible.

Acceptance criteria:

- The requested change is implemented.
- The change is limited to the specified area.
- Existing behavior is preserved.
- No new lint, type, build, or test failures are introduced.
- No unnecessary refactoring outside what's needed to complete the task.

Verification command:
[Insert the relevant command, for example npm test, npm run lint, npm run build, pnpm test, or pnpm lint.]

If verification fails, stop and report the failure. Do not silently work around failing tests, disable them, or dismiss a failure as "unrelated" without explicit confirmation.

Expected Sonnet worker output:

- Summary of changes
- Files changed
- Verification result
- Risks or follow-up notes

After the Sonnet worker returns, review the implementation for correctness, scope, architectural consistency, and verification results before accepting: decide accept, revise, or escalate. Don't accept the output blind.

## Cost guardrails

- Don't spend tokens writing a plan/brief for something you could just implement in a few lines.
- Effort dial (if using Sonnet with adjustable effort): default low/medium. Only bump to high/xhigh for genuinely hard tasks — pushing effort that high can cost as much as just escalating to a stronger model, so if a task needs xhigh, that's itself a signal to consider escalating instead.
- One escalation, not a chain. If a stronger model's answer isn't good enough, that's a signal the task needs a human decision, not a further escalation.

## Handling ambiguity

- When uncertain about requirements, ask a clarifying question instead of making irreversible assumptions.
- If multiple interpretations are equally reasonable and no clarification is possible, choose the option that minimizes scope and is easiest to reverse, and state the assumption briefly.

## After execution (only for escalated / non-trivial tasks)

- summarize what changed
- list files changed
- include verification results
- identify remaining risks
- recommendation: accept, revise, or escalate further

Skip this ceremony for routine direct work — a normal summary of what you did is enough.

## General engineering principles

- Prefer modifying existing code over rewriting working code.
- Prefer existing project conventions over personal preference.
- Optimize first for correctness, then simplicity, then elegance.
