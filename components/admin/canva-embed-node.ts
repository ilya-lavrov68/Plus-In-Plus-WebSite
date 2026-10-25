import { Node, mergeAttributes } from "@tiptap/core";
import { normalizeCanvaEmbedUrl } from "@/lib/canva";

/** A single block node, not a general-purpose iframe/HTML extension. */
export const CanvaEmbedNode = Node.create({
  name: "canvaEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "iframe[src]",
        getAttrs: (element) => {
          const src = normalizeCanvaEmbedUrl(element.getAttribute("src") ?? "");
          return src ? { src } : false;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const src = normalizeCanvaEmbedUrl(String(node.attrs.src ?? ""));
    if (!src) return ["p"];
    return [
      "iframe",
      mergeAttributes(HTMLAttributes, {
        src,
        title: "Canva design",
        loading: "lazy",
        referrerpolicy: "strict-origin-when-cross-origin",
        allowfullscreen: "allowfullscreen",
        class: "article-canva-frame",
      }),
    ];
  },
});
