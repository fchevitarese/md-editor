import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useState, useEffect, useCallback, useRef } from "react";
import { marked } from "marked";
import Toolbar, { type ViewMode } from "./Toolbar";

marked.use({ gfm: true, breaks: true } as Parameters<typeof marked.use>[0]);

interface EditorProps {
  initialContent: string;
  onSave: (markdown: string) => void;
  onDirty: () => void;
}

export default function Editor({ initialContent, onSave, onDirty }: EditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("wysiwyg");
  const [rawMarkdown, setRawMarkdown] = useState(initialContent);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const onDirtyRef = useRef(onDirty);
  onDirtyRef.current = onDirty;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({ html: false, transformCopiedText: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent,
    onUpdate: () => { onDirtyRef.current(); },
    editorProps: { attributes: { class: "prose-content" } },
  });

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    if (mode === viewMode) return;
    if (viewMode === "wysiwyg" && editor) {
      setRawMarkdown(editor.storage.markdown.getMarkdown());
    } else if (mode === "wysiwyg" && editor) {
      editor.commands.setContent(rawMarkdown);
    }
    setViewMode(mode);
  }, [viewMode, editor, rawMarkdown]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const save = useCallback(() => {
    if (viewMode === "wysiwyg" && editor) {
      onSave(editor.storage.markdown.getMarkdown());
    } else {
      onSave(rawMarkdown);
    }
  }, [viewMode, editor, rawMarkdown, onSave]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  const renderedHtml = marked(rawMarkdown) as string;

  return (
    <div className="editor-container">
      <Toolbar
        editor={editor}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onSave={save}
        onPrint={handlePrint}
      />

      {viewMode === "wysiwyg" && (
        <div className="editor-scroll">
          <EditorContent editor={editor} />
        </div>
      )}

      {viewMode === "split" && (
        <div className="editor-split">
          <div className="split-pane split-raw">
            <textarea
              className="raw-textarea"
              value={rawMarkdown}
              onChange={(e) => { setRawMarkdown(e.target.value); onDirty(); }}
              spellCheck={false}
            />
          </div>
          <div className="split-divider" />
          <div className="split-pane split-preview">
            <div className="preview-content prose-content"
              dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          </div>
        </div>
      )}

      {viewMode === "preview" && (
        <div className="editor-scroll">
          <div className="preview-content prose-content"
            dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        </div>
      )}
    </div>
  );
}
