import { LEGAL_CONTACT_EMAIL, type LocalizedLegalDoc } from "./types";

export const refundContent: LocalizedLegalDoc = {
  en: {
    slug: "refund-policy",
    title: "Refund Policy",
    metaTitle: "Refund Policy — ClinicRadar",
    metaDescription:
      "ClinicRadar's refund policy: try everything on the Free plan first, cancel anytime, and how billing errors and statutory rights are handled.",
    lastUpdated: "Last updated: February 27, 2026",
    intro: [
      "We keep this simple and honest: ClinicRadar has a generous Free plan precisely so you can evaluate the product before paying anything. Because of that, payments for the Pro plan are non-refundable — but you can cancel at any time and keep access until the end of the period you paid for.",
      "This policy explains exactly how cancellation works, what happens on renewal, and the exceptions where we do issue refunds.",
    ],
    atAGlance: [
      "Try before you buy: the Free plan includes the full task engine, so you can evaluate ClinicRadar at no cost.",
      "Pro payments are non-refundable, including partial periods and unused time.",
      "Cancel anytime from your billing page — no forms, no emails required. You keep Pro until the paid period ends.",
      "Billing errors, duplicate charges and confirmed technical failures on our side are always made right.",
      "Your statutory consumer rights are never limited by this policy.",
    ],
    sections: [
      {
        id: "free-plan-first",
        heading: "Evaluate on the Free plan first",
        paragraphs: [
          "The Free plan is not a time-limited trial — it includes the full task engine with monthly re-scans and up to 3 competitors, indefinitely. We encourage you to use it for as long as you need before upgrading. Upgrading to Pro adds weekly re-scans, more competitors, monthly PDF reports and instant critical-signal alerts.",
          "Because the product can be fully evaluated for free, we do not offer money-back refunds on Pro payments.",
        ],
      },
      {
        id: "cancellation",
        heading: "Cancellation",
        bullets: [
          "You can cancel your Pro subscription at any time from your billing page inside the app — self-service, effective immediately for future renewals.",
          "After cancelling, you keep full Pro access until the end of the billing period you already paid for. No further charges are made.",
          "When the paid period ends, your account automatically moves to the Free plan. Your data, analyses and tasks are not deleted.",
        ],
      },
      {
        id: "renewals",
        heading: "Renewals",
        paragraphs: [
          "Pro subscriptions renew automatically at the end of each billing period. It is your responsibility to cancel before the renewal date if you no longer want the service; charges for a period that has already started are not refunded, in full or pro-rata. You can check your next renewal date on the billing page at any time.",
        ],
      },
      {
        id: "exceptions",
        heading: "Exceptions — when we do refund",
        paragraphs: ["We review the following cases individually and issue refunds where justified:"],
        bullets: [
          "Duplicate or erroneous charges — e.g. you were billed twice for the same period.",
          "Confirmed billing errors on our side or on the side of our payment provider.",
          "A prolonged technical failure of the Service on our side that made Pro features unusable for a substantial part of the billing period, and that we could not resolve after you reported it.",
        ],
        afterBullets: [
          `To request a review, email ${LEGAL_CONTACT_EMAIL} within 14 days of the charge, with the email address on the account and the order or invoice reference.`,
        ],
      },
      {
        id: "processing",
        heading: "How refunds are processed",
        paragraphs: [
          "All payments are handled by Lemon Squeezy, our merchant of record. If a refund is approved, it is issued by Lemon Squeezy to your original payment method. Refunds typically appear within 5–10 business days depending on your bank or card issuer. Taxes collected on the payment are refunded together with it.",
        ],
      },
      {
        id: "statutory-rights",
        heading: "Your statutory rights",
        paragraphs: [
          "Nothing in this policy limits any non-waivable rights you have under the consumer-protection laws of your country of residence — including, where applicable, withdrawal rights under EU consumer law and rights under Turkish consumer legislation.",
          "Note for EU/EEA consumers: by starting your Pro subscription, you request immediate access to the digital service and acknowledge that, once performance has begun with your consent, the 14-day withdrawal right may no longer apply to the extent permitted by Directive 2011/83/EU. Where the law nevertheless grants you a refund right, we honor it.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to this policy",
        paragraphs: [
          "If we change this policy, the version in force at the time of your payment applies to that payment. The \"last updated\" date above always reflects the current version.",
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        paragraphs: [
          `Billing questions, cancellation help or refund requests: ${LEGAL_CONTACT_EMAIL}. We usually respond within 2 business days.`,
        ],
      },
    ],
  },
  tr: {
    slug: "refund-policy",
    title: "İade Politikası",
    metaTitle: "İade Politikası — ClinicRadar",
    metaDescription:
      "ClinicRadar iade politikası: önce Free planda ücretsiz deneyin, istediğiniz zaman iptal edin; fatura hataları ve yasal haklar nasıl ele alınır.",
    lastUpdated: "Son güncelleme: 27 Şubat 2026",
    intro: [
      "Bunu basit ve dürüst tutuyoruz: ClinicRadar'ın cömert bir Free planı var — tam da ödeme yapmadan önce ürünü değerlendirebilesiniz diye. Bu nedenle Pro plan ödemeleri iade edilmez; ancak istediğiniz an iptal edebilir ve ödediğiniz dönemin sonuna kadar erişiminizi korursunuz.",
      "Bu politika; iptalin tam olarak nasıl işlediğini, yenilemede ne olduğunu ve iade yaptığımız istisnaları açıklar.",
    ],
    atAGlance: [
      "Satın almadan önce deneyin: Free plan, görev motorunun tamamını içerir — ClinicRadar'ı ücretsiz değerlendirebilirsiniz.",
      "Pro ödemeleri iade edilmez; kısmi dönemler ve kullanılmayan süreler dahil.",
      "Faturalama sayfanızdan istediğiniz an iptal edin — form yok, e-posta gerekmez. Ödediğiniz dönem bitene kadar Pro sizde kalır.",
      "Fatura hataları, mükerrer tahsilatlar ve bizden kaynaklanan doğrulanmış teknik arızalar her zaman telafi edilir.",
      "Yasal tüketici haklarınız bu politikayla hiçbir şekilde sınırlandırılmaz.",
    ],
    sections: [
      {
        id: "free-plan-first",
        heading: "Önce Free planda değerlendirin",
        paragraphs: [
          "Free plan süreli bir deneme değildir — aylık yeniden tarama ve 3 rakibe kadar analizle görev motorunun tamamını süresiz içerir. Yükseltmeden önce ihtiyaç duyduğunuz kadar kullanmanızı öneririz. Pro'ya geçmek; haftalık yeniden tarama, daha fazla rakip, aylık PDF raporları ve anlık kritik sinyal uyarıları ekler.",
          "Ürün ücretsiz olarak eksiksiz değerlendirilebildiği için Pro ödemelerinde para iadesi sunmuyoruz.",
        ],
      },
      {
        id: "cancellation",
        heading: "İptal",
        bullets: [
          "Pro aboneliğinizi uygulama içindeki faturalama sayfanızdan istediğiniz an iptal edebilirsiniz — self-servis; gelecekteki yenilemeler için anında geçerlidir.",
          "İptalden sonra, ödemesini yaptığınız fatura döneminin sonuna kadar tam Pro erişiminiz devam eder. Başka tahsilat yapılmaz.",
          "Ödenen dönem bittiğinde hesabınız otomatik olarak Free plana geçer. Verileriniz, analizleriniz ve görevleriniz silinmez.",
        ],
      },
      {
        id: "renewals",
        heading: "Yenilemeler",
        paragraphs: [
          "Pro abonelikleri her fatura dönemi sonunda otomatik yenilenir. Hizmeti artık istemiyorsanız yenileme tarihinden önce iptal etmek sizin sorumluluğunuzdadır; başlamış bir döneme ait tahsilatlar tamamen veya oransal olarak iade edilmez. Bir sonraki yenileme tarihinizi faturalama sayfasından her zaman görebilirsiniz.",
        ],
      },
      {
        id: "exceptions",
        heading: "İstisnalar — iade yaptığımız durumlar",
        paragraphs: ["Aşağıdaki durumları tek tek inceler ve haklı bulunduğunda iade yaparız:"],
        bullets: [
          "Mükerrer veya hatalı tahsilat — ör. aynı dönem için iki kez ücretlendirilmeniz.",
          "Bizden veya ödeme sağlayıcımızdan kaynaklanan doğrulanmış fatura hataları.",
          "Hizmette bizden kaynaklanan, Pro özellikleri fatura döneminin önemli bir bölümünde kullanılamaz hâle getiren ve siz bildirdikten sonra çözemediğimiz uzun süreli teknik arıza.",
        ],
        afterBullets: [
          `İnceleme talebi için, tahsilattan itibaren 14 gün içinde ${LEGAL_CONTACT_EMAIL} adresine hesaptaki e-posta adresi ve sipariş/fatura referansıyla yazın.`,
        ],
      },
      {
        id: "processing",
        heading: "İadeler nasıl işlenir",
        paragraphs: [
          "Tüm ödemeler Merchant of Record'umuz Lemon Squeezy tarafından yürütülür. Bir iade onaylanırsa, Lemon Squeezy tarafından orijinal ödeme yönteminize yapılır. İadeler, bankanıza veya kart kuruluşunuza bağlı olarak genellikle 5–10 iş günü içinde hesabınıza yansır. Ödemeyle birlikte tahsil edilen vergiler de iadeyle birlikte geri ödenir.",
        ],
      },
      {
        id: "statutory-rights",
        heading: "Yasal haklarınız",
        paragraphs: [
          "Bu politikadaki hiçbir hüküm; ikamet ettiğiniz ülkenin tüketici koruma mevzuatı kapsamındaki vazgeçilemez haklarınızı — geçerli olduğu ölçüde AB tüketici hukuku kapsamındaki cayma hakları ve Türk tüketici mevzuatındaki haklar dahil — sınırlamaz.",
          "AB/AEA tüketicileri için not: Pro aboneliğinizi başlatarak dijital hizmete anında erişim talep etmiş olursunuz ve ifaya rızanızla başlandıktan sonra 14 günlük cayma hakkının, 2011/83/EU sayılı Direktif'in izin verdiği ölçüde artık uygulanmayabileceğini kabul edersiniz. Kanunun yine de iade hakkı tanıdığı durumlarda bu hakka uyarız.",
        ],
      },
      {
        id: "changes",
        heading: "Bu politikadaki değişiklikler",
        paragraphs: [
          "Bu politikayı değiştirirsek, ödemenizin yapıldığı tarihte yürürlükte olan sürüm o ödeme için geçerli olur. Yukarıdaki \"son güncelleme\" tarihi her zaman güncel sürümü gösterir.",
        ],
      },
      {
        id: "contact",
        heading: "İletişim",
        paragraphs: [
          `Faturalama soruları, iptal yardımı veya iade talepleri için: ${LEGAL_CONTACT_EMAIL}. Genellikle 2 iş günü içinde yanıt veririz.`,
        ],
      },
    ],
  },
};
