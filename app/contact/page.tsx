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

      <InternalPageContent labelledBy="contact-heading">
        <h2 id="contact-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
          Contact us
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed">
          Have an idea? Tell us about your project and we will get back to you.
        </p>
        <div className="mt-10">
          <ContactForm />
        </div>
      </InternalPageContent>
    </>
  );
}
