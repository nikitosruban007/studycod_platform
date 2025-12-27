import React, { Suspense, useMemo } from "react";
import loader from "@monaco-editor/loader";
import { useTranslation } from "react-i18next";

// Налаштовуємо Monaco для використання локальної версії замість CDN
if (typeof window !== "undefined") {
  loader.config({
    paths: {
      // Використовуємо файли з public директорії
      vs: "/monaco-editor/min/vs",
    },
  });
}

// Lazy load Monaco Editor - завантажується тільки коли компонент рендериться
const Editor = React.lazy(() => import("@monaco-editor/react").then((mod) => ({ default: mod.default })));

interface Props {
  language: "JAVA" | "PYTHON";
  value: string;
  onChange?: (code: string) => void;
  readOnly?: boolean;
}

// Мемоізація опцій для Monaco
const createEditorOptions = (readOnly: boolean) => ({
  fontSize: 14,
  fontFamily: "JetBrains Mono, Fira Code, Consolas, Monaco, 'Courier New', monospace",
  minimap: { enabled: false },
  readOnly,
  automaticLayout: true,
  lineNumbers: "on" as const,
  scrollBeyondLastLine: false,
  padding: { top: 16, bottom: 16 },
  wordWrap: "off" as const,
  tabSize: 2,
  insertSpaces: true,
  // Вимкнути зайві сервіси для економії пам'яті
  quickSuggestions: false,
  parameterHints: { enabled: false },
  suggestOnTriggerCharacters: false,
  acceptSuggestionOnEnter: "off" as const,
  tabCompletion: "off" as const,
  wordBasedSuggestions: "off" as const,
  // Вимкнути автоматичні перевірки
  validate: false,
  // Обмежити workers
  workers: 1,
});

export const CodeEditor: React.FC<Props> = React.memo(({ language, value, onChange, readOnly = false }) => {
  const { i18n } = useTranslation();
  const tr = (uk: string, en: string) => (i18n.language?.toLowerCase().startsWith("en") ? en : uk);
  const monacoLang = useMemo(() => (language === "JAVA" ? "java" : "python"), [language]);
  const editorOptions = useMemo(() => createEditorOptions(readOnly), [readOnly]);

  const handleChange = useMemo(
    () => (v: string | undefined) => {
      onChange?.(v ?? "");
    },
    [onChange]
  );

  return (
    <div className="h-full w-full">
      <Suspense
        fallback={
          <div className="h-full w-full flex items-center justify-center bg-bg-code border border-border">
            <div className="text-text-secondary font-mono text-sm">{tr("Завантаження редактора...", "Loading editor...")}</div>
          </div>
        }
      >
        <Editor
          height="100%"
          language={monacoLang}
          theme="vs-dark"
          value={value}
          options={editorOptions}
          onChange={handleChange}
          loading={
            <div className="h-full w-full flex items-center justify-center bg-bg-code border border-border">
              <div className="text-text-secondary font-mono text-sm">{tr("Завантаження редактора...", "Loading editor...")}</div>
            </div>
          }
        />
      </Suspense>
    </div>
  );
});

CodeEditor.displayName = "CodeEditor";
