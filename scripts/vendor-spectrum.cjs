#!/usr/bin/env node
/**
 * Re-vendor Spectrum UI components into this project.
 *
 * Spectrum UI (github.com/arihantcodes/spectrum-ui) is a copy/paste component
 * registry, not an npm package — components are meant to be copied into your
 * source tree. This script does that copying reproducibly, so the vendored
 * files can be refreshed when the upstream library changes.
 *
 * Usage:
 *   git clone --depth 1 https://github.com/arihantcodes/spectrum-ui.git /tmp/spectrum-ui
 *   node scripts/vendor-spectrum.cjs /tmp/spectrum-ui
 *
 * It reads the built registry manifests (public/r/<name>.json), writes each
 * component to the path in PLAN below, and applies the small import rewrites
 * this project needs. Re-run it after upgrading, then review `git diff` —
 * vendored files are ordinary source and are safe to edit afterwards.
 */

const fs = require("node:fs");
const path = require("node:path");

const SRC = process.argv[2] || "/tmp/spectrum-ui";
const DEST_ROOT = path.resolve(__dirname, "..");

/**
 * registry item -> { source path in the manifest : destination path here }
 *
 *   components/spectrumui/     showcase / composed components
 *   components/spectrumui/ui/  enhanced primitives
 */
const PLAN = {
  // ---- enhanced primitives -------------------------------------------------
  "accordion-dependencies": {
    "components/ui/accordion.tsx": "components/spectrumui/ui/accordion.tsx",
  },
  "autosize-textarea-dependecies": {
    "components/spectrumui/autosize-textarea.tsx": "components/spectrumui/ui/autosize-textarea.tsx",
  },
  "loading-button-dependencies": {
    "components/spectrumui/loading-button-dependencies.tsx": "components/spectrumui/ui/loading-button.tsx",
  },
  "multiple-selector-dependencies": {
    "components/spectrumui/multiple-selector-dependencies.tsx": "components/spectrumui/ui/multiple-selector.tsx",
  },
  "progress-with-value-dependencies": {
    "components/spectrumui/progress-with-value-dependencies.tsx": "components/spectrumui/ui/progress-with-value.tsx",
  },
  "responsive-modal-dependencies": {
    "components/spectrumui/responsive-modal-dependencies.tsx": "components/spectrumui/ui/responsive-modal.tsx",
  },
  "spinner-dependencies": {
    "components/spectrumui/spinner-dependencies.tsx": "components/spectrumui/ui/spinner.tsx",
  },
  "dual-range-slider-dependecies": {
    "components/spectrumui/dual-range-slider-dependecies.tsx": "components/spectrumui/ui/dual-range-slider.tsx",
  },
  "floating-label-input": {
    "components/spectrumui/floating-label-input.tsx": "components/spectrumui/ui/floating-label-input.tsx",
  },
  "infinite-scroll-dependecies": {
    "components/spectrumui/infinite-scroll-dependecies.tsx": "components/spectrumui/ui/infinite-scroll.tsx",
  },

  // ---- showcase / composed -------------------------------------------------
  "data-table": { "components/spectrumui/data-table.tsx": "components/spectrumui/data-table.tsx" },
  "animated-switch": { "components/spectrumui/animated-switch.tsx": "components/spectrumui/animated-switch.tsx" },
  "tilt-card": { "components/spectrumui/tilt-card.tsx": "components/spectrumui/tilt-card.tsx" },
  "command-search": { "components/spectrumui/command-search.tsx": "components/spectrumui/command-search.tsx" },
  "skeleton-reveal": { "components/spectrumui/skeleton-reveal.tsx": "components/spectrumui/skeleton-reveal.tsx" },
  "animated-card": { "components/spectrumui/animatedcard.tsx": "components/spectrumui/animated-card.tsx" },
  "password-strength": { "components/spectrumui/password-strength.tsx": "components/spectrumui/password-strength.tsx" },
  "quantity-stepper": { "components/spectrumui/quantity-stepper.tsx": "components/spectrumui/quantity-stepper.tsx" },
  "task-checkbox": { "components/spectrumui/task-checkbox.tsx": "components/spectrumui/task-checkbox.tsx" },
  dock: { "components/spectrumui/dock.tsx": "components/spectrumui/dock.tsx" },
  "accordion-card": { "components/spectrumui/accordion-card.tsx": "components/spectrumui/accordion-card.tsx" },
  "accordion-filled": { "components/spectrumui/accordion-filled.tsx": "components/spectrumui/accordion-filled.tsx" },
  "accordion-ghost": { "components/spectrumui/accordion-ghost.tsx": "components/spectrumui/accordion-ghost.tsx" },
  "accordion-generative": {
    "components/spectrumui/accordion-generative.tsx": "components/spectrumui/accordion-generative.tsx",
  },
  "toast-stack": {
    "components/motion/animated-toast-stack.tsx": "components/spectrumui/animated-toast-stack.tsx",
    "lib/ease.ts": "lib/ease.ts",
  },
};

