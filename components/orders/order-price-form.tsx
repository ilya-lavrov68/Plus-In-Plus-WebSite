"use client";

import * as React from "react";
import { Lock, LockOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { setOrderLocked, setOrderPrice } from "@/app/actions/orders";
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
  /** Заказ заблокирован от редактирования. */
  isLocked?: boolean;
  /** Основатель: может править и разблокировать заблокированный заказ. */
  canEditLocked?: boolean;
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
  isLocked = false,
  canEditLocked = false,
}: OrderPriceFormProps) {
  const t = useTranslations("admin");
  const ta = useTranslations("actions");
  const locale = useLocale();

  // Заблокированный заказ для не-основателя — только чтение. Сервер всё
  // равно откажет (orderLocked), но поля честно выключаем и здесь.
  const lockedForMe = isLocked && !canEditLocked;

  // Поле предзаполняется расчётом: менеджер чаще подтверждает расчёт, чем
  // меняет его, и пустое поле заставляло бы перепечатывать число каждый раз.
  const [amount, setAmount] = React.useState(() => toRubles(currentTotal || estimatedAmount));
  const [note, setNote] = React.useState(currentNote ?? "");
  const [lockAfterSave, setLockAfterSave] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [unlockPending, setUnlockPending] = React.useState(false);
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
      const result = await setOrderPrice({
        orderId,
        amountRub: amount,
        managerNote: note,
        lock: lockAfterSave,
      });
      if (result.ok) {
        // После блокировки форма должна стать недоступной — проще честно
        // перечитать страницу, чем держать второй источник правды в стейте.
        if (lockAfterSave) {
          window.location.reload();
          return;
        }
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

  async function handleUnlock() {
    setError(null);
    setUnlockPending(true);
    try {
      const result = await setOrderLocked({ orderId, locked: false });
      if (result.ok) {
        window.location.reload();
        return;
      }
      setError(result.error ?? ta("genericError"));
    } catch {
      setError(ta("genericError"));
    } finally {
      setUnlockPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isLocked ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/60 px-3.5 py-2.5 text-sm">
          <p className="inline-flex items-center gap-2">
            <Lock aria-hidden="true" className="h-4 w-4" />
            {canEditLocked ? t("orderLockedFounderNotice") : t("orderLockedNotice")}
          </p>
          {canEditLocked ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUnlock}
              disabled={unlockPending}
            >
              <LockOpen aria-hidden="true" className="h-4 w-4" />
              {t("unlockOrder")}
            </Button>
          ) : null}
        </div>
      ) : null}

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
            disabled={pending || lockedForMe}
            aria-describedby="price-hint"
          />
          <p id="price-hint" className="text-xs text-muted-foreground">
            {t("estimated")}: {formatKopecks(estimatedAmount, currency, locale)}
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
            disabled={pending || lockedForMe}
          />
        </div>
      </div>

      {!isLocked ? (
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
            checked={lockAfterSave}
            onChange={(event) => setLockAfterSave(event.target.checked)}
            disabled={pending}
          />
          <span>
            <span className="font-medium">{t("lockAfterSave")}</span>
            <span className="block text-xs text-muted-foreground">{t("lockAfterSaveHint")}</span>
          </span>
        </label>
      ) : null}

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

      <Button type="submit" loading={pending} disabled={pending || !valid || lockedForMe}>
        {lockAfterSave
          ? t("agreeLockAndIssue")
          : currentTotal
            ? t("savePrice")
            : t("agreeAndIssue")}
      </Button>
    </form>
  );
}
