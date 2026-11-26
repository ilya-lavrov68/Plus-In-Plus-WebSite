---
name: hazeglow-dither-ascii
description: Use when art-directing, prompting, reviewing, or integrating Hazeglow-generated dither/ASCII artwork for the Plus In Plus website, including section backgrounds, bento visuals, and small decorative details.
---

# Hazeglow dither / ASCII art direction

## Purpose

Prepare coherent, brand-aware artwork for the Plus In Plus agency site. The user
specified Hazeglow with `dither` and `ASCII` formats/modes for section backgrounds,
bento-grid imagery, and small details. Use only modes and export options actually
available in the installed Hazeglow tool; never invent UI controls or claim a
render came from Hazeglow unless it was actually generated there.

## Before making art

1. Inspect the current Plus In Plus wordmark, logo, and published identity.
   Treat the core tokens in the included palette as fixed owner direction; use
   only centrally approved extensions for additional tones.
2. Read the layout: determine viewport, crop, text-safe area, focal point, aspect
   ratio, asset purpose, and whether the image is decorative or meaningful.
3. Assign a limited color ramp from the validated tokens. Dither should create
   tonal structure, not introduce unapproved colors.
4. Select the least complex treatment that does the job: full-bleed atmosphere,
   one bento illustration, or small motif. Do not tile texture everywhere.
5. Agree a filename, source prompt, export dimensions, fallback, and alt-text
   policy before adding it to code.

## Prompt recipe

Each prompt should include:

- **Subject / abstraction:** one concise visual concept, not a random scene.
- **Composition:** subject location, scale, negative space, text-safe area and crop.
- **Mode:** explicitly request dither or ASCII using Hazeglow's supported terms.
- **Palette:** list only the approved hex colors and whether monochrome is preferred.
- **Texture:** describe dither density, cell/character scale, contrast and edge quality.
- **Use:** hero background, bento thumbnail, or small detail; state aspect ratio.
- **Exclusions:** no embedded text/logos, no extra colors, no UI mockups unless
  specifically asked, no noisy pattern under body copy.
- **Export:** request the highest practical source quality, then make optimized
  web derivatives in the project's supported formats.

See `prompts/hazeglow-prompts.md` for copy-ready starting templates.

## Integration rules

- Keep generated masters outside the production bundle when the repo has a source
  asset convention; publish only optimized derivatives.
- Use AVIF/WebP with a suitable fallback if supported by the target browser matrix
  and existing build pipeline. Preserve a static fallback for backgrounds.
- For large image grids, declare intrinsic aspect ratio/dimensions and responsive
  sources; lazy-load below the fold. Preload only the genuinely critical hero art.
- Put text on a solid/controlled scrim or a reserved quiet zone. Verify contrast
  against the final rendered crop, not just the palette swatches.
- CSS/background-only decoration is hidden from assistive technology. Meaningful
  images get concise alt text describing their purpose, not their pixel texture.
- Respect `prefers-reduced-motion`; don't animate a static texture by default.
- Check mobile crop independently. If the artwork cannot survive both desktop
  and portrait crops, generate a dedicated art-directed mobile variant.

## If Hazeglow is unavailable

Do not silently substitute another generator and do not commit a fake asset.
Create a prompt queue with status `not generated`, use a simple neutral CSS field
or a labeled local placeholder during implementation, and tell the owner exactly
which images still require Hazeglow output.

## Review

Reject artwork if it resembles generic AI wallpaper, overwhelms hierarchy, makes
text illegible, adds unapproved identity colors, repeats mechanically, or adds
large bytes without visible value. Keep a small asset manifest recording source
prompt, mode, palette, dimensions, derivative path, alt/decorative status, and
whether the file has been approved.
