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
import { openUrl } from "@tauri-apps/plugin-opener";
import Toolbar, { type ViewMode } from "./Toolbar";
import Minimap from "./Minimap";

marked.use({ gfm: true, breaks: true } as Parameters<typeof marked.use>[0]);

interface Preferences {
  font_size: number;
  show_minimap: boolean;
}

interface EditorProps {
  filePath: string | null;
  initialContent: string;
  initialScrollTop?: number;
  prefs: Preferences;
  onPrefsChange: (prefs: Preferences) => void;
  onSave: (markdown: string) => void;
  onContentChange: (content: string) => void;
  onScrollPosition: (scrollTop: number) => void;
}

export default function Editor({
  filePath,
  initialContent,
  initialScrollTop,
  prefs,
  onPrefsChange,
  onSave,
  onContentChange,
  onScrollPosition,
}: EditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("wysiwyg");
  const [rawMarkdown, setRawMarkdown] = useState(initialContent);
  const [scrollState, setScrollState] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialContentSet = useRef(true);

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
    onUpdate: ({ editor }) => {
      if (!isInitialContentSet.current) {
        onContentChangeRef.current(editor.storage.markdown.getMarkdown());
      }
    },
    onCreate: () => {},
    editorProps: { attributes: { class: "prose-content" } },
  });

  // Switch editor content when file changes (avoids full destroy/recreate)
  useEffect(() => {
    if (!editor) {
      console.warn("[md-editor] Editor: filePath changed but editor is null");
      return;
    }
    console.log("[md-editor] Editor: loading content for", filePath, initialContent.length, "chars");
    isInitialContentSet.current = true;
    setRawMarkdown(initialContent);
    try {
      editor.commands.setContent(initialContent);
    } catch (err) {
      console.error("[md-editor] Editor: setContent failed:", err);
    }
    queueMicrotask(() => {
      isInitialContentSet.current = false;
    });
  }, [filePath, editor]);

  // Restore scroll position when file changes
  useEffect(() => {
    if (scrollRef.current && initialScrollTop !== undefined && initialScrollTop > 0) {
      scrollRef.current.scrollTop = initialScrollTop;
    }
  }, [filePath, initialScrollTop]);

  // Track and debounce scroll position
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const st = scrollRef.current.scrollTop;
    const sh = scrollRef.current.scrollHeight;
    const ch = scrollRef.current.clientHeight;
    setScrollState({ scrollTop: st, scrollHeight: sh, clientHeight: ch });
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      onScrollPosition(st);
    }, 500);
  }, [onScrollPosition]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    if (mode === viewMode) return;
    if (viewMode === "wysiwyg" && editor) {
      setRawMarkdown(editor.storage.markdown.getMarkdown());
    } else if (mode === "wysiwyg" && editor) {
      editor.commands.setContent(rawMarkdown);
    }
    setViewMode(mode);
  }, [viewMode, editor, rawMarkdown]);

  const handlePrint = useCallback(() => { window.print(); }, []);

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

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") { e.preventDefault(); onPrefsChange({ ...prefs, font_size: Math.min(prefs.font_size + 1, 32) }); }
        if (e.key === "-") { e.preventDefault(); onPrefsChange({ ...prefs, font_size: Math.max(prefs.font_size - 1, 10) }); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [prefs, onPrefsChange]);

  const renderedHtml = marked(rawMarkdown) as string;

  const handleLinkClick = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    // Only handle external links (http/https/mailto). Leave relative/anchor links alone.
    if (!/^(https?:|mailto:)/i.test(href)) return;
    e.preventDefault();
    try {
      await openUrl(href);
    } catch (err) {
      console.error("Failed to open link:", err);
    }
  }, []);

  const rawText = viewMode === "wysiwyg" && editor
    ? editor.getText()
    : rawMarkdown;

  return (
    <div className="editor-container">
      <Toolbar
        editor={editor}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onSave={save}
        onPrint={handlePrint}
        prefs={prefs}
        onPrefsChange={onPrefsChange}
      />

      <div className="editor-area">
        {viewMode === "wysiwyg" && (
          <div className="editor-scroll" ref={scrollRef} onScroll={handleScroll} onClickCapture={handleLinkClick}>
            <EditorContent editor={editor} />
          </div>
        )}

        {viewMode === "split" && (
          <div className="editor-split">
            <div className="split-pane split-raw">
              <textarea
                className="raw-textarea"
                value={rawMarkdown}
                onChange={(e) => { setRawMarkdown(e.target.value); onContentChange(e.target.value); }}
                spellCheck={false}
              />
            </div>
            <div className="split-divider" />
            <div className="split-pane split-preview" ref={scrollRef} onScroll={handleScroll}>
              <div className="preview-content"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
                onClickCapture={handleLinkClick} />
            </div>
          </div>
        )}

        {viewMode === "preview" && (
          <div className="editor-scroll" ref={scrollRef} onScroll={handleScroll}>
            <div className="preview-content"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
              onClickCapture={handleLinkClick} />
          </div>
        )}

        {prefs.show_minimap && (
          <Minimap
            content={rawText}
            scrollTop={scrollState.scrollTop}
            scrollHeight={scrollState.scrollHeight}
            clientHeight={scrollState.clientHeight}
            onNavigate={(pct: number) => {
              if (scrollRef.current) {
                const target = pct * (scrollRef.current.scrollHeight - scrollRef.current.clientHeight);
                scrollRef.current.scrollTop = target;
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
