import path from "node:path";

import { Font } from "@react-pdf/renderer";

// react-pdf'in gömülü "Helvetica" fontu (base-14 PDF fontu, WinAnsi kodlaması)
// Türkçe'ye özgü karakterleri (ı, ş, ğ) içermiyor — PDF'te bu harfler yerine
// rastgele/yanlış glif basılıyordu (görsel doğrulamada tespit edildi). Google
// Fonts'un CDN-dağıtımlı "latin"/"latin-ext" alt kümeleri de Türkçe alfabeyi
// TEK bir dosyada karşılamıyor (ı "latin"de, ş/ğ "latin-ext"te) — bu yüzden
// Google'ın kaynak deposundaki (google/fonts) değişken Noto Sans fontundan
// Regular/Bold statik enstantane çıkarılıp (fonttools varLib.instancer),
// yalnızca Latin + Latin Extended-A + genel noktalama aralığına subset'lenmiş
// (fonttools subset --unicodes=U+0000-024F,U+2000-206F,U+20AC) hâliyle
// `./fonts/`'a gömüldü — OFL lisanslı, bkz. `./fonts/OFL-NOTICE.md`.
//
// `path.join(process.cwd(), ...)` kullanılıyor (require.resolve DEĞİL) —
// Turbopack/webpack require.resolve'daki literal relative path'i statik bir
// import olarak yorumlayıp ".ttf için loader yok" hatasıyla build'i
// kırıyordu. Dosyaların serverless bundle'a dahil edilmesi
// `next.config.ts`'teki `outputFileTracingIncludes` ile garanti edilir.
const fontsDir = path.join(process.cwd(), "src/lib/reports/fonts");

Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(fontsDir, "NotoSans-Regular.ttf") },
    { src: path.join(fontsDir, "NotoSans-Bold.ttf"), fontWeight: 700 },
  ],
});
