import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Aylık rapor PDF'i (src/lib/reports/pdf-fonts.ts) Türkçe karakter desteği
  // için process.cwd() bazlı bir yoldan font dosyası okuyor — bu dinamik
  // fs erişimi statik import taramasıyla bulunamaz, serverless bundle'a
  // elle dahil edilmesi gerekir.
  outputFileTracingIncludes: {
    "/api/business/[id]/monthly-report": ["./src/lib/reports/fonts/*.ttf"],
  },
};

export default withNextIntl(nextConfig);
