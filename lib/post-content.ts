import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import { normalizeCanvaEmbedUrl } from "@/lib/canva";
import {
  isLocalPostImageSource,
  isMarkdownPostContent,
  markdownSource,
} from "@/lib/post-content-format";
import { sanitizePostContent } from "@/lib/sanitize-post-content";

function createMarkdownRenderer(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
  });
  // The footnote declarations refer to markdown-it's ESM type facade while
  // this CommonJS build uses the equivalent bundled declarations.
  md.use(footnote as unknown as (instance: MarkdownIt) => void);

  md.block.ruler.before(
    "paragraph",
    "canva",
    (state, startLine, endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4 || startLine + 2 >= endLine) {
        return false;
      }

      const line = (lineNumber: number) =>
        state.src
          .slice(
            state.bMarks[lineNumber] + state.tShift[lineNumber],
            state.eMarks[lineNumber],
          )
          .trim();
      if (line(startLine) !== ":::canva" || line(startLine + 2) !== ":::") {
        return false;
      }

      const src = normalizeCanvaEmbedUrl(line(startLine + 1));
      if (!src) return false;
      if (silent) return true;

      const token = state.push("canva", "", 0);
      token.attrs = [["src", src]];
      token.map = [startLine, startLine + 3];
      state.line = startLine + 3;
      return true;
    },
    { alt: ["paragraph", "reference", "blockquote", "list"] },
  );

  md.renderer.rules.canva = (tokens, index) => {
    const src = tokens[index].attrGet("src");
    if (!src) return "";
    return `<div class="article-canva"><iframe src="${md.utils.escapeHtml(src)}" title="Canva design" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
  };

  const defaultImageRenderer = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const src = token.attrGet("src") ?? "";
    if (!isLocalPostImageSource(src)) return md.utils.escapeHtml(token.content);

    token.attrSet("loading", "lazy");
    token.attrSet("decoding", "async");
    return defaultImageRenderer
      ? defaultImageRenderer(tokens, index, options, env, self)
      : self.renderToken(tokens, index, options);
  };

  md.renderer.rules.table_open = () => '<div class="article-table-scroll"><table>';
  md.renderer.rules.table_close = () => "</table></div>";

  return md;
}

const markdown = createMarkdownRenderer();

/** Convert author-controlled Markdown, then apply the same security boundary as HTML posts. */
export function renderPostMarkdown(source: string): string {
  return sanitizePostContent(markdown.render(source));
}

export function renderPostContent(content: string): string {
  return isMarkdownPostContent(content)
    ? renderPostMarkdown(markdownSource(content))
    : sanitizePostContent(content);
}
