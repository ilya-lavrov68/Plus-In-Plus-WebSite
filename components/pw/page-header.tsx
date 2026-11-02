import block from "./blocks/block-wrapper.module.scss";

export interface PwPageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  dense?: boolean;
}

/**
 * Шапка внутренней страницы в структуре payloadcms.com:
 * blockWrapper → gutter → 16-колоночная сетка, текст в cols-8.
 */
export function PwPageHeader({ eyebrow, title, description, dense }: PwPageHeaderProps) {
  return (
    <div
      className={block.blockWrapper}
      style={{
        paddingTop: dense ? "calc(var(--header-height) * 0.5)" : undefined,
        paddingBottom: "3rem",
      }}
    >
      <div className="grid" style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
        <div className="cols-8 cols-m-8">
          <p className="pl-h6">{eyebrow}</p>
          <h1 className="pl-h1">{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
    </div>
  );
}
