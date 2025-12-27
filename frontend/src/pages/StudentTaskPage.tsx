// frontend/src/pages/StudentTaskPage.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { Panel, Group, Separator } from "react-resizable-panels";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { CodeEditor } from "../components/CodeEditor";
import { MarkdownView } from "../components/MarkdownView";
import { getTask, submitCode, runCode, submitQuizAnswers, completeTask, getTestData, type TaskWithGrade, type TestResult } from "../lib/api/edu";
import { ArrowLeft, Play, Send, Save, Clock, FileText, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { isDeadlineExpired } from "../utils/timezone";
import { getMe } from "../lib/api/profile";
import type { User } from "../types";

export const StudentTaskPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskWithGrade | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState("");

  const [testInput, setTestInput] = useState(""); // Поле для введення тестових даних
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [testProgress, setTestProgress] = useState<Record<number, 'pending' | 'running' | 'passed' | 'failed'>>({});
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [theoryAcknowledged, setTheoryAcknowledged] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timeStarted, setTimeStarted] = useState<Date | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, "А" | "Б" | "В" | "Г" | "Д">>({});
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizGrade, setQuizGrade] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [deadlineRemaining, setDeadlineRemaining] = useState<number | null>(null);

  const tr = useCallback(
    (uk: string, en: string) => (i18n.language?.toLowerCase().startsWith("en") ? en : uk),
    [i18n.language]
  );

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
    const init = async () => {
      try {
        const u = await getMe();
        setUser(u);
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (taskId) {
      loadTask();
    }
  }, [taskId]);

  // Автоматичне збереження коду в localStorage при зміні
  useEffect(() => {
    if (!taskId || !code) return;
    
    // Debounce збереження - зберігаємо через 1 секунду після останньої зміни
    const timeoutId = setTimeout(() => {
      localStorage.setItem(`task_draft_${taskId}`, code);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [code, taskId]);

  // Збереження коду при виході зі сторінки (cleanup)
  useEffect(() => {
    return () => {
      // Зберігаємо код при unmount компонента
      if (taskId && code) {
        localStorage.setItem(`task_draft_${taskId}`, code);
      }
    };
  }, [taskId, code]);

  // Таймер для deadline
  useEffect(() => {
    if (!task?.deadline || task.isClosed) {
      setDeadlineRemaining(null);
      return;
    }

    const updateDeadline = () => {
      // Дедлайн приходить в UTC з backend
      const deadlineUTC = new Date(task.deadline!).getTime();
      const nowUTC = new Date().getTime(); // Поточний час в UTC
      const remaining = Math.max(0, Math.floor((deadlineUTC - nowUTC) / 1000)); // секунди
      
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
        alert(t("timeUpAutoSubmit"));
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
      
      // ВАЖЛИВО: Якщо є grade і submittedCode, використовуємо submittedCode (пройдене завдання)
      // Інакше перевіряємо localStorage для draft коду, потім збережений код з сервера, потім шаблон
      const submittedCode = data.grade?.submittedCode;
      const draftCode = localStorage.getItem(`task_draft_${taskId}`);
      const savedCode = (data as any).savedCode;
      
      // Пріоритет: submittedCode > draftCode > savedCode > template
      setCode(submittedCode || draftCode || savedCode || data.template);
      
      // Якщо є grade, показуємо результати тестів (використовуємо збережені результати)
      if (data.grade && submittedCode) {
        // Використовуємо збережені результати тестів з бази даних (якщо є)
        if (data.grade.testResults && Array.isArray(data.grade.testResults) && data.grade.testResults.length > 0) {
          // Конвертуємо збережені результати в формат TestResult
          const testResults: TestResult[] = data.grade.testResults.map((result: any) => ({
            input: result.input || "",
            expectedOutput: result.expected || result.expectedOutput || "",
            actualOutput: result.actual || result.actualOutput || "",
            passed: result.passed || false,
            error: result.stderr || result.error || null,
          }));
          
          setTestResults(testResults);
          
          // Форматуємо результати для відображення в консолі
          let consoleText = `${t("testResultsHeader", { passed: data.grade.testsPassed, total: data.grade.testsTotal })}\n\n`;
          testResults.forEach((result, index) => {
            consoleText += `${t("testCaseLine", { index: index + 1, status: result.passed ? t("passed") : t("failed") })}\n`;
            consoleText += `${t("input")}: ${result.input}\n`;
            consoleText += `${t("expected")}: ${result.expectedOutput}\n`;
            consoleText += `${t("actual")}: ${result.actualOutput}\n`;
            if (result.error) {
              consoleText += `${t("error")}: ${result.error}\n`;
            }
            consoleText += '\n';
          });
          
          setConsoleOutput(consoleText);
        } else {
          // Якщо збережених результатів немає, показуємо базову інформацію
          setConsoleOutput(
            t("gradeSummary", {
              passed: data.grade.testsPassed,
              total: data.grade.testsTotal,
              grade: data.grade.total,
            })
          );
        }
      } else {
        setConsoleOutput("");
      }
      
      // Завантажуємо quiz питання якщо є (для контрольної роботи)
      if (data.lesson.type === "CONTROL" && (data.lesson as any).quizJson) {
        try {
          const quiz = JSON.parse((data.lesson as any).quizJson);
          setQuizQuestions(quiz);
          
          // ВАЖЛИВО: Використовуємо дані з сервера як source of truth
          const serverQuizSubmitted = (data.lesson as any).quizSubmitted === true;
          const serverQuizGrade = (data.lesson as any).quizGrade !== null && (data.lesson as any).quizGrade !== undefined
            ? Number((data.lesson as any).quizGrade)
            : null;
          
          if (serverQuizSubmitted) {
            // Тест вже відправлено на сервері - використовуємо дані з сервера
            setQuizSubmitted(true);
            setQuizGrade(serverQuizGrade);
            
            // Очищаємо localStorage, щоб уникнути конфліктів
            localStorage.removeItem(`quiz_submitted_${taskId}`);
            localStorage.removeItem(`quiz_answers_${taskId}`);
          } else {
            // Тест ще не відправлено - завантажуємо збережені відповіді з localStorage (якщо є)
            const savedAnswers = localStorage.getItem(`quiz_answers_${taskId}`);
            if (savedAnswers) {
              setQuizAnswers(JSON.parse(savedAnswers));
              // Оновлюємо timestamp
              localStorage.setItem(`quiz_answers_${taskId}_timestamp`, Date.now().toString());
            }
            setQuizSubmitted(false);
            setQuizGrade(null);
          }
        } catch (e) {
          if (import.meta.env.DEV) {
            console.error("Failed to parse quiz:", e);
          }
          setQuizQuestions([]);
        }
      } else {
        setQuizQuestions([]);
        setQuizSubmitted(false);
        setQuizGrade(null);
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
      setConsoleOutput(t("enterCodeToRun"));
      return;
    }

    setRunning(true);
    setConsoleOutput(t("runningCode"));
    try {
      // Передаємо ввід через stdin
      const result = await runCode(parseInt(taskId, 10), code, testInput || undefined);
      
      // Форматуємо вивід: показуємо тільки вихідні дані (вхідні дані вже відображаються в полі вводу)
      let output = "";
      
      // Фільтруємо stderr від системних повідомлень Java
      let filteredStderr = result.stderr || "";
      filteredStderr = filteredStderr
        .split('\n')
        .filter(line => !line.includes('Picked up JAVA_TOOL_OPTIONS'))
        .filter(line => !line.includes('Picked up _JAVA_OPTIONS'))
        .join('\n')
        .trim();
      
      output += result.output || filteredStderr || t("noOutput");
      if (filteredStderr && result.output) {
        output += `\n\n${t("errors")}:\n${filteredStderr}`;
      }
      
      setConsoleOutput(output);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Failed to run:", error);
      }
      setConsoleOutput(error.response?.data?.message || t("runError"));
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!taskId || !task) return;
    
    // Перевіряємо, чи всі питання відповідені
    if (Object.keys(quizAnswers).length < quizQuestions.length) {
      alert(t("pleaseAnswerAllQuestions"));
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
      
      alert(
        t("quizCompletedWithGrade", {
          grade: result.grade.theoryGrade,
          correct: result.grade.correctAnswers,
          total: result.grade.totalQuestions,
        })
      );
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Failed to submit quiz:", error);
      }
      if (error.response?.status === 409 && error.response?.data?.message === "QUIZ_ALREADY_SUBMITTED") {
        alert(t("quizAlreadySubmitted"));
        // Re-fetch task to sync state from server
        await loadTask();
      } else {
        alert(error.response?.data?.message || t("failedToSubmitTest"));
      }
    }
  };

  // Функція для порівняння виводу (копія з backend)
  const compareOutput = (actual: string, expected: string): boolean => {
    const normalize = (str: string) => {
      const normalized = str.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
      const lines = normalized.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      return lines.join("\n");
    };

    const normalizedActual = normalize(actual);
    const normalizedExpected = normalize(expected);

    if (normalizedActual === normalizedExpected) return true;

    const noSpacesActual = normalizedActual.replace(/\s+/g, "");
    const noSpacesExpected = normalizedExpected.replace(/\s+/g, "");
    if (noSpacesActual === noSpacesExpected) return true;

    const normalizeCommas = (str: string) => str.replace(/,\s+/g, ",").replace(/\s+,/g, ",");
    if (normalizeCommas(normalizedActual) === normalizeCommas(normalizedExpected)) return true;

    return false;
  };

  // Функція для виконання тестів з показом прогресу
  const runTestsWithProgress = useCallback(async (taskIdNum: number, codeToTest: string): Promise<TestResult[]> => {
    setIsRunningTests(true);
    const results: TestResult[] = [];
    
    try {
      // Отримуємо тестові дані
      const { testData } = await getTestData(taskIdNum);
      
      // Ініціалізуємо прогрес для всіх тестів
      const initialProgress: Record<number, 'pending' | 'running' | 'passed' | 'failed'> = {};
      testData.forEach((test) => {
        initialProgress[test.id] = 'pending';
      });
      setTestProgress(initialProgress);
      
      // Виконуємо тести ПАРАЛЕЛЬНО з одночасним оновленням анімації
      // Спочатку встановлюємо всі тести в статус "running" одночасно
      const runningProgress: Record<number, 'running'> = {};
      testData.forEach((test) => {
        runningProgress[test.id] = 'running';
      });
      setTestProgress(runningProgress);
      
      // Даємо React час оновити UI перед початком виконання
      await new Promise(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      }));
      
      // Запускаємо всі тести паралельно
      const testPromises = testData.map(async (test) => {
        try {
          // Виконуємо код з вхідними даними тесту ПАРАЛЕЛЬНО
          const result = await runCode(taskIdNum, codeToTest, test.input);
          
          // Порівнюємо результат
          const passed = compareOutput(result.output || "", test.expectedOutput);
          
          // Встановлюємо статус "passed" або "failed" одразу після завершення
          setTestProgress(prev => ({ ...prev, [test.id]: passed ? 'passed' : 'failed' }));
          
          // Повертаємо результат
          return {
            input: test.input,
            expected: test.expectedOutput,
            actual: result.output || "",
            stderr: result.stderr,
            passed,
          };
        } catch (error: any) {
          // Помилка виконання
          setTestProgress(prev => ({ ...prev, [test.id]: 'failed' }));
          return {
            input: test.input,
            expected: test.expectedOutput,
            actual: "",
            stderr: error.response?.data?.message || "Помилка виконання",
            passed: false,
          };
        }
      });
      
      // Чекаємо завершення всіх тестів
      const testResults = await Promise.all(testPromises);
      results.push(...testResults);
    } finally {
      setIsRunningTests(false);
    }
    
    return results;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!taskId || !code.trim()) {
      alert(t("enterCode"));
      return;
    }

    // Перевірка перед відправкою
    if (task?.isClosed) {
      alert(t("taskClosedCannotSubmit"));
      return;
    }
    // Перевірка дедлайну в UTC
    if (task?.deadline && isDeadlineExpired(task.deadline)) {
      alert(t("deadlinePassedCannotSubmit"));
      return;
    }
    if (task?.maxAttempts && task.attemptsUsed !== undefined && task.attemptsUsed >= task.maxAttempts) {
      alert(t("attemptsExhaustedCannotSubmit", { maxAttempts: task.maxAttempts }));
      return;
    }

    setSubmitting(true);
    setTestResults([]);
    setConsoleOutput(t("checkingCode"));
    
    try {
      // Спочатку виконуємо тести на фронтенді для показу прогресу
      const localTestResults = await runTestsWithProgress(parseInt(taskId, 10), code);
      setTestResults(localTestResults);
      
      // Тепер відправляємо на бекенд для збереження
      const result = await submitCode(parseInt(taskId, 10), code);
      
      // Видаляємо draft код з localStorage після успішної відправки
      if (taskId) {
        localStorage.removeItem(`task_draft_${taskId}`);
      }
      
      // Використовуємо результати з бекенду (як source of truth)
      const finalTestResults = result.testResults || localTestResults;
      setTestResults(finalTestResults);
      
      // Оновлюємо прогрес на основі результатів з бекенду
      // Отримуємо тестові дані для маппінгу результатів
      const { testData } = await getTestData(parseInt(taskId, 10));
      const updatedProgress: Record<number, 'pending' | 'running' | 'passed' | 'failed'> = {};
      
      // Маппимо результати з бекенду до testProgress за input (більш надійно, ніж за індексом)
      finalTestResults.forEach((testResult) => {
        // Знаходимо тест за input
        const test = testData.find(t => t.input === testResult.input);
        if (test) {
          updatedProgress[test.id] = testResult.passed ? 'passed' : 'failed';
        }
      });
      
      // Оновлюємо прогрес тільки якщо є результати
      if (Object.keys(updatedProgress).length > 0) {
        setTestProgress(updatedProgress);
      }
      
      setShowResults(true);
      
      // Перевіряємо чи завдання потребує ручної перевірки
      if (result.requiresManualReview) {
        setConsoleOutput(t('taskSubmittedForReview'));
        alert(t('taskSubmittedForReview'));
        await loadTask(); // Reload to get updated grade
        setSubmitting(false);
        return;
      }
      
      if (result.grade.total !== null) {
        setConsoleOutput(`${t('reviewCompleted')}: ${result.grade.testsPassed}/${result.grade.testsTotal}. ${t('gradeOutOf')}: ${result.grade.total}/12`);
      } else {
        setConsoleOutput(t('taskSubmittedForReview'));
      }
      await loadTask(); // Reload to get updated grade
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Failed to submit:", error);
      }
      const errorMessage = error.response?.data?.message || t('failedToSubmit');
      setConsoleOutput(errorMessage);
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [taskId, code, task?.isClosed, task?.deadline, task?.maxAttempts, task?.attemptsUsed, loadTask, t, runTestsWithProgress]);

  const handleComplete = useCallback(async () => {
    if (!taskId || !code.trim()) {
      alert(t("enterCode"));
      return;
    }

    // Перевірка перед завершенням
    if (task?.isClosed) {
      alert(t("taskClosedCannotComplete"));
      return;
    }
    if (task?.deadline && isDeadlineExpired(task.deadline)) {
      alert(t("deadlinePassedCannotComplete"));
      return;
    }
    if (task?.grade?.isCompleted) {
      alert(t("taskLockedManualGrade"));
      return;
    }

    if (!confirm(t("confirmCompleteEarly"))) {
      return;
    }

    setSubmitting(true);
    setTestResults([]);
    setConsoleOutput(t("completingTaskRunningFinalTest"));
    
    try {
      // Спочатку виконуємо тести на фронтенді для показу прогресу
      const localTestResults = await runTestsWithProgress(parseInt(taskId, 10), code);
      setTestResults(localTestResults);
      
      // Тепер відправляємо на бекенд для збереження
      const result = await completeTask(parseInt(taskId, 10), code);
      
      // Видаляємо draft код з localStorage після успішного завершення
      if (taskId) {
        localStorage.removeItem(`task_draft_${taskId}`);
      }
      
      // Використовуємо результати з бекенду (як source of truth)
      const finalTestResults = result.testResults || localTestResults;
      setTestResults(finalTestResults);
      
      // Оновлюємо прогрес на основі результатів з бекенду
      // Отримуємо тестові дані для маппінгу результатів
      const { testData } = await getTestData(parseInt(taskId, 10));
      const updatedProgress: Record<number, 'pending' | 'running' | 'passed' | 'failed'> = {};
      
      // Маппимо результати з бекенду до testProgress за input (більш надійно, ніж за індексом)
      finalTestResults.forEach((testResult) => {
        // Знаходимо тест за input
        const test = testData.find(t => t.input === testResult.input);
        if (test) {
          updatedProgress[test.id] = testResult.passed ? 'passed' : 'failed';
        }
      });
      
      // Оновлюємо прогрес тільки якщо є результати
      if (Object.keys(updatedProgress).length > 0) {
        setTestProgress(updatedProgress);
      }
      
      setShowResults(true);
      
      if (result.requiresManualReview) {
        setConsoleOutput(t("taskCompletedEarlySent"));
        alert(t("taskCompletedEarlySent"));
      } else if (result.grade.total !== null) {
        setConsoleOutput(
          t("taskCompletedEarlyDetailed", {
            passed: result.grade.testsPassed,
            total: result.grade.testsTotal,
            grade: result.grade.total,
          })
        );
        alert(t("taskCompletedEarlyWithGrade", { grade: result.grade.total }));
      } else {
        setConsoleOutput(t("taskCompletedEarly"));
        alert(t("taskCompletedEarly"));
      }
      
      await loadTask(); // Reload to get updated grade
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Failed to complete task:", error);
      }
      const errorMessage = error.response?.data?.message || t("failedToCompleteTask");
      setConsoleOutput(errorMessage);
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [taskId, code, task?.isClosed, task?.deadline, task?.grade?.isCompleted, loadTask, t, runTestsWithProgress]);

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
    if (task.grade?.isCompleted) return false; // Завдання завершено достроково
    if (task.grade && task.grade.total >= 6) return false; // Якщо оцінка >= 6, не можна редагувати
    if (task.isClosed) return false; // Завдання закрите
    if (task.deadline && isDeadlineExpired(task.deadline)) return false; // Deadline пройшов (перевірка в UTC)
    if (task.maxAttempts && task.attemptsUsed !== undefined && task.attemptsUsed >= task.maxAttempts) return false; // Вичерпано спроби
    return true;
  }, [task?.grade, task?.isClosed, task?.deadline, task?.maxAttempts, task?.attemptsUsed, task]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-primary font-mono">
        {t("loading")}
      </div>
    );
  }

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-text-primary font-mono">
        {t("taskNotFound")}
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
                {t("back")}
              </Button>
              <div>
                <h1 className="text-lg font-mono text-text-primary mb-1">{task.title}</h1>
                <div className="text-xs font-mono text-text-muted flex items-center gap-2">
                  <span>
                    {task.lesson.type === "LESSON"
                      ? t("lesson")
                      : task.lesson.type === "TOPIC"
                      ? t("topic")
                      : t("controlWork")}{" "}
                    · {task.language}
                  </span>
                  {task.testDataCount !== undefined && (
                    <span className="text-text-secondary">· {t("tests")}: {task.testDataCount}</span>
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
                    ? t("timeHhMm", { h: Math.floor(deadlineRemaining / 3600), m: Math.floor((deadlineRemaining % 3600) / 60) })
                    : deadlineRemaining > 60
                    ? t("timeMm", { m: Math.floor(deadlineRemaining / 60) })
                    : t("timeSs", { s: deadlineRemaining })
                  }
                </div>
              )}
              {/* Спроби */}
              {task.maxAttempts !== undefined && task.attemptsUsed !== undefined && (
                <div className="text-xs font-mono text-text-secondary mr-4">
                  {t("attempts")}: {task.attemptsUsed}/{task.maxAttempts}
                </div>
              )}
              {/* Статус закриття */}
              {task.isClosed && (
                <div className="text-xs font-mono text-accent-error mr-4">
                  {t("taskClosed")}
                </div>
              )}
              {task.grade && (
                <div className={`text-sm font-mono font-bold mr-4 flex items-center ${
                  task.grade.total >= 10 ? "text-accent-success" :
                  task.grade.total >= 7 ? "text-accent-warn" :
                  task.grade.total >= 4 ? "text-yellow-500" :
                  "text-accent-error"
                }`}>
                  {t("grade")}: {task.grade.total}/12
                </div>
              )}
              {theoryAcknowledged && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      // Повернутися до теорії
                      setTheoryAcknowledged(false);
                    }}
                    className="text-xs"
                  >
                  <FileText className="w-3 h-3 mr-1" /> {t("theory")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleRun}
                    disabled={!canEdit || running}
                    className="text-xs"
                  >
                  <Play className="w-3 h-3 mr-1" /> {tr("Запустити", "Run")}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={!canEdit || submitting || task.grade?.isCompleted}
                    className="text-xs"
                  >
                    <Send className="w-3 h-3 mr-1" />
                  {submitting ? tr("Перевірка...", "Checking...") : tr("Відправити", "Submit")}
                  </Button>
                  {canEdit && !task.grade?.isCompleted && (
                    <Button
                      variant="ghost"
                      onClick={handleComplete}
                      disabled={submitting}
                      className="text-xs border border-accent-warn text-accent-warn hover:bg-accent-warn/10"
                    title={tr(
                      "Завершити завдання достроково (закриє можливість редагування)",
                      "Complete the task early (will disable editing)"
                    )}
                    >
                    {tr("✓ Завершити", "✓ Complete")}
                    </Button>
                  )}
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
                {t("back")}
              </Button>
              <h1 className="text-lg font-mono text-text-primary">{task.title}</h1>
            </div>
          </div>
              <div className="flex-1 overflow-y-auto p-8 pb-24">
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-2xl font-mono text-text-primary mb-6">{t("theory")}</h2>
                  <div className="prose prose-invert max-w-none text-text-secondary font-mono">
                    <MarkdownView content={task.lesson.theory || ""} />
                  </div>
                </div>
              </div>
              <div className="bg-bg-surface p-4 flex-shrink-0 fixed bottom-0 left-0 right-0 z-30 shadow-lg">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                  <p className="text-xs font-mono text-text-secondary flex-1">
                    {tr(
                      "Після прочитання теорії ви зможете перейти до практичного завдання",
                      "After reading theory you can proceed to the practice task"
                    )}
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => {
                      console.log("Theory acknowledged");
                      setTheoryAcknowledged(true);
                    }}
                    className="text-base px-8 py-3 font-semibold whitespace-nowrap shadow-md hover:shadow-lg transition-all"
                  >
                    {tr("✓ Я прочитав теорію", "✓ I have read the theory")}
                  </Button>
                </div>
              </div>
            </div>
      ) : (
        <Group className="flex-1 overflow-hidden">
            {/* Left: Quiz (for control works) or Task Description */}
            <Panel defaultSize={25} minSize={15} maxSize={60} className="flex flex-col overflow-hidden bg-bg-surface border-r border-border">
              <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <div className="text-sm font-mono text-text-primary flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {task.lesson.type === "CONTROL" && quizQuestions.length > 0
                    ? tr("Теоретична частина", "Theory part")
                    : t("task")}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {task.lesson.type === "CONTROL" && quizQuestions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="mb-4 pb-3 border-b border-border">
                      <h3 className="text-lg font-mono text-text-primary mb-1">{tr("Теоретична частина", "Theory part")}</h3>
                      <p className="text-xs text-text-secondary">
                        {tr(
                          "Відповідьте на всі питання. Після відправки змінити відповіді буде неможливо.",
                          "Answer all questions. After submitting, you will not be able to change your answers."
                        )}
                      </p>
                      <div className="mt-2 text-xs text-text-muted">
                        {tr("Progress", "Progress")}: {Object.keys(quizAnswers).length} / {quizQuestions.length}{" "}
                        {tr("питань", "questions")}
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
                              <span className="text-xs text-primary">{tr("✓ Відповідь вибрано", "✓ Answer selected")}</span>
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
                                {tr("Залишилось відповісти на", "Remaining")}{" "}
                                {quizQuestions.length - Object.keys(quizAnswers).length}{" "}
                                {tr("питань", "questions")}
                              </span>
                            ) : (
                              <span className="text-accent-success">{tr("Всі питання відповідені", "All questions answered")}</span>
                            )}
                          </div>
                          <Button
                            variant="primary"
                            onClick={handleSubmitQuiz}
                            disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                            className="text-sm px-6 py-2 font-semibold"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {tr("Відправити тест", "Submit quiz")}
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
                            {tr("Оцінка за теоретичну частину", "Theory part grade")}
                          </div>
                          <div className="text-xs text-text-muted">
                            {tr("Correct answers", "Correct answers")}:{" "}
                            {Object.keys(quizAnswers).filter(i => quizQuestions[parseInt(i)]?.correct === quizAnswers[parseInt(i)]).length}{" "}
                            {tr("з", "of")} {quizQuestions.length}
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

            {/* Right: Console with Input/Output */}
            <Panel defaultSize={25} minSize={10} maxSize={50} className="flex flex-col overflow-hidden bg-bg-surface border-l border-border">
              <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <div className="text-sm font-mono text-text-primary flex items-center gap-2">
                  <Play className="w-4 h-4" /> {tr("Консоль", "Console")}
                </div>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Input section */}
                <div className="border-b border-border p-3 flex-shrink-0">
                  <div className="text-xs font-mono text-text-secondary mb-2">{tr("Вхідні дані:", "Input:")}</div>
                  <textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder={tr("Введіть тестові дані...", "Enter test input...")}
                    className="w-full h-24 bg-bg-code border border-border rounded p-2 font-mono text-xs text-text-primary resize-none focus:outline-none focus:border-primary"
                    spellCheck={false}
                  />
                </div>
                {/* Output section */}
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Показуємо прогрес тестів під час виконання */}
                  {isRunningTests && Object.keys(testProgress).length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs font-mono text-text-primary mb-3">{tr("Проходження тестів:", "Test progress:")}</div>
                      {Object.entries(testProgress)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([testId, status], index) => (
                          <div key={testId} className="flex items-center gap-2 text-xs font-mono">
                            {status === 'pending' && (
                              <span className="text-text-muted">{tr("Тест", "Test")} {index + 1}</span>
                            )}
                            {status === 'running' && (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                <span className="text-text-primary">{tr("Тест", "Test")} {index + 1}</span>
                              </>
                            )}
                            {status === 'passed' && (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-accent-success" />
                                <span className="text-accent-success">{tr("Тест", "Test")} {index + 1}</span>
                              </>
                            )}
                            {status === 'failed' && (
                              <>
                                <XCircle className="w-3 h-3 text-accent-error" />
                                <span className="text-accent-error">{tr("Тест", "Test")} {index + 1}</span>
                              </>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : consoleOutput ? (
                    <pre 
                      className="text-xs text-text-secondary whitespace-pre-wrap m-0"
                      style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", "Courier New", monospace' }}
                    >
                      {consoleOutput}
                    </pre>
                  ) : (
                    <span className="text-text-muted italic">
                      {tr("// Результат виконання з'явиться тут...", "// Program output will appear here...")}
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
          title={tr("Результати тестування", "Test results")}
          showCloseButton={false}
        >
          <div className="p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-mono text-text-primary mb-4">{tr("Результати тестування", "Test results")}</h2>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono text-text-primary">{tr("Тест", "Test")} {index + 1}</span>
                    {result.passed ? (
                      <span className="text-xs text-accent-success">{tr("✓ Пройдено", "✓ Passed")}</span>
                    ) : (
                      <span className="text-xs text-accent-error">{tr("✗ Не пройдено", "✗ Failed")}</span>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary space-y-1">
                    <div>
                      <strong>{tr("Вхід", "Input")}:</strong> {result.input}
                    </div>
                    <div>
                      <strong>{tr("Очікувано", "Expected")}:</strong> {result.expected}
                    </div>
                    <div>
                      <strong>{tr("Отримано", "Actual")}:</strong> {result.actual}
                    </div>
                    {result.stderr && (
                      <div className="text-accent-error">
                        <strong>{tr("Помилка", "Error")}:</strong> {result.stderr}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowResults(false)}>{tr("Закрити", "Close")}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
