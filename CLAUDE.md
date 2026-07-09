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
    - RLS her zaman açık; hiçbir tabloya `user_id` bypass eden bir servis-rol sorgusu authenticated context dışında yazılmaz. **Dar istisna:** `CRON_SECRET` korumalı `src/app/api/cron/**` route'ları ve `X-Signature` HMAC doğrulamalı `src/app/api/webhooks/billing/route.ts` (LemonSqueezy) — ikisi de kullanıcı oturumu olmadan çalıştıkları için service-role kullanır, o da yalnızca `src/lib/supabase/admin.ts` üzerinden.
      - Ham yorum metni (`reviews.text`) asla UI'da birebir gösterilmez — sadece Claude'un paraphrase edilmiş özeti (`theme_summary`) gösterilir. Bu bir iş kuralı, güvenlik/telif nedeniyle var — bkz. `docs/02-business-rules.md`.
      - AI pipeline çıktıları her zaman saf JSON (prose wrapper yok), çıktı dili parametrik — kullanıcının arayüz diline göre üretilir (bkz. `docs/06-prompts.md`), sabit Türkçe değil.
      - Arayüz metinleri hardcode edilmez, `messages/{locale}.json` üzerinden next-intl ile çevrilir — yeni bir sayfa/bileşen yazarken çeviri anahtarı ekle, doğrudan string yazma.
      - Eşik/filtreleme mantığı (ör. "≥5 mention") prompt içine gömülmez, application code'da uygulanır (test edilebilirlik için) — `docs/06-prompts.md`.
      - `priority` alanı AI tarafından set edilmez, kod tarafında `impact_score/effort_score` formülünden türetilir — `docs/09-task-engine.md`.

## Kod Kuralları

- TypeScript strict, `any` yok.
- Supabase client'ları server/browser context'e göre ayrı helper'lardan alınır, route handler'larda service-role key kullanılmaz (RLS'e güveniyoruz). **Dar istisna:** service-role yalnızca `src/lib/supabase/admin.ts`'te tanımlanır ve yalnızca `CRON_SECRET` korumalı `src/app/api/cron/**` route'larında, `X-Signature` HMAC doğrulamalı `src/app/api/webhooks/billing/route.ts`'te ve elle çalıştırılan tek seferlik bakım script'lerinde (`scripts/*.ts`, ör. `backfill-task-checklists.ts` — kullanıcı oturumu olmadan tüm işletmeler üzerinde toplu işlem yapar) kullanılır — başka hiçbir yerde import edilmez.
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

## Orchestration workflow

Use Fable 5 as the lead engineer and orchestrator.

Fable 5 should:

- understand the goal
- create the plan
- split work into clear tasks
- choose the right route for each task
- delegate work when another agent or Codex is a better fit
- review outputs from delegated work
- make the final quality decision

Fable 5 should not do mechanical work unless it is necessary.

Avoid using Fable 5 for:

- broad file scanning
- repetitive file edits
- boilerplate generation
- routine test writing
- formatting-only changes
- running tests without interpretation
- simple refactors with clear acceptance criteria

## Routing rules

Before doing any task, first choose one of these routes:

- Fable direct
- deep-reasoner
- fast-worker
- Codex
- no action

Always explain the routing choice in one sentence.

Use Fable direct for:

- planning
- task decomposition
- final review
- quality decisions
- product or architecture direction
- deciding whether to accept, revise, or escalate

Use deep-reasoner for:

- architecture decisions
- complex debugging
- algorithmic decisions
- reasoning-heavy trade-offs
- risky refactors
- second-opinion analysis before important changes

Use fast-worker for:

- boilerplate
- tests
- formatting
- simple edits
- small refactors
- repetitive mechanical changes
- small documentation updates

Use Codex for:

- well-specified implementation tasks
- codebase investigation
- terminal verification
- UI verification
- test, lint, or build checks
- independent engineering review

If a task clearly matches a subagent or Codex role, prefer delegation instead of doing the work directly.

If you do not delegate, briefly explain why.

Return all important results to Fable 5 before final acceptance.

## Codex execution rule

When the selected route is Codex, do not continue the implementation yourself as Fable 5.

Instead:

1. Create a self-contained Codex brief.
2. Include the task, files or area, constraints, acceptance criteria, and verification command.
3. Use the available Codex command or Codex workflow to delegate the task.
4. Wait for Codex to return the result.
5. Review the Codex result as Fable 5 before accepting it.

Codex brief format:

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

Verification command:
[Insert the relevant command, for example npm test, npm run lint, npm run build, pnpm test, or pnpm lint.]

Expected Codex output:

- Summary of changes
- Files changed
- Verification result
- Risks or follow-up notes

After Codex returns:

- Review the result.
- Decide: accept, revise, or escalate.
- Do not accept Codex output without review.

If Codex is unavailable (no Codex CLI/command in the environment), do NOT fall back to implementing directly as Fable. Route the same brief to a Sonnet worker instead: use the Agent tool with `subagent_type: general-purpose` and `model: "sonnet"`, passing the Codex brief unchanged. The same applies when `fast-worker`/`deep-reasoner` agents are not installed — Sonnet workers take their place. Fable itself writes code only when the change is genuinely trivial (a few lines) and briefing a worker would cost more than the edit itself.

## Before execution

Before execution:

- produce a short plan
- state the selected route
- state which agent, model, or Codex workflow should handle each part
- ask for confirmation when the task is broad, risky, destructive, or ambiguous

Do not execute broad or risky changes before the user confirms the plan.

## After execution

After execution:

- summarize what changed
- list files changed
- include verification results
- identify remaining risks
- make a clear recommendation: accept, revise, or escalate

## Response format for every task

Start with:

Route:
[Selected route]

Reason:
[One sentence explaining why this route is selected.]

Then continue with the plan, delegation, execution, or review depending on the task.
