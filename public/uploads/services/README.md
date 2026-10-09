# Service covers (dynamic uploads)

Cover images for services are uploaded through the admin panel
(`/admin/services`) and stored **strictly** in this folder
(`/public/uploads/services/`). The resulting public path
(`/uploads/services/<file>`) is saved in the database (`Service.coverImage`).

Rules:

- Never put hand-made brand assets here — those live in `/public/assets/`.
- Files in this folder are runtime data and are ignored by Git (only `.gitkeep` is tracked).
