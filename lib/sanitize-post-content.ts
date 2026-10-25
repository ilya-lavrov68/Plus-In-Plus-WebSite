import sanitizeHtml from "sanitize-html";
import { normalizeCanvaEmbedUrl } from "@/lib/canva";
import { isLocalPostImageSource } from "@/lib/post-content-format";

function tableCell(tagName: "th" | "td", attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  const safeAttributes = { ...attribs };
  const align = safeAttributes.style?.match(/^text-align:\s*(left|right|center)$/)?.[1];
  delete safeAttributes.style;
  return {
    tagName,
    attribs: { ...safeAttributes, ...(align ? { align } : {}) },
  };
}

/** Keep author formatting, but allow only explicitly supported embeds and local images. */
export function sanitizePostContent(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "br",
      "strong",
      "em",
      "i",
      "s",
      "del",
      "sub",
      "u",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "code",
      "pre",
      "hr",
      "div",
      "section",
      "sup",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "img",
      "iframe",
    ],
    allowedAttributes: {
      "*": ["class"],
      a: ["href", "name", "target", "rel", "id", "role", "aria-label", "aria-describedby"],
      li: ["id"],
      section: ["role", "aria-label"],
      img: ["src", "alt", "title", "loading", "decoding"],
      th: ["align"],
      td: ["align"],
      iframe: ["src", "title", "loading", "referrerpolicy", "allowfullscreen", "class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      iframe: ["https"],
    },
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowedIframeHostnames: ["www.canva.com", "canva.com"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attribs) => {
        const safeAttributes = { ...attribs };
        if (attribs.target === "_blank") {
          safeAttributes.rel = "noopener noreferrer";
        } else {
          delete safeAttributes.target;
          delete safeAttributes.rel;
        }
        return { tagName: "a", attribs: safeAttributes };
      },
      th: (_tagName, attribs) => tableCell("th", attribs),
      td: (_tagName, attribs) => tableCell("td", attribs),
      iframe: (_tagName, attribs): sanitizeHtml.Tag => {
        const src = attribs.src ? normalizeCanvaEmbedUrl(attribs.src) : null;
        if (!src) return { tagName: "span", attribs: {} };
        return {
          tagName: "iframe",
          attribs: {
            src,
            title: attribs.title?.trim() || "Canva design",
            loading: "lazy",
            referrerpolicy: "strict-origin-when-cross-origin",
            allowfullscreen: "allowfullscreen",
            class: "article-canva-frame",
          },
        };
      },
    },
    exclusiveFilter: (frame) =>
      frame.tag === "img" &&
      (!frame.attribs.src || !isLocalPostImageSource(frame.attribs.src)),
  });
}
