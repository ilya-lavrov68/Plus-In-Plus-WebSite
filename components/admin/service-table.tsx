"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import {
  ExternalLink,
  Lock,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  bulkUpdateServices,
  deleteService,
  saveQuickService,
  toggleServiceActive,
} from "@/app/actions/services";
import { InlinePriceEditor } from "@/components/admin/inline-price-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { formatKopecks } from "@/lib/pricing";

export interface AdminServiceRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  shortDesc?: string;
  coverImage: string;
  basePrice: number;
  currency: string;
  priceType: string;
  isActive?: boolean;
  isPublished: boolean;
  updatedAt: string | Date;
  activeOrderCount?: number;
}

interface QuickDialogState {
  open: boolean;
  serviceId?: string;
  title: string;
  slug: string;
  category: "small" | "large";
  description: string;
  basePriceRub: string;
  isActive: boolean;
  lockedByOrders: boolean;
}

const INITIAL_DIALOG_STATE: QuickDialogState = {
  open: false,
  serviceId: undefined,
  title: "",
  slug: "",
  category: "small",
  description: "",
  basePriceRub: "3000",
  isActive: true,
  lockedByOrders: false,
};

export function AdminServiceTable({
  services,
}: {
  services: AdminServiceRow[];
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminServiceRow | null>(
    null
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [quickDialog, setQuickDialog] =
    useState<QuickDialogState>(INITIAL_DIALOG_STATE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter(
      (s) =>
        (category === "all" || s.category === category) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q))
    );
  }, [services, query, category]);

  const allSelected =
    filtered.length > 0 && filtered.every((s) => selected.includes(s.id));

  function openQuickCreate() {
    setError(null);
    setQuickDialog({
      ...INITIAL_DIALOG_STATE,
      open: true,
    });
  }

  function openQuickEdit(service: AdminServiceRow) {
    setError(null);
    const activeOrders = service.activeOrderCount ?? 0;
    setQuickDialog({
      open: true,
      serviceId: service.id,
      title: service.title,
      slug: service.slug,
      category: service.category === "large" ? "large" : "small",
      description: service.shortDesc ?? "",
      basePriceRub: String(Math.round((service.basePrice ?? 0) / 100)),
      isActive: service.isActive ?? service.isPublished,
      lockedByOrders: activeOrders > 0,
    });
  }

  async function handleQuickSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await saveQuickService({
      id: quickDialog.serviceId,
      title: quickDialog.title,
      slug: quickDialog.slug || undefined,
      category: quickDialog.category,
      description: quickDialog.description,
      basePriceRub: quickDialog.basePriceRub,
      isActive: quickDialog.isActive,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error ?? null);
      toast({
        title: result.error ?? t("actionFailed"),
        variant: "destructive",
      });
      return;
    }

    toast({ title: t("serviceSaved") });
    setQuickDialog(INITIAL_DIALOG_STATE);
    router.refresh();
  }

  async function handleToggleActive(service: AdminServiceRow) {
    setPending(true);
    setError(null);
    const current = service.isActive ?? service.isPublished;
    const result = await toggleServiceActive({
      serviceId: service.id,
      isActive: !current,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? null);
      toast({
        title: result.error ?? t("actionFailed"),
        variant: "destructive",
      });
      return;
    }
    router.refresh();
  }

  async function runBulk(action: "publish" | "unpublish" | "delete") {
    setPending(true);
    setError(null);
    const result = await bulkUpdateServices(selected, action);
    setPending(false);
    setBulkDeleteOpen(false);
    if (!result.ok) {
      setError(result.error ?? null);
      toast({
        title: result.error ?? t("actionFailed"),
        variant: "destructive",
      });
      return;
    }
    setSelected([]);
    router.refresh();
  }

  async function runDelete() {
    if (!deleteTarget) return;
    setPending(true);
    setError(null);
    const result = await deleteService(deleteTarget.id);
    setPending(false);
    setDeleteTarget(null);
    if (!result.ok) {
      setError(result.error ?? null);
      toast({
        title: result.error ?? t("actionFailed"),
        variant: "destructive",
      });
      return;
    }
    setSelected((items) => items.filter((id) => id !== deleteTarget.id));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchTitleOrSlug")}
              className="pl-9"
            />
          </div>
          <select
            aria-label={t("category")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">{t("allCategories")}</option>
            <option value="small">{t("form.smallDesign")}</option>
            <option value="large">{t("form.largeDesign")}</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={openQuickCreate}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            {t("quickCreateService")}
          </Button>
          <Button asChild>
            <Link href="/admin/services/new">
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              {t("createService")}
            </Link>
          </Button>
        </div>
      </div>

      {selected.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/60 px-4 py-2.5 text-sm">
          <span className="font-medium">
            {t("selectedCount", { count: selected.length })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => runBulk("publish")}
          >
            {t("publish")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => runBulk("unpublish")}
          >
            {t("unpublish")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => setBulkDeleteOpen(true)}
          >
            {tc("delete")}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label={t("selectVisibleServices")}
                  checked={allSelected}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? filtered.map((s) => s.id) : []
                    )
                  }
                />
              </TableHead>
              <TableHead>{t("service")}</TableHead>
              <TableHead>{t("category")}</TableHead>
              <TableHead>{t("price")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("updated")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((service) => {
              const isActive = service.isActive ?? service.isPublished;
              const activeOrders = service.activeOrderCount ?? 0;
              const lockedByOrders = activeOrders > 0;

              return (
                <TableRow key={service.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={t("selectItem", { title: service.title })}
                      checked={selected.includes(service.id)}
                      onChange={(e) =>
                        setSelected((items) =>
                          e.target.checked
                            ? [...items, service.id]
                            : items.filter((id) => id !== service.id)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {service.coverImage ? (
                        <Image
                          src={service.coverImage}
                          alt=""
                          width={44}
                          height={44}
                          unoptimized
                          className="h-11 w-11 rounded-md border border-border object-contain bg-muted/50 p-0.5"
                        />
                      ) : null}
                      <div>
                        <p className="font-medium text-foreground">
                          {service.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>/{service.slug}</span>
                          {lockedByOrders ? (
                            <span className="inline-flex items-center gap-1 rounded border border-amber-500/35 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-200">
                              <Lock aria-hidden="true" className="h-3 w-3" />
                              {t("activeOrdersBadge", { count: activeOrders })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        service.category === "small" ? "default" : "secondary"
                      }
                    >
                      {service.category === "small"
                        ? t("form.smallDesign")
                        : t("form.largeDesign")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {lockedByOrders ? (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums text-foreground">
                          <Lock
                            aria-hidden="true"
                            className="h-3.5 w-3.5 text-amber-200"
                          />
                          {formatKopecks(
                            service.basePrice,
                            service.currency || "RUB"
                          )}
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          {t("lockedByActiveOrders")}
                        </p>
                      </div>
                    ) : (
                      <InlinePriceEditor
                        serviceId={service.id}
                        serviceTitle={service.title}
                        basePrice={service.basePrice}
                        emptyLabel={t("noPrice")}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      disabled={pending}
                      title={t("toggleActive")}
                      onClick={() => handleToggleActive(service)}
                      className="inline-flex"
                    >
                      <Badge variant={isActive ? "default" : "outline"}>
                        {isActive ? t("active") : t("inactive")}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(service.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`${t("quickEditService")} ${service.title}`}
                        title={t("quickEditService")}
                        onClick={() => openQuickEdit(service)}
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </Button>
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        aria-label={`${t("fullEditor")} ${service.title}`}
                        title={t("fullEditor")}
                      >
                        <Link href={`/admin/services/${service.id}`}>
                          <ExternalLink
                            aria-hidden="true"
                            className="h-4 w-4"
                          />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("deleteItem", { label: service.title })}
                        title={
                          lockedByOrders
                            ? t("lockedByActiveOrders")
                            : tc("delete")
                        }
                        disabled={lockedByOrders || pending}
                        onClick={() => setDeleteTarget(service)}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!filtered.length ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-muted-foreground"
                >
                  {t("noServicesMatch")}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={quickDialog.open}
        onOpenChange={(open) =>
          setQuickDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {quickDialog.serviceId
                ? t("quickEditService")
                : t("quickCreateService")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleQuickSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="quick-service-title">{t("title")}</Label>
              <Input
                id="quick-service-title"
                required
                maxLength={160}
                value={quickDialog.title}
                onChange={(e) =>
                  setQuickDialog((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quick-service-category">{t("category")}</Label>
                <select
                  id="quick-service-category"
                  value={quickDialog.category}
                  onChange={(e) =>
                    setQuickDialog((prev) => ({
                      ...prev,
                      category:
                        e.target.value === "large" ? "large" : "small",
                    }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="small">{t("form.smallDesign")}</option>
                  <option value="large">{t("form.largeDesign")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="quick-service-price">
                  {t("servicePriceRubField")}
                </Label>
                <Input
                  id="quick-service-price"
                  type="number"
                  min={0}
                  step="1"
                  required
                  disabled={quickDialog.lockedByOrders}
                  value={quickDialog.basePriceRub}
                  onChange={(e) =>
                    setQuickDialog((prev) => ({
                      ...prev,
                      basePriceRub: e.target.value,
                    }))
                  }
                />
                {quickDialog.lockedByOrders ? (
                  <p className="text-xs text-amber-200">
                    {t("lockedByActiveOrders")}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-service-slug">{t("slug")}</Label>
              <Input
                id="quick-service-slug"
                placeholder={t("serviceSlugOptional")}
                value={quickDialog.slug}
                onChange={(e) =>
                  setQuickDialog((prev) => ({ ...prev, slug: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-service-desc">{t("description")}</Label>
              <Textarea
                id="quick-service-desc"
                rows={3}
                maxLength={500}
                value={quickDialog.description}
                onChange={(e) =>
                  setQuickDialog((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="quick-service-active"
                checked={quickDialog.isActive}
                onCheckedChange={(checked) =>
                  setQuickDialog((prev) => ({ ...prev, isActive: checked }))
                }
              />
              <Label
                htmlFor="quick-service-active"
                className="cursor-pointer text-sm"
              >
                {t("serviceActiveField")}
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setQuickDialog((prev) => ({ ...prev, open: false }))
                }
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? tc("saving") : tc("save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteThisItem")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirmation", { label: deleteTarget?.title ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleteTarget(null)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={runDelete}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("confirmDeleteServices", { count: selected.length })}
            </DialogTitle>
            <DialogDescription>{t("confirmDelete")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setBulkDeleteOpen(false)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => runBulk("delete")}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
