# Brand logos (static assets)

SVG logos in this folder are **brand assets uploaded manually into the repository by the
customer** — they are never generated and never uploaded through the admin panel.

Expected file names (referenced from the code):

| File                | Used in                                       | Description                        |
| ------------------- | --------------------------------------------- | ---------------------------------- |
| `plus-in-plus.svg`  | `components/site/header.tsx`                  | Standalone Plus In Plus logo       |
| `pip-ts-connect.svg`| `components/site/partners.tsx`                | Combined Plus In Plus × TS Connect |

Rules:

- Static brand assets live **only** in `/public/assets/`. Dynamic uploads from the admin
  panel go **only** to `/public/uploads/`. Never mix the two.
- Until the files are added, the site renders text fallbacks for the logos.
