"use client";

import * as React from "react";
import { Check, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { updateServicePrice } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface InlinePriceEditorProps {
  serviceId: string;
  serviceTitle: string;
  /** Копейки. */
  basePrice: number;
  /** Показывать ли цену, когда её нет. */
  emptyLabel: string;
}

/**
 * Цена, которую правит клик по ней.
 *
 * Показывается текстом, по клику превращается в поле. Enter сохраняет,
 * Escape отменяет, потеря фокуса сохраняет — так же ведёт себя любая
 * таблица, к которой люди привыкли.
 */
export function InlinePriceEditor({
  serviceId,
  serviceTitle,
  basePrice,
  emptyLabel,
}: InlinePriceEditorProps) {
  const t = useTranslations("admin");

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const display = basePrice
    ? new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 })
        .format(basePrice / 100)
    : emptyLabel;

  function beginEditing() {
    setDraft(basePrice ? String(basePrice / 100) : "");
    setError(null);
    setEditing(true);
  }

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function save() {
    const value = draft.trim();
    // Ничего не меняли — просто закрываем, не дёргая базу.
    if (value === (basePrice ? String(basePrice / 100) : "")) {
      setEditing(false);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await updateServicePrice({ serviceId, basePriceRub: value });
      if (result.ok) {
        setEditing(false);
      } else {
        setError(result.error ?? t("updateServiceFailed"));
      }
    } catch {
      setError(t("genericError"));
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={beginEditing}
        title={t("editPrice")}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-left tabular-nums",
          "transition-colors duration-200 ease-out hover:bg-accent",
          "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          !basePrice && "text-muted-foreground",
        )}
      >
        <span>{display}</span>
        <Pencil
          aria-hidden="true"
          className="h-3 w-3 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-60"
        />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        value={draft}
        inputMode="decimal"
        disabled={pending}
        aria-label={t("editPrice")}
        aria-invalid={error ? true : undefined}
        className={cn("h-8 w-24 tabular-nums", error && "border-red-500")}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setEditing(false);
            setError(null);
          }
        }}
        onBlur={() => void save()}
      />
      {pending ? null : error ? (
        <X aria-hidden="true" className="h-4 w-4 text-red-600" />
      ) : (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={t("savePrice")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void save()}
        >
          <Check aria-hidden="true" className="h-4 w-4" />
        </Button>
      )}
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
      <span className="sr-only">{serviceTitle}</span>
    </div>
  );
}
