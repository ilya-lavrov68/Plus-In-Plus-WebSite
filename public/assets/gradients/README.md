# Brand gradients (static assets)

PNG gradient images in this folder are **brand assets uploaded manually into the repository
by the customer** — they are never generated and never uploaded through the admin panel.

Expected file names (referenced from the code):

| File                | Used in                                          | Description                          |
| ------------------- | ------------------------------------------------ | ------------------------------------ |
| `hero-gradient.png` | Hero section, `app/page.tsx`                     | Background gradient of the hero      |
| `category-bg.png`   | Featured-services (categories) section, `app/page.tsx` | Section background gradient    |

Rules:

- These PNGs are used as background images (`next/image` with `object-cover`).
  **CSS gradients (`linear-gradient`, `radial-gradient`) are forbidden** where these
  images belong.
- Static brand assets live **only** in `/public/assets/`. Dynamic uploads from the admin
  panel go **only** to `/public/uploads/`. Never mix the two.
- Until the files are added, the sections render solid brand-color fallbacks.
