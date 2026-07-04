// Statik kategori eşleştirme — bkz. docs/03-database.md "Kategori normalizasyonu".
// Yaşayan/genişleyen bir liste, tek seferlik bir teslimat değil. Google'ın
// döndürdüğü ham kategori (kullanıcının/işletmenin yerel dilinde gelir) burada
// listelenmemişse kendi değerine normalize edilir — yani sadece birebir aynı
// yazılmış diğer kayıtlarla eşleşir, farklı dildeki eşdeğeriyle otomatik
// eşleşmez. Bu kabul edilen bir MVP sınırlamasıdır (Claude tabanlı, dilden
// bağımsız eşleştirme Faz 1.1'e bırakıldı).
const CATEGORY_ALIASES: Record<string, string> = {
  // dentist kümesi
  dentist: "dentist",
  "dental clinic": "dentist",
  "cosmetic dentist": "dentist",
  orthodontist: "dentist",
  "diş hekimi": "dentist",
  "diş kliniği": "dentist",
  "ortodonti uzmanı": "dentist",
  zahnarzt: "dentist",
  dentiste: "dentist",

  // estetik/kozmetik kümesi
  "medical spa": "aesthetic_clinic",
  "cosmetic surgeon": "aesthetic_clinic",
  "plastic surgeon": "aesthetic_clinic",
  "hair transplant clinic": "aesthetic_clinic",
  "estetik merkezi": "aesthetic_clinic",
  "estetik cerrahi merkezi": "aesthetic_clinic",
  "saç ekim merkezi": "aesthetic_clinic",
  "plastik cerrah": "aesthetic_clinic",

  // dermatoloji kümesi
  dermatologist: "dermatology",
  "skin care clinic": "dermatology",
  cildiye: "dermatology",
  dermatolog: "dermatology",
};

export function normalizeCategory(rawCategory: string | null): string | null {
  if (!rawCategory) {
    return null;
  }

  const key = rawCategory.trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? key;
}
