# Stage 1 — Spectrum UI: research & analysis

Date: 2026-10-14
Status: **Stage 1 COMPLETE** — Spectrum UI vendored, themed and verified. Decision recorded in §9.

> **Update 2026-10-14.** The blocking finding below was resolved with the project owner:
> Spectrum UI is adopted as an **additive layer over the existing shadcn/ui base**, with **broad**
> scope (header, cards, hero, nav included). Stage 1 was then completed — see §10.

---

## 1. Blocking finding: `@spectrum-ui/react` does not exist

The TZ assumes an installable npm package. It does not exist.

| Check | Result |
| --- | --- |
| `npm view @spectrum-ui/react` | **HTTP 404 — no such package** |
| `npm view @spectrumui/react` | 404 |
| `npm view spectrum-ui-react` | 404 |
| `npm view spectrum-ui` | Exists, but **unrelated**: "another spectrum implementation unofficial inspired by adobe spectrum", v0.0.0, published 2021, zero dependencies |
| `npm view @react-spectrum/s2` (Adobe) | Exists — v1.8.1, real package, but a *different* library (see §6) |

So `npm install @spectrum-ui/react` (TZ Шаг 1.2) cannot be run.

## 2. What Spectrum UI actually is

**Repository:** `github.com/arihantcodes/spectrum-ui` — Apache-2.0, actively maintained.

> "Spectrum UI is a free collection of React components built on **shadcn/ui**, Tailwind CSS, and Motion. Nothing is hidden behind a package. The source lands in your project, and from there it's yours to change."

It is a **shadcn-style copy/paste registry**, not a runtime dependency. Distribution:

```bash
npx shadcn@latest add @spectrumui/<component-name>   # shadcn CLI
npx -y @spectrumui/mcp                              # MCP server for AI editors
```

Installed components are **copied into the project's own source tree** — there is no
`node_modules/@spectrum-ui` to import from, and therefore no `import { Button } from "@spectrum-ui/react"`.

Registry contents: **315 items** — 221 `registry:component`, 92 `registry:block`, 2 `registry:hook`.

## 3. The structural problem: Spectrum UI *requires* shadcn/ui

Spectrum UI is an **extension layer on top of shadcn/ui**, not a replacement. Four independent proofs:

