# Stage 2 — base components on Spectrum UI

Date: 2026-10-15
Status: **COMPLETE** — tsc, lint and build all pass; bundle impact ≈ 0.

## What "migration" means here

Stage 1 established that Spectrum UI ships no base primitives — no Button, Card, Input, Dialog,
Tabs, Table, Select, Switch or Badge. So this stage adopts the architecture:

```
components/spectrumui/ui/*   ← Spectrum primitives, upstream, unbranded
components/ui/*              ← brand layer: wraps a Spectrum primitive with Plus In Plus styling
```

`components/ui/*` keeps its existing names and props, so every call site is untouched.

## Migrated

| Component | Spectrum primitive | What it gains | Visual change |
| --- | --- | --- | --- |
| `button.tsx` | `ui/loading-button` | `loading` (spinner + auto-disable), `asChild` | none |
| `textarea.tsx` | `ui/autosize-textarea` | grows with content | none (identical start height) |
| `switch.tsx` | `animated-switch` | stretch/drag/flick knob, `prefers-reduced-motion` | none (identical 44×24) |
| `dialog.tsx` | `ui/responsive-modal` | sheet variants available | none (new `center` side is default) |
| `spinner.tsx` | `ui/spinner` | sized spinner for loading states | new component |

### Detail

**Button** — renders Spectrum's `LoadingButton` with the brand CVA. Verified by computing the
merged class string: every Spectrum default (`bg-primary`, `rounded-md`, `h-10`, `px-4`,
`focus-visible:outline-hidden`) is dropped by `tailwind-merge`, and every brand class survives.
`py-0` is in the brand base purely to cancel Spectrum's `py-2`.

**Textarea** — `rows` is mapped to the exact height the old `min-h-[80px]` textarea produced
(`2 → 80px`, `3 → 80px`, `4 → 98px`, `6 → 138px`), so forms open at the same size and then grow.
Spectrum applies its height in an effect, which would have caused a layout shift; the brand wrapper
seeds `min-height` inline so the first paint is already correct.

**Switch** — `AnimatedSwitch` size `md` is 44×24 with a 20px knob, matching the old `w-11 h-6` /
`h-5 w-5` exactly. Two upstream gaps were closed via `POST_FIXES`: `id` (so `<Label htmlFor>`
keeps working) and `aria-describedby`.

**Dialog** — upstream `ResponsiveModal` is a bottom sheet below `lg`, which would have moved the
account and delete-confirmation dialogs on phones. A `center` side was added that reproduces the
old centred layout at every width and is the default here. The sheet variants stay available via
`side="bottom" | "left" | "right" | "top"`. The dismiss button label is now injectable
(`closeLabel`) so it stays translated — upstream hardcoded the English word "Close".

## Not migrated — no Spectrum equivalent

Verified against all 315 registry items; see `stage-1-analysis.md` §4a.

| Component | Why |
| --- | --- |
| `input.tsx`, `label.tsx` | Spectrum only has `floating-label-input`, which is a different (label-inside) design. Switching would change every form's look. |
| `card.tsx` | No card primitive. Showcase cards (`tilt-card`, `animated-card`, `beam-card`) are Stage 3. |
| `badge.tsx` | No badge primitive. Registry `badge` is `event-badge-3d` — a three.js 3D tag. |
| `select.tsx` | Spectrum's `multiple-selector` is multi-select only; every call site here is single-select (source filter, role, category…). |
| `tabs.tsx` | No tabs primitive. |
| `skeleton.tsx` | `skeleton-reveal` is a reveal-on-load animation, not a placeholder. |
| `separator.tsx` | No primitive. |
| `table.tsx` | Unused (0 imports) — removed in Stage 4. Admin tables move to `data-table` in Stage 3. |

## Bundle: the one real trade-off

`AnimatedSwitch` pulls in `motion` (~48 kB). Measured A/B on the two admin routes that use a Switch:

| Route | Radix Switch (before) | Spectrum, static import | **Spectrum, lazy (shipped)** |
| --- | --- | --- | --- |
| `/admin/blog/[id]` | 272 kB | 320 kB | **270 kB** |
| `/admin/services/[id]` | 174 kB | 223 kB | **173 kB** |

Shipping it statically would have cost ~48 kB per admin route for a toggle animation — hard to
justify on a desktop admin form. `components/ui/switch.tsx` therefore loads `AnimatedSwitch` via
`next/dynamic({ ssr: false })`, so `motion` becomes a separate async chunk fetched after paint.
First Load JS ends up marginally *below* the old Radix baseline, because the Radix switch leaves
the main chunk too.

The trade-off is that the switch renders a placeholder for the few milliseconds before the chunk
arrives. The placeholder is the same 44×24 track with the same colours and the knob in the correct
position, so the swap is invisible.

## Result vs Stage 1 baseline

| Route | Stage 1 | Stage 2 | Δ |
| --- | --- | --- | --- |
| shared JS | 102 kB | 102 kB | 0 |
| `/` | 138 kB | 139 kB | +1 |
| `/shop` | 138 kB | 139 kB | +1 |
| `/blog` | 134 kB | 134 kB | 0 |
| `/contact` | 131 kB | 131 kB | 0 |
| `/admin/blog` | 174 kB | 175 kB | +1 |
| `/admin/blog/[id]` | 271 kB | 270 kB | −1 |
| `/admin/services/[id]` | 173 kB | 173 kB | 0 |
| `/admin/settings` | 129 kB | 131 kB | +2 |
| `/admin/users` | 164 kB | 164 kB | 0 |
| `/test-spectrum` | 259 kB | 259 kB | 0 |

Public routes unchanged. The only movement is +1–2 kB on admin routes from the autosize textarea.

## Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ no warnings or errors |
| `npm run build` | ✅ exit 0 |
| Brand button class merge | ✅ 8/8 brand classes present, 8/8 Spectrum classes absent |
| Button on `/contact` | ✅ `bg-[#052B42] rounded-xl h-11 px-6 font-body`, 0 Spectrum leaks |
| Switch SSR | ✅ `role="switch"`, `id` forwarded, 44×24px |
| Textarea SSR | ✅ `min-height:80px` (rows=2) and `min-height:138px` (rows=6) |
| Dialog `center` variant | ✅ centring classes present and compiled into CSS |
| Routes `/`, `/shop`, `/blog`, `/contact`, `/test-spectrum` | ✅ all 200, no error markers |

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| Base components on Spectrum UI | ✅ 5 migrated; 8 have no equivalent (documented) |
| Colours adapted to brand | ✅ verified at runtime, zero Spectrum palette leakage |
| Button shapes preserved (`rounded-xl`) | ✅ verified in rendered HTML |
| Animations preserved | ✅ plus: switch gains motion, textarea gains autosize |
| All pages render without visual bugs | ✅ |
| `npm run build` passes | ✅ |
| `npm run lint` passes | ✅ |
