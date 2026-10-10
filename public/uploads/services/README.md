# Service covers (dynamic uploads)

ADMIN sessions upload covers through `/admin/services`. Files are stored only in
`public/uploads/services/`; `Service.coverImage` stores `/uploads/services/<uuid>.webp`.

- Input: PNG, JPEG, WebP, GIF or AVIF, up to **8 MB / 25 megapixels**.
- Validated images are resized to at most 2400×2400 and re-encoded as static WebP
  without metadata. Animated inputs use the first frame.
- Uploads are runtime data, ignored by Git (only `.gitkeep` and this README are tracked).
- Keep the folder writable and on persistent storage. Back up uploads with the DB.
- Static brand assets belong in `public/assets/`, never here.
