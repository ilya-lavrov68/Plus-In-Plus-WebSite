/**
 * Собственный рендер Lexical-JSON в HTML.
 *
 * Материалы блога хранятся как Lexical-документ (`{"root": {...}}`). Раньше его
 * превращал в разметку пакет `@payloadcms/richtext-lexical`; после отказа от
 * CMS этот конвертер живёт у нас. Правила простые: неизвестные узлы рендерят
 * только своих детей, весь текст экранируется, а ссылки и медиа валидируются,
 * потому что содержимое приходит из редактора.
 */

type LexicalNode = {
  type?: unknown;
  text?: unknown;
  format?: unknown;
  tag?: unknown;
  listType?: unknown;
  url?: unknown;
  fields?: { url?: unknown; newTab?: unknown; linkType?: unknown; doc?: { value?: { slug?: unknown } } };
  value?: unknown;
  relationTo?: unknown;
  children?: unknown;
};

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_STRIKETHROUGH = 4;
const FORMAT_UNDERLINE = 8;
const FORMAT_CODE = 16;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function children(node: LexicalNode): string {
  if (!Array.isArray(node.children)) return "";
  return node.children.map((child) => renderNode(child as LexicalNode)).join("");
}

function formatText(text: string, format: unknown): string {
  const mask = typeof format === "number" ? format : 0;
  let html = escapeHtml(text);
  if (mask & FORMAT_CODE) html = `<code>${html}</code>`;
  if (mask & FORMAT_BOLD) html = `<strong>${html}</strong>`;
  if (mask & FORMAT_ITALIC) html = `<em>${html}</em>`;
  if (mask & FORMAT_UNDERLINE) html = `<u>${html}</u>`;
  if (mask & FORMAT_STRIKETHROUGH) html = `<s>${html}</s>`;
  return html;
}

/** Только http(s) и внутренние пути: `javascript:` из редактора не пройдёт. */
function safeHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

function mediaHtml(node: LexicalNode): string {
  const media = node.value as { url?: unknown; alt?: unknown; filename?: unknown } | null | undefined;
  const url = typeof media?.url === "string" ? media.url : null;
  const safe = url ? safeHref(url) ?? (url.startsWith("/") ? null : null) : null;
  const src = safe ?? (typeof url === "string" && url.startsWith("/uploads/") ? url : null);
  if (!src) return "";
  const alt = typeof media?.alt === "string" ? media.alt : "";
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" />`;
}

function renderNode(node: LexicalNode): string {
  const type = typeof node.type === "string" ? node.type : "";
  switch (type) {
    case "text":
      return formatText(typeof node.text === "string" ? node.text : "", node.format);
    case "linebreak":
      return "<br />";
    case "paragraph": {
      const inner = children(node);
      return inner.trim() ? `<p>${inner}</p>` : "";
    }
    case "heading": {
      const tag = node.tag === "h1" || node.tag === "h3" || node.tag === "h4" || node.tag === "h5" || node.tag === "h6" ? node.tag : "h2";
      return `<${tag}>${children(node)}</${tag}>`;
    }
    case "quote":
      return `<blockquote>${children(node)}</blockquote>`;
    case "list": {
      const tag = node.listType === "number" || node.tag === "ol" ? "ol" : "ul";
      return `<${tag}>${children(node)}</${tag}>`;
    }
    case "listitem":
      return `<li>${children(node)}</li>`;
    case "link": {
      const href = safeHref(node.fields?.url ?? node.url);
      const inner = children(node) || escapeHtml(String(node.url ?? ""));
      if (!href) return inner;
      const external = /^https?:\/\//i.test(href);
      const attrs = external ? ' rel="noopener noreferrer nofollow" target="_blank"' : "";
      return `<a href="${escapeHtml(href)}"${attrs}>${inner}</a>`;
    }
    case "horizontalrule":
      return "<hr />";
    case "upload":
      return mediaHtml(node);
    case "root":
      return children(node);
    default:
      // Неизвестный узел не ломает статью: показываем то, что внутри.
      return children(node);
  }
}

export function lexicalToHtml(document: unknown): string | null {
  if (!document || typeof document !== "object") return null;
  const root = (document as { root?: LexicalNode }).root;
  if (!root || typeof root !== "object") return null;
  return renderNode(root);
}
