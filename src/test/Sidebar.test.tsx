import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar, { type FileNode } from "../Sidebar";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

const dirNode: FileNode = { name: "docs", path: "/app/docs", is_dir: true };
const mdNode: FileNode = { name: "readme.md", path: "/app/readme.md", is_dir: false };
const txtNode: FileNode = { name: "notes.txt", path: "/app/notes.txt", is_dir: false };

const mockRootNodes: FileNode[] = [dirNode, mdNode, txtNode];

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(mockRootNodes);
  });

  it("renders root folder name", async () => {
    render(
      <Sidebar rootPath="/app" activeFile={null} openFiles={[]} onFileClick={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText("APP")).toBeInTheDocument();
    });
  });

  it("renders file nodes from invoke", async () => {
    render(
      <Sidebar rootPath="/app" activeFile={null} openFiles={[]} onFileClick={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText("readme.md")).toBeInTheDocument();
      expect(screen.getByText("notes.txt")).toBeInTheDocument();
      expect(screen.getByText("docs")).toBeInTheDocument();
    });
  });

  it("highlights active file", async () => {
    render(
      <Sidebar
        rootPath="/app"
        activeFile="/app/readme.md"
        openFiles={[]}
        onFileClick={vi.fn()}
      />
    );
    await waitFor(() => {
      const active = screen.getByText("readme.md").closest(".tree-item");
      expect(active).toHaveClass("tree-item--active");
    });
  });

  it("calls onFileClick when a file is clicked", async () => {
    const onFileClick = vi.fn();
    render(
      <Sidebar rootPath="/app" activeFile={null} openFiles={[]} onFileClick={onFileClick} />
    );
    await waitFor(() => {
      expect(screen.getByText("readme.md")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("readme.md"));
    expect(onFileClick).toHaveBeenCalledWith("/app/readme.md");
  });

  it("expands directory and shows children", async () => {
    const childNodes: FileNode[] = [
      { name: "api.md", path: "/app/docs/api.md", is_dir: false },
    ];
    mockInvoke.mockResolvedValueOnce(mockRootNodes); // initial load
    mockInvoke.mockResolvedValueOnce(childNodes); // expand docs

    render(
      <Sidebar rootPath="/app" activeFile={null} openFiles={[]} onFileClick={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText("docs")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("docs"));
    await waitFor(() => {
      expect(screen.getByText("api.md")).toBeInTheDocument();
    });
    expect(mockInvoke).toHaveBeenCalledWith("read_dir", { path: "/app/docs" });
  });

  it("shows loading state initially", () => {
    // Don't resolve the mock yet
    mockInvoke.mockReturnValue(new Promise(() => {}));
    render(
      <Sidebar rootPath="/app" activeFile={null} openFiles={[]} onFileClick={vi.fn()} />
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("reloads when rootPath changes", async () => {
    const { rerender } = render(
      <Sidebar rootPath="/app" activeFile={null} openFiles={[]} onFileClick={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText("APP")).toBeInTheDocument();
    });

    const newNodes: FileNode[] = [
      { name: "other.md", path: "/other/other.md", is_dir: false },
    ];
    mockInvoke.mockResolvedValue(newNodes);

    rerender(
      <Sidebar rootPath="/other" activeFile={null} openFiles={[]} onFileClick={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText("OTHER")).toBeInTheDocument();
      expect(screen.getByText("other.md")).toBeInTheDocument();
    });
    expect(mockInvoke).toHaveBeenCalledWith("read_dir", { path: "/other" });
  });
});
