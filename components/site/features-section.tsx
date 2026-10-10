import { Shield, User, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const features: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Everything is confidential",
    description:
      "We do not share your information with anyone other than our partners, who help us with our work",
    icon: Shield,
  },
  {
    title: "Individual selection",
    description: "We take an individualized approach with each person",
    icon: User,
  },
  {
    title: "Ongoing tech support",
    description: "We're always here to help if the design isn't quite right",
    icon: Wrench,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" aria-label="Why choose Plus In Plus" className="bg-[#0a2540] text-white">
      <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5 lg:gap-6">
          {features.map(({ title, description, icon: Icon }) => (
            <li
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.055] p-6 sm:p-8 lg:min-h-[265px]"
            >
              <Icon
                aria-hidden="true"
                className="h-9 w-9 text-[#70d77a] sm:h-10 sm:w-10"
                strokeWidth={1.7}
              />
              <h2 className="mt-7 font-geist text-xl font-semibold tracking-[-0.025em] text-white sm:text-2xl">
                {title}
              </h2>
              <p className="mt-3 max-w-sm font-body text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
