"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ServiceOptionGroupInput } from "@/lib/service-option-config";

export interface ServicePricingInitial {
  basePrice: number;
  priceType: string;
  isOrderable: boolean;
  optionGroups: ServiceOptionGroupInput[];
}

function emptyGroup(): ServiceOptionGroupInput {
  return {
    name: "",
    required: false,
    options: [{ label: "", priceDeltaRub: "0", priceFactor: "1", isDefault: true }],
  };
}

export function ServicePricingFields({ initial }: { initial?: ServicePricingInitial }) {
  const t = useTranslations("admin");
  const id = useId();
  const [basePriceRub, setBasePriceRub] = useState(
    String((initial?.basePrice ?? 0) / 100),
  );
  const [priceType, setPriceType] = useState(
    ["fixed", "from", "quote"].includes(initial?.priceType ?? "")
      ? initial!.priceType
      : "quote",
  );
  const [isOrderable, setIsOrderable] = useState(initial?.isOrderable ?? false);
  const [groups, setGroups] = useState<ServiceOptionGroupInput[]>(
    initial?.optionGroups ?? [],
  );

  function updateGroup(index: number, value: ServiceOptionGroupInput) {
    setGroups((current) => current.map((group, i) => i === index ? value : group));
  }

  return (
    <fieldset className="space-y-5 rounded-xl border border-border p-4 sm:p-5">
      <legend className="px-1 text-base font-semibold">{t("form.pricingTitle")}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-base-price`}>{t("form.basePriceRub")}</Label>
          <Input
            id={`${id}-base-price`}
            name="basePriceRub"
            type="number"
            min="0"
            max="100000000"
            step="0.01"
            required
            value={basePriceRub}
            onChange={(event) => setBasePriceRub(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-price-type`}>{t("priceType")}</Label>
          <input type="hidden" name="priceType" value={priceType} />
          <Select
            value={priceType}
            onValueChange={(next) => {
              setPriceType(next);
              if (next === "quote") setIsOrderable(false);
            }}
          >
            <SelectTrigger id={`${id}-price-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["fixed", "from", "quote"] as const).map((type) => (
                <SelectItem key={type} value={type}>{t(`priceType_${type}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Switch
          id={`${id}-orderable`}
          checked={priceType !== "quote" && isOrderable}
          disabled={priceType === "quote"}
          onCheckedChange={setIsOrderable}
        />
        <div>
          <Label htmlFor={`${id}-orderable`}>{t("form.orderable")}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{t("form.orderableHelp")}</p>
        </div>
        <input
          type="hidden"
          name="isOrderable"
          value={String(priceType !== "quote" && isOrderable)}
        />
      </div>

      <div className="space-y-3 border-t border-border pt-5">
        <div>
          <h3 className="font-medium">{t("form.optionsTitle")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("form.optionsHelp")}</p>
        </div>
        <input type="hidden" name="optionGroups" value={JSON.stringify(groups)} />

        {groups.map((group, groupIndex) => (
          <fieldset key={groupIndex} className="space-y-4 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">
              {t("form.optionGroup", { count: groupIndex + 1 })}
            </legend>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor={`${id}-group-${groupIndex}`}>{t("form.groupName")}</Label>
                <Input
                  id={`${id}-group-${groupIndex}`}
                  maxLength={160}
                  required
                  value={group.name}
                  onChange={(event) => updateGroup(groupIndex, { ...group, name: event.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  id={`${id}-required-${groupIndex}`}
                  checked={group.required}
                  onCheckedChange={(required) => updateGroup(groupIndex, { ...group, required })}
                />
                <Label htmlFor={`${id}-required-${groupIndex}`}>{t("form.requiredGroup")}</Label>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("form.removeGroup")}
                title={t("form.removeGroup")}
                onClick={() => setGroups((current) => current.filter((_, i) => i !== groupIndex))}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {group.options.map((option, optionIndex) => (
                <div key={optionIndex} className="grid gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_auto_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-option-${groupIndex}-${optionIndex}`}>{t("form.optionLabel")}</Label>
                    <Input
                      id={`${id}-option-${groupIndex}-${optionIndex}`}
                      maxLength={160}
                      required
                      value={option.label}
                      onChange={(event) => {
                        const options = group.options.map((item, i) => i === optionIndex ? { ...item, label: event.target.value } : item);
                        updateGroup(groupIndex, { ...group, options });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-delta-${groupIndex}-${optionIndex}`}>{t("form.priceDeltaRub")}</Label>
                    <Input
                      id={`${id}-delta-${groupIndex}-${optionIndex}`}
                      type="number"
                      step="0.01"
                      max="100000000"
                      min="-100000000"
                      required
                      value={option.priceDeltaRub}
                      onChange={(event) => {
                        const options = group.options.map((item, i) => i === optionIndex ? { ...item, priceDeltaRub: event.target.value } : item);
                        updateGroup(groupIndex, { ...group, options });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-factor-${groupIndex}-${optionIndex}`}>{t("form.priceFactor")}</Label>
                    <Input
                      id={`${id}-factor-${groupIndex}-${optionIndex}`}
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="10000"
                      required
                      value={option.priceFactor}
                      onChange={(event) => {
                        const options = group.options.map((item, i) => i === optionIndex ? { ...item, priceFactor: event.target.value } : item);
                        updateGroup(groupIndex, { ...group, options });
                      }}
                    />
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input
                      type="radio"
                      name={`${id}-default-${groupIndex}`}
                      checked={option.isDefault}
                      onChange={() => {
                        const options = group.options.map((item, i) => ({ ...item, isDefault: i === optionIndex }));
                        updateGroup(groupIndex, { ...group, options });
                      }}
                    />
                    {t("form.defaultOption")}
                  </label>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={group.options.length === 1}
                    aria-label={t("form.removeOption")}
                    title={t("form.removeOption")}
                    onClick={() => {
                      const options = group.options.filter((_, i) => i !== optionIndex);
                      if (!options.some((item) => item.isDefault)) options[0].isDefault = true;
                      updateGroup(groupIndex, { ...group, options });
                    }}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => updateGroup(groupIndex, {
                ...group,
                options: [...group.options, { label: "", priceDeltaRub: "0", priceFactor: "1", isDefault: false }],
              })}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {t("form.addOption")}
            </Button>
          </fieldset>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() => setGroups((current) => [...current, emptyGroup()])}
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t("form.addOptionGroup")}
        </Button>
      </div>
    </fieldset>
  );
}
