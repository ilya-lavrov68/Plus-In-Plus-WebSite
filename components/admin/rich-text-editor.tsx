"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useTranslations } from "next-intl";

import { CanvaEmbedNode } from "@/components/admin/canva-embed-node";
import { normalizeCanvaEmbedUrl } from "@/lib/canva";

const toolbar = [
  { label: "B", titleKey: "bold", run: (editor: Editor | null) => editor?.chain().focus().toggleBold().run() },
  { label: "I", titleKey: "italic", run: (editor: Editor | null) => editor?.chain().focus().toggleItalic().run() },
  { label: "H2", titleKey: "heading", run: (editor: Editor | null) => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "•", titleKey: "bulletList", run: (editor: Editor | null) => editor?.chain().focus().toggleBulletList().run() },
  { label: "1.", titleKey: "numberedList", run: (editor: Editor | null) => editor?.chain().focus().toggleOrderedList().run() },
];

export interface CanvaInsertion {
  url: string;
  nonce: number;
}

interface RichTextEditorProps {
  name?: string;
  initialValue?: string;
  canvaInsertion?: CanvaInsertion;
}

/** Tiptap editor with a small toolbar and a narrowly defined Canva block node. */
export function RichTextEditor({
  name,
  initialValue = "",
  canvaInsertion,
}: RichTextEditorProps) {
  const t = useTranslations("admin");
  const [html, setHtml] = useState(initialValue);
  const handledInsertion = useRef(0);
  const editor = useEditor({
    extensions: [StarterKit, CanvaEmbedNode],
    content: initialValue,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => setHtml(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (!editor || !canvaInsertion || handledInsertion.current === canvaInsertion.nonce) {
      return;
    }
    handledInsertion.current = canvaInsertion.nonce;
    const src = normalizeCanvaEmbedUrl(canvaInsertion.url);
    if (!src) return;
    editor.chain().focus().insertContent({ type: "canvaEmbed", attrs: { src } }).run();
    setHtml(editor.getHTML());
  }, [canvaInsertion, editor]);

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-2" aria-label={t("editor.toolbar")}>
        {toolbar.map((action) => (
          <button
            key={action.titleKey}
            type="button"
            title={t(`editor.${action.titleKey}`)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => action.run(editor)}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {action.label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="article-content min-h-56 p-4 [&_.ProseMirror]:min-h-48 [&_.ProseMirror]:outline-none" />
      {name ? <input type="hidden" name={name} value={html} readOnly /> : null}
    </div>
  );
}
