import {
  adminFieldsetClass,
  adminLabelClass,
  adminLabelHintClass,
  adminInputClass,
  adminTextareaClass,
  adminFilledButtonClass,
} from "@/components/admin/ui";
import type { AdminLabels } from "@/components/admin/labels";
import type { StudioProduct } from "@/lib/studio-products";

interface StudioProductFormProps {
  t: AdminLabels;
  action: (formData: FormData) => Promise<void>;
  product?: StudioProduct;
}

/**
 * Форма продукта — одна и та же для создания и правки.
 *
 * Разбита на три смысловых блока: что это за продукт (тексты), откуда брать
 * историю версий (репозиторий), и когда он виден посетителю (публикация).
 */
export function StudioProductForm({ t, action, product }: StudioProductFormProps) {
  const copy = t.studioProduct;

  return (
    <form action={action} className="flex flex-col gap-8">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <fieldset className={adminFieldsetClass}>
        <legend className="mb-4 text-sm font-medium text-on-surface">{copy.title}</legend>

        <label className={adminLabelClass}>
          {copy.title}
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            autoFocus={!product}
            defaultValue={product?.name ?? ""}
            className={adminInputClass}
          />
        </label>

        <label className={adminLabelClass}>
          {copy.slug}
          <input
            name="slug"
            maxLength={80}
            defaultValue={product?.slug ?? ""}
            placeholder="line-launcher"
            className={adminInputClass}
          />
          <span className={adminLabelHintClass}>{copy.slugHint}</span>
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={adminLabelClass}>
            {copy.taglineRu}
            <input name="taglineRu" maxLength={200} defaultValue={product?.taglineRu ?? ""} className={adminInputClass} />
          </label>
          <label className={adminLabelClass}>
            {copy.taglineEn}
            <input name="taglineEn" maxLength={200} defaultValue={product?.taglineEn ?? ""} className={adminInputClass} />
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={adminLabelClass}>
            {copy.summaryRu}
            <textarea name="summaryRu" rows={4} maxLength={600} defaultValue={product?.summaryRu ?? ""} className={adminTextareaClass} />
          </label>
          <label className={adminLabelClass}>
            {copy.summaryEn}
            <textarea name="summaryEn" rows={4} maxLength={600} defaultValue={product?.summaryEn ?? ""} className={adminTextareaClass} />
          </label>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className={adminLabelClass}>
            {copy.version}
            <input name="version" maxLength={40} defaultValue={product?.version ?? ""} placeholder="0.15.4" className={adminInputClass} />
          </label>
          <label className={adminLabelClass}>
            {copy.statusLabel}
            <input name="statusLabel" maxLength={40} defaultValue={product?.statusLabel ?? ""} placeholder="В разработке" className={adminInputClass} />
          </label>
        </div>

        <label className={adminLabelClass}>
          {copy.facts}
          <textarea
            name="facts"
            rows={4}
            className={adminTextareaClass}
            defaultValue={product?.facts.map((fact) => fact.value).join("\n") ?? ""}
            placeholder={"Windows | Linux\nTauri 2.12 | Rust | React 19"}
          />
        </label>
      </fieldset>

      <fieldset className={adminFieldsetClass}>
        <legend className="mb-4 text-sm font-medium text-on-surface">{copy.repoUrl}</legend>

        <label className={adminLabelClass}>
          {copy.repoUrl}
          <input
            name="repoUrl"
            maxLength={300}
            defaultValue={product?.repoUrl ?? ""}
            placeholder="https://github.com/ilya-lavrov68/Line-Launcher"
            className={adminInputClass}
          />
        </label>

        <label className={adminLabelClass}>
          {copy.changelogPath}
          <input name="changelogPath" maxLength={120} defaultValue={product?.changelogPath ?? "CHANGELOG.md"} className={adminInputClass} />
        </label>

        <label className={adminLabelClass}>
          {copy.downloads}
          <textarea
            name="downloads"
            rows={5}
            className={adminTextareaClass}
            defaultValue={product?.downloads
              .map((row) => `${row.platform} | ${row.format} | ${row.url}`)
              .join("\n") ?? ""}
            placeholder={"Windows | .msi | https://github.com/…/app.msi\nWindows | .exe | https://github.com/…/app-setup.exe\nLinux | .AppImage | https://github.com/…/app.AppImage"}
          />
          <span className={adminLabelHintClass}>{copy.downloadsHint}</span>
        </label>

        <label className={adminLabelClass}>
          {copy.pagePath}
          <input name="pagePath" maxLength={200} defaultValue={product?.pagePath ?? ""} placeholder="/line-launcher" className={adminInputClass} />
          <span className={adminLabelHintClass}>{copy.pagePathHint}</span>
        </label>
      </fieldset>

      <fieldset className={adminFieldsetClass}>
        <legend className="mb-4 text-sm font-medium text-on-surface">{copy.published}</legend>

        <label className="flex items-center gap-3 text-sm text-on-surface">
          <input type="checkbox" name="published" defaultChecked={product?.published ?? false} className="size-4" />
          {copy.published}
        </label>

        <label className={adminLabelClass}>
          {copy.sortOrder}
          <input
            type="number"
            name="sortOrder"
            defaultValue={product?.sortOrder ?? 0}
            className={adminInputClass}
          />
        </label>
      </fieldset>

      <div>
        <button type="submit" className={adminFilledButtonClass}>
          {t.table.save}
        </button>
      </div>
    </form>
  );
}
