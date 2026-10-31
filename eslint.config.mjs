import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores(["lib/generated/**", "vendor/**"]),
  {
    extends: [...nextCoreWebVitals, ...nextTypescript],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    // Node test runners and operational scripts intentionally use CommonJS.
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-this-alias": "off",
    },
  },
  {
    // Next 16 enables React Compiler diagnostics even when the compiler is off.
    // These existing effects synchronize external editors, media and session state.
    files: [
      "components/admin/cover-image-help.tsx",
      "components/admin/rich-text-editor.tsx",
      "components/blocks/contact29.tsx",
      "components/site/cart-icon.tsx",
      "components/site/lazy-account-modal.tsx",
      "components/site/motion/scroll-experience.tsx",
      "components/spectrumui/ui/autosize-textarea.tsx",
      "components/ui/carousel.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    // Existing DOM adapters mutate browser nodes outside React's render output.
    files: [
      "components/site/language-switcher.tsx",
      "components/spectrumui/ui/autosize-textarea.tsx",
    ],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
    },
  },
]);
