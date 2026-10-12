"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const toolbar = [
  { label: "B", title: "Bold", run: (editor: Editor | null) => editor?.chain().focus().toggleBold().run() },
  { label: "I", title: "Italic", run: (editor: Editor | null) => editor?.chain().focus().toggleItalic().run() },
  { label: "H2", title: "Heading", run: (editor: Editor | null) => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "•", title: "Bullet list", run: (editor: Editor | null) => editor?.chain().focus().toggleBulletList().run() },
  { label: "1.", title: "Numbered list", run: (editor: Editor | null) => editor?.chain().focus().toggleOrderedList().run() },
];

/** Tiptap editor with a deliberately small toolbar; content is sanitised again in the server action. */
export function RichTextEditor({ name, initialValue = "" }: { name: string; initialValue?: string }) {
  const [html, setHtml] = useState(initialValue);
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialValue,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => setHtml(currentEditor.getHTML()),
  });

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-2" aria-label="Formatting toolbar">
        {toolbar.map((action) => (
          <button
            key={action.title}
            type="button"
            title={action.title}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => action.run(editor)}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-body text-sm font-semibold text-[#052B42] transition-colors duration-200 ease-out hover:bg-[#00C56D]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#052B42]"
          >
            {action.label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="article-content min-h-56 p-4 [&_.ProseMirror]:min-h-48 [&_.ProseMirror]:outline-none" />
      <input type="hidden" name={name} value={html} readOnly />
    </div>
  );
}
