# Supplied gradient artwork

The gradient artwork is the client's own artwork and is served as-is: the
pixels here are exactly the ones that were delivered, only re-encoded. Do not
replace it with CSS gradients or newly generated images.

| File | Used in | Description |
| --- | --- | --- |
| `hero-gradient.jpg` | Landing hero and internal-page headers | Full-bleed green/teal brand background |
| `category-bg.jpg` | Website mockup category card | First category artwork |
| `category-bg2.jpg` | Badge design category card | Second category artwork |
| `category-bg3.jpg` | Poster design category card | Third category artwork |
| `category-bg4.jpg` | Banner design category card | Fourth category artwork |

All bundled artwork is served from `/public/assets/gradients/` and is independent
of files uploaded through the admin panel.

## Why these are JPEG and not SVG

The artwork originally arrived as `.svg` files whose only content was a single
raster PNG embedded as base64 — vector wrappers around bitmap images. That
combination costs more than either format alone: the SVG wrapper added nothing
(no scalable shapes), while base64 inflates the payload by roughly a third on
top of the already-heavy PNG.

| File | Was | Now |
| --- | --- | --- |
| `hero-gradient` | 4 695 KB | 61 KB |
| `category-bg` | 200 KB | 12 KB |
| `category-bg2` | 174 KB | 9 KB |
| `category-bg3` | 260 KB | 11 KB |
| `category-bg4` | 172 KB | 8 KB |
| **Total** | **5 501 KB** | **101 KB** |

The PNGs were extracted from the SVG wrappers and re-encoded as JPEG. The
images are opaque (alpha is fully solid) and are gradients, so JPEG compression
at this quality is visually lossless — no transparency or fine detail is lost.

There is a second, quieter reason to prefer a real raster format here:
`next/image` does not optimise SVG (it passes the file through untouched unless
`dangerouslyAllowSVG` is enabled), so every visitor downloaded the full
original. A JPEG is picked up by `next/image` and resized and served as
WebP/AVIF automatically, which shrinks it further on delivery.

If a source file needs updating, replace the `.jpg` and keep the same name;
no code change is required.
