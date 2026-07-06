import { MarketingFooter } from "./marketing-footer";
import { MarketingHeader } from "./marketing-header";

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
