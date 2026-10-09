"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Partners block: the combined Plus In Plus × TS Connect brand SVG
 * (/public/assets/logos/pip-ts-connect.svg, uploaded manually by the customer)
 * with a text fallback until the asset is added.
 */
export function Partners() {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <section aria-label="Our partners">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-8 sm:py-20 lg:grid-cols-2">
        <div className="flex items-center justify-center gap-6 sm:gap-8">
          {logoFailed ? (
            <>
              <span className="text-2xl font-bold tracking-tight">Plus In Plus</span>
              <span aria-hidden="true" className="h-12 w-px bg-border" />
              <span className="text-2xl font-bold tracking-[0.2em]">TS CONNECT</span>
            </>
          ) : (
            <Image
              src="/assets/logos/pip-ts-connect.svg"
              alt="Plus In Plus and TS Connect"
              width={420}
              height={96}
              className="h-auto w-auto max-w-full"
              onError={() => setLogoFailed(true)}
            />
          )}
        </div>
        <p className="text-center text-lg leading-relaxed lg:text-left">
          Our partners and neighbors at TS Connect, an IT firm in Tambov, provide us with the
          resources we need to carry out our activities, and we, in turn, provide them with our
          services.
        </p>
      </div>
    </section>
  );
}
