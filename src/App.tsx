import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import Editor from "./Editor";
import Sidebar from "./Sidebar";

interface Session {
  file_path?: string | null;
  dir_path?: string | null;
}

export default function App() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [fileName, setFileName] = useState("Untitled.md");
  const [dirty, setDirty] = useState(false);
  const [dirPath, setDirPath] = useState<string | null>(null);
  const sessionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore session on mount
  useEffect(() => {
    invoke<string | null>("get_opened_file").then((cliFile) => {
      if (cliFile) {
        loadFile(cliFile);
        return;
      }
      invoke<Session>("load_session").then((s) => {
        if (s.dir_path) setDirPath(s.dir_path);
        if (s.file_path) loadFile(s.file_path);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist session (debounced 1s)
  useEffect(() => {
    if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
    sessionSaveTimer.current = setTimeout(() => {
      invoke("save_session", {
        session: { file_path: filePath, dir_path: dirPath },
      });
    }, 1000);
  }, [filePath, dirPath]);

  const loadFile = useCallback(async (path: string) => {
    const text = await invoke<string>("read_file", { path });
    setFilePath(path);
    setContent(text);
    setFileName(path.split("/").pop() ?? path);
    setDirty(false);
  }, []);

  const handleOpenFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (selected && typeof selected === "string") loadFile(selected);
  }, [loadFile]);

  const handleOpenFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") setDirPath(selected);
  }, []);

  const handleSave = useCallback(
    async (markdown: string) => {
      let path = filePath;
      if (!path) {
        const selected = await save({
          filters: [{ name: "Markdown", extensions: ["md"] }],
          defaultPath: "untitled.md",
        });
        if (!selected) return;
        path = selected;
        setFilePath(path);
        setFileName(path.split("/").pop() ?? path);
      }
      await invoke("write_file", { path, content: markdown });
      setDirty(false);
    },
    [filePath]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key === "o") { e.preventDefault(); handleOpenFile(); }
      if (e.ctrlKey && e.shiftKey && e.key === "O") { e.preventDefault(); handleOpenFolder(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleOpenFile, handleOpenFolder]);

  return (
    <div className="app">
      <header className="titlebar">
        <button className="btn-icon" onClick={handleOpenFolder} title="Open Folder (Ctrl+Shift+O)">
          &#128193;
        </button>
        <button className="btn-icon" onClick={handleOpenFile} title="Open File (Ctrl+O)">
          &#128196;
        </button>
        <span className="filename">
          {fileName}
          {dirty && " •"}
        </span>
      </header>
      <div className="app-body">
        {dirPath && (
          <Sidebar rootPath={dirPath} activeFile={filePath} onFileClick={loadFile} />
        )}
        <Editor
          key={filePath ?? "__new__"}
          initialContent={content}
          onSave={handleSave}
          onDirty={() => setDirty(true)}
        />
      </div>
    </div>
  );
}
