"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileCode2, FileUp, Plus, Type } from "lucide-react";
import { useTranslations } from "next-intl";

import { LazyRichTextEditor } from "@/components/admin/lazy-rich-text-editor";
import type { CanvaInsertion } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeCanvaEmbedUrl } from "@/lib/canva";
import {
  insertMarkdownBlockAtCursor,
  isMarkdownPostContent,
  markdownSource,
  MAX_POST_SOURCE_LENGTH,
  normalizeMarkdownSource,
} from "@/lib/post-content-format";

type ContentMode = "rich" | "markdown";

export function PostContentEditor({ initialContent = "" }: { initialContent?: string }) {
  const t = useTranslations("admin");
  const startsAsMarkdown = isMarkdownPostContent(initialContent);
  const [mode, setMode] = useState<ContentMode>(startsAsMarkdown ? "markdown" : "rich");
  const [markdown, setMarkdown] = useState(
    startsAsMarkdown ? markdownSource(initialContent) : "",
  );
  const [canvaUrl, setCanvaUrl] = useState("");
  const [canvaInsertion, setCanvaInsertion] = useState<CanvaInsertion>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const insertionNonce = useRef(0);

  const importMarkdown = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    if (!/\.(?:md|markdown)$/i.test(file.name)) {
      setError(t("form.markdownFileType"));
      input.value = "";
      return;
    }
    // UTF encodings use at most four bytes per code point; avoid reading a
    // clearly oversized local file into memory before the exact character check.
    if (file.size > MAX_POST_SOURCE_LENGTH * 4 + 3) {
      setError(t("form.markdownTooLong"));
      input.value = "";
      return;
    }

    setReading(true);
    try {
      const source = normalizeMarkdownSource(await file.text());
      if (source.length > MAX_POST_SOURCE_LENGTH) {
        setError(t("form.markdownTooLong"));
        return;
      }
      // Only the Markdown draft changes. An inactive rich-text draft is kept.
      setMarkdown(source);
      setMode("markdown");
      setNotice(t("form.markdownImported", { name: file.name }));
    } catch {
      setError(t("form.markdownReadFailed"));
    } finally {
      setReading(false);
      input.value = "";
    }
  };

  const insertCanva = () => {
    const src = normalizeCanvaEmbedUrl(canvaUrl);
    if (!src) {
      setError(t("form.canvaInvalid"));
      return;
    }

    setError(null);
    setNotice(null);
    if (mode === "rich") {
      insertionNonce.current += 1;
      setCanvaInsertion({ url: src, nonce: insertionNonce.current });
    } else {
      const textarea = textareaRef.current;
      const result = insertMarkdownBlockAtCursor(
        markdown,
        textarea?.selectionStart ?? markdown.length,
        textarea?.selectionEnd ?? markdown.length,
        `:::canva\n${src}\n:::`,
      );
      if (result.value.length > MAX_POST_SOURCE_LENGTH) {
        setError(t("form.markdownTooLong"));
        return;
      }
      setMarkdown(result.value);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(result.cursor, result.cursor);
      }, 0);
    }
    setCanvaUrl("");
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name="contentFormat" value={mode} readOnly />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor={mode === "markdown" ? "post-content-markdown" : undefined}>
          {t("form.contentLabel")}
        </Label>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("form.contentMode")}>
          <Button
            type="button"
            size="sm"
            variant={mode === "rich" ? "default" : "outline"}
            aria-pressed={mode === "rich"}
            onClick={() => {
              setMode("rich");
              setError(null);
              setNotice(null);
            }}
          >
            <Type aria-hidden="true" className="size-4" />
            {t("form.richMode")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "markdown" ? "default" : "outline"}
            aria-pressed={mode === "markdown"}
            onClick={() => {
              setMode("markdown");
              setError(null);
              setNotice(null);
            }}
          >
            <FileCode2 aria-hidden="true" className="size-4" />
            {t("form.markdownMode")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown"
          className="sr-only"
          aria-label={t("form.importMarkdown")}
          onChange={importMarkdown}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={reading}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp aria-hidden="true" className="size-4" />
          {reading ? t("form.readingMarkdown") : t("form.importMarkdown")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("form.markdownFileHelp")}</span>
      </div>

      <div hidden={mode !== "rich"}>
        <LazyRichTextEditor
          name={mode === "rich" ? "content" : undefined}
          initialValue={startsAsMarkdown ? "" : initialContent}
          canvaInsertion={canvaInsertion}
        />
      </div>
      <div hidden={mode !== "markdown"}>
        <Textarea
          ref={textareaRef}
          id="post-content-markdown"
          name={mode === "markdown" ? "content" : undefined}
          value={markdown}
          rows={18}
          maxLength={MAX_POST_SOURCE_LENGTH}
          spellCheck={false}
          className="min-h-72 resize-y font-mono text-sm leading-6"
          onChange={(event) => {
            setMarkdown(event.target.value);
            setNotice(null);
          }}
          aria-describedby="post-content-help"
        />
      </div>
      <p id="post-content-help" className="text-xs text-muted-foreground">
        {mode === "markdown" ? t("form.markdownHelp") : t("form.contentHelp")}
      </p>

      <div className="space-y-3 rounded-lg bg-muted/30 p-4">
        <Label htmlFor="post-canva-url">{t("form.canvaLabel")}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="post-canva-url"
            type="text"
            inputMode="url"
            value={canvaUrl}
            placeholder={t("form.canvaPlaceholder")}
            onChange={(event) => {
              setCanvaUrl(event.target.value);
              setError(null);
            }}
            aria-describedby="post-canva-help"
          />
          <Button type="button" variant="secondary" onClick={insertCanva}>
            <Plus aria-hidden="true" className="size-4" />
            {t("form.insertCanva")}
          </Button>
        </div>
        <p id="post-canva-help" className="text-xs text-muted-foreground">
          {t("form.canvaHelp")}
        </p>
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
    </div>
  );
}
