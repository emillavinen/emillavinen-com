"use client";

import type { Editor } from "@tiptap/react";

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function ToolBtn({ active, disabled, onClick, title, children }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "var(--space-1) var(--space-2)",
        fontSize: "var(--text-xs)",
        fontFamily: "var(--font-sans)",
        background: active ? "var(--color-fg)" : "transparent",
        color: active ? "var(--color-bg)" : "var(--color-fg)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        minHeight: "28px",
        minWidth: "28px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background var(--transition-fast), color var(--transition-fast)",
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span
      style={{
        width: "1px",
        height: "20px",
        background: "var(--color-border)",
        display: "inline-block",
        margin: "0 var(--space-1)",
      }}
    />
  );
}

interface ToolbarProps {
  editor: Editor;
  charCount: number;
}

export default function Toolbar({ editor, charCount }: ToolbarProps) {
  function addLink() {
    const url = window.prompt("URL:");
    if (!url) return;
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  }

  function addImage() {
    const url = window.prompt("Image URL:");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }

  function addSpotify() {
    const url = window.prompt("Spotify URL or URI:");
    if (!url) return;
    editor.chain().focus().insertSpotify(url).run();
  }

  function addVideo() {
    const url = window.prompt("YouTube or Vimeo URL:");
    if (!url) return;
    editor.chain().focus().insertVideo(url).run();
  }

  const e = editor;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-1)",
        alignItems: "center",
        padding: "var(--space-2) var(--space-3)",
        borderBottom: "1px solid var(--color-border)",
        background: "#fafafa",
      }}
    >
      {/* Text style */}
      <ToolBtn active={e.isActive("bold")} onClick={() => e.chain().focus().toggleBold().run()} title="Bold">B</ToolBtn>
      <ToolBtn active={e.isActive("italic")} onClick={() => e.chain().focus().toggleItalic().run()} title="Italic"><em>I</em></ToolBtn>
      <Divider />
      <ToolBtn active={e.isActive("heading", { level: 1 })} onClick={() => e.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">H1</ToolBtn>
      <ToolBtn active={e.isActive("heading", { level: 2 })} onClick={() => e.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">H2</ToolBtn>
      <ToolBtn active={e.isActive("heading", { level: 3 })} onClick={() => e.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">H3</ToolBtn>
      <ToolBtn active={e.isActive("heading", { level: 4 })} onClick={() => e.chain().focus().toggleHeading({ level: 4 }).run()} title="Heading 4">H4</ToolBtn>
      <Divider />
      {/* Lists */}
      <ToolBtn active={e.isActive("bulletList")} onClick={() => e.chain().focus().toggleBulletList().run()} title="Bullet list">• List</ToolBtn>
      <ToolBtn active={e.isActive("orderedList")} onClick={() => e.chain().focus().toggleOrderedList().run()} title="Ordered list">1. List</ToolBtn>
      <Divider />
      {/* Blocks */}
      <ToolBtn active={e.isActive("blockquote")} onClick={() => e.chain().focus().toggleBlockquote().run()} title="Blockquote">&ldquo;&rdquo;</ToolBtn>
      <ToolBtn active={e.isActive("codeBlock")} onClick={() => e.chain().focus().toggleCodeBlock().run()} title="Code block">{`<>`}</ToolBtn>
      <ToolBtn active={false} onClick={() => e.chain().focus().setHorizontalRule().run()} title="Horizontal rule">—</ToolBtn>
      <Divider />
      {/* Insert */}
      <ToolBtn active={e.isActive("link")} onClick={addLink} title="Link">🔗</ToolBtn>
      <ToolBtn active={false} onClick={addImage} title="Image">🖼</ToolBtn>
      <ToolBtn active={false} onClick={addSpotify} title="Spotify embed">♫</ToolBtn>
      <ToolBtn active={false} onClick={addVideo} title="Video embed">▶</ToolBtn>
      <Divider />
      {/* Undo / Redo */}
      <ToolBtn active={false} disabled={!e.can().undo()} onClick={() => e.chain().focus().undo().run()} title="Undo">↩</ToolBtn>
      <ToolBtn active={false} disabled={!e.can().redo()} onClick={() => e.chain().focus().redo().run()} title="Redo">↪</ToolBtn>

      {/* Character count */}
      <span
        style={{
          marginLeft: "auto",
          fontSize: "var(--text-xs)",
          color: "var(--color-muted)",
          fontFamily: "var(--font-sans)",
        }}
      >
        {charCount.toLocaleString()} chars
      </span>
    </div>
  );
}
