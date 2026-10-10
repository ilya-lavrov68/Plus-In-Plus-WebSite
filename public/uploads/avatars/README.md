# User avatars

Authenticated users upload avatars here through **Account → Edit profile**.
`User.avatar` stores the local URL `/uploads/avatars/<uuid>.webp`.

PNG, JPEG, WebP, GIF and AVIF inputs up to **2 MB / 25 megapixels** are accepted.
Images are decoded, auto-oriented, resized to at most 256×256 and re-encoded as
static WebP without metadata. No external avatar services or remote URLs are used.
Replacement removes the previous upload only after the database transaction succeeds.
Runtime files are ignored by Git. Keep this folder writable and on persistent storage.
