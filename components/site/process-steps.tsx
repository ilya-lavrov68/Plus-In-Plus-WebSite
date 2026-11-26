export interface ProcessStep {
  title: string;
  body: string;
}

interface ProcessStepsProps {
  steps: ProcessStep[];
  className?: string;
}

/**
 * Процесс работы: четыре шага без выдуманных сроков и гарантий.
 * Номера — служебные, поэтому нейтральные, а не акцентные.
 */
export function ProcessSteps({ steps, className }: ProcessStepsProps) {
  return (
    <ol className={className ?? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"}>
      {steps.map((step, index) => (
        <li
          key={step.title}
          data-reveal=""
          data-reveal-delay={index * 60}
          className="flex flex-col gap-3 rounded-2xl bg-white/[0.045] p-6"
        >
          <span className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-lg font-medium tracking-tight">{step.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
