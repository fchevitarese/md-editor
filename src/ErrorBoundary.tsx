import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[md-editor] React error boundary caught:", error.message);
    console.error("[md-editor] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: "40px",
          fontFamily: "monospace",
          color: "#e74c3c",
          background: "#1e1e1e",
          height: "100vh",
          overflow: "auto",
        }}>
          <h2 style={{ marginBottom: "16px" }}>md-editor: Crash</h2>
          <pre style={{
            background: "#2d2d2d",
            padding: "16px",
            borderRadius: "8px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {this.state.error.message}
          </pre>
          {this.state.error.stack && (
            <>
              <h3 style={{ margin: "16px 0 8px" }}>Stack:</h3>
              <pre style={{
                background: "#2d2d2d",
                padding: "16px",
                borderRadius: "8px",
                fontSize: "12px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {this.state.error.stack}
              </pre>
            </>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
