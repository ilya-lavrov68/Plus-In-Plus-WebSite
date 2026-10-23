"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

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
}

export default function CartPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("cart");

  const [items, setItems] = useState<CartItem[]>([]);
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], []);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.push("/login");
      return;
    }

    let cancelled = false;
    fetch("/api/cart", { cache: "no-store" })
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setDeadline(
          typeof data.deadline === "string"
            ? data.deadline.split("T")[0]
            : ""
        );
        setDescription(data.description || "");
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, status, router]);

  const updateQuantity = async (
    itemId: string,
    itemType: "service" | "product",
    nextQuantity: number
  ) => {
    if (nextQuantity < 1 || nextQuantity > 99) return;
    setErrorMessage(null);
    const previous = items;
    const updated = items.map((i) =>
      i.itemId === itemId && i.itemType === itemType
        ? { ...i, quantity: nextQuantity }
        : i
    );
    setItems(updated);
    notifyCartUpdated(updated.reduce((sum, i) => sum + i.quantity, 0));

    try {
      const res = await fetch("/api/cart/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, itemType, quantity: nextQuantity }),
      });
      if (!res.ok) {
        setItems(previous);
        notifyCartUpdated(previous.reduce((sum, i) => sum + i.quantity, 0));
      }
    } catch {
      setItems(previous);
      notifyCartUpdated(previous.reduce((sum, i) => sum + i.quantity, 0));
    }
  };

  const removeItem = async (
    itemId: string,
    itemType: "service" | "product"
  ) => {
    setErrorMessage(null);
    const nextItems = items.filter(
      (i) => !(i.itemId === itemId && i.itemType === itemType)
    );
    setItems(nextItems);
    notifyCartUpdated(nextItems.reduce((sum, i) => sum + i.quantity, 0));

    await fetch("/api/cart/item", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, itemType }),
    });
  };

  const handleCheckout = async () => {
    if (items.length === 0 || isSubmitting) return;
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
        const msg = data?.error || "Checkout failed";
        setErrorMessage(msg);
        toast({
          title: msg,
          variant: "destructive",
        });
        return;
      }

      notifyCartUpdated(0);
      toast({
        title: data?.orderNumber
          ? t("submitted", { number: data.orderNumber })
          : t("submitOrderRequest"),
      });
      router.push("/orders");
      router.refresh();
    } catch {
      setErrorMessage("Failed to submit order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (status === "loading" || isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-28 text-center text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-28 text-center">
        <ShoppingCart
          aria-hidden="true"
          className="mx-auto mb-4 h-16 w-16 text-muted-foreground"
        />
        <h1 className="mb-4 text-3xl font-bold tracking-tight">
          {t("emptyTitle")}
        </h1>
        <p className="mb-8 text-muted-foreground">{t("emptyBody")}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button onClick={() => router.push("/services")}>
            {t("browseServices")}
          </Button>
          <Button variant="outline" onClick={() => router.push("/shop")}>
            {t("browseShop")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-24 md:py-32">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">
        {t("shoppingCart")}
      </h1>

      <div className="space-y-6">
        <Card className="border-border bg-card p-6">
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={`${item.itemType}-${item.itemId}`}
                className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{item.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.itemType === "service"
                      ? t("serviceLabel")
                      : t("productLabel")}
                    {item.category ? ` · ${item.category}` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="inline-flex items-center rounded-lg border border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-r-none"
                      disabled={item.quantity <= 1}
                      onClick={() =>
                        void updateQuantity(
                          item.itemId,
                          item.itemType,
                          item.quantity - 1
                        )
                      }
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
                      disabled={item.quantity >= 99}
                      onClick={() =>
                        void updateQuantity(
                          item.itemId,
                          item.itemType,
                          item.quantity + 1
                        )
                      }
                    >
                      <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="min-w-24 text-right text-lg font-bold tabular-nums">
                    {(item.price * item.quantity).toLocaleString("ru-RU")} ₽
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("remove")}
                    onClick={() => void removeItem(item.itemId, item.itemType)}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <div className="text-lg font-semibold">{t("estimatedTotal")}:</div>
            <div className="text-2xl font-bold tabular-nums">
              {total.toLocaleString("ru-RU")} ₽
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card p-6">
          <h2 className="mb-4 text-xl font-semibold">{t("orderDetails")}</h2>
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

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-4">
          <Button
            type="button"
            onClick={() => void handleCheckout()}
            disabled={isSubmitting || items.length === 0}
            className="flex-1"
            size="lg"
          >
            {isSubmitting ? t("submitting") : t("submitOrderRequest")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.back()}
          >
            {t("continueShopping")}
          </Button>
        </div>
      </div>
    </div>
  );
}
