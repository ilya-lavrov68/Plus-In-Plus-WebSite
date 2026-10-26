"use client";

import * as React from "react";

import { useTranslations } from "next-intl";

import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalOverlay,
  ResponsiveModalPortal,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "@/components/spectrumui/ui/responsive-modal";
import { cn } from "@/lib/utils";

/**
 * Brand dialog, now Spectrum UI's ResponsiveModal.
 *
 * Upstream ResponsiveModal defaults to a bottom sheet below `lg`, which would
 * have moved the account and delete-confirmation dialogs on phones. The `center`
 * side added in scripts/vendor-spectrum.cjs reproduces the old centred layout at
 * every width, and it is the default here — so every existing screen is
 * pixel-identical while the sheet variants (`side="bottom"`, `"left"`, …) remain
 * available for new dialogs that want the native mobile feel.
 *
 * Everything else is preserved: the same names are re-exported, the overlay is
 * still a dark wash, and the dismiss button keeps its translated label.
 */
const Dialog = ResponsiveModal;
const DialogTrigger = ResponsiveModalTrigger;
const DialogPortal = ResponsiveModalPortal;
const DialogClose = ResponsiveModalClose;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof ResponsiveModalOverlay>,
  React.ComponentPropsWithoutRef<typeof ResponsiveModalOverlay>
>(({ className, ...props }, ref) => (
  <ResponsiveModalOverlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 duration-250 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof ResponsiveModalContent>,
  React.ComponentPropsWithoutRef<typeof ResponsiveModalContent>
>(({ className, children, side = "center", ...props }, ref) => {
  const t = useTranslations("common");
  return (
    <ResponsiveModalContent
      ref={ref}
      side={side}
      closeLabel={t("close")}
      className={cn(
        "glass-panel border-border bg-background/80 shadow-glass duration-250 ease-out sm:rounded-2xl",
        className
      )}
      {...props}
    >
      {children}
    </ResponsiveModalContent>
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <ResponsiveModalHeader
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <ResponsiveModalFooter
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof ResponsiveModalTitle>,
  React.ComponentPropsWithoutRef<typeof ResponsiveModalTitle>
>(({ className, ...props }, ref) => (
  <ResponsiveModalTitle
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof ResponsiveModalDescription>,
  React.ComponentPropsWithoutRef<typeof ResponsiveModalDescription>
>(({ className, ...props }, ref) => (
  <ResponsiveModalDescription
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
