import type { Metadata } from "next";

import { SpectrumShowcase } from "./spectrum-showcase";

export const metadata: Metadata = {
  title: "Spectrum UI check",
  // Scaffolding page for the migration — keep it out of search results and the
  // sitemap. Removed in Stage 4.
  robots: { index: false, follow: false },
};

export default function TestSpectrumPage() {
  return <SpectrumShowcase />;
}
