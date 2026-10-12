import { ShieldCheck, UserRound, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const features: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Everything is confidential",
    description:
      "We do not share your information with anyone other than our partners, who help us with our work",
    icon: ShieldCheck,
  },
  {
    title: "Individual selection",
    description: "We take an individualized approach with each person",
    icon: UserRound,
  },
  {
    title: "Ongoing tech support",
    description: "We're always here to help if the design isn't quite right",
    icon: Wrench,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" aria-label="Why choose Plus In Plus" className="bg-[#052B42] text-white">
      <div className="mx-auto max-w-[1736px] px-5 py-16 sm:px-8 sm:py-20 min-[1736px]:px-0 lg:py-[65px]">
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:gap-8 xl:grid-cols-3 xl:gap-[43px]">
          {features.map(({ title, description, icon: Icon }) => (
            <li
              key={title}
              className="flex flex-col rounded-[2rem] bg-[#0A3B57] p-6 sm:p-7 lg:rounded-[40px] lg:p-8"
            >
              <div className="flex items-center gap-4">
                <Icon aria-hidden="true" className="h-9 w-9 shrink-0 text-[#05F07E]" strokeWidth={1.8} />
                <h2 className="font-geist text-xl font-semibold leading-tight tracking-[-0.025em] text-white sm:text-[1.375rem]">
                  {title}
                </h2>
              </div>
              <p className="mt-5 max-w-[28rem] font-body text-[0.9375rem] leading-6 text-white sm:text-[1.0625rem] sm:leading-7">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
