import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
}

function fileIcon(name: string): string {
  if (/\.(md|markdown)$/.test(name)) return "📝";
  if (/\.(txt|text)$/.test(name)) return "📄";
  if (/\.(png|jpg|jpeg|gif|svg|webp)$/.test(name)) return "🖼";
  if (/\.(json|yaml|yml|toml)$/.test(name)) return "⚙";
  return "📄";
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  activeFile: string | null;
  openFiles: string[];
  onFileClick: (path: string) => void;
}

function TreeNode({ node, depth, activeFile, openFiles, onFileClick }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileNode[] | null>(null);

  const handleClick = useCallback(async () => {
    if (!node.is_dir) {
      onFileClick(node.path);
      return;
    }
    if (!expanded && children === null) {
      const items = await invoke<FileNode[]>("read_dir", { path: node.path });
      setChildren(items);
    }
    setExpanded((e) => !e);
  }, [node, expanded, children, onFileClick]);

  const isActive = !node.is_dir && activeFile === node.path;
  const isOpen = !node.is_dir && openFiles.includes(node.path);

  return (
    <div>
      <div
        className={`tree-item${isActive ? " tree-item--active" : ""}`}
        style={{ paddingLeft: 6 + depth * 16 }}
        onClick={handleClick}
        title={node.path}
      >
        <span className="tree-chevron">
          {node.is_dir ? (expanded ? "▾" : "▸") : ""}
        </span>
        <span className="tree-file-icon">
          {node.is_dir ? (expanded ? "📂" : "📁") : fileIcon(node.name)}
        </span>
        <span className="tree-label">
          {node.name}
          {isOpen && !isActive && <span className="tree-open-dot" />}
        </span>
      </div>
      {expanded &&
        children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFile={activeFile}
            openFiles={openFiles}
            onFileClick={onFileClick}
          />
        ))}
    </div>
  );
}

interface SidebarProps {
  rootPath: string;
  activeFile: string | null;
  openFiles: string[];
  onFileClick: (path: string) => void;
}

export default function Sidebar({ rootPath, activeFile, openFiles, onFileClick }: SidebarProps) {
  const [nodes, setNodes] = useState<FileNode[] | null>(null);
  const rootName = rootPath.split("/").pop() ?? rootPath;

  useEffect(() => {
    setNodes(null);
    invoke<FileNode[]>("read_dir", { path: rootPath }).then(setNodes);
  }, [rootPath]);

  return (
    <div className="sidebar">
      <div className="sidebar-header" title={rootPath}>
        <span className="sidebar-root-icon">📁</span>
        <span className="sidebar-root-name">{rootName.toUpperCase()}</span>
      </div>
      <div className="sidebar-tree">
        {nodes === null ? (
          <div className="sidebar-loading">Loading…</div>
        ) : nodes.length === 0 ? (
          <div className="sidebar-loading">Empty folder</div>
        ) : (
          nodes.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              activeFile={activeFile}
              openFiles={openFiles}
              onFileClick={onFileClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