1. **Its own base primitives are stock shadcn files.** `components/ui/` in the Spectrum repo contains
   `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `dialog.tsx`, `select.tsx`, `switch.tsx`,
   `tabs.tsx`, `table.tsx`, `badge.tsx`, `toast.tsx`, `separator.tsx`, `dropdown-menu.tsx` — all identical
   in API to shadcn/ui (Radix + `cva` + `cn()`).

2. **Its registry declares shadcn components as dependencies.** From `registry.json`:
   - `floating-label-input` → `registryDependencies: ["input", "label"]`
   - `responsive-modal` → `registryDependencies: ["@spectrumui/responsive-modal-dependencies", "button"]`
   - `accordion` → `registryDependencies: ["@spectrumui/accordion-dependencies"]`

   Those bare names (`input`, `label`, `button`) resolve to the **shadcn/ui core registry**
   (`ui.shadcn.com/r/styles/default/*.json`). Spectrum components literally cannot install without them.

3. **Its `package.json` depends on the exact packages Stage 4.2 says to uninstall** — 21 `@radix-ui/react-*`
   packages plus `class-variance-authority`, `tailwind-merge`, `clsx`.

4. **The registry ships zero base primitives.** Verified against all 315 item names:

   | Primitive | Spectrum UI registry equivalent |
   | --- | --- |
   | Button | **none** |
   | Card | **none** |
   | Input | **none** (`input-model` is an AI-chat prompt bar) |
   | Textarea | **none** |
   | Label | **none** |
   | Dialog / Modal | **none** |
   | Tabs | **none** |
   | Table | **none** (`table-empty` is an empty state) |
   | Select | **none** |
   | Switch | **none** |
   | Badge | **none** (`badge` = `event-badge-3d`, a three.js/react-three-fiber 3D tag) |
   | Dropdown | **none** |
   | Separator | **none** |
   | Checkbox / Radio / Tooltip / Popover / Sheet / Form | **none** |

   What the registry *does* contain is **showcase and animated components**: `data-table`,
   `animated-switch`, `floating-label-input`, `autosize-textarea`, `multiple-selector`,
   `datetime-picker`, `command-search`, `command-palette`, `responsive-modal`, `kanbanboard`,
   `toast-stack`, `status-badge`, `accordion` (+5 variants), `dock`, `tilt-card`, `beam-card`,
   `animated-card`, `loading-button`, `metal-button`, `morph-button`, `tree-nav`, `floating-navbar`,
   `circular-navbar`, `tab-navbar`, `sidebar-navbar`, `profile-dropdown`, `quantity-stepper`,
   `password-strength`, `task-checkbox`, `skeleton`, `progress-with-value`, ~25 empty states,
   ~23 charts, 18 footer blocks, 7 pricing blocks.

### Consequences for the TZ

| TZ requirement | Verdict |
| --- | --- |
| Шаг 1.2 `npm install @spectrum-ui/react` | **Impossible** — package does not exist |
| Шаг 2.1 replace `components/ui/*` with Spectrum UI | **Impossible** — Spectrum ships no base primitives |
| Шаг 4.2 uninstall `@radix-ui/*` + `class-variance-authority` | **Would break Spectrum UI itself** |
| "ЗАПРЕЩЕНО оставлять смешанные импорты" | **Unachievable by design** — Spectrum components import `@/components/ui/*` |
| Example API `<Button variant="primary" color="navy">` | **Does not exist.** Spectrum's Button is shadcn's: `variant: default \| destructive \| outline \| secondary \| ghost \| link`. No `color` prop. |
| "Полностью перейти на Spectrum UI" | Only meaningful as *adding* Spectrum's showcase layer on a shadcn base |

## 4. Component mapping table (real, verified against the registry)

### 4a. Base primitives — no Spectrum equivalent

| Current file | Used in | Spectrum UI | Action |
| --- | --- | --- | --- |
| `components/ui/button.tsx` | 12 files | none | keep as base |
| `components/ui/input.tsx` | 8 files | none | keep as base |
| `components/ui/label.tsx` | 4 files | none | keep as base |
| `components/ui/select.tsx` | 4 files | none | keep as base |
| `components/ui/badge.tsx` | 3 files | none | keep as base |
| `components/ui/switch.tsx` | 3 files | none | keep as base |
| `components/ui/textarea.tsx` | 3 files | none | keep as base |
| `components/ui/skeleton.tsx` | 2 files | `skeleton` (registry) | optional swap |
| `components/ui/dialog.tsx` | 2 files | none | keep as base |
| `components/ui/card.tsx` | 1 file | none | keep as base |
| `components/ui/tabs.tsx` | 1 file | none | keep as base |
| `components/ui/separator.tsx` | 1 file | none | keep as base |
| `components/ui/table.tsx` | 0 files | none | unused — delete |
| `components/ui/dropdown-menu.tsx` | 0 files | none | unused — delete |

### 4b. Genuine Spectrum UI upgrades available

| Current | Spectrum UI item | Deps to add | Notes |
| --- | --- | --- | --- |
| hand-rolled admin tables | `data-table` | `motion` | sorting/filtering/pagination |
| `Switch` | `animated-switch` | `framer-motion` | drop-in for settings toggles |
| `Input` + `Label` | `floating-label-input` | *(needs shadcn input+label)* | forms |
| `Textarea` | `autosize-textarea` | — | admin editors |
| `Select` | `multiple-selector` | `cmdk` | command-based select |
| `Dialog` | `responsive-modal` | *(needs shadcn button)* | modal wrapper |
| `Toast` / `use-toast` | `toast-stack` | `motion` | feedback |
| `Tabs` (admin) | `accordion` / `faq-tabs-card` | — | verify API |
| `Badge` (status) | `status-badge` | `lucide-react` | status pills |
| `Card` (news/service) | `animated-card` / `tilt-card` / `beam-card` | `motion` | **changes hover animation — risk to TZ constraint** |
| `Button` (async actions) | `loading-button` | — | submit buttons |
| header nav | `floating-navbar` / `circular-navbar` / `tab-navbar` | `motion` | **would replace existing hover-dropdown logic — risk** |
| admin date fields | `datetime-picker` | `date-fns`, `react-day-picker` | forms |
| admin search | `command-search` / `command-palette` | `cmdk` | — |

## 5. Compatibility risks

| Risk | Detail |
| --- | --- |
| **React / Next version** | Spectrum repo runs **React 19 + Next 16**. This project runs **React 18.3 + Next 15.5**. Every component must be smoke-tested. |
| **Tailwind** | Both Tailwind v4.3.3 — compatible. |
| **Bundle** | Several Spectrum components pull heavy deps: `three` + `@react-three/fiber` + `@react-three/drei` (3D badge), `recharts` (charts), `framer-motion`/`motion`, `@dnd-kit/*` (kanban), `@tanstack/react-table`. Conflicts with TZ "bundle не вырос критично". |
| **Brand constraints** | TZ forbids changing brand colours (#052B42, #00C56D), button shapes (rounded-xl / rounded-full) and animations. Spectrum's showcase components ship their own visual language and would need re-styling per component. |
| **Existing brand work** | This project's `components/ui/button.tsx` is *already* more brand-adapted than Spectrum's (navy `#052B42`, `rounded-xl`, `font-body`, `focus-visible:ring-navy`). Replacing it with Spectrum's stock shadcn button would be a **regression**. |

## 6. Alternative: Adobe React Spectrum

If the intent was a genuine full replacement with a real npm package, the candidate is Adobe's:

| Package | Version | Peer deps |
| --- | --- | --- |
| `@react-spectrum/s2` (Spectrum 2) | 1.8.1 | `react ^19.0.0-rc.1`, `react-dom ^19.0.0-rc.1` |
| `@adobe/react-spectrum` (v3) | published | React 18-compatible |

This **is** a complete, self-contained component library (Button, Dialog, TableView, Tabs, Picker,
Switch, Badge, Toast, …) that could genuinely replace shadcn/ui. Trade-offs:

- Requires a **React 19 upgrade** for S2 (v3 works on React 18).
- Brings Adobe's own design-token system; forcing exact Plus In Plus navy / rounded-xl across
  every component is substantial theming work.
- Would touch ** every ** page and component — a far larger migration than 4 stages.

## 7. Baseline (measured before any change)

```
npm install   → 617 packages, OK
npm run build → PASS (exit 0)
```

Routes and First Load JS:

```
/                        209 B    139 kB
/admin/blog            5.21 kB    174 kB
/admin/blog/[id]         149 B    271 kB
/admin/blog/new          148 B    271 kB
/admin/dashboard       1.75 kB    108 kB
/admin/services        4.69 kB    173 kB
/admin/settings        6.04 kB    129 kB
/admin/users           4.96 kB    164 kB
/blog                    749 B    134 kB
/blog/[slug]           2.08 kB    141 kB
/contact               1.38 kB    131 kB
/shop                    214 B    139 kB
/shop/[slug]             214 B    139 kB
+ First Load JS shared by all              103 kB
```

## 8. Stage 1 acceptance criteria

| Criterion | Status |
| --- | --- |
| Spectrum UI installed & configured | ❌ Blocked — no npm package exists |
| Component mapping table produced | ✅ §4 |
| Test page `/test-spectrum` works | ⏸ Blocked on decision |
| No conflicts with current code | ✅ Nothing changed yet; baseline build green |
| `npm run build` passes | ✅ Baseline green |

---

## 9. Decision

**Chosen: A + broad scope.**

- Spectrum UI is adopted as an **additive layer** on top of the existing `components/ui/*`
  shadcn base. The base stays; Spectrum's enhanced primitives and showcase components sit on top.
- Scope is **broad**: Header, cards, hero, navigation and the admin panel are all in scope for
  Stages 2–3, not just the low-churn admin components.
- TZ Шаг 1.2 (`npm install @spectrum-ui/react`), Шаг 2.1 (replace base primitives) and Шаг 4.2
  (uninstall `@radix-ui/*` + `class-variance-authority`) are **dropped** — they are not executable
  against a copy/paste registry. Stage 4.2 is replaced by "delete shadcn primitives that are
  genuinely unused" (`table`, `dropdown-menu`).
- The "no mixed imports" rule is reinterpreted: mixed imports are *required*. The rule becomes
  "no *duplicate* implementations" — one button primitive, one toast hook, one table.

## 10. Stage 1 — what was actually built

### 10.1 Vendoring (replaces Шаг 1.2)

`npm install @spectrum-ui/react` is impossible, so components were vendored from the registry into
`components/spectrumui/`. The process is reproducible via **`scripts/vendor-spectrum.cjs`**:

```bash
git clone --depth 1 https://github.com/arihantcodes/spectrum-ui.git /tmp/spectrum-ui
node scripts/vendor-spectrum.cjs /tmp/spectrum-ui
```

It reads the built registry manifests (`public/r/<name>.json`) and writes **28 files**:

- **`components/spectrumui/ui/`** — enhanced primitives: `accordion`, `autosize-textarea`,
  `command`, `dual-range-slider`, `floating-label-input`, `infinite-scroll`, `loading-button`,
  `multiple-selector`, `progress-with-value`, `responsive-modal`, `spinner`
- **`components/spectrumui/`** — showcase: `data-table`, `animated-switch`, `tilt-card`, `dock`,
  `command-search`, `password-strength`, `quantity-stepper`, `task-checkbox`, `skeleton-reveal`,
  `animated-card`, `animated-toast-stack`, four accordion variants, `use-typewriter`
- **`lib/ease.ts`** — shared easing constants

The script also applies five compatibility fixes automatically (empty-interface → type alias,
unused `@ts-ignore`, short-circuit-as-statement, an ESLint-disable for a rule this project does not
have). Verified **idempotent**: a second run produces byte-identical output.

### 10.2 Dependencies added

```
motion  cmdk  @radix-ui/react-accordion  @radix-ui/react-progress
@radix-ui/react-slot  @radix-ui/react-slider
```

`framer-motion` was **not** installed — the script rewrites its imports to `motion/react` so only
one animation package ships.

### 10.3 Brand theme (TZ Шаг 2.2, delivered early)

`lib/spectrum-theme.ts` exports `spectrumTheme`, `spectrumCssVariables`, `brandClassNames` and a
`brand()` helper. Values are the real site palette — navy `#052B42`, green `#00C56D`, lavender
`#D9E1FF`, `rounded-xl` (12px) default / `rounded-full` for header pills.

Note: the TZ specified `accent: '#D6E4FF'`; the site actually uses `#D9E1FF` (defined in
`tailwind.config.ts`). The **site value was kept** — preserving the existing visual style outranks
the TZ's illustrative value.

Matching `--spectrum-*` CSS custom properties were added to `styles/globals.css`, so the palette is
also reachable from plain CSS and arbitrary Tailwind values.

### 10.4 Test page (TZ Шаг 1.3)

`/test-spectrum` → `app/test-spectrum/` renders all vendored components on the brand palette:
buttons, spinner, floating-label inputs, autosize textarea, multi-select, animated switch, stepper,
dual-range slider, task checkboxes, responsive modal, data table, accordion, progress, password
strength, tilt card, animated card, dock, command search, skeleton reveal and toast stack.

Marked `robots: noindex` — it is migration scaffolding and is removed in Stage 4.

### 10.5 Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ no warnings or errors |
| `npm run build` | ✅ exit 0 |
| `GET /test-spectrum` | ✅ 200, all components rendered, no error markers in HTML |
| Brand classes in output | ✅ navy ×78, green ×7, lavender ×3, `rounded-xl` ×21 |
| `--spectrum-*` vars in compiled CSS | ✅ all 16 present |
| Existing routes | ✅ `/`, `/shop`, `/blog`, `/contact`, `/admin` all 200 |

### 10.6 Bundle impact

| Route | Before | After |
| --- | --- | --- |
| shared JS | 103 kB | 102 kB |
| `/` | 139 kB | 138 kB |
| `/blog` | 134 kB | 134 kB |
| `/contact` | 131 kB | 131 kB |
| `/admin/settings` | 129 kB | 129 kB |
| **`/test-spectrum`** | — | **259 kB** (new, isolated) |

**No existing route grew.** The vendored components are only pulled into routes that import them,
so the Stage 1 cost is confined to the scaffolding page.

### 10.7 Stage 1 acceptance criteria (revised)

| Criterion | Status |
| --- | --- |
| Spectrum UI "installed" & configured | ✅ vendored + reproducible via script |
| Component mapping table produced | ✅ §4 |
| Test page works | ✅ `/test-spectrum` |
| No conflicts with current code | ✅ tsc + lint + build clean, all routes 200 |
| `npm run build` passes | ✅ |
