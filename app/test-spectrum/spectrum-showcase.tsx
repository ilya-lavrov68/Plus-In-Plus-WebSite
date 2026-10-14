"use client";

/**
 * Stage 1 verification page for the Spectrum UI vendoring.
 *
 * Exercises every vendored Spectrum component against the Plus In Plus brand
 * palette from `lib/spectrum-theme.ts`, so we can confirm they render, accept
 * the brand styling, and do not collide with the existing Tailwind layer.
 *
 * This page is scaffolding for the migration and is removed in Stage 4.
 */

import * as React from "react";
import { Check, Plus, Search, Trash2 } from "lucide-react";

import AnimatedCard from "@/components/spectrumui/animated-card";
import {
  AnimatedToastStack,
  useAnimatedToastStack,
} from "@/components/spectrumui/animated-toast-stack";
import { AnimatedSwitch } from "@/components/spectrumui/animated-switch";
import { CommandSearch } from "@/components/spectrumui/command-search";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import type { DataTableColumn } from "@/components/spectrumui/data-table";
import { Dock, DockIcon } from "@/components/spectrumui/dock";
import { PasswordStrengthInput } from "@/components/spectrumui/password-strength";
import { QuantityStepper } from "@/components/spectrumui/quantity-stepper";
import { SkeletonReveal } from "@/components/spectrumui/skeleton-reveal";
import { TaskCheckbox } from "@/components/spectrumui/task-checkbox";
import { TiltCard, TiltCardItem } from "@/components/spectrumui/tilt-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/spectrumui/ui/accordion";
import { AutosizeTextarea } from "@/components/spectrumui/ui/autosize-textarea";
import { DualRangeSlider } from "@/components/spectrumui/ui/dual-range-slider";
import { FloatingLabelInput } from "@/components/spectrumui/ui/floating-label-input";
import { LoadingButton } from "@/components/spectrumui/ui/loading-button";
import MultipleSelector from "@/components/spectrumui/ui/multiple-selector";
import { ProgressWithValue } from "@/components/spectrumui/ui/progress-with-value";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "@/components/spectrumui/ui/responsive-modal";
import { brand, spectrumTheme } from "@/lib/spectrum-theme";

