// E-posta şablon yardımcıları — tek yerde: hem tekrar önlenir hem de HTML
// bağlamına giren her değişkenin kaçışlanması garanti altına alınır.
// Şablon metinlerinin kendisi (messages/*.json) güvenilir kabul edilir;
// güvenilmeyen kısım DEĞİŞKENLERDİR (işletme adı Google'dan, tema adları
// yorum içeriğinden/AI çıktısından türetilir) — bkz. güvenlik incelemesi
// bulgusu: HTML injection via manual HTML building.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Düz metin bağlamı (örn. e-posta konusu) — kaçışlama YAPMAZ. */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

/** HTML bağlamı — her değişkeni yerine koymadan önce kaçışlar. */
export function fillTemplateHtml(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    key in vars ? escapeHtml(String(vars[key])) : `{${key}}`,
  );
}
