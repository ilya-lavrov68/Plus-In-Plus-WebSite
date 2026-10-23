"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";

import { notifyCartUpdated } from "@/components/site/cart-icon";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export interface AddToCartButtonProps {
  itemType: "service" | "product";
  itemId: string;
  itemName: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function AddToCartButton({
  itemType,
  itemId,
  itemName,
  variant = "default",
  size = "default",
  className,
}: AddToCartButtonProps) {
  const [isAdded, setIsAdded] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("cart");

  const handleClick = async () => {
    if (!session?.user) {
      router.push("/login");
      return;
    }

    if (isPending || isAdded) return;
    setIsPending(true);

    try {
      const res = await fetch("/api/cart/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId, quantity: 1 }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast({
          title: data?.error || "Failed to add to cart",
          variant: "destructive",
        });
        return;
      }

      notifyCartUpdated(
        typeof data?.count === "number" ? data.count : undefined
      );
      setIsAdded(true);
      toast({
        title: `${t("added")}: ${itemName}`,
      });
      setTimeout(() => setIsAdded(false), 2000);
    } catch (error) {
      console.error("Failed to add to cart:", error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isAdded || isPending}
      className={cn("gap-2", className)}
    >
      {isAdded ? (
        <>
          <Check aria-hidden="true" className="h-4 w-4" />
          {t("added")}
        </>
      ) : (
        <>
          <ShoppingCart aria-hidden="true" className="h-4 w-4" />
          {t("addToCart")}
        </>
      )}
    </Button>
  );
}
