import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { Tab } from "./types";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
}

export default function TabBar({ tabs, activeTabId, onSwitchTab, onCloseTab }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep active tab visible
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const tab = activeRef.current;
      const margin = 40;
      if (tab.offsetLeft < container.scrollLeft + margin) {
        container.scrollLeft = tab.offsetLeft - margin;
      } else if (tab.offsetLeft + tab.offsetWidth > container.scrollLeft + container.offsetWidth - margin) {
        container.scrollLeft = tab.offsetLeft + tab.offsetWidth - container.offsetWidth + margin;
      }
    }
  }, [activeTabId]);

  if (tabs.length === 0) return null;

  return (
    <div className="tabbar-container">
      <div className="tabbar" ref={scrollRef}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={tab.id === activeTabId ? activeRef : undefined}
            className={`tab-item${tab.id === activeTabId ? " tab-item--active" : ""}`}
            onClick={() => onSwitchTab(tab.id)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                onCloseTab(tab.id);
              }
            }}
            title={tab.filePath ?? tab.fileName}
          >
            <span className="tab-label">
              {tab.fileName}
              {tab.dirty && <span className="tab-dirty"> ●</span>}
            </span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
