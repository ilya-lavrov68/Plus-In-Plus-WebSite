# Spectrum UI — vendored components

These files are vendored source from **[Spectrum UI](https://github.com/arihantcodes/spectrum-ui)**
(Apache-2.0), part of the Plus In Plus migration off plain shadcn/ui.

## Why vendored instead of installed

Spectrum UI publishes **no npm package**. It is a shadcn-style copy/paste registry: components are
meant to be copied into your source tree and edited there. There is no
`import { Button } from "@spectrum-ui/react"` — that package does not exist.

```
npx shadcn@latest add @spectrumui/<name>    # the upstream install path
node scripts/vendor-spectrum.cjs            # what we do instead (reproducible)
```

## Relationship to shadcn/ui

Spectrum UI is **built on shadcn/ui**, not an alternative to it. Its own components import
`@/components/ui/*` primitives, and its registry declares shadcn components as dependencies
(`floating-label-input` needs `input` + `label`; `responsive-modal` needs `button`).

So `components/ui/` stays. Spectrum sits **on top** as an enhanced layer. Do not "finish" the
migration by deleting `components/ui/` or the `@radix-ui/*` dependencies — that breaks these files.

## Layout

| Path | Contents |
| --- | --- |
| `components/spectrumui/ui/` | enhanced primitives — `loading-button`, `floating-label-input`, `autosize-textarea`, `multiple-selector`, `responsive-modal`, `accordion`, `spinner`, `progress-with-value`, `dual-range-slider`, `infinite-scroll`, `command` |
| `components/spectrumui/` | showcase / composed — `data-table`, `animated-switch`, `tilt-card`, `dock`, `command-search`, `password-strength`, `quantity-stepper`, `task-checkbox`, `skeleton-reveal`, `animated-card`, `animated-toast-stack`, accordion variants |
| `lib/spectrum-theme.ts` | Plus In Plus brand palette + ready-made class fragments |
| `lib/ease.ts` | shared easing constants (used by `animated-toast-stack`) |

## Branding

Components are restyled through `brand()` / `brandClassNames` from `@/lib/spectrum-theme.ts`:

```tsx
import { LoadingButton } from "@/components/spectrumui/ui/loading-button";
import { brand } from "@/lib/spectrum-theme";

<LoadingButton className={brand("ctaButton")}>Order now</LoadingButton>;
```

Rules that must hold for every component here:

- navy `#052B42` is the primary, green `#00C56D` the CTA
- `rounded-xl` (12px) for buttons and controls; `rounded-full` only for header pills
- keep existing hover/transition timing — never drop an animation

## Updating

```bash
git clone --depth 1 https://github.com/arihantcodes/spectrum-ui.git /tmp/spectrum-ui
node scripts/vendor-spectrum.cjs /tmp/spectrum-ui
git diff components/spectrumui     # review: local edits will be overwritten
```

The vendored files are ordinary source — edit them freely, but keep a note in the PR if you do,
so the next re-vendor does not silently drop your change.

## Note on `use-toast`

Spectrum's `use-toast` is **not** vendored. This project already has
`components/ui/use-toast.ts` with a compatible `toast()` / `useToast()` API, and Spectrum's copy
depends on shadcn types our `toast.tsx` does not export. The project hook is the single source.
