import type React from "react";
import {
  Bold, Italic, Strikethrough, Code, Code2,
  Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks,
  Quote, Link2, Minus,
  Undo2, Redo2, Save, Printer,
  PanelLeft, Eye, AlignLeft,
} from "lucide-react";
import type { Editor } from "@tiptap/react";

export type ViewMode = "wysiwyg" | "split" | "preview";

interface ToolbarProps {
  editor: Editor | null;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSave: () => void;
  onPrint: () => void;
}

function Sep() {
  return <span className="sep" />;
}

function Btn({
  onClick, active = false, disabled = false, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`toolbar-btn${active ? " active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export default function Toolbar({ editor, viewMode, onViewModeChange, onSave, onPrint }: ToolbarProps) {
  const wysiwyg = viewMode === "wysiwyg";
  const sz = 15;

  const addLink = () => {
    if (!editor) return;
    const url = window.prompt("URL:");
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="toolbar">
      {/* Formatting — only active in WYSIWYG */}
      <Btn onClick={() => editor?.chain().focus().toggleBold().run()} active={wysiwyg && !!editor?.isActive("bold")} disabled={!wysiwyg} title="Bold (Ctrl+B)">
        <Bold size={sz} />
      </Btn>
      <Btn onClick={() => editor?.chain().focus().toggleItalic().run()} active={wysiwyg && !!editor?.isActive("italic")} disabled={!wysiwyg} title="Italic (Ctrl+I)">
        <Italic size={sz} />
      </Btn>
      <Btn onClick={() => editor?.chain().focus().toggleStrike().run()} active={wysiwyg && !!editor?.isActive("strike")} disabled={!wysiwyg} title="Strikethrough">
        <Strikethrough size={sz} />
      </Btn>
      <Btn onClick={() => editor?.chain().focus().toggleCode().run()} active={wysiwyg && !!editor?.isActive("code")} disabled={!wysiwyg} title="Inline code">
        <Code size={sz} />
      </Btn>

      <Sep />

      <Btn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={wysiwyg && !!editor?.isActive("heading", { level: 1 })} disabled={!wysiwyg} title="Heading 1">
        <Heading1 size={sz} />
      </Btn>
      <Btn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={wysiwyg && !!editor?.isActive("heading", { level: 2 })} disabled={!wysiwyg} title="Heading 2">
        <Heading2 size={sz} />
      </Btn>
      <Btn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={wysiwyg && !!editor?.isActive("heading", { level: 3 })} disabled={!wysiwyg} title="Heading 3">
        <Heading3 size={sz} />
      </Btn>

      <Sep />

      <Btn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={wysiwyg && !!editor?.isActive("bulletList")} disabled={!wysiwyg} title="Bullet list">
        <List size={sz} />
      </Btn>
      <Btn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={wysiwyg && !!editor?.isActive("orderedList")} disabled={!wysiwyg} title="Ordered list">
        <ListOrdered size={sz} />
      </Btn>
      <Btn onClick={() => editor?.chain().focus().toggleTaskList().run()} active={wysiwyg && !!editor?.isActive("taskList")} disabled={!wysiwyg} title="Task list">
        <ListChecks size={sz} />
      </Btn>

      <Sep />

      <Btn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={wysiwyg && !!editor?.isActive("blockquote")} disabled={!wysiwyg} title="Blockquote">
        <Quote size={sz} />
      </Btn>
      <Btn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={wysiwyg && !!editor?.isActive("codeBlock")} disabled={!wysiwyg} title="Code block">
        <Code2 size={sz} />
      </Btn>
      <Btn onClick={addLink} active={wysiwyg && !!editor?.isActive("link")} disabled={!wysiwyg} title="Add link">
        <Link2 size={sz} />
      </Btn>
      <Btn onClick={() => editor?.chain().focus().setHorizontalRule().run()} disabled={!wysiwyg} title="Horizontal rule">
        <Minus size={sz} />
      </Btn>

      <Sep />

      <Btn onClick={() => editor?.chain().focus().undo().run()} disabled={!wysiwyg || !editor?.can().undo()} title="Undo (Ctrl+Z)">
        <Undo2 size={sz} />
      </Btn>
      <Btn onClick={() => editor?.chain().focus().redo().run()} disabled={!wysiwyg || !editor?.can().redo()} title="Redo (Ctrl+Y)">
        <Redo2 size={sz} />
      </Btn>

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* View mode */}
      <Btn onClick={() => onViewModeChange("wysiwyg")} active={viewMode === "wysiwyg"} title="WYSIWYG">
        <AlignLeft size={sz} />
      </Btn>
      <Btn onClick={() => onViewModeChange("split")} active={viewMode === "split"} title="Split view">
        <PanelLeft size={sz} />
      </Btn>
      <Btn onClick={() => onViewModeChange("preview")} active={viewMode === "preview"} title="Preview">
        <Eye size={sz} />
      </Btn>

      <Sep />

      <Btn onClick={onSave} title="Save (Ctrl+S)">
        <Save size={sz} />
      </Btn>
      <Btn onClick={onPrint} title="Export PDF">
        <Printer size={sz} />
      </Btn>
    </div>
  );
}
