import { Fragment, type ReactNode } from "react";

/**
 * Минимальный inline-markdown для записей CHANGELOG: жирный акцент, код и
 * ссылки. Полноценный markdown здесь не нужен, а HTML из репозитория
 * рендерить нельзя — собираем React-узлы, поэтому текст всегда экранирован.
 *
 * Относительные ссылки (`docs/LOGGING.md`) ведут в репозиторий: на сайте такого
 * файла нет, и мёртвый адрес выглядел бы как ошибка.
 */

interface InlineMarkdownProps {
  text: string;
  repositoryUrl?: string;
  branch?: string;
}

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

const CODE_CLASS =
  "rounded-sm bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.85em] text-foreground";

function renderLink(label: string, href: string, repositoryUrl?: string, branch?: string, key?: number): ReactNode {
  const isAbsolute = /^https?:\/\//.test(href) || href.startsWith("mailto:");
  const target = isAbsolute
    ? href
    : repositoryUrl
      ? `${repositoryUrl}/blob/${branch ?? "main"}/${href.replace(/^\.?\//, "")}`
      : href;

  return (
    <a
      key={key}
      href={target}
      {...(isAbsolute ? { target: "_blank", rel: "noreferrer" } : {})}
      className="text-foreground underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white/70 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {label}
    </a>
  );
}

export function InlineMarkdown({ text, repositoryUrl, branch }: InlineMarkdownProps) {
  const parts = text.split(TOKEN).filter((part) => part !== "");

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }

        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={index} className={CODE_CLASS}>
              {part.slice(1, -1)}
            </code>
          );
        }

        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
        if (link) {
          return (
            <Fragment key={index}>
              {renderLink(link[1], link[2], repositoryUrl, branch, index)}
            </Fragment>
          );
        }

        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}
