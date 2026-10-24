# Retired stock mockups

The JPEG files in this directory are retired and must not be referenced by the
interface, seeds, metadata, or new content. They contained third-party product
mockup artwork and were removed from all public UI paths.

Use the original local placeholders in `/assets/placeholders/` when a database
row has no approved cover. Customer-uploaded artwork remains under `/uploads/`.
The legacy paths are recognized by `lib/content-placeholders.ts` so old database
rows fall back safely instead of displaying the retired artwork again.
