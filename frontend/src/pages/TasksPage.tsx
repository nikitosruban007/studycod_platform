import React, { useEffect, useState, useCallback } from "react";
import { listTasks, generateTask, saveDraft, submitTask, resetTopic, runTask } from "../lib/api/tasks";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { CodeEditor } from "../components/CodeEditor";
import { MarkdownView } from "../components/MarkdownView";
import type { Task, User } from "../types";
import { Play, CheckCircle2, ChevronLeft, ChevronRight, Plus, Save, PlayCircle } from "lucide-react";

interface Props {
  user: User;
}

type BlockState =
  | null
  | {
      mode: "low" | "weak";
      topicId: number;
      topicTitle: string;
      average: number;
      message: string;
    };

type UIState = "idle" | "evaluating" | "success" | "error" | "logic-warning";

export const TasksPage: React.FC<Props> = ({ user }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [active, setActive] = useState<Task | null>(null);
  const [code, setCode] = useState("");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [blockState, setBlockState] = useState<BlockState>(null);
  const [aiResult, setAiResult] = useState<{
    total: number;
    workScore: number;
    optimizationScore: number;
    integrityScore: number;
    aiFeedback: string;
    comparisonFeedback?: string | null;
    previousGrade?: number | null;
  } | null>(null);
  const [theoryAcknowledged, setTheoryAcknowledged] = useState(false);
  const [showTaskHistory, setShowTaskHistory] = useState(false);
  const [uiState, setUIState] = useState<UIState>("idle");
  const [milestone, setMilestone] = useState<{
    type: string;
    message: string;
    previousAverage?: number;
    currentAverage?: number;
  } | null>(null);

  const reloadTasks = useCallback(async (selectLast = false) => {
    const data = await listTasks();
    const filtered = data.filter((t) => true);
    setTasks(filtered);
    const currentActiveId = active?.id;
    const currentAiResult = aiResult;
    if (selectLast && filtered.length) {
      const latest = filtered[0];
      setActive(latest);
      // Завжди показуємо starterCode для нового завдання
      setCode(latest.starterCode);
      setAiResult(null);
      setConsoleOutput("");
    } else if (active) {
      // Оновлюємо тільки якщо є активне завдання
      const updated = filtered.find((t) => t.id === active.id);
      if (updated) {
        setActive(updated);
        // Оновлюємо код тільки якщо немає aiResult з оцінкою < 6 (користувач виправляє помилку)
        if (!currentAiResult || currentAiResult.total >= 6) {
          // Завжди показуємо starterCode, якщо немає draftCode
          if (updated.userCode && updated.userCode.trim() && updated.status !== "GRADED") {
            setCode(updated.userCode);
          } else {
            setCode(updated.starterCode);
          }
        }
      } else {
        // Якщо активне завдання не знайдено в списку, скидаємо його
        setActive(null);
        setCode("");
        setAiResult(null);
      }
    }
    // НЕ встановлюємо active автоматично, якщо його немає
  }, [active?.id, aiResult?.total]); // Використовуємо тільки ID та total, щоб уникнути зайвих викликів

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await listTasks();
        if (mounted) {
          setTasks(data.filter((t) => true));
        }
      } catch {
        // Ignore
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []); // Завантажуємо тільки один раз при монтуванні

  useEffect(() => {
    if (active) {
      const content = active.descriptionMarkdown || "";
      const hasTheory = content.includes("### Практика") && !content.trim().startsWith("### Практичне завдання");
      setTheoryAcknowledged(!hasTheory);
    } else {
      setTheoryAcknowledged(false);
    }
  }, [active?.id]);

  // Автозбереження кожні 30 секунд
  useEffect(() => {
    if (!active || !theoryAcknowledged || code.trim() === "") return;
    // Перевіряємо canEdit безпосередньо в interval
    const isEditable = active.status !== "GRADED" || (aiResult && aiResult.total < 6);
    if (!isEditable) return;
    
    const interval = setInterval(() => {
      if (active && code.trim() !== "" && (active.status !== "GRADED" || (aiResult && aiResult.total < 6))) {
        saveDraft(active.id, code).catch(() => undefined);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [active, code, theoryAcknowledged, aiResult]);

  const handleGenerate = async () => {
    setLoading(true);
    setAiResult(null);
    setConsoleOutput("");
    setUIState("idle");
    try {
      const res = await generateTask();
      if (res.status === "ok") {
        const newTasks = await listTasks();
        setTasks(newTasks.filter((t) => true));
        if (newTasks.length > 0) {
          const latest = newTasks[0];
          setActive(latest);
          setCode(latest.starterCode);
          setAiResult(null);
          setConsoleOutput("");
        }
      } else if (res.status === "blocked" || res.status === "warn") {
        setBlockState({
          mode: res.status === "blocked" ? "low" : "weak",
          topicId: res.topicId,
          topicTitle: res.topicTitle,
          average: res.average,
          message: res.message,
        });
        setUIState(res.status === "blocked" ? "logic-warning" : "logic-warning");
      }
    } catch (err: any) {
      setConsoleOutput("Помилка генерації завдання: " + (err?.response?.data?.message ?? String(err)));
      setUIState("error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!active) return;
    setSubmitting(true);
    setUIState("evaluating");
    setConsoleOutput("Оцінювання...");
    try {
      const res = await submitTask(active.id, code);
      let result: {
        total: number;
        workScore: number;
        optimizationScore: number;
        integrityScore: number;
        aiFeedback: string;
        comparisonFeedback: string | null;
        previousGrade: number | null;
      } | null = null;
      
      if (res.grade) {
        const grade = res.grade;
        result = {
          total: Number(grade.total ?? 0),
          workScore: Number(grade.workScore ?? 0),
          optimizationScore: Number(grade.optimizationScore ?? 0),
          integrityScore: Number(grade.integrityScore ?? 0),
          aiFeedback: grade.aiFeedback ?? "",
          comparisonFeedback: grade.comparisonFeedback ?? null,
          previousGrade: grade.previousGrade ?? null,
        };
        const outputText = result.previousGrade
          ? `Завдання відправлено на перевірку. Оцінка: ${result.total} (було ${result.previousGrade})`
          : `Завдання відправлено на перевірку. Оцінка: ${result.total}`;
        setConsoleOutput(outputText);
        setAiResult(result);
        setUIState(result.total >= 9 ? "success" : result.total >= 6 ? "idle" : "error");
        
        // Показати milestone якщо є
        if (res.milestone) {
          setMilestone(res.milestone);
        }
      }
      
      // Оновлюємо список завдань без вибору останнього
      const updatedTasks = await listTasks();
      setTasks(updatedTasks.filter((t) => true));
      
      // Оновлюємо активне завдання якщо воно є
      if (active) {
        const updated = updatedTasks.find((t) => t.id === active.id);
        if (updated) {
          setActive(updated);
        }
      }
      
      // НЕ генеруємо автоматично нове завдання - користувач сам вирішує
    } catch (err: any) {
      console.error("Submit error:", err);
      setConsoleOutput("Помилка відправлення: " + (err?.response?.data?.message ?? String(err)));
      setUIState("error");
    } finally {
      setSubmitting(false);
    }
  };

  // Дозволяємо редагування якщо:
  // 1. Завдання існує і не має статусу GRADED, АБО
  // 2. Є aiResult з оцінкою < 6 (користувач може виправити помилку)
  const canEdit = active && theoryAcknowledged && (active.status !== "GRADED" || (aiResult && aiResult.total < 6));
  
  const handleSaveDraft = async () => {
    if (!active || !code.trim()) return;
    try {
      await saveDraft(active.id, code);
      setConsoleOutput("Чернетку збережено");
    } catch (err: any) {
      setConsoleOutput("Помилка збереження: " + (err?.response?.data?.message ?? String(err)));
    }
  };

  const handleRun = async () => {
    if (!active || !code.trim()) return;
    setUIState("evaluating");
    setConsoleOutput("Запуск...");
    try {
      const res = await runTask(active.id, code);
      setConsoleOutput(res.output || res.stderr || "Вивід відсутній");
      setUIState("idle");
    } catch (err: any) {
      setConsoleOutput("Помилка запуску: " + (err?.response?.data?.message ?? String(err)));
      setUIState("error");
    }
  };

  // Extract practice task text
  const getPracticeText = () => {
    if (!active) return null;
    const content = active.descriptionMarkdown || "";
    
    if (content.trim().startsWith("### Практичне завдання")) {
      return content.replace(/^###\s*Практичне завдання\s*/i, "").trim();
    }
    
    const practiceMatch = content.match(/(?:###\s*)?Практика[\s\S]*$/i);
    if (practiceMatch) {
      return practiceMatch[0].replace(/^###\s*Практика\s*/i, "").trim();
    }
    
    return content.trim() || null;
  };

  return (
    <div className="h-screen flex flex-col bg-bg-base">

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left TaskPane - колапсована, можна відкрити */}
        <div
          className={`bg-bg-surface border-r border-border transition-slow ease-in-out flex flex-col ${
            showTaskHistory ? "w-[280px]" : "w-12"
          }`}
        >
          <div className="flex items-center justify-between p-3 border-b border-border">
            {showTaskHistory && (
              <h2 className="text-sm font-mono text-text-primary">Завдання</h2>
            )}
            <button
              onClick={() => setShowTaskHistory(!showTaskHistory)}
              className="w-6 h-6 border border-border flex items-center justify-center hover:bg-bg-hover transition-fast ml-auto"
            >
              {showTaskHistory ? (
                <ChevronLeft className="w-3 h-3 text-text-secondary" />
              ) : (
                <ChevronRight className="w-3 h-3 text-text-secondary" />
              )}
            </button>
          </div>
          {showTaskHistory && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {tasks.length === 0 && (
                  <div className="text-xs text-text-muted font-mono">
                    Немає завдань
        </div>
                )}
        {tasks.map((t) => (
          <Card
            key={t.id}
                    className={`p-3 cursor-pointer border transition-fast ${
                      active?.id === t.id
                        ? "border-primary bg-bg-hover"
                        : "border-border hover:border-primary/50"
            }`}
                    onClick={() => {
                      setActive(t);
                      // Завжди показуємо starterCode, якщо немає draftCode
                      if (t.userCode && t.userCode.trim() && t.status !== "GRADED") {
                        setCode(t.userCode);
                      } else {
                        setCode(t.starterCode);
                      }
                      setAiResult(null);
                      setConsoleOutput("");
                      setUIState("idle");
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-xs font-mono text-text-primary truncate flex-1">
                        {t.title}
                      </div>
              <Badge
                color={
                          t.status === "GRADED"
                            ? "success"
                            : t.status === "SUBMITTED"
                            ? "info"
                            : "warn"
                        }
                      >
                        {t.status === "GRADED"
                          ? "✓"
                          : t.status === "SUBMITTED"
                          ? "…"
                          : "○"}
              </Badge>
            </div>
                    <div className="text-[10px] font-mono text-text-muted">
                      {new Date(t.createdAt).toLocaleDateString("uk-UA")}
            </div>
          </Card>
        ))}
              </div>
              {/* Кнопка генерації внизу списку, якщо є відкрите завдання */}
              {active && (
                <div className="p-3 border-t border-border">
                  <Button
                    variant="primary"
                    onClick={handleGenerate}
                    disabled={loading}
                    className="w-full text-sm px-4 py-2 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Згенерувати нове
                  </Button>
                </div>
              )}
            </div>
          )}
      </div>

        {/* Center EditorPane */}
        <div className="flex-1 flex flex-col overflow-hidden">
        {active ? (
          <>
              {/* Task Header */}
              <div className="border-b border-border bg-bg-surface p-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="text-lg font-mono text-text-primary mb-1">{active.title}</h1>
                    <div className="text-xs font-mono text-text-muted">
                      {active.kind === "CONTROL" ? "Контроль знань" : "Тема"} · Difus: {user.difus}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!aiResult ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={handleSaveDraft}
                          disabled={!active || !code.trim() || !theoryAcknowledged}
                          className="text-sm px-4 py-2"
                        >
                          <Save className="w-4 h-4 mr-2" /> Зберегти
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={handleRun}
                          disabled={!active || !code.trim() || !theoryAcknowledged}
                          className="text-sm px-4 py-2"
                        >
                          <PlayCircle className="w-4 h-4 mr-2" /> Запустити
                        </Button>
                        <Button
                          variant="primary"
                          onClick={handleSubmit}
                          disabled={!canEdit || submitting || !theoryAcknowledged || !code.trim()}
                          className="text-sm px-6 py-2"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Перевірити ШІ
                        </Button>
                      </>
                    ) : aiResult.total < 6 ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={handleSaveDraft}
                          disabled={!active || !code.trim()}
                          className="text-sm px-4 py-2"
                        >
                          <Save className="w-4 h-4 mr-2" /> Зберегти
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => {
                            setAiResult(null);
                            setConsoleOutput("");
                            setUIState("idle");
                          }}
                          className="text-sm px-6 py-2"
                        >
                          Виправити помилку
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Practice Task */}
                {theoryAcknowledged && getPracticeText() && (
                  <div className="mt-3 border border-border bg-bg-code overflow-hidden flex flex-col" style={{ maxHeight: "200px" }}>
                    <div className="p-3 border-b border-border flex-shrink-0">
                      <div className="text-xs font-mono text-text-secondary">Практичне завдання</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      <div className="text-sm text-text-primary">
                        <MarkdownView content={getPracticeText()!} />
                      </div>
                    </div>
                  </div>
                )}
                </div>

              {/* Code Editor */}
              <div className="flex-1 overflow-hidden bg-bg-code">
                <CodeEditor
                  language={user.course}
                  value={code}
                  onChange={canEdit ? setCode : undefined}
                  readOnly={!canEdit}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted font-mono text-sm gap-4">
              <div>{tasks.length === 0 ? "Немає завдань" : "Виберіть завдання зі списку"}</div>
            </div>
          )}
        </div>

        {/* Right OutputPane */}
        <div className="w-[400px] border-l border-border bg-bg-surface flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-mono text-text-primary flex items-center gap-2">
                    <Play className="w-4 h-4" /> Консоль
            </div>
                  {aiResult && (
                    <Badge
                      color={
                  aiResult.total >= 10
                    ? "success"
                    : aiResult.total >= 7
                    ? "warn"
                    : aiResult.total >= 4
                    ? "warn"
                    : "error"
                }
              >
                {aiResult.total ?? "—"}
                    </Badge>
                  )}
                </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="font-mono text-xs text-text-primary whitespace-pre-wrap">
                  {consoleOutput || "Натисни «Перевірити ШІ», щоб отримати оцінку."}
            </div>
                  {aiResult && (
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                {aiResult.total !== null && aiResult.total !== undefined && (
                  <>
                    <div className="text-xs font-mono text-text-secondary">
                      Оцінка: <span className={`font-semibold ${
                        aiResult.total >= 10 ? "text-accent-success" :
                        aiResult.total >= 7 ? "text-accent-warn" :
                        aiResult.total >= 4 ? "text-yellow-500" :
                        "text-accent-error"
                      }`}>{aiResult.total}</span>
                      {aiResult.previousGrade !== null && aiResult.previousGrade !== undefined && (
                        <span className="text-text-muted ml-2">(було {aiResult.previousGrade})</span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-text-secondary">
                      Працездатність: <span className="text-text-primary">{aiResult.workScore ?? 0}</span> / 5
                    </div>
                    <div className="text-xs font-mono text-text-secondary">
                      Оптимізація: <span className="text-text-primary">{aiResult.optimizationScore ?? 0}</span> / 4
                    </div>
                    <div className="text-xs font-mono text-text-secondary">
                      Доброчесність: <span className="text-text-primary">{aiResult.integrityScore ?? 0}</span> / 3
                      </div>
                  </>
                )}
                {aiResult.comparisonFeedback && (
                  <div className="mt-3 p-2 border border-primary/30 bg-bg-code">
                    <div className="text-xs font-mono text-primary mb-1">Порівняння з попередньою спробою:</div>
                    <div className="text-xs font-mono text-text-primary whitespace-pre-wrap">
                      {aiResult.comparisonFeedback}
                      </div>
                      </div>
                )}
                      {aiResult.aiFeedback && (
                  <div className="text-xs font-mono text-text-secondary mt-3 whitespace-pre-wrap">
                          {aiResult.aiFeedback}
                        </div>
                      )}
                    </div>
                  )}
            {/* UI State Indicator */}
            {uiState === "evaluating" && (
              <div className="mt-4 text-xs font-mono text-secondary animate-pulse">
                Оцінювання...
              </div>
            )}
            {uiState === "success" && (
              <div className="mt-4 text-xs font-mono text-accent-success">
                ✓ Успішно
              </div>
            )}
            {uiState === "error" && (
              <div className="mt-4 text-xs font-mono text-accent-error">
                ✗ Помилка
                </div>
            )}
            {uiState === "logic-warning" && (
              <div className="mt-4 text-xs font-mono text-accent-logic-warning">
                ⚠ Попередження
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Theory Modal */}
      {(() => {
        if (!active || theoryAcknowledged) return null;
        const content = active.descriptionMarkdown || "";
        const hasTheory = content.includes("### Практика") && !content.trim().startsWith("### Практичне завдання");
        if (!hasTheory) return null;
        
        const theoryText = content.split(/\n\n###\s*Практика/i)[0]?.trim() || content;
        
        return (
          <Modal
            open={true}
            title="Теорія"
            onClose={() => {}}
            closable={false}
            showCloseButton={false}
          >
            <MarkdownView content={theoryText} />
            <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-border">
              <Button variant="primary" onClick={() => setTheoryAcknowledged(true)}>
                Я прочитав(ла) теорію
              </Button>
            </div>
          </Modal>
        );
      })()}

      {/* Block/Warn Modal */}
      <Modal
        open={!!blockState}
        title={
          blockState?.mode === "low"
            ? "Тему потрібно пройти повторно"
            : "Бажано повторити тему"
        }
        description={
          blockState
            ? `Тема: ${blockState.topicTitle}\nСередній бал: ${blockState.average.toFixed(2)}\n\nЩоб рухатись далі, необхідно перепройти тему.`
            : undefined
        }
        onClose={() => {
          setBlockState(null);
          setUIState("idle");
        }}
      >
        {blockState && (
          <div className="flex justify-end mt-2">
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await resetTopic(blockState.topicId);
                  setBlockState(null);
                  setUIState("idle");
                  await reloadTasks(true);
                } catch (err) {
                  console.error(err);
                  setUIState("error");
                }
              }}
            >
              Перепройти тему
            </Button>
          </div>
        )}
      </Modal>

      {/* Milestone Modal */}
      <Modal
        open={!!milestone}
        title="🎯 Ти покращився!"
        description={milestone?.message}
        onClose={async () => {
          if (milestone) {
            try {
              await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/profile/milestone-shown`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${localStorage.getItem("token")}`,
                  "Content-Type": "application/json",
                },
              });
            } catch (err) {
              // Ignore errors
            }
          }
          setMilestone(null);
        }}
      >
        {milestone && (
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/profile/milestone-shown`, {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${localStorage.getItem("token")}`,
                      "Content-Type": "application/json",
                    },
                  });
                } catch (err) {
                  // Ignore errors
                }
                setMilestone(null);
              }}
            >
              Продовжити
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
