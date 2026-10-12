"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";

export function ImportSource() {
  const t = useTranslations("admin");
  const [source, setSource] = useState<"vk" | "telegram" | "youtube">("vk");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const importPost = async () => {
    setPending(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/import-source", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source, url }) });
      const data = await response.json();
      setMessage(response.ok ? t("import.parsed", { title: data.title || t("import.parsedFallbackTitle") }) : data.error || t("import.failed"));
    } catch {
      setMessage(t("import.failedCheckUrl"));
    } finally { setPending(false); }
  };

  return <div className="mt-6 rounded-xl border border-dashed border-[#052B42]/25 bg-[#00C56D]/[0.06] p-4"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{t("import.label")}</span>{(["vk", "telegram", "youtube"] as const).map((option) => <button key={option} type="button" onClick={() => setSource(option)} className={`rounded-full px-3 py-1.5 text-xs font-medium uppercase transition-colors duration-200 ease-out ${source === option ? "bg-[#00C56D] text-[#052B42]" : "bg-white text-[#052B42] hover:bg-[#052B42]/[0.05]"}`}>{option === "youtube" ? "YouTube" : option}</button>)}<Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={t("import.placeholder")} className="min-w-[220px] flex-1 bg-white" /><Button type="button" onClick={importPost} disabled={pending || !url.trim()} className="bg-[#052B42] text-white hover:bg-[#0A4366]">{pending ? t("import.parsing") : t("import.action")}</Button></div>{message ? <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p> : null}</div>;
}
