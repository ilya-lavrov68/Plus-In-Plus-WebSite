import Link from "next/link";

import block from "./blocks/block-wrapper.module.scss";

export interface PwPost {
  slug: string;
  title: string;
  dateLabel: string;
  category: string | null;
}

export interface PwBlogArchiveProps {
  locale: string;
  title: string;
  description: string;
  posts: PwPost[];
  emptyTitle: string;
  emptyDescription: string;
}

/** Архив блога в структуре payloadcms.com: строки-записи вместо карточек. */
export function PwBlogArchive({
  locale,
  title,
  description,
  posts,
  emptyTitle,
  emptyDescription,
}: PwBlogArchiveProps) {
  const href = (slug: string) => `/${locale}/blog/${slug}`;

  return (
    <div>
      <div className={block.blockWrapper} style={{ paddingBottom: "3rem" }}>
        <div className="grid" style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
          <div className="cols-8 cols-m-8">
            <p className="pl-h6">Plus In Plus</p>
            <h1 className="pl-h1">{title}</h1>
            <p>{description}</p>
          </div>
        </div>
      </div>

      <div className="grid" style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
        {posts.length === 0 ? (
          <div className="cols-8 cols-m-8">
            <h2 className="pl-h3">{emptyTitle}</h2>
            <p>{emptyDescription}</p>
          </div>
        ) : (
          <ul className="cols-16">
            {posts.map((post) => (
              <li
                key={post.slug}
                style={{ borderTop: "1px solid var(--theme-border-color)" }}
              >
                <Link
                  href={href(post.slug)}
                  className="grid"
                  style={{ padding: "1.5rem 0", alignItems: "baseline", rowGap: "0.5rem" }}
                >
                  <span className="cols-2 cols-m-2 pl-h6">{post.dateLabel}</span>
                  <span className="cols-10 cols-m-6 pl-h4">{post.title}</span>
                  <span className="cols-3 cols-m-8 pl-h6" style={{ textAlign: "right" }}>
                    {post.category ?? "Studio"}
                  </span>
                  <span className="cols-1" aria-hidden="true" style={{ textAlign: "right" }}>
                    ↗
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
