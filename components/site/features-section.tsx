import { ShieldCheck, UserRound, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Feature cards of the landing page. Copy lives in `messages/*.json` under
 * `features.*`; only the icons are declared here.
 */
const features: { key: string; icon: LucideIcon }[] = [
  { key: "confidential", icon: ShieldCheck },
  { key: "individual", icon: UserRound },
  { key: "support", icon: Wrench },
];

export function FeaturesSection() {
  const t = useTranslations("features");
  return (
    <section id="features" aria-label={t("ariaLabel")} className="bg-[#052B42] text-white">
      <div className="mx-auto max-w-[1736px] px-5 py-16 sm:px-8 sm:py-20 min-[1736px]:px-0 lg:py-[65px]">
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:gap-8 xl:grid-cols-3 xl:gap-[43px]">
          {features.map(({ key, icon: Icon }) => (
            <li key={key} className="flex flex-col rounded-[1.75rem] bg-[#0A3B57] p-6 sm:p-7 lg:p-8">
              <div className="flex items-center gap-4">
                <Icon aria-hidden="true" className="h-9 w-9 shrink-0 text-[#05F07E]" strokeWidth={1.8} />
                <h2 className="font-geist text-xl font-semibold leading-tight tracking-[-0.025em] text-white sm:text-[1.375rem]">
                  {t(`${key}.title`)}
                </h2>
              </div>
              <p className="mt-5 max-w-[28rem] font-body text-[0.9375rem] leading-6 text-white sm:text-[1.0625rem] sm:leading-7">
                {t(`${key}.description`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
