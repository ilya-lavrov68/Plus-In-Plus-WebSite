export const POST_MARKDOWN_MARKER = "<!-- pip:markdown -->";
export const MAX_POST_SOURCE_LENGTH = 100_000;

/** Normalize imported text without changing its Markdown structure. */
export function normalizeMarkdownSource(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
}

export function isMarkdownPostContent(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trimStart().startsWith(POST_MARKDOWN_MARKER)
  );
}

/** Markdown stays editable in the existing Post.content column. */
export function toMarkdownPostContent(source: string): string {
  return `${POST_MARKDOWN_MARKER}\n${normalizeMarkdownSource(source)}`;
}

export function markdownSource(content: string): string {
  if (!isMarkdownPostContent(content)) return content;
  const markerAt = content.indexOf(POST_MARKDOWN_MARKER);
  return content.slice(markerAt + POST_MARKDOWN_MARKER.length).trim();
}

export function insertMarkdownBlockAtCursor(
  source: string,
  selectionStart: number,
  selectionEnd: number,
  block: string,
): { value: string; cursor: number } {
  const start = Math.max(0, Math.min(source.length, selectionStart));
  const end = Math.max(start, Math.min(source.length, selectionEnd));
  const before = source.slice(0, start);
  const after = source.slice(end);
  const leading = !before || before.endsWith("\n\n")
    ? ""
    : before.endsWith("\n")
      ? "\n"
      : "\n\n";
  const trailing = !after || after.startsWith("\n\n")
    ? after
      ? ""
      : "\n\n"
    : after.startsWith("\n")
      ? "\n"
      : "\n\n";
  const insertion = `${leading}${block.trim()}${trailing}`;
  return {
    value: `${before}${insertion}${after}`,
    cursor: before.length + insertion.length,
  };
}

export function isLocalPostImageSource(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return false;
  }
  try {
    const url = new URL(value, "https://post.local");
    return (
      url.origin === "https://post.local" &&
      (url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/assets/")) &&
      !url.pathname.split("/").includes("..")
    );
  } catch {
    return false;
  }
}
