import block from "./block-wrapper.module.scss";
import classes from "./statement.module.scss";

export interface PwStatementProps {
  eyebrow: string;
  quote: string;
  author: string;
  role: string;
}

/**
 * Statement из payloadcms/website: крупная цитата в их контейнере
 * statementWrap/content с подписью автора.
 */
export function PwStatement({ eyebrow, quote, author, role }: PwStatementProps) {
  return (
    <div
      className={block.blockWrapper}
      style={{ paddingTop: "var(--block-spacing)", paddingBottom: "var(--block-spacing)" }}
    >
      <div className="grid" style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
        <div className={`cols-12 cols-m-8 ${classes.statementWrap}`}>
          <p className="pl-h6">{eyebrow}</p>
          <div className={classes.content}>
            <blockquote className="pl-h2">«{quote}»</blockquote>
            <p className="pl-h6">
              {author} · {role}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
