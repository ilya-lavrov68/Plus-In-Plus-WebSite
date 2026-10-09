# Blog covers (dynamic uploads)

Cover images for blog posts are uploaded through the admin panel
(`/admin/blog`) and stored **strictly** in this folder
(`/public/uploads/blog/`). The resulting public path
(`/uploads/blog/<file>`) is saved in the database (`Post.coverImage`).

Rules:

- Never put hand-made brand assets here — those live in `/public/assets/`.
- Files in this folder are runtime data and are ignored by Git (only `.gitkeep` is tracked).