const REWRITES = [
  // The project installs the `motion` package only; several Spectrum components
  // still import the legacy `framer-motion` entry point (same library).
  [/from ["']framer-motion["']/g, 'from "motion/react"'],
  // shadcn's `command` primitive is not part of this project; it is vendored
  // together with the other Spectrum primitives.
  [/@\/components\/ui\/command/g, "@/components/spectrumui/ui/command"],
  // Same for the accordion: Spectrum's variants must import the vendored copy.
  [/@\/components\/ui\/accordion/g, "@/components/spectrumui/ui/accordion"],
];

/**
 * Local fixes applied after every vendoring.
 *
 * Upstream targets React 19 / Next 16 with a newer ESLint flat config; this
 * project runs React 18 / Next 15 with `next lint` (ESLint 8). These rewrites
 * close that gap. They are idempotent — a no-op if upstream already changed.
 */
const POST_FIXES = [
  {
    file: "components/spectrumui/ui/command.tsx",
    from: "interface CommandDialogProps extends DialogProps {}",
    to: "type CommandDialogProps = DialogProps;",
    why: "@typescript-eslint/no-empty-object-type",
  },
  {
    file: "components/spectrumui/ui/floating-label-input.tsx",
    from: "export interface InputProps\n  extends React.InputHTMLAttributes<HTMLInputElement> {}",
    to: "export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;",
    why: "@typescript-eslint/no-empty-object-type",
  },
  {
    file: "components/spectrumui/ui/infinite-scroll.tsx",
    from: "        // @ts-ignore ignore ref type\n",
    to: "",
    why: "unused @ts-ignore under this tsconfig",
  },
  {
    file: "components/spectrumui/ui/multiple-selector.tsx",
    from: "                triggerSearchOnFocus && onSearch?.(debouncedSearchTerm);",
    to: "                if (triggerSearchOnFocus) onSearch?.(debouncedSearchTerm);",
    why: "@typescript-eslint/no-unused-expressions",
  },
  {
    file: "components/spectrumui/animated-toast-stack.tsx",
    from: "    // eslint-disable-next-line react-hooks/set-state-in-effect -- upstream beUI code\n",
    to: "",
    why: "rule does not exist in this project's ESLint config",
  },

  // Upstream AnimatedSwitch renders a <button> but exposes no `id`, so
  // <Label htmlFor> cannot target it and `aria-describedby` is unreachable.
  // Both are labelable-button attributes; upstream has no reason to reject them.
  {
    file: "components/spectrumui/animated-switch.tsx",
    from: '  /** Accessible name of the switch. Default "Toggle" */\n  label?: string\n',
    to:
      '  /** Accessible name of the switch. Default "Toggle" */\n  label?: string\n' +
      "  /** Forwards to the button so `<Label htmlFor>` can target the switch. */\n" +
      "  id?: string\n" +
      "  /** Forwards to the button so descriptions stay wired up. */\n" +
      '  "aria-describedby"?: string\n',
    why: "a11y: label/switch association (htmlFor) and aria-describedby",
  },
  {
    file: "components/spectrumui/animated-switch.tsx",
    from: '  disabled = false,\n  label = "Toggle",\n  className,\n}: AnimatedSwitchProps) {',
    to:
      '  disabled = false,\n  label = "Toggle",\n  id,\n  "aria-describedby": ariaDescribedBy,\n  className,\n}: AnimatedSwitchProps) {',
    why: "a11y: read the new id / aria-describedby props",
  },
  {
    file: "components/spectrumui/animated-switch.tsx",
    from: "      aria-checked={checked}\n      aria-label={label}\n",
    to:
      "      id={id}\n      aria-checked={checked}\n      aria-describedby={ariaDescribedBy}\n      aria-label={label}\n",
    why: "a11y: apply id / aria-describedby to the button",
  },
  // Upstream declares AnimatedSwitch as a plain function component, so it
  // cannot take a ref — but it renders a <button> and every other toggle in the
  // codebase is ref-forwarding. Convert to forwardRef so the brand wrapper in
  // components/ui/switch.tsx keeps the usual Radix-style API.
  {
    file: "components/spectrumui/animated-switch.tsx",
    from: "export function AnimatedSwitch({\n  checked: checkedProp,",
    to:
      "export const AnimatedSwitch = React.forwardRef<HTMLButtonElement, AnimatedSwitchProps>(\n  function AnimatedSwitch({\n  checked: checkedProp,",
    why: "forwardRef: wraps the component so refs reach the button",
  },
  {
    file: "components/spectrumui/animated-switch.tsx",
    from: "}: AnimatedSwitchProps) {",
    to: "  }: AnimatedSwitchProps,\n  ref,\n) {",
    why: "forwardRef: accept the ref argument",
  },
  {
    file: "components/spectrumui/animated-switch.tsx",
    from: "      id={id}\n",
    to: "      ref={ref}\n      id={id}\n",
    why: "forwardRef: attach the ref to the button",
  },
  {
    file: "components/spectrumui/animated-switch.tsx",
    from: "    </button>\n  )\n}\n",
    to: '    </button>\n  )\n});\n\nAnimatedSwitch.displayName = "AnimatedSwitch";\n',
    why: "forwardRef: close the forwardRef call",
  },

  // Upstream hardcodes the English word "Close" in the modal's dismiss button.
  // This site is EN/RU, so the label has to be injectable.
  {
    file: "components/spectrumui/ui/responsive-modal.tsx",
    from:
      "    VariantProps<typeof ResponsiveModalVariants> {}",
    to:
      "    VariantProps<typeof ResponsiveModalVariants> {\n" +
      "  /** Accessible label for the dismiss button. Pass a translated string. */\n" +
      "  closeLabel?: string;\n" +
      "}",
    why: "i18n: modal close button label must be translatable",
  },
  {
    file: "components/spectrumui/ui/responsive-modal.tsx",
    from: '>(({ side = "bottom", className, children, ...props }, ref) => (',
    to: '>(({ side = "bottom", className, children, closeLabel, ...props }, ref) => (',
    why: "i18n: read the closeLabel prop",
  },
  {
    file: "components/spectrumui/ui/responsive-modal.tsx",
    from:
      '<ResponsiveModalClose className="absolute right-4 top-4 rounded-sm opacity-70',
    to:
      '<ResponsiveModalClose aria-label={closeLabel} className="absolute right-4 top-4 rounded-sm opacity-70',
    why: "i18n: label the dismiss button for screen readers",
  },
  {
    file: "components/spectrumui/ui/responsive-modal.tsx",
    from: '<span className="sr-only">Close</span>',
    to: '<span className="sr-only">{closeLabel}</span>',
    why: "i18n: use the translated close label",
  },
  // Upstream only ships top/bottom/left/right: below `lg` the modal is always a
  // sheet. This site's dialogs have always been centred at every width, so add a
  // `center` side that reproduces the lg behaviour unconditionally. The brand
  // dialog defaults to it, which keeps every existing screen pixel-identical
  // while the sheet variants stay available.
  {
    file: "components/spectrumui/ui/responsive-modal.tsx",
    from: "      side: {\n        top:",
    to:
      "      side: {\n" +
      "        center:\n" +
      '          "left-[50%] top-[50%] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",\n' +
      "        top:",
    why: "preserve centred dialogs below lg (upstream only ships sheet sides)",
  },
];

function main() {
  const written = [];
  const missing = [];

  for (const [name, mapping] of Object.entries(PLAN)) {
    const manifestPath = path.join(SRC, "public", "r", `${name}.json`);
    if (!fs.existsSync(manifestPath)) {
      missing.push(`${name}: registry manifest not found`);
      continue;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const byPath = new Map();
    for (const file of manifest.files || []) {
      if (file.path) byPath.set(file.path, file.content);
      if (file.target) byPath.set(file.target, file.content);
    }

    for (const [srcFile, target] of Object.entries(mapping)) {
      const content = byPath.get(srcFile);
      if (content === undefined) {
        missing.push(`${name}: ${srcFile}`);
        continue;
      }
      let out = content;
      for (const [pattern, replacement] of REWRITES) out = out.replace(pattern, replacement);

      const dest = path.join(DEST_ROOT, target);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, out);
      written.push(target);
    }
  }

  // components/ui/command.tsx is a plain shadcn primitive that Spectrum's
  // multiple-selector builds on. It is not published to the registry, so take it
  // from the library source tree.
  const commandSrc = path.join(SRC, "components/ui/command.tsx");
  if (fs.existsSync(commandSrc)) {
    const dest = path.join(DEST_ROOT, "components/spectrumui/ui/command.tsx");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, fs.readFileSync(commandSrc, "utf8"));
    written.push("components/spectrumui/ui/command.tsx");
  } else {
    missing.push("components/ui/command.tsx (library source)");
  }

  // use-typewriter is a hook, not a registry component.
  const typewriterSrc = path.join(SRC, "components/spectrumui/use-typewriter.ts");
  if (fs.existsSync(typewriterSrc)) {
    const dest = path.join(DEST_ROOT, "components/spectrumui/use-typewriter.ts");
    fs.writeFileSync(dest, fs.readFileSync(typewriterSrc, "utf8"));
    written.push("components/spectrumui/use-typewriter.ts");
  } else {
    missing.push("components/spectrumui/use-typewriter.ts (library source)");
  }

  // Apply the local compatibility fixes.
  for (const fix of POST_FIXES) {
    const dest = path.join(DEST_ROOT, fix.file);
    if (!fs.existsSync(dest)) {
      missing.push(`${fix.file} (post-fix target missing)`);
      continue;
    }
    const before = fs.readFileSync(dest, "utf8");
    if (!before.includes(fix.from)) continue; // already applied / upstream changed
    fs.writeFileSync(dest, before.replace(fix.from, fix.to));
    console.log(`  ~ ${fix.file}  (${fix.why})`);
  }

  console.log(`\nwrote ${written.length} files`);
  for (const file of written.sort()) console.log("  +", file);

  if (missing.length) {
    console.log(`\nMISSING (${missing.length}):`);
    for (const item of missing) console.log("  !", item);
    process.exit(1);
  }

  console.log(
    "\nNext: npx tsc --noEmit && npm run lint && npm run build, then review git diff.",
  );
}

main();
