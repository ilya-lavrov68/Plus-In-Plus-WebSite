"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";

const FIELD_CLASS =
  "mt-2 w-full rounded-lg border border-navy/30 bg-white/50 px-3 py-2.5 font-body text-sm text-navy placeholder:text-navy/50 transition-colors duration-200 ease-out focus-visible:border-navy focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30";

const CHECKBOX_CLASS = "mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-navy";

/**
 * Newsletter sign-up in the footer. Presentation and client-side validation
 * only, following the contact form: the submit handler is ready for a
 * delivery endpoint to be connected later and says so instead of pretending
 * the address was stored.
 */
export function FooterSubscribeForm() {
  const t = useTranslations("footer");
  const tc = useTranslations("common");
  const [status, setStatus] = useState<"idle" | "pending">("idle");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("pending");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md font-body xl:max-w-none">
      <h3 className="font-body text-sm font-semibold text-navy">{t("subscribe")}</h3>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="footer-first-name" className="sr-only">
            {tc("firstName")}
          </label>
          <input
            id="footer-first-name"
            name="firstName"
            type="text"
            autoComplete="given-name"
            placeholder={tc("firstName")}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor="footer-last-name" className="sr-only">
            {tc("lastName")}
          </label>
          <input
            id="footer-last-name"
            name="lastName"
            type="text"
            autoComplete="family-name"
            placeholder={tc("lastName")}
            className={FIELD_CLASS}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="footer-email" className="sr-only">
            {tc("email")}
          </label>
          <input
            id="footer-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={tc("email")}
            className={FIELD_CLASS}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <label className="flex cursor-pointer items-start gap-2 font-body text-xs leading-5 text-navy/80">
          <input type="checkbox" name="plusInPlusNews" defaultChecked className={CHECKBOX_CLASS} />
          {t("news")}
        </label>
        <label className="flex cursor-pointer items-start gap-2 font-body text-xs leading-5 text-navy/80">
          <input type="checkbox" name="designInsights" defaultChecked className={CHECKBOX_CLASS} />
          {t("insights")}
        </label>
      </div>

      <p id="footer-subscribe-consent" className="mt-3 font-body text-xs leading-5 text-navy/60">
        {t("subscriptionConsent")}
      </p>

      <button
        type="submit"
        aria-describedby="footer-subscribe-consent"
        className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-navy px-4 font-body text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-[#0A4366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-[#D6E4FF]"
      >
        {t("subscribeButton")}
      </button>

      <p role="status" className="mt-3 min-h-5 font-body text-xs leading-5 text-navy/70">
        {status === "pending" ? t("subscribeNotConnected") : ""}
      </p>
    </form>
  );
}
