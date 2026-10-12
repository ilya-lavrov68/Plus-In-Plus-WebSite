import type { Metadata } from "next";

import { ContactForm } from "@/components/site/contact-form";
import { InternalPageContent, InternalPageHeader } from "@/components/site/internal-page-header";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Contact us — Plus In Plus",
  description: "Get in touch with the Plus In Plus design studio.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
      <InternalPageHeader title="CONTACT" />

      <InternalPageContent labelledBy="contact-heading" sectionClassName="pt-12 sm:pt-16 lg:pt-20">
        <h2 id="contact-heading" className="text-center font-geist text-3xl font-semibold tracking-[-0.04em] text-[#052B42] sm:text-4xl">
          Contact us
        </h2>
        <div className="mt-8 sm:mt-10">
          <ContactForm />
        </div>
      </InternalPageContent>
    </>
  );
}
