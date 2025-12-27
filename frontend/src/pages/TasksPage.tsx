import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  listTasks,
  generateTask,
  saveDraft,
  submitTaskWithMode,
  resetTopic,
  runTask,
} from "../lib/api/tasks";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { CodeEditor } from "../components/CodeEditor";
import { MarkdownView } from "../components/MarkdownView";
import type { Task, User } from "../types";
import { Play, CheckCircle2, ChevronLeft, ChevronRight, Plus, Save, PlayCircle } from "lucide-react";
import { tr } from "../i18n";

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
  const { i18n } = useTranslation();
  const locale = i18n.language === "uk" ? "uk-UA" : "en-US";

  const isCyrillic = (s: string) => /[А-Яа-яІіЇїЄєҐґ]/.test(s);
  const safeServerMessage = (value: unknown) => {
    const msg = typeof value === "string" ? value : String(value ?? "");
    if (i18n.language === "en" && isCyrillic(msg)) return "";
    return msg;
  };

  const computeHasTheory = (content: string) => {
    const trimmed = content.trim();
    // Detect the explicit separator we add in backend for AI tasks.
    // IMPORTANT: support both LF and CRLF line endings.
    const practiceSeparator = /###\s*(Практика|Practice)\b/i;
    const idx = trimmed.search(practiceSeparator);
    if (idx < 0) return false;

    const theoryText = trimmed.slice(0, idx).trim();
    if (!theoryText) return false;

    // If the "theory" part is only a practical header (AI sometimes puts it at the top), treat as no theory.
    const practicalHeaderOnly = /^###\s*(Практичне завдання|Practical task)\b/i;
    const rest = theoryText.replace(practicalHeaderOnly, "").trim();
    return rest.length > 0;
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [active, setActive] = useState<Task | null>(null);
  const [code, setCode] = useState("");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [stdin, setStdin] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [judgeMode, setJudgeMode] = useState<"TESTS" | "AI">("TESTS");
  const [blockState, setBlockState] = useState<BlockState>(null);
  const [aiResult, setAiResult] = useState<{
    gradingMode?: "TESTS" | "AI";
    total: number;
    workScore: number;
    optimizationScore: number;
    integrityScore: number;
    aiFeedback: string;
    comparisonFeedback?: string | null;
    previousGrade?: number | null;
    testsPassed?: number;
    testsTotal?: number;
    testResults?: Array<{
      testId: number;
      input: string;
      expectedOutput: string;
      actualOutput: string;
      passed: boolean;
      error?: string | null;
    }>;
  } | null>(null);
  const [theoryAcknowledged, setTheoryAcknowledged] = useState(false);
  const [showTaskHistory, setShowTaskHistory] = useState(true);
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
      // Встановлюємо theoryAcknowledged на основі наявності теорії
      const content = latest.descriptionMarkdown || "";
      const hasTheory = computeHasTheory(content);
      setTheoryAcknowledged(!hasTheory);
    } else if (active) {
      // Оновлюємо тільки якщо є активне завдання
      const updated = filtered.find((t) => t.id === active.id);
      if (updated) {
        setActive(updated);
        // Оновлюємо код тільки якщо немає aiResult з оцінкою < 6 (користувач виправляє помилку)
        if (!currentAiResult || currentAiResult.total >= 6) {
              // Для GRADED завдань показуємо finalCode, для інших - userCode або starterCode
              if (updated.status === "GRADED" && updated.finalCode) {
                setCode(updated.finalCode);
              } else if (updated.userCode && updated.userCode.trim()) {
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
          const filtered = data.filter((t) => true);
          setTasks(filtered);
          // Автоматично відкриваємо перше завдання, якщо немає активного
          if (filtered.length > 0 && !active) {
            const firstTask = filtered[0];
            setActive(firstTask);
            // Для GRADED завдань показуємо finalCode, для інших - userCode або starterCode
            if (firstTask.status === "GRADED" && firstTask.finalCode) {
              setCode(firstTask.finalCode);
            } else if (firstTask.userCode && firstTask.userCode.trim()) {
              setCode(firstTask.userCode);
            } else {
              setCode(firstTask.starterCode);
            }
            // Встановлюємо theoryAcknowledged на основі наявності теорії
            const content = firstTask.descriptionMarkdown || "";
            const hasTheory = computeHasTheory(content);
            setTheoryAcknowledged(!hasTheory);
          }
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

  // Автоматично відкриваємо завдання після завантаження
  useEffect(() => {
    if (tasks.length > 0 && !active) {
      // Перевіряємо, чи є завдання, яке потрібно відкрити з sessionStorage
      const openTaskId = sessionStorage.getItem("openTaskId");
      let taskToOpen = tasks[0];
      
      if (openTaskId) {
        const taskId = parseInt(openTaskId, 10);
        const foundTask = tasks.find(t => t.id === taskId);
        if (foundTask) {
          taskToOpen = foundTask;
        }
        sessionStorage.removeItem("openTaskId");
      }
      
      setActive(taskToOpen);
      // Для GRADED завдань показуємо finalCode, для інших - userCode або starterCode
      if (taskToOpen.status === "GRADED" && taskToOpen.finalCode) {
        setCode(taskToOpen.finalCode);
      } else if (taskToOpen.userCode && taskToOpen.userCode.trim()) {
        setCode(taskToOpen.userCode);
      } else {
        setCode(taskToOpen.starterCode);
      }
      // Встановлюємо theoryAcknowledged на основі наявності теорії
      const content = taskToOpen.descriptionMarkdown || "";
      const hasTheory = computeHasTheory(content);
      setTheoryAcknowledged(!hasTheory);
    }
  }, [tasks.length, active]);

  useEffect(() => {
    if (active) {
      const content = active.descriptionMarkdown || "";
      const hasTheory = computeHasTheory(content);
      setTheoryAcknowledged(!hasTheory);
    } else {
      setTheoryAcknowledged(false);
    }
  }, [active?.id, active?.descriptionMarkdown]);

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
      if (res.status === "ok" && res.task) {
        // Використовуємо завдання з відповіді
        const newTask = res.task;
        const newTasks = await listTasks();
        setTasks(newTasks);
        setActive(newTask);
        setCode(newTask.starterCode);
        setAiResult(null);
        setConsoleOutput("");
        // Встановлюємо theoryAcknowledged на основі наявності теорії
        const content = newTask.descriptionMarkdown || "";
        const hasTheory = computeHasTheory(content);
        setTheoryAcknowledged(!hasTheory);
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
    } catch (error: any) {
      // Обробка помилок авторизації
      if (error.message?.includes("авторизовані") || error.message?.includes("Сесія")) {
        const raw = safeServerMessage(error.message);
        setConsoleOutput(
          `${tr("Помилка:", "Error:")} ${raw || tr("Сесія недійсна.", "Session is invalid.")}\n${tr(
            "Будь ласка, увійдіть в систему.",
            "Please sign in."
          )}`
        );
        setUIState("error");
      } else {
        const errorResponse = error?.response?.data;
        if (errorResponse?.status === "blocked") {
          // Обробка блокувань (COMPLETE_PREVIOUS_TASK, ALL_TOPICS_COMPLETED)
          setBlockState({
            mode: "low",
            topicId: errorResponse.taskId,
            topicTitle: errorResponse.topicTitle,
            average: errorResponse.average,
            message: errorResponse.message,
          });
          setUIState("logic-warning");
        } else {
          const raw = safeServerMessage(error.message || errorResponse?.message);
          setConsoleOutput(
            `${tr("Помилка генерації завдання:", "Task generation error:")}${raw ? ` ${raw}` : ""}`
          );
          setUIState("error");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!active) return;
    setSubmitting(true);
    setUIState("evaluating");
    setConsoleOutput(tr("Оцінювання...", "Evaluating..."));
    try {
      const res = await submitTaskWithMode(active.id, code, judgeMode);
      let result: {
        gradingMode?: "TESTS" | "AI";
        total: number;
        workScore: number;
        optimizationScore: number;
        integrityScore: number;
        aiFeedback: string;
        comparisonFeedback: string | null;
        previousGrade: number | null;
        testsPassed?: number;
        testsTotal?: number;
        testResults?: Array<{
          testId: number;
          input: string;
          expectedOutput: string;
          actualOutput: string;
          passed: boolean;
          error?: string | null;
        }>;
      } | null = null;
      
      if (res.grade) {
        const grade = res.grade;
        result = {
          gradingMode: grade.gradingMode,
          total: Number(grade.total ?? 0),
          workScore: Number(grade.workScore ?? 0),
          optimizationScore: Number(grade.optimizationScore ?? 0),
          integrityScore: Number(grade.integrityScore ?? 0),
          aiFeedback: grade.aiFeedback ?? "",
          comparisonFeedback: grade.comparisonFeedback ?? null,
          previousGrade: grade.previousGrade ?? null,
          testsPassed: grade.testsPassed ?? undefined,
          testsTotal: grade.testsTotal ?? undefined,
          testResults: grade.testResults ?? undefined,
        };
        const outputText =
          result.gradingMode === "TESTS"
            ? tr(
                `Перевірка тестами завершена: ${result.testsPassed ?? 0}/${result.testsTotal ?? 0}. Оцінка: ${result.total}`,
                `Test check completed: ${result.testsPassed ?? 0}/${result.testsTotal ?? 0}. Grade: ${result.total}`
              )
            : result.previousGrade
            ? tr(
                `Завдання відправлено на перевірку ШІ. Оцінка: ${result.total} (було ${result.previousGrade})`,
                `Task submitted for AI review. Grade: ${result.total} (was ${result.previousGrade})`
              )
            : tr(
                `Завдання відправлено на перевірку ШІ. Оцінка: ${result.total}`,
                `Task submitted for AI review. Grade: ${result.total}`
              );
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
      const raw = safeServerMessage(err?.response?.data?.message ?? err?.message ?? String(err));
      setConsoleOutput(`${tr("Помилка відправлення:", "Submit error:")}${raw ? ` ${raw}` : ""}`);
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
      setConsoleOutput(tr("Чернетку збережено", "Draft saved"));
    } catch (err: any) {
      const raw = safeServerMessage(err?.response?.data?.message ?? err?.message ?? String(err));
      setConsoleOutput(`${tr("Помилка збереження:", "Save error:")}${raw ? ` ${raw}` : ""}`);
    }
  };

  const handleRun = async () => {
    if (!active || !code.trim()) return;
    setUIState("evaluating");
    setConsoleOutput(tr("Запуск...", "Running..."));
    try {
      const res = await runTask(active.id, code, stdin || "");
      setConsoleOutput(res.output || res.stderr || tr("Вивід відсутній", "No output"));
      setUIState("idle");
    } catch (err: any) {
      const raw = safeServerMessage(err?.response?.data?.message ?? err?.message ?? String(err));
      setConsoleOutput(`${tr("Помилка запуску:", "Run error:")}${raw ? ` ${raw}` : ""}`);
      setUIState("error");
    }
  };

  // Extract practice task text
  const getPracticeText = () => {
    if (!active) return null;
    const content = active.descriptionMarkdown || "";
    
    if (/^###\s*(Практичне завдання|Practical task)\b/i.test(content.trim())) {
      return content.replace(/^###\s*(Практичне завдання|Practical task)\s*/i, "").trim();
    }
    
    const practiceMatch = content.match(/(?:###\s*)?(Практика|Practice)[\s\S]*$/i);
    if (practiceMatch) {
      return practiceMatch[0].replace(/^###\s*(Практика|Practice)\s*/i, "").trim();
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
              <h2 className="text-sm font-mono text-text-primary">{tr("Завдання", "Tasks")}</h2>
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
                  <div className="space-y-3">
                    <div className="text-xs text-text-muted font-mono text-center py-4">
                      {tr("Немає завдань", "No tasks")}
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleGenerate}
                      disabled={loading}
                      className="w-full text-sm px-4 py-2 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {tr("Згенерувати завдання", "Generate task")}
                    </Button>
                  </div>
                )}
        {tasks.length > 0 && tasks.map((t) => (
          <div
            key={t.id}
                    className={`p-3 cursor-pointer border transition-fast bg-bg-surface ${
                      active?.id === t.id
                        ? "border-primary bg-bg-hover"
                        : "border-border hover:border-primary/50"
            }`}
                    onClick={() => {
                      setActive(t);
                      // Для GRADED завдань показуємо finalCode, для інших - userCode або starterCode
                      if (t.status === "GRADED" && t.finalCode) {
                        setCode(t.finalCode);
                      } else if (t.userCode && t.userCode.trim()) {
                        setCode(t.userCode);
                      } else {
                        setCode(t.starterCode);
                      }
                      setAiResult(null);
                      setConsoleOutput("");
                      setUIState("idle");
                      // Перевіряємо, чи є теорія
                      const content = t.descriptionMarkdown || "";
                      const hasTheory = computeHasTheory(content);
                      setTheoryAcknowledged(!hasTheory);
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
                      {new Date(t.createdAt).toLocaleDateString(locale)}
            </div>
          </div>
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
                    {tr("Згенерувати нове", "Generate new")}
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
                      {active.kind === "CONTROL"
                        ? tr("Контроль знань", "Knowledge check")
                        : tr("Тема", "Topic")}{" "}
                      · {tr("Difus:", "Difficulty:")} {user.difus}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const hasTheory = computeHasTheory(active.descriptionMarkdown || "");
                      if (!hasTheory) return null;
                      return (
                        <Button
                          variant="ghost"
                          onClick={() => setTheoryAcknowledged(false)}
                          className="text-sm px-3 py-2"
                        >
                          {tr("Теорія", "Theory")}
                        </Button>
                      );
                    })()}
                    {!aiResult ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={handleSaveDraft}
                          disabled={!active || !code.trim() || !theoryAcknowledged}
                          className="text-sm px-4 py-2"
                        >
                          <Save className="w-4 h-4 mr-2" /> {tr("Зберегти", "Save")}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={handleRun}
                          disabled={!active || !code.trim() || !theoryAcknowledged}
                          className="text-sm px-4 py-2"
                        >
                          <PlayCircle className="w-4 h-4 mr-2" /> {tr("Запустити", "Run")}
                        </Button>
                        <div className="flex items-center gap-1 border border-border bg-bg-code px-1 py-1">
                          <button
                            type="button"
                            onClick={() => setJudgeMode("TESTS")}
                            className={`px-2 py-1 text-xs font-mono transition-fast ${
                              judgeMode === "TESTS"
                                ? "bg-primary text-white"
                                : "text-text-secondary hover:bg-bg-hover"
                            }`}
                          >
                            {tr("Тести", "Tests")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setJudgeMode("AI")}
                            className={`px-2 py-1 text-xs font-mono transition-fast ${
                              judgeMode === "AI"
                                ? "bg-primary text-white"
                                : "text-text-secondary hover:bg-bg-hover"
                            }`}
                          >
                            {tr("ШІ", "AI")}
                          </button>
                        </div>
                        <Button
                          variant="primary"
                          onClick={handleSubmit}
                          disabled={!canEdit || submitting || !theoryAcknowledged || !code.trim()}
                          className="text-sm px-6 py-2"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />{" "}
                          {judgeMode === "TESTS"
                            ? tr("Перевірити тести", "Check tests")
                            : tr("Перевірити ШІ", "Check AI")}
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
                          <Save className="w-4 h-4 mr-2" /> {tr("Зберегти", "Save")}
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
                          {tr("Виправити помилку", "Fix the error")}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Task Description - показуємо завжди */}
                {active.descriptionMarkdown && (
                  <div className="mt-3 border border-border bg-bg-code overflow-hidden flex flex-col" style={{ maxHeight: "300px" }}>
                    <div className="p-3 border-b border-border flex-shrink-0">
                      <div className="text-xs font-mono text-text-secondary">
                        {theoryAcknowledged && getPracticeText()
                          ? tr("Практичне завдання", "Practical task")
                          : tr("Опис завдання", "Task description")}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      <div className="text-sm text-text-primary">
                        {theoryAcknowledged && getPracticeText() ? (
                        <MarkdownView content={getPracticeText()!} />
                        ) : (
                          <MarkdownView content={active.descriptionMarkdown} />
                        )}
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
              <div>
                {tasks.length === 0
                  ? tr("Немає завдань", "No tasks")
                  : tr("Виберіть завдання зі списку", "Select a task from the list")}
              </div>
              {tasks.length === 0 && (
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="text-sm px-6 py-2 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {tr("Згенерувати завдання", "Generate task")}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Right OutputPane */}
        <div className="w-[400px] border-l border-border bg-bg-surface flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-mono text-text-primary flex items-center gap-2">
                    <Play className="w-4 h-4" /> {tr("Консоль", "Console")}
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
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div className="border border-border bg-bg-code p-2">
              <div className="text-[10px] font-mono text-text-secondary mb-1">
                {tr("Вхідні дані (stdin)", "Input (stdin)")}
              </div>
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder={tr("Введіть дані для програми...", "Enter input for your program...")}
                className="w-full h-20 bg-transparent border border-border p-2 font-mono text-xs text-text-primary resize-none focus:outline-none focus:border-primary"
                spellCheck={false}
              />
            </div>
            <div className="font-mono text-xs text-text-primary whitespace-pre-wrap">
                  {consoleOutput ||
                    tr(
                      "Натисни «Перевірити», щоб отримати оцінку (Тести або ШІ).",
                      "Press “Check” to get a grade (Tests or AI)."
                    )}
            </div>
                  {aiResult && (
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                {aiResult.gradingMode !== "TESTS" &&
                  aiResult.total !== null &&
                  aiResult.total !== undefined && (
                  <>
                    <div className="text-xs font-mono text-text-secondary">
                      {tr("Оцінка:", "Grade:")} <span className={`font-semibold ${
                        aiResult.total >= 10 ? "text-accent-success" :
                        aiResult.total >= 7 ? "text-accent-warn" :
                        aiResult.total >= 4 ? "text-yellow-500" :
                        "text-accent-error"
                      }`}>{aiResult.total}</span>
                      {aiResult.previousGrade !== null && aiResult.previousGrade !== undefined && (
                        <span className="text-text-muted ml-2">
                          ({tr(`було ${aiResult.previousGrade}`, `was ${aiResult.previousGrade}`)})
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-text-secondary">
                      {tr("Працездатність:", "Correctness:")}{" "}
                      <span className="text-text-primary">{aiResult.workScore ?? 0}</span> / 5
                    </div>
                    <div className="text-xs font-mono text-text-secondary">
                      {tr("Оптимізація:", "Optimization:")}{" "}
                      <span className="text-text-primary">{aiResult.optimizationScore ?? 0}</span> / 4
                    </div>
                    <div className="text-xs font-mono text-text-secondary">
                      {tr("Доброчесність:", "Integrity:")}{" "}
                      <span className="text-text-primary">{aiResult.integrityScore ?? 0}</span> / 3
                      </div>
                  </>
                )}
                {aiResult.gradingMode === "TESTS" && (
                  <div className="text-xs font-mono text-text-secondary">
                    {tr("Тести:", "Tests:")}{" "}
                    <span className="text-text-primary">
                      {(aiResult.testsPassed ?? 0)}/{(aiResult.testsTotal ?? 0)}
                    </span>{" "}
                    · {tr("Оцінка:", "Grade:")}{" "}
                    <span className="text-text-primary">{aiResult.total ?? 0}</span>
                  </div>
                )}
                {aiResult.comparisonFeedback && (
                  <div className="mt-3 p-2 border border-primary/30 bg-bg-code">
                    <div className="text-xs font-mono text-primary mb-1">
                      {tr("Порівняння з попередньою спробою:", "Comparison with previous attempt:")}
                    </div>
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
                {tr("Оцінювання...", "Evaluating...")}
              </div>
            )}
            {uiState === "success" && (
              <div className="mt-4 text-xs font-mono text-accent-success">
                {tr("✓ Успішно", "✓ Success")}
              </div>
            )}
            {uiState === "error" && (
              <div className="mt-4 text-xs font-mono text-accent-error">
                {tr("✗ Помилка", "✗ Error")}
                </div>
            )}
            {uiState === "logic-warning" && (
              <div className="mt-4 text-xs font-mono text-accent-logic-warning">
                {tr("⚠ Попередження", "⚠ Warning")}
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Theory Modal */}
      {(() => {
        if (!active || theoryAcknowledged) return null;
        const content = active.descriptionMarkdown || "";
        const hasTheory = computeHasTheory(content);
        if (!hasTheory) return null;
        const trimmed = content.trim();
        const idx = trimmed.search(/###\s*(Практика|Practice)\b/i);
        const theoryText = (idx >= 0 ? trimmed.slice(0, idx).trim() : trimmed) || content;
        
        return (
          <Modal
            open={true}
            title={tr("Теорія", "Theory")}
            onClose={() => {}}
            closable={false}
            showCloseButton={false}
          >
            <MarkdownView content={theoryText} />
            <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-border">
              <Button variant="primary" onClick={() => setTheoryAcknowledged(true)}>
                {tr("Я прочитав(ла) теорію", "I have read the theory")}
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
            ? tr("Тему потрібно пройти повторно", "You need to retry this topic")
            : tr("Бажано повторити тему", "It’s recommended to review this topic")
        }
        description={
          blockState
            ? tr(
                `Тема: ${blockState.topicTitle}\nСередній бал: ${blockState.average.toFixed(2)}\n\nЩоб рухатись далі, необхідно перепройти тему.`,
                `Topic: ${blockState.topicTitle}\nAverage grade: ${blockState.average.toFixed(2)}\n\nTo continue, you need to retry the topic.`
              )
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
              {tr("Перепройти тему", "Retry topic")}
            </Button>
          </div>
        )}
      </Modal>

      {/* Milestone Modal */}
      <Modal
        open={!!milestone}
        title={tr("🎯 Ти покращився!", "🎯 You improved!")}
        description={milestone?.message}
        onClose={async () => {
          if (milestone) {
            try {
              await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/profile/milestone-shown`, {
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
                  await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/profile/milestone-shown`, {
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
              {tr("Продовжити", "Continue")}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
