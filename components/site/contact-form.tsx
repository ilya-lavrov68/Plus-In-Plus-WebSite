"use client";

import { useState } from "react";
import type { FormEvent } from "react";

const FIELD_CLASS =
  "mt-2 w-full rounded-xl border border-[#052B42]/20 bg-white px-4 py-3 font-body text-base text-[#052B42] placeholder:text-[#052B42]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]";

/** Contact-form presentation. Submission is ready for the existing API to be connected later. */
export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "pending">("idle");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("pending");
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-5">
      <label className="block font-body text-sm font-medium text-[#052B42]">
        First name
        <input name="firstName" type="text" autoComplete="given-name" required className={FIELD_CLASS} />
      </label>
      <label className="block font-body text-sm font-medium text-[#052B42]">
        Last name
        <input name="lastName" type="text" autoComplete="family-name" required className={FIELD_CLASS} />
      </label>
      <label className="block font-body text-sm font-medium text-[#052B42] sm:col-span-2">
        Email
        <input name="email" type="email" autoComplete="email" required className={FIELD_CLASS} />
      </label>
      <label className="block font-body text-sm font-medium text-[#052B42] sm:col-span-2">
        Message
        <textarea name="message" rows={5} required className={`${FIELD_CLASS} resize-y`} />
      </label>
      <div className="flex flex-col items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          className="mx-auto inline-flex h-12 min-w-32 items-center justify-center rounded-xl bg-[#052B42] px-8 font-body text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-[#0A4366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2"
        >
          Send
        </button>
        <p role="status" className="min-h-5 text-center font-body text-sm text-[#052B42]/80">
          {status === "pending" ? "Message sending is not connected yet." : ""}
        </p>
      </div>
    </form>
  );
}
