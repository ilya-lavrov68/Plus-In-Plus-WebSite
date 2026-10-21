import type { Metadata } from "next";

import { Separator } from "@/components/ui/separator";
import { getRequestLocale } from "@/lib/request-locale";
import { createPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return createPageMetadata({
    title: "Privacy Policy — Plus In Plus",
    description:
      "How Plus In Plus handles project briefs, client contact details, and strict studio confidentiality.",
    path: "/privacy",
    locale,
  });
}

export default function PrivacyPage() {
  return (
    <section className="py-24 md:py-32">
      <div className="container max-w-3xl">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Confidentiality is one of the core principles of Plus In Plus. This
          policy explains what data we collect when you use our website, create
          an account, or submit a design request.
        </p>

        <Separator className="my-10" />

        <div className="space-y-8 text-base leading-7 text-muted-foreground">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              1. Information We Collect
            </h2>
            <p>
              We collect only the details necessary to process inquiries and
              deliver design projects: your first name, last name, email
              address, selected service options, and project descriptions you
              voluntarily submit through our forms.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              2. Strict Confidentiality
            </h2>
            <p>
              We do not sell, rent, or publish client materials. Project files
              and brief details are never shared outside Plus In Plus other than
              with trusted production partners directly assisting with your
              order.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              3. Contact &amp; Data Requests
            </h2>
            <p>
              To update or delete your account information at any time, contact
              our studio team through the Contact page or email{" "}
              <a
                href="mailto:hello@plusinplus.studio"
                className="text-foreground underline underline-offset-4"
              >
                hello@plusinplus.studio
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
