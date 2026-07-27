import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import Editor from "./Editor";
import Sidebar from "./Sidebar";
import TabBar from "./TabBar";
import { makeTab, type Tab } from "./types";

interface Session {
  open_files?: string[] | null;
  active_file?: string | null;
  dir_path?: string | null;
  scroll_positions?: Record<string, number>;
}

interface Preferences {
  font_size: number;
  show_minimap: boolean;
}

const MAX_CLOSED_TABS = 10;

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>(() => [makeTab(null, "", "Untitled.md")]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [dirPath, setDirPath] = useState<string | null>(null);
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
  const [prefs, setPrefs] = useState<Preferences>({ font_size: 16, show_minimap: true });
  const sessionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const osFileOpened = useRef(false);
  // Stack of recently closed tabs for Ctrl+Shift+T (most recent last, capped)
  const closedTabs = useRef<{ tab: Tab; index: number }[]>([]);

  // Ref to avoid stale closures in loadFile without recreating it on every tabs change
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const getActiveTab = useCallback((): Tab => {
    const tab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
    if (!tab) {
      console.error("[md-editor] getActiveTab returned undefined!", {
        tabsLength: tabs.length,
        activeTabId,
        tabs: tabs.map(t => ({ id: t.id, filePath: t.filePath })),
      });
      throw new Error("No active tab — tabs array is empty");
    }
    return tab;
  }, [tabs, activeTabId]);

  const updateTab = useCallback((tabId: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...patch } : t)));
  }, []);

  // Stable identity — uses refs for current tabs/activeTabId, never recalculated
  const loadFile = useCallback(async (path: string) => {
    console.log("[md-editor] loadFile:", path);
    const currentTabs = tabsRef.current;
    const existing = currentTabs.find((t) => t.filePath === path);
    if (existing) {
      console.log("[md-editor] loadFile: file already open, switching to tab", existing.id);
      setActiveTabId(existing.id);
      return;
    }

    try {
      const text = await invoke<string>("read_file", { path });
      console.log("[md-editor] loadFile: read_file OK,", text.length, "chars");
      const fileName = path.split("/").pop() ?? path;
      const newTab = makeTab(path, text, fileName);

      setTabs((prev) => {
        const last = prev[prev.length - 1];
        if (prev.length === 1 && !last.filePath && last.content === "" && !last.dirty) {
          console.log("[md-editor] loadFile: replacing empty untitled tab");
          return [newTab];
        }
        console.log("[md-editor] loadFile: adding tab, total tabs:", prev.length + 1);
        return [...prev, newTab];
      });
      setActiveTabId(newTab.id);
    } catch (err) {
      console.error("[md-editor] loadFile: invoke read_file failed:", err);
    }
  }, []); // stable identity via refs

  const switchTab = useCallback((tabId: string) => {
    console.log("[md-editor] switchTab:", tabId);
    setActiveTabId(tabId);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    const currentTabs = tabsRef.current;
    const currentActiveId = activeTabIdRef.current;
    console.log("[md-editor] closeTab:", tabId, "activeTabId:", currentActiveId, "tabsLength:", currentTabs.length);
    const replacementTab = makeTab(null, "", "Untitled.md");

    const closing = currentTabs.find((t) => t.id === tabId);
    // Don't remember pristine untitled tabs — nothing to restore
    if (closing && (closing.filePath || closing.content !== "" || closing.dirty)) {
      closedTabs.current.push({ tab: closing, index: currentTabs.indexOf(closing) });
      if (closedTabs.current.length > MAX_CLOSED_TABS) closedTabs.current.shift();
    }

    let nextActiveId: string;
    if (currentTabs.length === 1) {
      nextActiveId = replacementTab.id;
    } else if (tabId === currentActiveId) {
      const idx = currentTabs.findIndex((t) => t.id === tabId);
      const filtered = currentTabs.filter((t) => t.id !== tabId);
      const newIdx = Math.min(idx, filtered.length - 1);
      nextActiveId = filtered[newIdx].id;
    } else {
      nextActiveId = currentActiveId;
    }

    setTabs((prev) => {
      if (prev.length === 1) {
        return [replacementTab];
      }
      return prev.filter((t) => t.id !== tabId);
    });
    setActiveTabId(nextActiveId);
  }, []);

  const reopenClosedTab = useCallback(() => {
    const entry = closedTabs.current.pop();
    if (!entry) {
      console.log("[md-editor] reopenClosedTab: nothing to reopen");
      return;
    }
    const { tab, index } = entry;
    console.log("[md-editor] reopenClosedTab:", tab.fileName, "at index", index);

    // Already reopened by other means (e.g. sidebar click) — just focus it
    const existing = tabsRef.current.find((t) => t.filePath && t.filePath === tab.filePath);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    setTabs((prev) => {
      // Replace a lone pristine untitled tab instead of stacking next to it
      const last = prev[prev.length - 1];
      if (prev.length === 1 && !last.filePath && last.content === "" && !last.dirty) {
        return [tab];
      }
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, tab);
      return next;
    });
    setActiveTabId(tab.id);
  }, []);

  const handleContentChange = useCallback((tabId: string, content: string) => {
    updateTab(tabId, { content, dirty: true });
  }, [updateTab]);

  const handleScrollPosition = useCallback((scrollTop: number) => {
    const tab = getActiveTab();
    if (!tab.filePath) return;
    setScrollPositions((prev) => ({ ...prev, [tab.filePath!]: scrollTop }));
    invoke("save_scroll_position", { filePath: tab.filePath, scrollTop });
  }, [getActiveTab]);

  const handlePrefsChange = useCallback((newPrefs: Preferences) => {
    setPrefs(newPrefs);
    invoke("save_preferences", { prefs: newPrefs });
  }, []);

  // Load preferences on mount
  useEffect(() => {
    invoke<Preferences>("load_preferences").then((p) => {
      if (p) setPrefs(p);
    });
  }, []);

  // Listen for file-open events + restore session
  useEffect(() => {
    console.log("[md-editor] session effect mounting...");
    const unlisten = listen<string>("file-open", (event) => {
      console.log("[md-editor] file-open event:", event.payload);
      osFileOpened.current = true;
      loadFile(event.payload);
    });

    invoke<string | null>("get_initial_file_path").then((initialPath) => {
      if (initialPath) {
        console.log("[md-editor] initial file path from CLI:", initialPath);
        osFileOpened.current = true;
        loadFile(initialPath);
      } else {
        console.log("[md-editor] no initial file, loading session...");
        invoke<Session>("load_session").then((s) => {
          console.log("[md-editor] session loaded:", {
            dir_path: s.dir_path,
            open_files_count: s.open_files?.length ?? 0,
            active_file: s.active_file,
          });
          if (s.dir_path) setDirPath(s.dir_path);
          if (s.scroll_positions) setScrollPositions(s.scroll_positions);
          if (s.open_files && s.open_files.length > 0 && !osFileOpened.current) {
            const filesToRestore = s.open_files;
            console.log("[md-editor] restoring", filesToRestore.length, "files...");
            // Load all files in parallel, then set tabs atomically (avoids empty tabs state)
            Promise.all(
              filesToRestore.map(fp =>
                invoke<string>("read_file", { path: fp })
                  .then(text => ({ fp, text }))
                  .catch(() => null)
              )
            ).then((results) => {
              const restoredTabs: Tab[] = [];
              for (const r of results) {
                if (!r) continue;
                const fileName = r.fp.split("/").pop() ?? r.fp;
                restoredTabs.push(makeTab(r.fp, r.text, fileName));
              }
              if (restoredTabs.length > 0) {
                const active = restoredTabs.find(t => t.filePath === s.active_file)
                            ?? restoredTabs[0];
                console.log("[md-editor] session restore: loaded", restoredTabs.length, "tabs, active:", active.fileName);
                setTabs(restoredTabs);
                setActiveTabId(active.id);
              }
            });
          }
        }).catch((err) => {
          console.error("[md-editor] load_session failed:", err);
        });
      }
    }).catch((err) => {
      console.error("[md-editor] get_initial_file_path failed:", err);
    });

    return () => { unlisten.then((fn) => fn()); console.log("[md-editor] session effect unmounting"); };
  }, [loadFile]);

  // Persist session (debounced 1s)
  useEffect(() => {
    if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
    sessionSaveTimer.current = setTimeout(() => {
      const openFiles = tabs.filter((t) => t.filePath).map((t) => t.filePath!);
      const activeFile = getActiveTab().filePath ?? null;
      invoke("save_session", {
        session: {
          open_files: openFiles,
          active_file: activeFile,
          dir_path: dirPath,
          scroll_positions: scrollPositions,
        },
      });
    }, 1000);
  }, [tabs, activeTabId, dirPath, scrollPositions, getActiveTab]);

  // Apply font size CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty("--editor-font-size", `${prefs.font_size}px`);
  }, [prefs.font_size]);

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
      const tab = getActiveTab();
      console.log("[md-editor] handleSave:", tab.fileName, tab.filePath ?? "(new file)");
      let path = tab.filePath;

      if (!path) {
        const selected = await save({
          filters: [{ name: "Markdown", extensions: ["md"] }],
          defaultPath: "untitled.md",
        });
        if (!selected) return;
        path = selected;
        const fileName = path.split("/").pop() ?? path;
        updateTab(tab.id, { filePath: path, fileName });
      }

      try {
        await invoke("write_file", { path, content: markdown });
        console.log("[md-editor] handleSave: write_file OK");
        updateTab(tab.id, { content: markdown, dirty: false });
      } catch (err) {
        console.error("[md-editor] handleSave: write_file failed:", err);
      }
    },
    [getActiveTab, updateTab]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key === "o") { e.preventDefault(); handleOpenFile(); }
      if (e.ctrlKey && e.shiftKey && e.key === "O") { e.preventDefault(); handleOpenFolder(); }
      if (e.ctrlKey && !e.shiftKey && e.key === "w") {
        e.preventDefault();
        closeTab(activeTabIdRef.current);
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "T" || e.key === "t")) {
        e.preventDefault();
        reopenClosedTab();
      }
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        const currentTabs = tabsRef.current;
        const currentActiveId = activeTabIdRef.current;
        const idx = currentTabs.findIndex((t) => t.id === currentActiveId);
        if (e.shiftKey) {
          const prev = idx > 0 ? currentTabs[idx - 1] : currentTabs[currentTabs.length - 1];
          switchTab(prev.id);
        } else {
          const next = idx < currentTabs.length - 1 ? currentTabs[idx + 1] : currentTabs[0];
          switchTab(next.id);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleOpenFile, handleOpenFolder, closeTab, switchTab, reopenClosedTab]);

  const activeTab = getActiveTab();
  console.log("[md-editor] render: tabs", tabs.length, "activeTabId", activeTabId, "activeTab.fileName", activeTab?.fileName);

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
          {activeTab.fileName}
          {activeTab.dirty && " •"}
        </span>
      </header>

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitchTab={switchTab}
        onCloseTab={closeTab}
      />

      <div className="app-body">
        {dirPath && (
          <Sidebar
            rootPath={dirPath}
            activeFile={activeTab.filePath}
            openFiles={tabs.filter((t) => t.filePath).map((t) => t.filePath!)}
            onFileClick={loadFile}
          />
        )}
        <Editor
          filePath={activeTab.filePath}
          initialContent={activeTab.content}
          initialScrollTop={activeTab.filePath ? scrollPositions[activeTab.filePath] : undefined}
          prefs={prefs}
          onPrefsChange={handlePrefsChange}
          onSave={handleSave}
          onContentChange={(content) => handleContentChange(activeTabId, content)}
          onScrollPosition={handleScrollPosition}
        />
      </div>
    </div>
  );
}
