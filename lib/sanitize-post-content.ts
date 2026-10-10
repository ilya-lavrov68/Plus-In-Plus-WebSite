import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "strong",
  "sub",
  "sup",
  "u",
  "ul",
];

/** Sanitize admin-authored HTML both before persistence and before rendering. */
export function sanitizePostContent(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "name", "rel", "target"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attributes) => {
        const safeAttributes = { ...attributes };
        if (attributes.target === "_blank") {
          safeAttributes.rel = "noopener noreferrer";
        } else {
          delete safeAttributes.target;
          delete safeAttributes.rel;
        }

        return { tagName, attribs: safeAttributes };
      },
    },
  });
}
