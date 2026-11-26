---
name: plus-in-plus-site-redesign
description: Use when auditing, repositioning, redesigning, or implementing the Plus In Plus website. Keeps the studio-first positioning, removes the discontinued AI direction, and presents Line Launcher as the flagship product without turning Home into a product-only SaaS landing page.
---

# Plus In Plus site redesign

Use this skill for the complete site refresh described in `AGENT_BRIEF_RU.md`.

## Non-negotiable intent

- Plus In Plus is presented as a design agency/studio first.
- Line Launcher is its flagship product, with a dedicated product page and clear
  presence on Home.
- The AI direction is permanently discontinued: remove public-facing AI services,
  products, routes, references, metadata, sitemap entries, and related visuals.
  Do not replace the story with another unsupported claim.
- The core palette values supplied by the owner are fixed: #EEEEEE and #FF5F01
  accents; #0E1015 text on light/colorful surfaces; #EEEEEE text on dark surfaces;
  #110F10 and #2B292A base dark/gray surfaces. Don't recolor the logo.
- Extend through a coherent enterprise-grade token hierarchy (primitive →
  semantic → component). Individual modules may vary their styling and use
  approved, centrally named supporting colors, but never scatter arbitrary
  literals or break the required text/surface pairings.
- Only use real, approved case studies and verified product claims.

## Workflow

1. **Inspect** repository rules, routes, current pages, content, brand assets,
   integrations, SEO, scripts, tests, deployment, and current working-tree state.
2. **Inventory** every old AI reference and every link that will be removed or
   redirected. Identify factual gaps; do not fill them with invented content.
3. **Plan** the page map, Home content hierarchy, Line Launcher page, visual
   principles, palette validation, Hazeglow asset needs, and test plan. Show the
   concise plan before wide implementation.
4. **Design system**: adopt the fixed core values from `brand/palette.json`,
   then add primitive → semantic → component tokens in the project's existing
   convention. Define type/space/layout scales and document accessible focus,
   contrast, and reduced-motion behavior. Any extension colors must be named,
   centralized, and contrast-checked.
5. **Implement** using the existing stack. Treat Home as an agency presentation;
   make the product page a separate route. Bento is optional composition, not a
   mandate to render every section as a card grid.
6. **Remove stale direction safely** across code, content, routes, navigation,
   image alt, SEO, Open Graph, JSON-LD, sitemap, and tests. Keep relevant old URLs
   useful through exact redirects only when a genuine destination exists.
7. **Verify** all routes/links, responsive layouts, keyboard/focus, reduced motion,
   image loading, build/test/lint commands, and desktop/mobile screenshots.
8. **Report** changed routes, removed content, verified facts, asset provenance,
   commands and results, and unresolved questions.

## Review checklist

- Can a first-time visitor identify the agency before seeing product details?
- Is Line Launcher easy to find and clearly described without dominating the
  agency narrative?
- Did all obsolete AI links, SEO metadata, public assets, and sitemap references
  disappear?
- Is every project, testimonial, number, feature and CTA supported by source
  material and actually functional?
- Are Hazeglow dither/ASCII elements restrained, optimized and accessible?
- Do light/dark sections maintain readable contrast, and does the page work at
  mobile widths and with reduced motion?
