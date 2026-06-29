"use client";

import { useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { SpotifyNode } from "./extensions/SpotifyNode";
import { VideoNode } from "./extensions/VideoNode";
import { tiptapToMarkdown } from "./toMarkdown";
import Toolbar from "./Toolbar";

/* Minimal markdown → basic HTML for loading existing posts into the editor */
function markdownToHtml(md: string): string {
  return md
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^---$/gm, "<hr>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/<SpotifyEmbed url="([^"]+)" \/>/g, '<div data-spotify="true" data-url="$1"></div>')
    .replace(/<VideoEmbed url="([^"]+)" \/>/g, '<div data-video="true" data-url="$1"></div>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .split(/\n\n+/)
    .map((para) => {
      para = para.trim();
      if (!para) return "";
      if (/^<(h[1-6]|ul|ol|blockquote|hr|div)/.test(para)) return para;
      return `<p>${para.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

interface TiptapEditorProps {
  initialContent?: string;
  onChange: (markdown: string) => void;
}

export default function TiptapEditor({ initialContent = "", onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false, defaultProtocol: "https" }),
      ImageExtension,
      Placeholder.configure({ placeholder: "Start writing…" }),
      CharacterCount,
      SpotifyNode,
      VideoNode,
    ],
    content: markdownToHtml(initialContent),
    editorProps: {
      attributes: {
        style: [
          "min-height:400px",
          "padding:var(--space-6)",
          "font-family:var(--font-sans)",
          "font-size:var(--text-base)",
          "line-height:1.75",
          "color:var(--color-fg)",
          "outline:none",
        ].join(";"),
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(tiptapToMarkdown(ed.getJSON()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    const html = markdownToHtml(initialContent);
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html);
    }
  // We only want to re-sync when initialContent changes externally (load)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, initialContent]);

  const charCount = editor?.storage.characterCount.characters() ?? 0;

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
      }}
    >
      {editor && <Toolbar editor={editor} charCount={charCount} />}
      <EditorContent editor={editor} />
      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: var(--color-muted);
          pointer-events: none;
          float: left;
          height: 0;
        }
        .tiptap h1 { font-size: var(--text-3xl); font-weight: 300; margin: var(--space-6) 0 var(--space-3); }
        .tiptap h2 { font-size: var(--text-2xl); font-weight: 400; margin: var(--space-6) 0 var(--space-3); }
        .tiptap h3 { font-size: var(--text-xl); font-weight: 400; margin: var(--space-5) 0 var(--space-2); }
        .tiptap h4 { font-size: var(--text-lg); font-weight: 500; margin: var(--space-4) 0 var(--space-2); }
        .tiptap blockquote { border-left: 3px solid var(--color-border); padding-left: var(--space-4); margin: var(--space-4) 0; color: var(--color-muted); }
        .tiptap pre { background: #f5f5f5; padding: var(--space-4); border-radius: var(--radius-md); overflow-x: auto; }
        .tiptap code { font-size: 0.9em; background: #f0f0f0; padding: 0.1em 0.3em; border-radius: 2px; }
        .tiptap pre code { background: none; padding: 0; }
        .tiptap a { text-decoration: underline; }
        .tiptap ul, .tiptap ol { padding-left: var(--space-6); }
        .tiptap hr { border: none; border-top: 1px solid var(--color-border); margin: var(--space-6) 0; }
        .tiptap img { max-width: 100%; height: auto; border-radius: var(--radius-md); }
      `}</style>
    </div>
  );
}
