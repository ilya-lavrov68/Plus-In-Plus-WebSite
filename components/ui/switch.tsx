"use client";

import * as React from "react";

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

/**
 * AnimatedSwitch is the only thing on the admin routes that pulls in `motion`,
 * and it costs ~48 kB. Loading it on demand keeps that out of First Load JS
 * (measured: /admin/services/[id] 223 kB static vs 173 kB lazy) — the toggle is
 * an admin-only control, so fetching it just after paint costs nothing.
 *
 * The placeholder mirrors the real track exactly (44×24, same colours, knob in
 * the right place) so the swap is invisible rather than a flash of grey.
 */
const AnimatedSwitch = dynamic(
  () =>
    import("@/components/spectrumui/animated-switch").then(
      (mod) => mod.AnimatedSwitch
    ),
  { ssr: false }
);

/**
 * Props the old Radix switch accepted and that callers in this codebase use:
 * `id` + `<Label htmlFor>` and `aria-describedby` for help text. Both are
 * forwarded to AnimatedSwitch (see scripts/vendor-spectrum.cjs POST_FIXES).
 */
export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Lets `<Label htmlFor>` target the switch. */
  id?: string;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

/** Same 44×24 track and knob as AnimatedSwitch's "md" size. */
function SwitchPlaceholder({
  checked,
  className,
}: {
  checked: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-250 ease-out",
        checked ? "bg-neutral-900" : "bg-input",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background ring-0 transition-transform duration-250 ease-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </span>
  );
}

/**
 * Brand toggle, now Spectrum UI's AnimatedSwitch.
 *
 * The "md" size is 44×24px with a 20px knob — the same dimensions as the old
 * shadcn switch (w-11 h-6, thumb h-5 w-5), so nothing shifts in the layout.
 * The upgrade is behavioural: the knob stretches when pressed, can be dragged,
 * honours a flick, and collapses to an instant jump under
 * `prefers-reduced-motion`.
 *
 * Track colours are Spectrum's neutral pair, which matches the old
 * `--primary` / `--input` pair closely enough to be visually identical.
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, defaultChecked, ...props }, ref) => {
    // The dynamic import only resolves on the client, so the first render — on
    // the server and during hydration — is the placeholder.
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    if (!mounted) {
      return (
        <SwitchPlaceholder
          checked={checked ?? defaultChecked ?? false}
          className={className}
        />
      );
    }

    return (
      <AnimatedSwitch
        ref={ref as React.Ref<HTMLButtonElement>}
        size="md"
        checked={checked}
        defaultChecked={defaultChecked}
        className={cn(
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className
        )}
        {...props}
      />
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
