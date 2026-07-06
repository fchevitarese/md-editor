import { useRef, useMemo } from "react";

interface MinimapProps {
  content: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  onNavigate: (percentage: number) => void;
}

export default function Minimap({ content, scrollTop, scrollHeight, clientHeight, onNavigate }: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Strip formatting for minimap — show plain text with line breaks
  const minimapText = useMemo(() => {
    return content.slice(0, 3000); // limit for performance
  }, [content]);

  // Calculate scale factor so content fits in ~80px wide minimap
  const scale = 0.09;

  // Viewport indicator position
  const viewportRatio = scrollHeight > 0 ? clientHeight / scrollHeight : 1;
  const viewportTop = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
  const viewportHeight = Math.max(viewportRatio * 100, 5);

  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pct = y / rect.height;
    onNavigate(pct);
  };

  return (
    <div
      className="minimap"
      ref={containerRef}
      onClick={handleClick}
      title="Click to navigate"
    >
      <div
        className="minimap-content"
        style={{ fontSize: "16px", transform: `scale(${scale})`, width: `${100 / scale}%` }}
      >
        {minimapText || <span style={{ opacity: 0.3 }}>empty document</span>}
      </div>
      {scrollHeight > 0 && (
        <div
          className="minimap-viewport"
          style={{ top: `${viewportTop}%`, height: `${viewportHeight}%` }}
        />
      )}
    </div>
  );
}
