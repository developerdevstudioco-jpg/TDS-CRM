import React, { ReactNode } from "react";

export class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; info: any }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("ErrorBoundary caught:", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: "monospace", background: "#1a1a1a", color: "#fff", minHeight: "100vh" }}>
          <h1 style={{ color: "#f87171", fontSize: 24, marginBottom: 16 }}>App Error</h1>
          <p style={{ color: "#fca5a5", marginBottom: 16 }}>{this.state.error?.message}</p>
          <pre style={{ background: "#111", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
            {this.state.error?.stack}
          </pre>
          {this.state.info && (
            <pre style={{ background: "#111", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 12, color: "#64748b" }}>
              {this.state.info.componentStack}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "8px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}