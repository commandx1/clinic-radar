import { LEGAL_CONTACT_EMAIL, type LocalizedLegalDoc } from "./types";

export const privacyContent: LocalizedLegalDoc = {
  en: {
    slug: "privacy",
    title: "Privacy Policy",
    metaTitle: "Privacy Policy — ClinicRadar",
    metaDescription:
      "How ClinicRadar collects, uses, shares and protects personal data — including account data, billing data and publicly available review data.",
    lastUpdated: "Last updated: February 27, 2026",
    intro: [
      "ClinicRadar (\"ClinicRadar\", \"we\", \"us\") is a competitor-intelligence service for clinics. It compares the public Google reviews of your business with those of nearby competitors and turns the gap into a short, actionable task list.",
      "This Privacy Policy explains what personal data we collect, why we collect it, who we share it with, how long we keep it, and the rights you have over it. It applies to the ClinicRadar website and application. It is written to comply with the EU General Data Protection Regulation (GDPR) and the Turkish Personal Data Protection Law No. 6698 (KVKK).",
      `If anything in this policy is unclear, contact us at ${LEGAL_CONTACT_EMAIL} — we answer privacy questions directly.`,
    ],
    atAGlance: [
      "We collect your account details, the business and competitors you select, and publicly available Google review data.",
      "Payments are handled entirely by Lemon Squeezy, our merchant of record — we never see or store your card details.",
      "Review text is analyzed by AI models to produce summaries; the raw text of individual reviews is never shown back in the app.",
      "We do not sell personal data, and we do not use advertising or cross-site tracking cookies.",
      `You can request access, correction or deletion of your data at any time via ${LEGAL_CONTACT_EMAIL}.`,
    ],
    sections: [
      {
        id: "data-we-collect",
        heading: "Data we collect",
        paragraphs: ["We collect the following categories of data:"],
        bullets: [
          "Account data — your email address, name (if provided by your sign-in method, e.g. Google sign-in) and hashed authentication credentials, managed through Supabase Auth.",
          "Business data you provide — the business you connect, the competitors you select, and settings such as language preference.",
          "Billing data — your subscription plan, order and subscription identifiers, and invoicing details. Payment itself is processed by Lemon Squeezy as merchant of record; we never receive or store full card numbers.",
          "Publicly available review data — public Google Maps reviews of the businesses being analyzed (your own and the competitors you select), including review text, star rating, review date and the reviewer's public display name, collected via the Google Places API and the Apify platform.",
          "Technical data — standard server logs (IP address, browser type, timestamps) and essential cookies needed to keep you signed in and remember your language.",
        ],
      },
      {
        id: "how-we-use-data",
        heading: "How we use your data",
        bullets: [
          "To provide the service: fetching and analyzing reviews, computing scores and trends, and generating your task list and reports.",
          "To run AI analysis: review text is sent to our AI providers (Anthropic Claude and/or Google Gemini) to extract themes and produce summaries. Under our API agreements these providers do not use your data to train their models.",
          "To manage your subscription and billing through Lemon Squeezy.",
          "To send transactional emails (e.g. weekly summaries, monthly reports, critical alerts) via Resend. These relate to the service you signed up for; we do not send third-party marketing.",
          "To secure, debug and improve the service, using aggregated or technical data.",
        ],
        afterBullets: [
          "One important product principle: although we store raw review text in our database (the analysis is impossible without it), the app never displays the raw text of an individual review back to you — only AI-generated summaries of themes.",
        ],
      },
      {
        id: "legal-bases",
        heading: "Legal bases (GDPR & KVKK)",
        paragraphs: ["We rely on the following legal bases:"],
        bullets: [
          "Performance of a contract — account, business, billing and usage data are processed because they are necessary to deliver the service you signed up for (GDPR Art. 6(1)(b); KVKK Art. 5(2)(c)).",
          "Legitimate interests — processing publicly available review data to produce competitive analysis, and securing our systems (GDPR Art. 6(1)(f); KVKK Art. 5(2)(f)). We only process review data that reviewers have chosen to make public on Google Maps, we use it solely for analysis, and we never republish individual reviews.",
          "Legal obligations — retaining billing records where tax or accounting law requires it (GDPR Art. 6(1)(c); KVKK Art. 5(2)(a) and 5(2)(ç)).",
          "Consent — for anything optional we may add later; we will ask you first and you can withdraw consent at any time.",
        ],
      },
      {
        id: "processors",
        heading: "Who we share data with",
        paragraphs: [
          "We do not sell personal data. We share data only with the service providers (processors) needed to run ClinicRadar:",
        ],
        bullets: [
          "Supabase — database hosting and authentication.",
          "Vercel — application hosting and content delivery.",
          "Lemon Squeezy — merchant of record; processes payments, taxes and invoices as an independent controller for the checkout it operates.",
          "Google — Places API (business and review data) and, where used, the Gemini API for AI analysis.",
          "Apify — collection of publicly available Google Maps reviews.",
          "Anthropic — the Claude API, used for AI analysis of review text.",
          "Resend — transactional email delivery.",
        ],
        afterBullets: [
          "Each provider is bound by its own data-processing terms. We may also disclose data where the law requires it, or as part of a merger or acquisition (in which case this policy will continue to apply until updated).",
        ],
      },
      {
        id: "international-transfers",
        heading: "International transfers",
        paragraphs: [
          "The providers above may process data in countries outside your own, including the United States. Where data leaves the EU/EEA, transfers rely on safeguards such as the European Commission's Standard Contractual Clauses or an adequacy decision (including the EU–US Data Privacy Framework, where the provider is certified). For transfers out of Türkiye, we follow the mechanisms provided under KVKK Art. 9.",
        ],
      },
      {
        id: "retention",
        heading: "How long we keep data",
        bullets: [
          "Account and business data — kept while your account is active, and deleted or anonymized within 90 days after account deletion.",
          "Review data — kept while the related business is being analyzed, so trends can be computed over time. It is deleted together with the business/account.",
          "Billing records — kept as long as tax and accounting law requires.",
          "Server logs — kept for a short rolling window for security and debugging purposes.",
        ],
      },
      {
        id: "your-rights",
        heading: "Your rights",
        paragraphs: [
          "Under the GDPR and Article 11 of the KVKK you have the right to:",
        ],
        bullets: [
          "learn whether your data is processed, and request access to it;",
          "request correction of inaccurate or incomplete data;",
          "request deletion of your data (\"right to be forgotten\");",
          "request restriction of processing, or object to processing based on legitimate interests;",
          "receive your data in a portable format (GDPR);",
          "withdraw consent at any time, where processing is based on consent;",
          "lodge a complaint with your supervisory authority — your local EU data protection authority, or the Turkish Personal Data Protection Board (KVKK Kurulu).",
        ],
        afterBullets: [
          `To exercise any of these rights, email ${LEGAL_CONTACT_EMAIL}. We respond within 30 days at the latest. If you appear in review data as a reviewer and want your data removed from our analysis, the same address applies.`,
        ],
      },
      {
        id: "public-data",
        heading: "A note on public review data",
        paragraphs: [
          "ClinicRadar analyzes reviews that reviewers have voluntarily published on Google Maps, where they are visible to anyone. We collect this data through the Google Places API and Apify, use it only to produce aggregated, paraphrased insights for the business being analyzed, and never display or republish individual reviews or reviewer identities in the product.",
          "If you are a reviewer and would like your review excluded from our processing, contact us and we will remove it from our systems.",
        ],
      },
      {
        id: "cookies",
        heading: "Cookies",
        paragraphs: [
          "We only use cookies that are strictly necessary for the service to work: an authentication session cookie (so you stay signed in) and a language-preference cookie. We do not use advertising, analytics or cross-site tracking cookies, which is why you don't see a cookie banner.",
        ],
      },
      {
        id: "security",
        heading: "Security",
        paragraphs: [
          "All traffic is encrypted in transit (TLS), data is encrypted at rest by our hosting providers, access to production data is restricted, and payment data never touches our servers. No system is perfectly secure, but if we become aware of a breach affecting your personal data we will notify you and the relevant authorities as required by law.",
        ],
      },
      {
        id: "children",
        heading: "Children",
        paragraphs: [
          "ClinicRadar is a business tool and is not directed at children. We do not knowingly collect personal data from anyone under 16. If you believe a child has provided us data, contact us and we will delete it.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to this policy",
        paragraphs: [
          "We may update this policy as the service evolves. The \"last updated\" date at the top always reflects the current version, and for material changes we will notify you by email or in the app before they take effect.",
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        paragraphs: [
          `For any privacy question or request: ${LEGAL_CONTACT_EMAIL}. ClinicRadar acts as the data controller for the processing described in this policy.`,
        ],
      },
    ],
  },
  tr: {
    slug: "privacy",
    title: "Gizlilik Politikası",
    metaTitle: "Gizlilik Politikası — ClinicRadar",
    metaDescription:
      "ClinicRadar'ın kişisel verileri nasıl topladığı, kullandığı, paylaştığı ve koruduğu — hesap verileri, ödeme verileri ve herkese açık yorum verileri dahil.",
    lastUpdated: "Son güncelleme: 27 Şubat 2026",
    intro: [
      "ClinicRadar (\"ClinicRadar\", \"biz\"), klinikler için bir rakip istihbaratı hizmetidir. İşletmenizin herkese açık Google yorumlarını çevrenizdeki rakiplerinkiyle karşılaştırır ve aradaki farkı kısa, uygulanabilir bir görev listesine çevirir.",
      "Bu Gizlilik Politikası hangi kişisel verileri topladığımızı, neden topladığımızı, kimlerle paylaştığımızı, ne kadar sakladığımızı ve bu veriler üzerindeki haklarınızı açıklar. ClinicRadar web sitesi ve uygulaması için geçerlidir. Politika, AB Genel Veri Koruma Tüzüğü (GDPR) ve 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ile uyumlu olacak şekilde hazırlanmıştır.",
      `Bu politikada net olmayan bir nokta varsa ${LEGAL_CONTACT_EMAIL} adresinden bize ulaşın — gizlilik sorularını doğrudan yanıtlıyoruz.`,
    ],
    atAGlance: [
      "Hesap bilgilerinizi, seçtiğiniz işletme ve rakipleri ve herkese açık Google yorum verilerini topluyoruz.",
      "Ödemeler tamamen Merchant of Record'umuz Lemon Squeezy tarafından işlenir — kart bilgilerinizi hiçbir zaman görmeyiz ve saklamayız.",
      "Yorum metinleri, özet üretmek için yapay zekâ modelleriyle analiz edilir; tekil yorumların ham metni uygulamada asla gösterilmez.",
      "Kişisel veri satmıyoruz; reklam veya siteler arası takip çerezi kullanmıyoruz.",
      `Verilerinize erişim, düzeltme veya silme talebinizi her zaman ${LEGAL_CONTACT_EMAIL} adresine iletebilirsiniz.`,
    ],
    sections: [
      {
        id: "data-we-collect",
        heading: "Topladığımız veriler",
        paragraphs: ["Aşağıdaki veri kategorilerini topluyoruz:"],
        bullets: [
          "Hesap verileri — e-posta adresiniz, adınız (giriş yönteminiz sağlıyorsa, ör. Google ile giriş) ve Supabase Auth üzerinden yönetilen kimlik doğrulama bilgileri.",
          "Sağladığınız işletme verileri — bağladığınız işletme, seçtiğiniz rakipler ve dil tercihi gibi ayarlar.",
          "Ödeme verileri — abonelik planınız, sipariş/abonelik tanımlayıcıları ve faturalama bilgileri. Ödemenin kendisi Merchant of Record olarak Lemon Squeezy tarafından işlenir; tam kart numaralarını hiçbir zaman almayız ve saklamayız.",
          "Herkese açık yorum verileri — analiz edilen işletmelerin (kendi işletmeniz ve seçtiğiniz rakipler) herkese açık Google Haritalar yorumları: yorum metni, yıldız puanı, yorum tarihi ve yorumu yazan kişinin herkese açık görünen adı. Bu veriler Google Places API ve Apify platformu üzerinden toplanır.",
          "Teknik veriler — standart sunucu kayıtları (IP adresi, tarayıcı türü, zaman damgaları) ve oturumunuzu açık tutmak ile dil tercihinizi hatırlamak için gereken zorunlu çerezler.",
        ],
      },
      {
        id: "how-we-use-data",
        heading: "Verilerinizi nasıl kullanıyoruz",
        bullets: [
          "Hizmeti sunmak için: yorumları çekmek ve analiz etmek, skor ve trendleri hesaplamak, görev listenizi ve raporlarınızı üretmek.",
          "Yapay zekâ analizi için: yorum metinleri, tema çıkarımı ve özet üretimi amacıyla yapay zekâ sağlayıcılarımıza (Anthropic Claude ve/veya Google Gemini) gönderilir. API sözleşmelerimiz kapsamında bu sağlayıcılar verilerinizi model eğitiminde kullanmaz.",
          "Aboneliğinizi ve faturalamayı Lemon Squeezy üzerinden yönetmek için.",
          "Resend aracılığıyla işlemsel e-postalar göndermek için (ör. haftalık özetler, aylık raporlar, kritik uyarılar). Bunlar kaydolduğunuz hizmetle ilgilidir; üçüncü taraf pazarlama e-postası göndermeyiz.",
          "Hizmeti güvenli tutmak, hataları ayıklamak ve geliştirmek için — toplulaştırılmış veya teknik verilerle.",
        ],
        afterBullets: [
          "Önemli bir ürün ilkesi: ham yorum metnini veritabanımızda saklasak da (analiz onsuz mümkün değildir), uygulama tekil bir yorumun ham metnini size asla göstermez — yalnızca yapay zekânın ürettiği tema özetleri gösterilir.",
        ],
      },
      {
        id: "legal-bases",
        heading: "Hukuki dayanaklar (GDPR & KVKK)",
        paragraphs: ["Veri işlemede aşağıdaki hukuki dayanaklara dayanıyoruz:"],
        bullets: [
          "Sözleşmenin ifası — hesap, işletme, ödeme ve kullanım verileri, kaydolduğunuz hizmeti sunabilmek için gerekli olduğundan işlenir (GDPR m. 6/1-b; KVKK m. 5/2-c).",
          "Meşru menfaat — rekabet analizi üretmek için herkese açık yorum verilerinin işlenmesi ve sistemlerimizin güvenliği (GDPR m. 6/1-f; KVKK m. 5/2-f). Yalnızca yorum sahiplerinin Google Haritalar'da alenileştirdiği verileri işleriz, bunları sadece analiz için kullanırız ve tekil yorumları asla yeniden yayımlamayız.",
          "Hukuki yükümlülük — vergi veya muhasebe mevzuatının gerektirdiği durumlarda fatura kayıtlarının saklanması (GDPR m. 6/1-c; KVKK m. 5/2-a ve 5/2-ç).",
          "Açık rıza — ileride ekleyebileceğimiz isteğe bağlı özellikler için; önce size sorarız ve rızanızı her zaman geri çekebilirsiniz.",
        ],
      },
      {
        id: "processors",
        heading: "Verileri kimlerle paylaşıyoruz",
        paragraphs: [
          "Kişisel veri satmıyoruz. Verileri yalnızca ClinicRadar'ı çalıştırmak için gereken hizmet sağlayıcılarla (veri işleyenlerle) paylaşırız:",
        ],
        bullets: [
          "Supabase — veritabanı barındırma ve kimlik doğrulama.",
          "Vercel — uygulama barındırma ve içerik dağıtımı.",
          "Lemon Squeezy — Merchant of Record; işlettiği ödeme sayfası için bağımsız veri sorumlusu olarak ödemeleri, vergileri ve faturaları işler.",
          "Google — Places API (işletme ve yorum verileri) ve kullanıldığında yapay zekâ analizi için Gemini API.",
          "Apify — herkese açık Google Haritalar yorumlarının toplanması.",
          "Anthropic — yorum metinlerinin yapay zekâ analizi için kullanılan Claude API.",
          "Resend — işlemsel e-posta gönderimi.",
        ],
        afterBullets: [
          "Her sağlayıcı kendi veri işleme sözleşmesiyle bağlıdır. Ayrıca kanunen zorunlu olduğunda veya bir birleşme/devralma kapsamında veri aktarabiliriz (bu durumda politika güncellenene kadar geçerliliğini korur).",
        ],
      },
      {
        id: "international-transfers",
        heading: "Yurt dışına veri aktarımı",
        paragraphs: [
          "Yukarıdaki sağlayıcılar verileri, Amerika Birleşik Devletleri dahil olmak üzere bulunduğunuz ülke dışında işleyebilir. AB/AEA dışına aktarımlar, Avrupa Komisyonu Standart Sözleşme Maddeleri veya yeterlilik kararı (sağlayıcı sertifikalıysa AB–ABD Veri Gizliliği Çerçevesi dahil) gibi güvencelere dayanır. Türkiye'den yurt dışına aktarımlarda KVKK m. 9'da öngörülen mekanizmalara uyarız.",
        ],
      },
      {
        id: "retention",
        heading: "Verileri ne kadar saklıyoruz",
        bullets: [
          "Hesap ve işletme verileri — hesabınız aktif olduğu sürece saklanır; hesap silindikten sonra en geç 90 gün içinde silinir veya anonimleştirilir.",
          "Yorum verileri — ilgili işletme analiz edildiği sürece saklanır (trendlerin zaman içinde hesaplanabilmesi için) ve işletme/hesapla birlikte silinir.",
          "Fatura kayıtları — vergi ve muhasebe mevzuatının gerektirdiği süre boyunca saklanır.",
          "Sunucu kayıtları — güvenlik ve hata ayıklama amacıyla kısa bir dönem için tutulur.",
        ],
      },
      {
        id: "your-rights",
        heading: "Haklarınız",
        paragraphs: ["GDPR ve KVKK'nın 11. maddesi kapsamında şu haklara sahipsiniz:"],
        bullets: [
          "verilerinizin işlenip işlenmediğini öğrenme ve verilerinize erişim talep etme;",
          "eksik veya yanlış verilerin düzeltilmesini isteme;",
          "verilerinizin silinmesini isteme (\"unutulma hakkı\");",
          "işlemenin kısıtlanmasını isteme veya meşru menfaate dayalı işlemeye itiraz etme;",
          "verilerinizi taşınabilir bir formatta alma (GDPR);",
          "işleme rızaya dayanıyorsa rızanızı her zaman geri çekme;",
          "denetim makamına şikâyette bulunma — AB'deki yerel veri koruma otoriteniz veya Kişisel Verileri Koruma Kurulu (KVKK Kurulu).",
        ],
        afterBullets: [
          `Bu haklardan herhangi birini kullanmak için ${LEGAL_CONTACT_EMAIL} adresine e-posta gönderin. En geç 30 gün içinde yanıt veririz. Yorum verilerinde yorum sahibi olarak yer alıyorsanız ve verilerinizin analizimizden çıkarılmasını istiyorsanız aynı adresi kullanabilirsiniz.`,
        ],
      },
      {
        id: "public-data",
        heading: "Herkese açık yorum verileri hakkında not",
        paragraphs: [
          "ClinicRadar, yorum sahiplerinin Google Haritalar'da gönüllü olarak yayımladığı ve herkesin görebildiği yorumları analiz eder. Bu verileri Google Places API ve Apify üzerinden toplar, yalnızca analiz edilen işletme için toplulaştırılmış ve yeniden ifade edilmiş içgörüler üretmek amacıyla kullanır; tekil yorumları veya yorum sahiplerinin kimliklerini üründe asla göstermez ya da yeniden yayımlamaz.",
          "Yorum sahibiyseniz ve yorumunuzun işleme sürecimizden çıkarılmasını istiyorsanız bize ulaşın; sistemlerimizden kaldıralım.",
        ],
      },
      {
        id: "cookies",
        heading: "Çerezler",
        paragraphs: [
          "Yalnızca hizmetin çalışması için kesinlikle gerekli çerezleri kullanıyoruz: oturum çerezi (oturumunuzun açık kalması için) ve dil tercihi çerezi. Reklam, analitik veya siteler arası takip çerezi kullanmıyoruz — bu yüzden çerez bandı görmüyorsunuz.",
        ],
      },
      {
        id: "security",
        heading: "Güvenlik",
        paragraphs: [
          "Tüm trafik aktarım sırasında şifrelenir (TLS), veriler barındırma sağlayıcılarımız tarafından beklemede şifrelenir, üretim verilerine erişim kısıtlıdır ve ödeme verileri sunucularımıza hiç uğramaz. Hiçbir sistem kusursuz güvenli değildir; ancak kişisel verilerinizi etkileyen bir ihlalden haberdar olursak, kanunun gerektirdiği şekilde sizi ve ilgili makamları bilgilendiririz.",
        ],
      },
      {
        id: "children",
        heading: "Çocuklar",
        paragraphs: [
          "ClinicRadar bir işletme aracıdır ve çocuklara yönelik değildir. 16 yaşından küçüklerden bilerek kişisel veri toplamayız. Bir çocuğun bize veri sağladığını düşünüyorsanız bize ulaşın; verileri silelim.",
        ],
      },
      {
        id: "changes",
        heading: "Bu politikadaki değişiklikler",
        paragraphs: [
          "Hizmet geliştikçe bu politikayı güncelleyebiliriz. Sayfanın üst kısmındaki \"son güncelleme\" tarihi her zaman güncel sürümü gösterir; önemli değişikliklerde, değişiklik yürürlüğe girmeden önce e-posta veya uygulama içinden sizi bilgilendiririz.",
        ],
      },
      {
        id: "contact",
        heading: "İletişim",
        paragraphs: [
          `Gizlilikle ilgili her türlü soru veya talep için: ${LEGAL_CONTACT_EMAIL}. Bu politikada açıklanan işleme faaliyetleri bakımından veri sorumlusu ClinicRadar'dır.`,
        ],
      },
    ],
  },
};
