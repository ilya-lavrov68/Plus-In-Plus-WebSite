import block from "./block-wrapper.module.scss";
import classes from "./steps.module.scss";

export interface PwStepsProps {
  eyebrow: string;
  heading: string;
  steps: { title: string; body: string }[];
}

/** Steps из payloadcms/website: нумерованный список в их блоке. */
export function PwSteps({ eyebrow, heading, steps }: PwStepsProps) {
  return (
    <div
      className={block.blockWrapper}
      style={{ paddingTop: "var(--block-spacing)", paddingBottom: "var(--block-spacing)" }}
    >
      <div className="grid" style={{ paddingLeft: "var(--gutter-h)", paddingRight: "var(--gutter-h)" }}>
        <div className="cols-4 cols-m-8">
          <p className="pl-h6">{eyebrow}</p>
          <h2 className="pl-h3">{heading}</h2>
        </div>
        <ol className={`cols-12 cols-m-8 ${classes.steps}`}>
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="pl-h6">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="pl-h5">{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
