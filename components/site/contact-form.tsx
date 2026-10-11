"use client";

import { useState } from "react";
import type { FormEvent } from "react";

const FIELD_CLASS =
  "mt-2 w-full rounded-lg border border-[#052B42]/20 bg-white px-4 py-3 font-body text-base text-[#052B42] placeholder:text-[#052B42]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy";

/**
 * Contact form placeholder. Submission is not connected to a backend yet:
 * the submit only validates the browser fields and shows a status message.
 */
export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "pending">("idle");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("pending");
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold">
        First name
        <input name="firstName" type="text" autoComplete="given-name" required className={FIELD_CLASS} />
      </label>
      <label className="block text-sm font-semibold">
        Last name
        <input name="lastName" type="text" autoComplete="family-name" required className={FIELD_CLASS} />
      </label>
      <label className="block text-sm font-semibold sm:col-span-2">
        Email
        <input name="email" type="email" autoComplete="email" required className={FIELD_CLASS} />
      </label>
      <label className="block text-sm font-semibold sm:col-span-2">
        Message
        <textarea name="message" rows={6} required className={`${FIELD_CLASS} resize-y`} />
      </label>
      <div className="flex flex-col items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          className="mx-auto inline-flex h-12 min-w-32 items-center justify-center rounded-xl bg-[#052B42] px-8 font-body text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-[#153c5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2"
        >
          Send
        </button>
        <p role="status" className="text-center text-sm text-[#052B42]/80">
          {status === "pending" ? "Message sending is not connected yet." : ""}
        </p>
      </div>
    </form>
  );
}
