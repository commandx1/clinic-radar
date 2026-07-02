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
      - Claude API (Anthropic) — AI pipeline (tema/duygu çıkarımı, gap analizi, görev üretimi)
      - Apify — Google Maps scraping (sonraki fazda entegre edilecek)
      - LemonSqueezy — billing (Merchant of Record; Stripe TR'den hesap açmaya izin vermediği için tercih edildi, sonraki fazda entegre edilecek)
      - next-intl — arayüz i18n (cihaz diline göre otomatik seçim, URL öneki yok, Faz 1'den itibaren global — bkz. `docs/07-ui.md`)

      ## Mimari Kurallar
    - RLS her zaman açık; hiçbir tabloya `user_id` bypass eden bir servis-rol sorgusu authenticated context dışında yazılmaz.
      - Ham yorum metni (`reviews.text`) asla UI'da birebir gösterilmez — sadece Claude'un paraphrase edilmiş özeti (`theme_summary`) gösterilir. Bu bir iş kuralı, güvenlik/telif nedeniyle var — bkz. `docs/02-business-rules.md`.
      - AI pipeline çıktıları her zaman saf JSON (prose wrapper yok), çıktı dili parametrik — kullanıcının arayüz diline göre üretilir (bkz. `docs/06-prompts.md`), sabit Türkçe değil.
      - Arayüz metinleri hardcode edilmez, `messages/{locale}.json` üzerinden next-intl ile çevrilir — yeni bir sayfa/bileşen yazarken çeviri anahtarı ekle, doğrudan string yazma.
      - Eşik/filtreleme mantığı (ör. "≥5 mention") prompt içine gömülmez, application code'da uygulanır (test edilebilirlik için) — `docs/06-prompts.md`.
      - `priority` alanı AI tarafından set edilmez, kod tarafında `impact_score/effort_score` formülünden türetilir — `docs/09-task-engine.md`.

 ## Kod Kuralları
 - TypeScript strict, `any` yok.
 - Supabase client'ları server/browser context'e göre ayrı helper'lardan alınır, route handler'larda service-role key kullanılmaz (RLS'e güveniyoruz).
 - Migration'lar SQL dosyaları olarak `supabase/migrations/` altında, her migration tek bir mantıksal değişiklik içerir.
 - Yeni bir tablo/alan eklerken önce `docs/03-database.md`'yi güncelle, sonra migration yaz — döküman kod ile senkron kalmalı.
      - Faz 1 kapsamı dışındaki şeyleri (otomatik yorum isteme SMS/email, çok dilli **yorum analizi**/tercüme, doctor/treatment breakdown, agency panel) şimdi implemente etme — `docs/10-roadmap.md`. (Arayüz i18n'i bu kapsamın dışında, Faz 1'de.)

    ## Test/Doğrulama
      - DB değişikliklerinde RLS politikalarını farklı `user_id`'ler ile manuel test et (bir kullanıcı başka kullanıcının business/task satırını göremiyor olmalı).
      - AI pipeline değişikliklerinde şema validasyonu (Zod/JSON schema) zorunlu; validasyon başarısızsa bir kez retry, yine başarısızsa o business'ın analizi "pending" olarak işaretlenir, asla yarım/yanlış veri gösterilmez.