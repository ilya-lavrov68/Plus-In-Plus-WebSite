"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { setOrderPrice } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { estimateDriftPercent, formatKopecks } from "@/lib/pricing";

export interface OrderPriceFormProps {
  orderId: string;
  /** Расчётная цена в копейках — показывается рядом для сравнения. */
  estimatedAmount: number;
  /** Уже согласованная цена в копейках. 0, если цены ещё нет. */
  currentTotal: number;
  currentNote?: string | null;
  currency: string;
}

function toRubles(kopecks: number): string {
  return kopecks ? String(kopecks / 100) : "";
}

export function OrderPriceForm({
  orderId,
  estimatedAmount,
  currentTotal,
  currentNote,
  currency,
}: OrderPriceFormProps) {
  const t = useTranslations("admin");
  const ta = useTranslations("actions");

  // Поле предзаполняется расчётом: менеджер чаще подтверждает расчёт, чем
  // меняет его, и пустое поле заставляло бы перепечатывать число каждый раз.
  const [amount, setAmount] = React.useState(() => toRubles(currentTotal || estimatedAmount));
  const [note, setNote] = React.useState(currentNote ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const rubles = Number(amount.replace(",", "."));
  const valid = Number.isFinite(rubles) && rubles >= 0;
  const kopecks = valid ? Math.round(rubles * 100) : 0;
  const drift = estimatedAmount ? estimateDriftPercent(estimatedAmount, kopecks) : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!valid) {
      setError(ta("invalidAmount"));
      return;
    }
    setPending(true);
    try {
      const result = await setOrderPrice({ orderId, amountRub: amount, managerNote: note });
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.error ?? ta("genericError"));
      }
    } catch {
      setError(ta("genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agreed-price">{t("agreedPriceLabel")}</Label>
          <Input
            id="agreed-price"
            // Числовая клавиатура на мобильных: менеджер вводит сумму.
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setSaved(false);
            }}
            disabled={pending}
            aria-describedby="price-hint"
          />
          <p id="price-hint" className="text-xs text-muted-foreground">
            {t("estimated")}: {formatKopecks(estimatedAmount, currency)}
            {drift !== null && drift !== 0 && (
              <>
                {" · "}
                {t("estimateDrift")}: {drift > 0 ? "+" : ""}
                {drift}%
              </>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="manager-note">{t("managerComment")}</Label>
          <Textarea
            id="manager-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("managerCommentPlaceholder")}
            disabled={pending}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {saved ? (
        <p role="status" className="text-sm text-emerald-700">
          {t("priceSaved")}
        </p>
      ) : null}

      <Button type="submit" loading={pending} disabled={pending || !valid}>
        {currentTotal ? t("savePrice") : t("agreeAndIssue")}
      </Button>
    </form>
  );
}
