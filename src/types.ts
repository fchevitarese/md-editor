export interface Tab {
  id: string;
  filePath: string | null;
  content: string;
  fileName: string;
  dirty: boolean;
}

let counter = 0;
export function nextTabId(): string {
  return `tab-${Date.now()}-${++counter}`;
}

export function makeTab(filePath: string | null, content: string, fileName: string): Tab {
  return {
    id: nextTabId(),
    filePath,
    content,
    fileName,
    dirty: false,
  };
}
