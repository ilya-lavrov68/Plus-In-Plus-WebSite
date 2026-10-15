/**
 * Plus In Plus brand theme for Spectrum UI components.
 *
 * Spectrum UI ships no runtime theming API — its components are Tailwind-based
 * source files that live in `components/spectrumui/`. Branding therefore happens
 * through three channels, all driven from this one file so there is a single
 * source of truth:
 *
 *   1. `spectrumTheme`      — the typed token object (import it in TS).
 *   2. `--spectrum-*` vars  — declared in `styles/globals.css` from
 *                             `spectrumCssVariables`, for plain CSS / inline
 *                             styles / arbitrary Tailwind values.
 *   3. Tailwind tokens      — registered under `@theme` in `styles/globals.css`
 *                             so `bg-brand`, `text-brand`, `rounded-brand` etc.
 *                             work as normal utilities.
 *
 * The values below are the *existing* Plus In Plus palette. Changing a hex here
 * changes it across every Spectrum component at once — do not introduce new
 * colours without updating `tailwind.config.ts` and `styles/globals.css` too.
 */

export const spectrumTheme = {
  colors: {
    /** Brand navy — primary surfaces, text, focus rings. (#052B42) */
    primary: "#052B42",
    /** Brand green — CTAs, positive states, featured badges. (#00C56D) */
    secondary: "#00C56D",
    /** Light blue/lavender wash — tinted panels and hover fills. (#D9E1FF) */
    accent: "#D9E1FF",
    /** Page background. */
    background: "#FFFFFF",
    /** Default text, identical to `primary`. */
    text: "#052B42",
    /** Muted text: navy at 50% opacity. */
    muted: "#052B4280",
    /** Destructive actions. */
    destructive: "#B4232A",
    /** Hairline borders. */
    border: "#052B4229",
  },

  /**
   * Brand corner radii.
   * `md` (12px / rounded-xl) is the default for buttons and controls;
   * `full` is reserved for the header pill buttons and small icon chips.
   */
  borderRadius: {
    sm: "0.375rem", // 6px  — rounded-md: inputs, small controls
    md: "0.75rem", // 12px — rounded-xl: buttons, cards, panels
    lg: "1rem", // 16px — rounded-2xl: large surfaces, modals
    full: "9999px", // rounded-full: header buttons, pills
  },

  /** Hover / active states derived from the base colours above. */
  hover: {
    primary: "#153C5C",
    primaryAlt: "#0A4366",
    secondary: "#00B361",
    /** Navy at 6% — the standard ghost/outline hover wash. */
    primaryWash: "#052B420F",
  },

  /** Motion tokens. Spectrum components ship their own animations, but any
   *  transition added on top must use these to stay consistent. */
  transition: {
    duration: {
      fast: "160ms",
      base: "200ms",
      slow: "250ms",
    },
    timing: "cubic-bezier(0, 0, 0.2, 1)",
  },

  /** Focus ring, applied to every focusable Spectrum component. */
  focus: {
    ring: "#052B42",
    offset: "#FFFFFF",
  },
} as const;

export type SpectrumTheme = typeof spectrumTheme;

/**
 * CSS custom properties mirroring `spectrumTheme`.
 * Spread into a style object on a wrapper element, or inject globally via
 * `styles/globals.css` (already done — see the `:root` block there).
 */
export const spectrumCssVariables: Record<string, string> = {
  "--spectrum-primary": spectrumTheme.colors.primary,
  "--spectrum-primary-hover": spectrumTheme.hover.primary,
  "--spectrum-secondary": spectrumTheme.colors.secondary,
  "--spectrum-secondary-hover": spectrumTheme.hover.secondary,
  "--spectrum-accent": spectrumTheme.colors.accent,
  "--spectrum-background": spectrumTheme.colors.background,
  "--spectrum-text": spectrumTheme.colors.text,
  "--spectrum-muted": spectrumTheme.colors.muted,
  "--spectrum-destructive": spectrumTheme.colors.destructive,
  "--spectrum-border": spectrumTheme.colors.border,
  "--spectrum-radius-sm": spectrumTheme.borderRadius.sm,
  "--spectrum-radius-md": spectrumTheme.borderRadius.md,
  "--spectrum-radius-lg": spectrumTheme.borderRadius.lg,
  "--spectrum-radius-full": spectrumTheme.borderRadius.full,
  "--spectrum-duration-base": spectrumTheme.transition.duration.base,
  "--spectrum-ease": spectrumTheme.transition.timing,
};

/**
 * Ready-made Tailwind class fragments for branding Spectrum components.
 *
 * Spectrum components accept `className`, so these are the fastest way to pull
 * a stock component onto the Plus In Plus palette without editing its source.
 */
export const brandClassNames = {
  /** Solid navy button (the `default`/`primary` look). */
  solidButton:
    "rounded-xl bg-[#052B42] font-body text-white transition-colors duration-200 ease-out hover:bg-[#153C5C]",
  /** Solid green button — the primary site CTA. */
  ctaButton:
    "rounded-xl bg-[#00C56D] font-body text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#00B361]",
  /** Outline button on light backgrounds. */
  outlineButton:
    "rounded-xl border border-[#052B42] bg-transparent font-body text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#052B42]/[0.06]",
  /** Card surface. */
  card: "rounded-xl border border-[#052B4229] bg-white text-[#052B42] shadow-sm",
  /** Form control (input / textarea / select trigger). */
  control:
    "rounded-md border border-[#052B4229] bg-white text-[#052B42] transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2",
  /** Focus ring, for components that do not inherit one. */
  focusRing:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42] focus-visible:ring-offset-2",
  /** Small status pill. */
  badge:
    "rounded-lg border border-transparent bg-[#00C56D] px-2.5 py-0.5 font-body text-xs font-semibold text-[#052B42]",
  /** Icon tile used across the navigation dropdowns. */
  iconTile: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00C56D] text-[#052B42]",
} as const;

/**
 * Convenience helper: merge brand classes with a component's own classes.
 * Keeps the import list short in consuming files.
 */
export function brand<K extends keyof typeof brandClassNames>(
  key: K,
  extra?: string,
): string {
  return extra ? `${brandClassNames[key]} ${extra}` : brandClassNames[key];
}