// Brand layer (Stage 2): these are the components the site actually imports.
// Each one is a Spectrum UI primitive restyled for Plus In Plus.
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#052B4229] bg-white p-6 shadow-sm">
      <h2 className="font-heading text-lg font-semibold text-[#052B42]">{title}</h2>
      {note ? <p className="mt-1 text-sm text-[#052B4280]">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const TAGS = [
  { value: "branding", label: "Branding" },
  { value: "web", label: "Web design" },
  { value: "smm", label: "SMM" },
  { value: "seo", label: "SEO" },
  { value: "photo", label: "Photography" },
];

type ServiceRow = {
  id: string;
  title: string;
  category: string;
  views: number;
  published: boolean;
};

const SERVICE_ROWS: ServiceRow[] = [
  { id: "1", title: "Brand identity", category: "Branding", views: 1284, published: true },
  { id: "2", title: "Landing page", category: "Web design", views: 3902, published: true },
  { id: "3", title: "Social media kit", category: "SMM", views: 744, published: false },
  { id: "4", title: "Technical audit", category: "SEO", views: 2109, published: true },
  { id: "5", title: "Product shoot", category: "Photography", views: 512, published: false },
];

const SERVICE_COLUMNS: DataTableColumn<ServiceRow>[] = [
  { id: "title", header: "Service", sortable: true },
  { id: "category", header: "Category", sortable: true },
  { id: "views", header: "Views", numeric: true, sortable: true },
  {
    id: "published",
    header: "Status",
    sortable: true,
    value: (row) => (row.published ? "Published" : "Draft"),
    cell: (row) => (
      <span
        className={
          row.published
            ? "rounded-lg bg-[#00C56D] px-2.5 py-0.5 text-xs font-semibold text-[#052B42]"
            : "rounded-lg border border-[#052B4229] px-2.5 py-0.5 text-xs font-semibold text-[#052B42]"
        }
      >
        {row.published ? "Published" : "Draft"}
      </span>
    ),
  },
];

/* -------------------------------------------------------------------------- */
/* showcase                                                                    */
/* -------------------------------------------------------------------------- */

export function SpectrumShowcase() {
  const [saving, setSaving] = React.useState(false);
  const [tags, setTags] = React.useState<typeof TAGS>([TAGS[0]]);
  const [range, setRange] = React.useState<number[]>([20, 80]);
  const [notes, setNotes] = React.useState("");
  const [published, setPublished] = React.useState(true);
  const [qty, setQty] = React.useState(1);
  const [revealed, setRevealed] = React.useState(false);

  const { toasts, showToast: push, dismissToast: dismiss } = useAnimatedToastStack();

  React.useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  function fakeSave() {
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      push({ status: "success", title: "Saved", description: "The service was updated." });
    }, 1400);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00C56D]">
          Stage 1 · Spectrum UI
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-[#052B42]">
          Spectrum UI component check
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#052B4280]">
          Every component below is vendored source from{" "}
          <span className="font-medium text-[#052B42]">
            github.com/arihantcodes/spectrum-ui
          </span>
          , restyled with the Plus In Plus palette from{" "}
          <code className="rounded bg-[#D9E1FF] px-1 py-0.5 text-[#052B42]">
            lib/spectrum-theme.ts
          </code>
          . Nothing here is imported from npm — Spectrum UI ships no runtime package.
        </p>
      </header>

      <div className="grid gap-6">
        {/* ---- brand layer (Stage 2) ------------------------------------- */}
        <Section
          title="Brand layer — components/ui/*"
          note="What the site actually imports. Each component below is a Spectrum UI primitive wrapped with the Plus In Plus palette. Nothing here should look grey."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default (navy)</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button size="sm">Small</Button>
            <Button loading={saving} onClick={fakeSave}>
              {saving ? "Saving…" : "Click to load"}
            </Button>
            <Button disabled>Disabled</Button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-8">
            <label className="flex items-center gap-3 text-sm font-medium text-[#052B42]">
              <Switch id="brand-switch" checked={published} onCheckedChange={setPublished} />
              <span>Brand switch (drag or flick it)</span>
            </label>

            <div className="flex items-center gap-3">
              <Spinner size="small" />
              <Spinner />
              <Spinner size="large" />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Textarea rows={2} placeholder="rows={2} — starts at 80px, grows as you type" />
            <Textarea rows={6} placeholder="rows={6} — starts at 138px, grows as you type" />
          </div>

          <div className="mt-5">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open brand dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Brand dialog</DialogTitle>
                  <DialogDescription>
                    Below lg this slides up from the bottom; from lg it is centred.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={() => push({ status: "info", title: "Dismissed" })}>
                    Got it
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Section>

        {/* ---- buttons -------------------------------------------------- */}
        <Section
          title="Buttons — LoadingButton"
          note="Branded with rounded-xl (12px). Navy is the default action, green is the hero CTA, per the brand rules."
        >
          <div className="flex flex-wrap items-center gap-3">
            <LoadingButton className={brand("solidButton")} loading={saving} onClick={fakeSave}>
              {saving ? "Saving…" : "Save service"}
            </LoadingButton>
            <LoadingButton className={brand("ctaButton")}>Order now</LoadingButton>
            <LoadingButton className={brand("outlineButton")}>View details</LoadingButton>
            <LoadingButton className={brand("solidButton")} disabled>
              Disabled
            </LoadingButton>
            <LoadingButton className={brand("solidButton")} size="sm">
              <Plus className="h-4 w-4" /> New
            </LoadingButton>
          </div>
          <div className="mt-4 flex items-center gap-3 text-sm text-[#052B4280]">
            <Spinner className="text-[#052B42]" />
            <span>Spinner — navy, inherits currentColor</span>
          </div>
        </Section>

        {/* ---- inputs --------------------------------------------------- */}
        <Section title="Form controls" note="FloatingLabelInput, AutosizeTextarea, MultipleSelector.">
          <div className="grid gap-5 sm:grid-cols-2">
            <FloatingLabelInput id="ts-title" label="Service title" placeholder=" " />
            <FloatingLabelInput id="ts-slug" label="Slug" placeholder=" " />
          </div>

          <div className="mt-5">
            <AutosizeTextarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              minHeight={72}
              placeholder="Short description — the textarea grows as you type."
              className={brand("control")}
            />
          </div>

          <div className="mt-5">
            <MultipleSelector
              value={tags}
              onChange={setTags}
              defaultOptions={TAGS}
              placeholder="Pick categories…"
              className={brand("control")}
              emptyIndicator="No category found."
            />
          </div>
        </Section>

        {/* ---- toggles & ranges ----------------------------------------- */}
        <Section title="Switch, slider, stepper, checkbox" note="Interactive state components.">
          <div className="flex flex-wrap items-center gap-8">
            <label className="flex items-center gap-3 text-sm font-medium text-[#052B42]">
              <AnimatedSwitch
                checked={published}
                onCheckedChange={setPublished}
                label="Published"
                onIcon={<Check className="h-3 w-3" />}
              />
              Published
            </label>

            <QuantityStepper value={qty} onValueChange={setQty} min={1} max={12} />
          </div>

          <div className="mt-6 max-w-sm">
            <DualRangeSlider
              label={(value) => `Value: ${value ?? 0}`}
              value={range}
              onValueChange={setRange}
              min={0}
              max={100}
              step={1}
            />
          </div>

          <div className="mt-6 space-y-2">
            <TaskCheckbox
              label="Replace cards in components/site/"
              description="Stage 3 — service, category and news cards"
              defaultChecked
            />
            <TaskCheckbox label="Migrate the admin tables to DataTable" description="Stage 3.4" />
          </div>
        </Section>

        {/* ---- modal ---------------------------------------------------- */}
        <Section title="ResponsiveModal" note="Radix dialog underneath — drawer on mobile, dialog on desktop.">
          <ResponsiveModal>
            <ResponsiveModalTrigger className={brand("solidButton", "h-11 px-6")}>
              Open modal
            </ResponsiveModalTrigger>
            <ResponsiveModalContent className="rounded-2xl">
              <ResponsiveModalHeader>
                <ResponsiveModalTitle className="font-heading text-[#052B42]">
                  Publish this service?
                </ResponsiveModalTitle>
                <ResponsiveModalDescription className="text-[#052B4280]">
                  It becomes visible in /shop immediately.
                </ResponsiveModalDescription>
              </ResponsiveModalHeader>
              <ResponsiveModalFooter className="gap-2">
                <button
                  type="button"
                  className={brand("ctaButton", "h-10 px-5 text-sm")}
                  onClick={() =>
                    push({ status: "success", title: "Published", description: "It is live." })
                  }
                >
                  Publish
                </button>
              </ResponsiveModalFooter>
            </ResponsiveModalContent>
          </ResponsiveModal>
        </Section>

        {/* ---- data table ----------------------------------------------- */}
        <Section title="DataTable" note="Sorting, search and quick filters for the admin screens.">
          <AdminDataTable
            data={SERVICE_ROWS}
            columns={SERVICE_COLUMNS}
            rowId={(row) => row.id}
            title="Services"
            searchable
            searchPlaceholder="Search services…"
            variant="bordered"
            density="default"
          />
        </Section>

        {/* ---- accordion ------------------------------------------------ */}
        <Section title="Accordion" note="Spectrum's streaming-content accordion on the brand border colour.">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="a">
              <AccordionTrigger>What is Spectrum UI?</AccordionTrigger>
              <AccordionContent>
                A copy-paste component registry built on shadcn/ui, Tailwind and Motion. There is no
                npm package — the source is vendored into this repository.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="b">
              <AccordionTrigger>Does it replace shadcn/ui?</AccordionTrigger>
              <AccordionContent>
                No. It extends it: its own components import @/components/ui primitives. The shadcn
                base stays.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>

        {/* ---- progress ------------------------------------------------- */}
        <Section title="ProgressWithValue">
          <div className="space-y-6">
            <ProgressWithValue value={72} />
            <ProgressWithValue value={40} position="follow" />
          </div>
        </Section>

        {/* ---- password ------------------------------------------------- */}
        <Section title="PasswordStrengthInput">
          <div className="max-w-sm">
            <PasswordStrengthInput placeholder="New password" />
          </div>
        </Section>

        {/* ---- cards ---------------------------------------------------- */}
        <Section
          title="TiltCard, AnimatedCard, Dock"
          note="Showcase components. Kept on-brand by overriding the glare colour."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <TiltCard
              maxTilt={10}
              glareColor={spectrumTheme.colors.secondary}
              className="rounded-xl border border-[#052B4229] bg-white p-6 shadow-sm"
            >
              <TiltCardItem depth={24} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#00C56D]">
                  Branding
                </p>
                <h3 className="font-heading text-xl font-semibold text-[#052B42]">
                  Brand identity
                </h3>
                <p className="text-sm text-[#052B4280]">
                  Move the pointer across the card — the glare uses the brand green.
                </p>
              </TiltCardItem>
            </TiltCard>

            <AnimatedCard
              imgSrc="/assets/logos/plus-in-plus.svg"
              title="Plus In Plus"
              aboutProduct="AnimatedCard on the default neutral surface, shown for comparison."
            />
          </div>

          <div className="mt-8 flex justify-center">
            <Dock magnification={56} distance={110} variant="glass">
              <DockIcon label="Search">
                <Search className="h-5 w-5" />
              </DockIcon>
              <DockIcon label="Add">
                <Plus className="h-5 w-5" />
              </DockIcon>
              <DockIcon label="Delete">
                <Trash2 className="h-5 w-5" />
              </DockIcon>
            </Dock>
          </div>
        </Section>

        {/* ---- command search ------------------------------------------- */}
        <Section title="CommandSearch">
          <div className="max-w-md">
            <CommandSearch
              placeholder="Search the site…"
              queries={["brand", "logo"]}
              autoType
              groups={[
                {
                  label: "Pages",
                  items: [
                    { label: "Home", icon: <Search className="h-4 w-4" /> },
                    { label: "Shop", icon: <Search className="h-4 w-4" /> },
                    { label: "Blog", icon: <Search className="h-4 w-4" /> },
                  ],
                },
              ]}
            />
          </div>
        </Section>

        {/* ---- skeleton reveal ------------------------------------------ */}
        <Section title="SkeletonReveal" note="Cross-fades from placeholder to content once loaded.">
          <SkeletonReveal
            loading={!revealed}
            skeleton={
              <div className="space-y-3">
                <div className="h-4 w-2/3 animate-pulse rounded-md bg-[#D9E1FF]" />
                <div className="h-4 w-1/2 animate-pulse rounded-md bg-[#D9E1FF]" />
              </div>
            }
          >
            <p className="text-sm text-[#052B42]">
              Content revealed after the skeleton settles.
            </p>
          </SkeletonReveal>
        </Section>

        {/* ---- toasts --------------------------------------------------- */}
        <Section title="AnimatedToastStack" note="Stacked, animated feedback layer.">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={brand("solidButton", "h-10 px-4 text-sm")}
              onClick={() => push({ status: "success", title: "Saved", description: "All good." })}
            >
              Success toast
            </button>
            <button
              type="button"
              className={brand("outlineButton", "h-10 px-4 text-sm")}
              onClick={() => push({ status: "error", title: "Failed", description: "Try again." })}
            >
              Error toast
            </button>
            <button
              type="button"
              className={brand("outlineButton", "h-10 px-4 text-sm")}
              onClick={() => push({ status: "loading", title: "Uploading…" })}
            >
              Loading toast
            </button>
          </div>
        </Section>
      </div>

      <AnimatedToastStack toasts={toasts} onDismiss={dismiss} position="bottom-right" />
    </div>
  );
}
