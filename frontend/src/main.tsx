
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./App";

// Error boundary для відлову помилок
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error; errorInfo?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("App error:", error, errorInfo);
    }
    this.setState({ errorInfo: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: "20px", 
          textAlign: "center",
          fontFamily: "monospace",
          color: "#fff",
          backgroundColor: "#1a1a1a",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <h1 style={{ color: "#ef4444", marginBottom: "20px" }}>Помилка завантаження</h1>
          <p style={{ marginBottom: "10px", color: "#fbbf24" }}>{this.state.error?.message || "Невідома помилка"}</p>
          {this.state.error?.stack && (
            <pre style={{ 
              textAlign: "left", 
              fontSize: "12px", 
              color: "#9ca3af",
              maxWidth: "800px",
              overflow: "auto",
              marginBottom: "20px",
              padding: "10px",
              backgroundColor: "#0a0a0a",
              borderRadius: "4px"
            }}>
              {this.state.error.stack}
            </pre>
          )}
          <button
            onClick={() => {
              window.location.reload();
            }}
            style={{
              padding: "10px 20px",
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontFamily: "monospace"
            }}
          >
            Перезавантажити
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found!");
  }

  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  if (import.meta.env.DEV) {
    console.error("Failed to initialize app:", error);
  }
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: monospace; color: #fff; background: #1a1a1a; min-height: 100vh;">
      <h1 style="color: #ef4444;">Критична помилка ініціалізації</h1>
      <p>${error instanceof Error ? error.message : String(error)}</p>
      <pre style="background: #0a0a0a; padding: 10px; border-radius: 4px; overflow: auto;">
        ${error instanceof Error ? error.stack : String(error)}
      </pre>
    </div>
  `;
}
