"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { notifyCartUpdated } from "@/components/site/cart-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

export interface CartItem {
  id: string;
  itemType: "service" | "product";
  itemId: string;
  quantity: number;
  name: string;
  price: number;
  category?: string;
  unavailable: boolean;
  maxQuantity: number;
}

/**
 * Корзина на объединённой странице «Корзина и заказы».
 *
 * Доступ проверяет серверная страница /cart, поэтому здесь остаётся только
 * работа с позициями. После отправки заявки никуда не уходим: список заказов
 * рендерит сервер на этой же странице, поэтому достаточно `router.refresh()`.
 */
export function CartPanel() {
  const router = useRouter();
  const t = useTranslations("cart");
  const numberLocale = useLocale() === "ru" ? "ru-RU" : "en-GB";

  const [items, setItems] = useState<CartItem[]>([]);
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cart", { cache: "no-store" })
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("Cart request failed");
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setDeadline(
          typeof data.deadline === "string" ? data.deadline.split("T")[0] : ""
        );
        setDescription(data.description || "");
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage(t("loadFailed"));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, t]);

  const updateQuantity = async (id: string, nextQuantity: number) => {
    const line = items.find((item) => item.id === id);
    if (
      !line ||
      pendingItemId ||
      nextQuantity < 1 ||
      nextQuantity > Math.min(99, line.maxQuantity)
    ) return;
    setErrorMessage(null);
    setPendingItemId(id);
    const previous = items;
    const updated = items.map((item) =>
      item.id === id ? { ...item, quantity: nextQuantity } : item
    );
    setItems(updated);
    notifyCartUpdated(updated.reduce((sum, item) => sum + item.quantity, 0));

    try {
      const res = await fetch("/api/cart/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, quantity: nextQuantity }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("updateFailed"));
      if (typeof data?.count === "number") notifyCartUpdated(data.count);
    } catch (error) {
      setItems(previous);
      notifyCartUpdated(previous.reduce((sum, item) => sum + item.quantity, 0));
      const message = error instanceof Error ? error.message : t("updateFailed");
      setErrorMessage(message);
      toast({ title: message, variant: "destructive" });
    } finally {
      setPendingItemId(null);
    }
  };

  const removeItem = async (id: string) => {
    if (pendingItemId) return;
    setErrorMessage(null);
    setPendingItemId(id);
    const previous = items;
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    notifyCartUpdated(nextItems.reduce((sum, item) => sum + item.quantity, 0));

    try {
      const res = await fetch("/api/cart/item", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("removeFailed"));
      if (typeof data?.count === "number") notifyCartUpdated(data.count);
    } catch (error) {
      setItems(previous);
      notifyCartUpdated(previous.reduce((sum, item) => sum + item.quantity, 0));
      const message = error instanceof Error ? error.message : t("removeFailed");
      setErrorMessage(message);
      toast({ title: message, variant: "destructive" });
    } finally {
      setPendingItemId(null);
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0 || isSubmitting || pendingItemId) return;
    if (hasCartIssues) {
      setErrorMessage(t("resolveItems"));
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deadline: deadline || null,
          description: description || null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || t("checkoutFailed");
        setErrorMessage(msg);
        toast({ title: msg, variant: "destructive" });
        return;
      }

      // Заявка стала заказом: корзина пуста, а заказ появляется в списке ниже.
      setItems([]);
      setDeadline("");
      setDescription("");
      notifyCartUpdated(0);
      toast({
        title: data?.orderNumber
          ? t("submitted", { number: data.orderNumber })
          : t("submitOrderRequest"),
        description: t("submittedHint"),
      });
      router.refresh();
    } catch {
      setErrorMessage(t("checkoutFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasCartIssues = items.some(
    (item) => item.unavailable || item.quantity > item.maxQuantity,
  );
  const total = items.reduce(
    (sum, item) =>
      item.unavailable || item.quantity > item.maxQuantity
        ? sum
        : sum + item.price * item.quantity,
    0,
  );

  if (isLoading) {
    return (
      <p className="py-10 text-center text-muted-foreground">{t("loading")}</p>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="glass-panel bg-background/65 px-6 py-10 text-center">
        <ShoppingCart
          aria-hidden="true"
          className="mx-auto mb-4 h-10 w-10 text-muted-foreground"
        />
        <h2 className="mb-2 text-xl font-semibold tracking-tight">
          {t("emptyTitle")}
        </h2>
        <p
          role={errorMessage ? "alert" : undefined}
          className={
            errorMessage ? "mb-6 text-destructive" : "mb-6 text-muted-foreground"
          }
        >
          {errorMessage ?? t("emptyBody")}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => router.push("/services")}>
            {t("browseServices")}
          </Button>
          <Button variant="outline" onClick={() => router.push("/shop")}>
            {t("browseShop")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-panel bg-background/65 p-6">
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 py-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">{item.name}</div>
                <div className="text-sm text-muted-foreground">
                  {item.itemType === "service"
                    ? t("serviceLabel")
                    : t("productLabel")}
                  {item.category ? ` · ${item.category}` : ""}
                </div>
                {item.unavailable ? (
                  <p className="mt-1 text-sm text-destructive">{t("itemUnavailable")}</p>
                ) : item.quantity > item.maxQuantity ? (
                  <p className="mt-1 text-sm text-destructive">
                    {t("itemStockLimited", { count: item.maxQuantity })}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-4">
                <div className="inline-flex items-center rounded-lg">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-r-none"
                    disabled={pendingItemId !== null || item.quantity <= 1}
                    onClick={() => void updateQuantity(item.id, item.quantity - 1)}
                  >
                    <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-8 px-2 text-center text-sm font-medium tabular-nums">
                    {item.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-l-none"
                    disabled={
                      pendingItemId !== null ||
                      item.unavailable ||
                      item.quantity >= Math.min(99, item.maxQuantity)
                    }
                    onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="min-w-24 text-right text-lg font-bold tabular-nums">
                  {(item.price * item.quantity).toLocaleString(numberLocale)} ₽
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("remove")}
                  disabled={pendingItemId !== null}
                  onClick={() => void removeItem(item.id)}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between pt-4">
          <div className="text-lg font-semibold">{t("estimatedTotal")}:</div>
          <div className="text-2xl font-bold tabular-nums">
            {total.toLocaleString(numberLocale)} ₽
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("managerNote")}</p>
      </Card>

      <Card className="glass-panel bg-background/65 p-6">
        <h3 className="mb-4 text-xl font-semibold">{t("orderDetails")}</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="cart-deadline" className="mb-2 block text-sm font-medium">
              {t("desiredDeadline")}
            </Label>
            <Input
              id="cart-deadline"
              type="date"
              min={todayIso}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cart-description" className="mb-2 block text-sm font-medium">
              {t("projectDescription")}
            </Label>
            <Textarea
              id="cart-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder={t("projectDescriptionPlaceholder")}
            />
          </div>
        </div>
      </Card>

      {hasCartIssues ? (
        <p role="alert" className="text-sm text-destructive">
          {t("resolveItems")}
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <Button
          type="button"
          onClick={() => void handleCheckout()}
          disabled={isSubmitting || pendingItemId !== null || hasCartIssues || items.length === 0}
          className="flex-1"
          size="lg"
        >
          {isSubmitting ? t("submitting") : t("submitOrderRequest")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push("/services")}
        >
          {t("continueShopping")}
        </Button>
      </div>
    </div>
  );
}
