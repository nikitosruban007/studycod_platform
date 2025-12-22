// frontend/src/pages/StudentTaskPage.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Panel, Group, Separator } from "react-resizable-panels";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { CodeEditor } from "../components/CodeEditor";
import { MarkdownView } from "../components/MarkdownView";
import { getTask, submitCode, runCode, submitQuizAnswers, type TaskWithGrade, type TestResult } from "../lib/api/edu";
import { ArrowLeft, Play, Send, Save, Clock, FileText } from "lucide-react";

export const StudentTaskPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskWithGrade | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState("");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [theoryAcknowledged, setTheoryAcknowledged] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timeStarted, setTimeStarted] = useState<Date | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, "А" | "Б" | "В" | "Г" | "Д">>({});
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizGrade, setQuizGrade] = useState<number | null>(null);
  const [deadlineRemaining, setDeadlineRemaining] = useState<number | null>(null);

  // Refs для уникнення stale closures в setInterval
  const taskRef = useRef(task);
  const codeRef = useRef(code);
  const handleSubmitRef = useRef<() => Promise<void>>();

  // Оновлюємо refs при зміні
  useEffect(() => {
    taskRef.current = task;
    codeRef.current = code;
  }, [task, code]);

  useEffect(() => {
    if (taskId) {
      loadTask();
    }
  }, [taskId]);

  // Таймер для deadline
  useEffect(() => {
    if (!task?.deadline || task.isClosed) {
      setDeadlineRemaining(null);
      return;
    }

    const updateDeadline = () => {
      const now = new Date().getTime();
      const deadline = new Date(task.deadline!).getTime();
      const remaining = Math.max(0, Math.floor((deadline - now) / 1000)); // секунди
      
      if (remaining > 0) {
        setDeadlineRemaining(remaining);
      } else {
        setDeadlineRemaining(0);
      }
    };

    updateDeadline();
    const interval = setInterval(updateDeadline, 1000); // Оновлюємо кожну секунду

    return () => clearInterval(interval);
  }, [task?.deadline, task?.isClosed]);

  // Таймер для контрольної роботи - ВИПРАВЛЕНО: використовуємо refs для уникнення memory leak
  useEffect(() => {
    // Перевірки через refs для уникнення залежностей
    if (timeRemaining === null || timeRemaining <= 0) return;
    if (!timeStarted) return;
    if (taskRef.current?.lesson.type !== "CONTROL") return;
    if (taskRef.current?.hasGrade) return;

    const interval = setInterval(() => {
      const currentTask = taskRef.current;
      const currentCode = codeRef.current;
      
      if (!currentTask || !timeStarted) {
        clearInterval(interval);
        return;
      }

      const elapsed = Math.floor((Date.now() - timeStarted.getTime()) / 1000 / 60);
      const remaining = (currentTask.lesson.timeLimitMinutes || 0) - elapsed;
      
      if (remaining > 0) {
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(0);
        clearInterval(interval);
        alert("Час вийшов! Завдання буде автоматично відправлено.");
        // Автоматично відправляємо завдання через ref
        if (currentTask && currentCode && handleSubmitRef.current) {
          handleSubmitRef.current();
        }
      }
    }, 60000); // Оновлюємо кожну хвилину

    return () => clearInterval(interval);
  }, [timeStarted]); // ✅ Тільки timeStarted в залежностях - interval створюється тільки один раз

  useEffect(() => {
    if (task) {
      // Якщо є теорія в урокі, потрібно підтвердити прочитання (починаємо з false)
      // Якщо немає теорії, одразу дозволяємо працювати (true)
      const hasTheory = task.lesson.hasTheory && task.lesson.theory && task.lesson.theory.trim().length > 0;
      setTheoryAcknowledged(!hasTheory);
    } else {
      setTheoryAcknowledged(false);
    }
  }, [task?.id]);

  const loadTask = async () => {
    if (!taskId) return;
    try {
      const data = await getTask(parseInt(taskId, 10));
      setTask(data);
      // Використовуємо збережений код, якщо є, інакше шаблон
      const savedCode = (data as any).savedCode;
      setCode(savedCode || data.template);
      setConsoleOutput("");
      
      // Завантажуємо quiz питання якщо є (для контрольної роботи)
      if (data.lesson.type === "CONTROL" && (data.lesson as any).quizJson) {
        try {
          const quiz = JSON.parse((data.lesson as any).quizJson);
          setQuizQuestions(quiz);
          // Завантажуємо збережені відповіді з localStorage
          const savedAnswers = localStorage.getItem(`quiz_answers_${taskId}`);
          if (savedAnswers) {
            setQuizAnswers(JSON.parse(savedAnswers));
            // Оновлюємо timestamp
            localStorage.setItem(`quiz_answers_${taskId}_timestamp`, Date.now().toString());
          }
          // Перевіряємо, чи тест вже відправлено
          const submitted = localStorage.getItem(`quiz_submitted_${taskId}`);
          if (submitted === "true") {
            setQuizSubmitted(true);
            // Завантажуємо оцінку за тест
            const grade = localStorage.getItem(`quiz_grade_${taskId}`);
            if (grade) {
              setQuizGrade(parseFloat(grade));
            }
          }
        } catch (e) {
          if (import.meta.env.DEV) {
            console.error("Failed to parse quiz:", e);
          }
          setQuizQuestions([]);
        }
      } else {
        setQuizQuestions([]);
      }
      
      // Ініціалізуємо таймер для контрольної роботи
      if (data.lesson.type === "CONTROL" && data.lesson.timeLimitMinutes && !data.hasGrade) {
        const startTime = localStorage.getItem(`task_${taskId}_start_time`);
        if (startTime) {
          const elapsed = Math.floor((Date.now() - parseInt(startTime)) / 1000 / 60);
          const remaining = data.lesson.timeLimitMinutes - elapsed;
          if (remaining > 0) {
            setTimeRemaining(remaining);
            setTimeStarted(new Date(parseInt(startTime)));
          } else {
            setTimeRemaining(0);
          }
        } else {
          // Перший раз відкриваємо - зберігаємо час старту з timestamp
          const now = Date.now();
          localStorage.setItem(`task_${taskId}_start_time`, now.toString());
          localStorage.setItem(`task_${taskId}_start_time_timestamp`, now.toString());
          setTimeRemaining(data.lesson.timeLimitMinutes);
          setTimeStarted(new Date(now));
        }
      }
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Failed to load task:", error);
      }
      if (error.response?.status === 404 || error.response?.status === 403) {
        // Помилка вже буде показана через перевірку !task
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    if (!taskId || !code.trim()) {
      setConsoleOutput("Введіть код для запуску");
      return;
    }

    setRunning(true);
    setConsoleOutput("Запуск коду...");
    try {
      const result = await runCode(parseInt(taskId, 10), code);
      setConsoleOutput(result.output || result.stderr || "Немає виводу");
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Failed to run:", error);
      }
      setConsoleOutput(error.response?.data?.message || "Помилка запуску коду");
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!taskId || !task) return;
    
    // Перевіряємо, чи всі питання відповідені
    if (Object.keys(quizAnswers).length < quizQuestions.length) {
      alert("Будь ласка, відповідьте на всі питання");
      return;
    }

    try {
      // Відправляємо відповіді на сервер
      const result = await submitQuizAnswers(parseInt(taskId, 10), quizAnswers);
      
      setQuizGrade(result.grade.theoryGrade);
      setQuizSubmitted(true);
      
      // Зберігаємо в localStorage з timestamp
      const now = Date.now().toString();
      localStorage.setItem(`quiz_submitted_${taskId}`, "true");
      localStorage.setItem(`quiz_submitted_${taskId}_timestamp`, now);
      localStorage.setItem(`quiz_grade_${taskId}`, result.grade.theoryGrade.toString());
      localStorage.setItem(`quiz_grade_${taskId}_timestamp`, now);
      
      alert(`Тест завершено! Оцінка: ${result.grade.theoryGrade}/12 (${result.grade.correctAnswers}/${result.grade.totalQuestions} правильних відповідей)`);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Failed to submit quiz:", error);
      }
      alert(error.response?.data?.message || "Не вдалося відправити тест");
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!taskId || !code.trim()) {
      alert("Введіть код");
      return;
    }

    // Перевірка перед відправкою
    if (task?.isClosed) {
      alert("Завдання закрите. Неможливо відправити код.");
      return;
    }
    if (task?.deadline && new Date(task.deadline) < new Date()) {
      alert("Термін здачі завдання минув. Неможливо відправити код.");
      return;
    }
    if (task?.maxAttempts && task.attemptsUsed !== undefined && task.attemptsUsed >= task.maxAttempts) {
      alert(`Вичерпано всі спроби (${task.maxAttempts}). Неможливо відправити код.`);
      return;
    }

    setSubmitting(true);
    setConsoleOutput("Перевірка коду...");
    try {
      const result = await submitCode(parseInt(taskId, 10), code);
      setTestResults(result.testResults);
      setShowResults(true);
      setConsoleOutput(`Перевірка завершена. Пройдено тестів: ${result.grade.testsPassed}/${result.grade.testsTotal}. Оцінка: ${result.grade.total}/12`);
      await loadTask(); // Reload to get updated grade
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Failed to submit:", error);
      }
      const errorMessage = error.response?.data?.message || "Не вдалося відправити код";
      setConsoleOutput(errorMessage);
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [taskId, code, task?.isClosed, task?.deadline, task?.maxAttempts, task?.attemptsUsed]);

  // Оновлюємо ref для handleSubmit
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Extract practice task text (як в Personal TasksPage)
  const getPracticeText = () => {
    if (!task) return null;
    const content = task.description || "";
    
    if (content.trim().startsWith("### Практичне завдання")) {
      return content.replace(/^###\s*Практичне завдання\s*/i, "").trim();
    }
    
    const practiceMatch = content.match(/(?:###\s*)?Практика[\s\S]*$/i);
    if (practiceMatch) {
      return practiceMatch[0].replace(/^###\s*Практика\s*/i, "").trim();
    }
    
    // Якщо немає розділу "Практика", повертаємо весь опис
    return content.trim() || null;
  };

  // Визначаємо, чи можна редагувати код (викликаємо ДО умовних return)
  const canEdit = useMemo(() => {
    if (!task) return false;
    if (task.grade && task.grade.total >= 6) return false; // Якщо оцінка >= 6, не можна редагувати
    if (task.isClosed) return false; // Завдання закрите
    if (task.deadline && new Date(task.deadline) < new Date()) return false; // Deadline пройшов
    if (task.maxAttempts && task.attemptsUsed !== undefined && task.attemptsUsed >= task.maxAttempts) return false; // Вичерпано спроби
    return true;
  }, [task?.grade, task?.isClosed, task?.deadline, task?.maxAttempts, task?.attemptsUsed, task]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-primary font-mono">
        Завантаження...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-text-primary font-mono">
        Завдання не знайдено
      </div>
    );
  }

  const hasTheory = task.lesson.hasTheory && task.lesson.theory && task.lesson.theory.trim().length > 0;
  const showTheory = !theoryAcknowledged && hasTheory;

  return (
    <div className="h-screen flex flex-col bg-bg-base">
      {/* Header - приховуємо, якщо показується теорія */}
      {!showTheory && (
        <div className="border-b border-border bg-bg-surface p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => {
                  const hasTheory = task.lesson.hasTheory && task.lesson.theory && task.lesson.theory.trim().length > 0;
                  if (theoryAcknowledged && hasTheory) {
                    // Якщо на практиці і є теорія, повертаємо на теорію
                    setTheoryAcknowledged(false);
                  } else {
                    // Якщо на теорії або немає теорії, повертаємо на головну/урок
                    navigate(-1);
                  }
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <div>
                <h1 className="text-lg font-mono text-text-primary mb-1">{task.title}</h1>
                <div className="text-xs font-mono text-text-muted flex items-center gap-2">
                  <span>{task.lesson.type === "LESSON" ? "Урок" : "Контрольна"} · {task.language}</span>
                  {task.testDataCount !== undefined && (
                    <span className="text-text-secondary">· Тестів: {task.testDataCount}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {/* Таймер для контрольної роботи */}
              {timeRemaining !== null && task.lesson.type === "CONTROL" && !task.hasGrade && (
                <div className={`text-sm font-mono mr-4 flex items-center ${
                  timeRemaining <= 5 ? "text-accent-error" : timeRemaining <= 10 ? "text-yellow-500" : "text-text-primary"
                }`}>
                  <Clock className="w-4 h-4 mr-1" />
                  {Math.floor(timeRemaining)} хв
                </div>
              )}
              {/* Таймер для deadline */}
              {deadlineRemaining !== null && !task.isClosed && (
                <div className={`text-sm font-mono mr-4 flex items-center ${
                  deadlineRemaining <= 300 ? "text-accent-error" : deadlineRemaining <= 600 ? "text-yellow-500" : "text-text-primary"
                }`}>
                  <Clock className="w-4 h-4 mr-1" />
                  {deadlineRemaining > 3600 
                    ? `${Math.floor(deadlineRemaining / 3600)} год ${Math.floor((deadlineRemaining % 3600) / 60)} хв`
                    : deadlineRemaining > 60
                    ? `${Math.floor(deadlineRemaining / 60)} хв`
                    : `${deadlineRemaining} сек`
                  }
                </div>
              )}
              {/* Спроби */}
              {task.maxAttempts !== undefined && task.attemptsUsed !== undefined && (
                <div className="text-xs font-mono text-text-secondary mr-4">
                  Спроб: {task.attemptsUsed}/{task.maxAttempts}
                </div>
              )}
              {/* Статус закриття */}
              {task.isClosed && (
                <div className="text-xs font-mono text-accent-error mr-4">
                  Завдання закрите
                </div>
              )}
              {task.grade && (
                <div className={`text-sm font-mono font-bold mr-4 flex items-center ${
                  task.grade.total >= 10 ? "text-accent-success" :
                  task.grade.total >= 7 ? "text-accent-warn" :
                  task.grade.total >= 4 ? "text-yellow-500" :
                  "text-accent-error"
                }`}>
                  Оцінка: {task.grade.total}/12
                </div>
              )}
              {theoryAcknowledged && (
                <>
                  <Button
                    variant="ghost"
                    onClick={handleRun}
                    disabled={!canEdit || running}
                    className="text-xs"
                  >
                    <Play className="w-3 h-3 mr-1" /> Запустити
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={!canEdit || submitting}
                    className="text-xs"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    {submitting ? "Перевірка..." : "Відправити"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Theory Modal - показуємо на весь екран, якщо теорія не підтверджена */}
      {showTheory ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-bg-base">
          {/* Header з кнопкою Назад на теорії */}
          <div className="border-b border-border bg-bg-surface p-4 flex-shrink-0">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <h1 className="text-lg font-mono text-text-primary">{task.title}</h1>
            </div>
          </div>
              <div className="flex-1 overflow-y-auto p-8 pb-24">
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-2xl font-mono text-text-primary mb-6">Теорія</h2>
                  <div className="prose prose-invert max-w-none text-text-secondary font-mono">
                    <MarkdownView content={task.lesson.theory} />
                  </div>
                </div>
              </div>
              <div className="bg-bg-surface p-4 flex-shrink-0 fixed bottom-0 left-0 right-0 z-30 shadow-lg">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                  <p className="text-xs font-mono text-text-secondary flex-1">
                    Після прочитання теорії ви зможете перейти до практичного завдання
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => {
                      console.log("Theory acknowledged");
                      setTheoryAcknowledged(true);
                    }}
                    className="text-base px-8 py-3 font-semibold whitespace-nowrap shadow-md hover:shadow-lg transition-all"
                  >
                    ✓ Я прочитав теорію
                  </Button>
                </div>
              </div>
            </div>
      ) : (
        <Group direction="horizontal" className="flex-1 overflow-hidden">
            {/* Left: Quiz (for control works) or Task Description */}
            <Panel defaultSize={25} minSize={15} maxSize={60} className="flex flex-col overflow-hidden bg-bg-surface border-r border-border">
              <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <div className="text-sm font-mono text-text-primary flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {task.lesson.type === "CONTROL" && quizQuestions.length > 0 ? "Теоретична частина" : "Завдання"}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {task.lesson.type === "CONTROL" && quizQuestions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="mb-4 pb-3 border-b border-border">
                      <h3 className="text-lg font-mono text-text-primary mb-1">Теоретична частина</h3>
                      <p className="text-xs text-text-secondary">
                        Відповідьте на всі питання. Після відправки змінити відповіді буде неможливо.
                      </p>
                      <div className="mt-2 text-xs text-text-muted">
                        Прогрес: {Object.keys(quizAnswers).length} / {quizQuestions.length} питань
                      </div>
                    </div>
                    {quizQuestions.map((q: any, index: number) => (
                      <Card 
                        key={index} 
                        className={`p-4 transition-all ${
                          quizAnswers[index] 
                            ? "border-primary/50 bg-bg-code/50" 
                            : "border-border"
                        } ${
                          quizSubmitted && quizAnswers[index] === q.correct
                            ? "border-accent-success bg-accent-success/10"
                            : quizSubmitted && quizAnswers[index] && quizAnswers[index] !== q.correct
                            ? "border-accent-error bg-accent-error/10"
                            : ""
                        }`}
                      >
                        <div className="mb-4">
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-xs font-mono text-text-secondary bg-bg-surface px-2 py-1 rounded">
                              {index + 1} / {quizQuestions.length}
                            </span>
                            {quizAnswers[index] && !quizSubmitted && (
                              <span className="text-xs text-primary">✓ Відповідь вибрано</span>
                            )}
                          </div>
                          <div className="text-sm font-mono text-text-primary">
                            <MarkdownView content={q.question} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          {(["А", "Б", "В", "Г", "Д"] as const).map((option) => {
                            const isSelected = quizAnswers[index] === option;
                            const isCorrect = q.correct === option;
                            const isWrong = isSelected && !isCorrect && quizSubmitted;
                            
                            return (
                              <label
                                key={option}
                                className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                  isSelected && !quizSubmitted
                                    ? "border-primary bg-primary/10 shadow-md"
                                    : quizSubmitted && isCorrect
                                    ? "border-accent-success bg-accent-success/20"
                                    : quizSubmitted && isWrong
                                    ? "border-accent-error bg-accent-error/20"
                                    : "border-border hover:border-primary/50 hover:bg-bg-hover"
                                } ${quizSubmitted ? "cursor-default" : ""}`}
                              >
                                <input
                                  type="radio"
                                  name={`question-${index}`}
                                  value={option}
                                  checked={isSelected}
                                  onChange={() => {
                                    if (!quizSubmitted) {
                                      const newAnswers = { ...quizAnswers, [index]: option };
                                      setQuizAnswers(newAnswers);
                                      localStorage.setItem(`quiz_answers_${taskId}`, JSON.stringify(newAnswers));
                                    }
                                  }}
                                  disabled={quizSubmitted}
                                  className="mt-1 mr-3 flex-shrink-0"
                                />
                                <div className="flex-1">
                                  <span className="font-semibold text-text-primary mr-2">{option})</span>
                                  <span className="text-sm font-mono text-text-primary">
                                    <MarkdownView content={q.options[option]} />
                                  </span>
                                </div>
                                {quizSubmitted && isCorrect && (
                                  <span className="ml-2 text-accent-success flex-shrink-0">✓</span>
                                )}
                                {quizSubmitted && isWrong && (
                                  <span className="ml-2 text-accent-error flex-shrink-0">✗</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </Card>
                    ))}
                    {!quizSubmitted && (
                      <div className="sticky bottom-0 bg-bg-surface border-t border-border p-4 -mx-4 -mb-4 mt-6">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-text-secondary">
                            {Object.keys(quizAnswers).length < quizQuestions.length ? (
                              <span className="text-accent-warn">
                                Залишилось відповісти на {quizQuestions.length - Object.keys(quizAnswers).length} питань
                              </span>
                            ) : (
                              <span className="text-accent-success">Всі питання відповідені</span>
                            )}
                          </div>
                          <Button
                            variant="primary"
                            onClick={handleSubmitQuiz}
                            disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                            className="text-sm px-6 py-2 font-semibold"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Відправити тест
                          </Button>
                        </div>
                      </div>
                    )}
                    {quizSubmitted && quizGrade !== null && (
                      <Card className="p-6 bg-gradient-to-br from-primary/20 to-secondary/20 border-primary">
                        <div className="text-center">
                          <div className={`text-3xl font-mono mb-2 font-bold ${
                            quizGrade >= 10 ? "text-accent-success" :
                            quizGrade >= 7 ? "text-accent-warn" :
                            quizGrade >= 4 ? "text-yellow-500" :
                            "text-accent-error"
                          }`}>
                            {quizGrade}/12
                          </div>
                          <div className="text-sm text-text-secondary mb-4">
                            Оцінка за теоретичну частину
                          </div>
                          <div className="text-xs text-text-muted">
                            Правильних відповідей: {Object.keys(quizAnswers).filter(i => quizQuestions[parseInt(i)]?.correct === quizAnswers[parseInt(i)]).length} з {quizQuestions.length}
                          </div>
                        </div>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none text-text-secondary font-mono text-sm">
                    <MarkdownView content={getPracticeText() || task.description || ""} />
                  </div>
                )}
              </div>
            </Panel>

            <Separator className="w-2 bg-border hover:bg-primary transition-colors cursor-col-resize flex-shrink-0 relative group">
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-0.5 h-8 bg-primary rounded-full" />
              </div>
            </Separator>

            {/* Center: Code Editor */}
            <Panel defaultSize={50} minSize={20} maxSize={70} className="flex flex-col overflow-hidden bg-bg-code">
              <CodeEditor
                value={code}
                onChange={canEdit ? setCode : undefined}
                language={task.language}
                readOnly={!canEdit}
              />
            </Panel>

            <Separator className="w-2 bg-border hover:bg-primary transition-colors cursor-col-resize flex-shrink-0 relative group">
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-0.5 h-8 bg-primary rounded-full" />
              </div>
            </Separator>

            {/* Right: Console */}
            <Panel defaultSize={25} minSize={10} maxSize={50} className="flex flex-col overflow-hidden bg-bg-surface border-l border-border">
              <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <div className="text-sm font-mono text-text-primary flex items-center gap-2">
                  <Play className="w-4 h-4" /> Консоль
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="font-mono text-xs text-text-secondary whitespace-pre-wrap">
                  {consoleOutput || (
                    <span className="text-text-muted italic">
                      // Результат виконання з'явиться тут...
                    </span>
                  )}
                </div>
              </div>
            </Panel>
          </Group>
      )}

      {/* Test Results Modal */}
      {showResults && (
        <Modal 
          open={showResults}
          onClose={() => setShowResults(false)}
          title="Результати тестування"
          showCloseButton={false}
        >
          <div className="p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-mono text-text-primary mb-4">Результати тестування</h2>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono text-text-primary">Тест {index + 1}</span>
                    {result.passed ? (
                      <span className="text-xs text-accent-success">✓ Пройдено</span>
                    ) : (
                      <span className="text-xs text-accent-error">✗ Не пройдено</span>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary space-y-1">
                    <div>
                      <strong>Вхід:</strong> {result.input}
                    </div>
                    <div>
                      <strong>Очікувано:</strong> {result.expected}
                    </div>
                    <div>
                      <strong>Отримано:</strong> {result.actual}
                    </div>
                    {result.stderr && (
                      <div className="text-accent-error">
                        <strong>Помилка:</strong> {result.stderr}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowResults(false)}>Закрити</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
