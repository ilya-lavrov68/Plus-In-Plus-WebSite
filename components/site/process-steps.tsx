import { cn } from "@/lib/utils";

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
 *
 * Каждый шаг начинается с волосяной линии и крупного номера — это задаёт
 * ритм без карточных подложек. Номера служебные, поэтому нейтральные.
 */
export function ProcessSteps({ steps, className }: ProcessStepsProps) {
  return (
    <ol
      className={cn(
        "grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {steps.map((step, index) => (
        <li
          key={step.title}
          data-reveal=""
          data-reveal-delay={index * 60}
          className="group flex flex-col gap-4 pt-5"
        >
          <span aria-hidden="true" className="h-px w-full bg-white/12" />
          <span className="font-mono text-xs text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-lg font-medium tracking-tight">{step.title}</h3>
          <p className="max-w-xs text-sm leading-[1.7] text-muted-foreground">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
