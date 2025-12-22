// frontend/src/pages/LessonDetailsPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import {
  getLesson,
  createTask,
  generateTestData,
  getTaskGrades,
  generateQuiz,
  saveQuiz,
  submitQuizAnswers,
  getTestData,
  updateTestData,
  deleteTestData,
  addTestData,
  updateTaskDetails,
  getTask,
  type Lesson,
  type Task,
  type CreateTaskRequest,
  type TestData,
  type TestDataItem,
  type TaskWithGrade,
} from "../lib/api/edu";
import { Plus, ArrowLeft, FileText, Users, Sparkles, Play, Trash2, Edit2, X, Send, Settings, Save } from "lucide-react";
import { getMe } from "../lib/api/profile";
import { MarkdownView } from "../components/MarkdownView";
import type { User } from "../types";

export const LessonDetailsPage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson & { tasks: Task[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTask, setNewTask] = useState<CreateTaskRequest>({
    title: "",
    description: "",
    template: "",
  });
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showGrades, setShowGrades] = useState(false);
  const [grades, setGrades] = useState<any[]>([]);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizTopicTitle, setQuizTopicTitle] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizCount, setQuizCount] = useState(12);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    question: "",
    options: { А: "", Б: "", В: "", Г: "", Д: "" },
    correct: "А" as "А" | "Б" | "В" | "Г" | "Д",
  });
  const [showTestDataModal, setShowTestDataModal] = useState(false);
  const [testDataTaskId, setTestDataTaskId] = useState<number | null>(null);
  const [testDataList, setTestDataList] = useState<TestData[]>([]);
  const [editingTestIndex, setEditingTestIndex] = useState<number | null>(null);
  const [editingTest, setEditingTest] = useState<{ input: string; expectedOutput: string; points: number } | null>(null);
  const [newTestCount, setNewTestCount] = useState(10);
  const [loadingTestData, setLoadingTestData] = useState(false);
  const [showTaskSettings, setShowTaskSettings] = useState(false);
  const [settingsTask, setSettingsTask] = useState<TaskWithGrade | null>(null);
  const [taskMaxAttempts, setTaskMaxAttempts] = useState<number>(1);
  const [taskDeadline, setTaskDeadline] = useState<string>("");
  const [taskIsClosed, setTaskIsClosed] = useState<boolean>(false);
  // Quiz state for students
  const [studentQuizAnswers, setStudentQuizAnswers] = useState<Record<number, "А" | "Б" | "В" | "Г" | "Д">>({});
  const [studentQuizSubmitted, setStudentQuizSubmitted] = useState(false);
  const [studentQuizGrade, setStudentQuizGrade] = useState<number | null>(null);
  const [hasAutoRedirected, setHasAutoRedirected] = useState(false);

  useEffect(() => {
    loadUser();
    if (lessonId) {
      loadLesson();
      // Скидаємо прапорець при зміні уроку
      setHasAutoRedirected(false);
    }
  }, [lessonId]);

  // Автоматичний перехід на завдання для звичайних уроків з одним завданням
  useEffect(() => {
    if (lesson && user?.userMode === "EDUCATIONAL" && user?.studentId && !hasAutoRedirected) {
      // Для учнів: якщо урок має одне завдання, автоматично переходимо на нього
      // Але тільки один раз, щоб не було циклу при поверненні назад
      if (lesson.type === "LESSON" && lesson.tasks.length === 1) {
        const task = lesson.tasks[0];
        setHasAutoRedirected(true);
        // Використовуємо navigate замість window.location.href для кращої інтеграції з React Router
        navigate(`/edu/tasks/${task.id}`, { replace: true });
      }
    }
  }, [lesson, user, hasAutoRedirected, navigate]);

  const loadUser = async () => {
    try {
      const u = await getMe();
      setUser(u);
    } catch (error) {
      console.error("Failed to load user:", error);
    }
  };

  const loadLesson = async () => {
    if (!lessonId) return;
    try {
      const data = await getLesson(parseInt(lessonId, 10));
      setLesson(data);
      // Завантажуємо quiz питання якщо є
      if (data.quizJson) {
        try {
          const quiz = JSON.parse(data.quizJson);
          setQuizQuestions(quiz);
          
          // Завантажуємо збережені відповіді учня (якщо учень)
          if (user?.userMode === "EDUCATIONAL" && user?.studentId) {
            const savedAnswers = localStorage.getItem(`quiz_answers_lesson_${lessonId}`);
            if (savedAnswers) {
              setStudentQuizAnswers(JSON.parse(savedAnswers));
            }
            const submitted = localStorage.getItem(`quiz_submitted_lesson_${lessonId}`);
            if (submitted === "true") {
              setStudentQuizSubmitted(true);
              const grade = localStorage.getItem(`quiz_grade_lesson_${lessonId}`);
              if (grade) {
                setStudentQuizGrade(parseFloat(grade));
              }
            }
          }
        } catch (e) {
          console.error("Failed to parse quiz:", e);
        }
      } else {
        setQuizQuestions([]);
      }
    } catch (error: any) {
      console.error("Failed to load lesson:", error);
      if (error.response?.status === 404 || error.response?.status === 403) {
        // Показуємо повідомлення про помилку
        alert(error.response?.data?.message || "Урок не знайдено");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!lessonId || !newTask.title.trim() || !newTask.description.trim() || !newTask.template.trim()) {
      alert("Заповніть всі поля");
      return;
    }

    try {
      await createTask(parseInt(lessonId, 10), newTask);
      setNewTask({ title: "", description: "", template: "" });
      setShowCreateTask(false);
      await loadLesson();
    } catch (error: any) {
      console.error("Failed to create task:", error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || "Не вдалося створити завдання";
      alert(errorMessage);
    }
  };

  const handleGenerateTests = async (taskId: number, count: number) => {
    try {
      await generateTestData(taskId, count);
      alert(`Згенеровано ${count} тестових даних`);
      await loadLesson();
      if (showTestDataModal && testDataTaskId === taskId) {
        await loadTestData(taskId);
      }
    } catch (error: any) {
      console.error("Failed to generate tests:", error);
      alert(error.response?.data?.message || "Не вдалося згенерувати тести");
    }
  };

  const loadTestData = async (taskId: number) => {
    setLoadingTestData(true);
    try {
      const data = await getTestData(taskId);
      setTestDataList(data.testData);
    } catch (error: any) {
      console.error("Failed to load test data:", error);
      alert(error.response?.data?.message || "Не вдалося завантажити тести");
    } finally {
      setLoadingTestData(false);
    }
  };

  const handleOpenTestDataModal = async (taskId: number) => {
    setTestDataTaskId(taskId);
    setShowTestDataModal(true);
    await loadTestData(taskId);
  };

  const handleSaveTest = async (testDataId: number, index: number) => {
    if (!testDataTaskId || !editingTest) return;
    try {
      await updateTestData(testDataTaskId, testDataId, editingTest);
      await loadTestData(testDataTaskId);
      setEditingTestIndex(null);
      setEditingTest(null);
    } catch (error: any) {
      console.error("Failed to update test:", error);
      alert(error.response?.data?.message || "Не вдалося оновити тест");
    }
  };

  const handleDeleteTest = async (testDataId: number) => {
    if (!testDataTaskId) return;
    if (!confirm("Видалити цей тест?")) return;
    try {
      await deleteTestData(testDataTaskId, testDataId);
      await loadTestData(testDataTaskId);
      await loadLesson();
    } catch (error: any) {
      console.error("Failed to delete test:", error);
      alert(error.response?.data?.message || "Не вдалося видалити тест");
    }
  };

  const handleAddNewTest = async () => {
    if (!testDataTaskId || !editingTest) return;
    try {
      await addTestData(testDataTaskId, [editingTest]);
      await loadTestData(testDataTaskId);
      setEditingTestIndex(null);
      setEditingTest(null);
    } catch (error: any) {
      console.error("Failed to add test:", error);
      alert(error.response?.data?.message || "Не вдалося додати тест");
    }
  };

  const handleOpenTaskSettings = async (taskId: number) => {
    try {
      const task = await getTask(taskId);
      setSettingsTask(task);
      setTaskMaxAttempts(task.maxAttempts || 1);
      setTaskDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "");
      setTaskIsClosed(task.isClosed || false);
      setShowTaskSettings(true);
    } catch (error: any) {
      console.error("Failed to load task:", error);
      alert(error.response?.data?.message || "Не вдалося завантажити завдання");
    }
  };

  const handleSaveTaskSettings = async () => {
    if (!settingsTask) return;
    try {
      await updateTaskDetails(settingsTask.id, {
        maxAttempts: taskMaxAttempts,
        deadline: taskDeadline || null,
        isClosed: taskIsClosed,
      });
      await loadLesson();
      setShowTaskSettings(false);
      setSettingsTask(null);
    } catch (error: any) {
      console.error("Failed to update task settings:", error);
      alert(error.response?.data?.message || "Не вдалося оновити налаштування");
    }
  };

  const handleViewGrades = async (taskId: number) => {
    try {
      const data = await getTaskGrades(taskId);
      setGrades(data);
      setSelectedTaskId(taskId);
      setShowGrades(true);
    } catch (error) {
      console.error("Failed to load grades:", error);
      alert("Не вдалося завантажити оцінки");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-primary font-mono">
        Завантаження...
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="h-full flex items-center justify-center text-text-primary font-mono">
        Урок не знайдено
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ height: 'calc(100vh - 4rem)' }}>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <h1 className="text-2xl font-mono text-text-primary">{lesson.title}</h1>
          <span className="text-xs text-text-muted px-2 py-1 border border-border">
            {lesson.type === "LESSON" ? "Урок" : "Контрольна"}
          </span>
        </div>

        {lesson.hasTheory && lesson.theory && (
          <Card className="p-4 mb-6">
            <h2 className="text-lg font-mono text-text-primary mb-3">Теорія</h2>
            <div className="prose prose-invert max-w-none text-text-secondary font-mono text-sm">
              <MarkdownView content={lesson.theory} />
            </div>
          </Card>
        )}

        {/* Quiz Generation and Display for Control Works */}
        {lesson.type === "CONTROL" && lesson.controlHasTheory && (
          <Card className="p-4 mb-6">
            <h2 className="text-lg font-mono text-text-primary mb-3">Теоретична частина (Питання)</h2>
            
            {/* Quiz Display */}
            {lesson.quizJson && (() => {
              try {
                const quiz = JSON.parse(lesson.quizJson);
                return (
                  <div className="mb-4 space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {quiz.map((q: any, index: number) => (
                      <div key={index} className="p-3 border border-border bg-bg-base relative">
                        {user?.userMode === "EDUCATIONAL" && !user?.studentId && (
                          <div className="absolute top-2 right-2 flex gap-1">
                            <button
                              onClick={() => {
                                setNewQuestion({
                                  question: q.question,
                                  options: { ...q.options },
                                  correct: q.correct,
                                });
                                setEditingQuestionIndex(index);
                                setShowAddQuestion(true);
                              }}
                              className="text-xs p-1 h-6 w-6 border border-border hover:bg-bg-hover flex items-center justify-center"
                              title="Редагувати питання"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm("Видалити це питання?")) return;
                                try {
                                  const updatedQuiz = [...quiz];
                                  updatedQuiz.splice(index, 1);
                                  await saveQuiz(parseInt(lessonId!, 10), updatedQuiz);
                                  await loadLesson();
                                } catch (error: any) {
                                  console.error("Failed to delete question:", error);
                                  alert("Не вдалося видалити питання");
                                }
                              }}
                              className="text-xs p-1 h-6 w-6 border border-border hover:bg-bg-hover flex items-center justify-center text-accent-error"
                              title="Видалити питання"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <div className="text-sm font-mono text-text-primary mb-2 pr-16">
                          {index + 1}. {q.question}
                        </div>
                        <div className="space-y-1 text-xs text-text-secondary">
                          {Object.entries(q.options || {}).map(([key, value]: [string, any]) => (
                            <div key={key} className="flex items-center gap-2">
                              <span className="font-mono">{key})</span>
                              <span>{value}</span>
                              {q.correct === key && user?.userMode === "EDUCATIONAL" && !user?.studentId && (
                                <span className="text-accent-success ml-2">✓ Правильна відповідь</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              } catch (e) {
                console.error("Failed to parse quiz:", e);
                return null;
              }
            })()}

            {/* Quiz Management (only for teachers) */}
            {user?.userMode === "EDUCATIONAL" && !user?.studentId && (
              <>
                {/* Add Question Button */}
                {lesson.quizJson && (
                  <div className="mb-3">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setNewQuestion({
                          question: "",
                          options: { А: "", Б: "", В: "", Г: "", Д: "" },
                          correct: "А",
                        });
                        setEditingQuestionIndex(null);
                        setShowAddQuestion(true);
                      }}
                      className="text-xs"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Додати питання
                    </Button>
                  </div>
                )}
                {!lesson.quizJson && (
                  <>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={quizTopicTitle}
                        onChange={(e) => setQuizTopicTitle(e.target.value)}
                        placeholder="Назва теми для генерації питань"
                        className="flex-1 px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                      />
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={quizCount}
                        onChange={(e) => setQuizCount(parseInt(e.target.value) || 12)}
                        placeholder="Кількість"
                        className="w-24 px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                      />
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          if (!lessonId || !quizTopicTitle.trim()) {
                            alert("Введіть назву теми");
                            return;
                          }
                          setGeneratingQuiz(true);
                          try {
                            const result = await generateQuiz(parseInt(lessonId, 10), quizCount, quizTopicTitle);
                            alert(`Згенеровано ${result.count} питань`);
                            setQuizTopicTitle("");
                            await loadLesson();
                          } catch (error: any) {
                            console.error("Failed to generate quiz:", error);
                            alert(error.response?.data?.message || "Не вдалося згенерувати питання");
                          } finally {
                            setGeneratingQuiz(false);
                          }
                        }}
                        disabled={generatingQuiz}
                        className="text-xs"
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        {generatingQuiz ? "Генерація..." : "Згенерувати"}
                      </Button>
                    </div>
                    <p className="text-xs text-text-muted">
                      Згенеруйте питання для теоретичної частини контрольної роботи
                    </p>
                  </>
                )}
              </>
            )}
          </Card>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-mono text-text-primary">
            {lesson.type === "LESSON" ? "Завдання" : "Завдання"} ({lesson.tasks.length})
          </h2>
          {user?.userMode === "EDUCATIONAL" && !user?.studentId && (
            <Button 
              onClick={() => {
                // Для звичайних уроків перевіряємо, чи вже є завдання
                if (lesson.type === "LESSON" && lesson.tasks.length > 0) {
                  alert("Звичайний урок може мати тільки одне завдання. Видаліть існуюче завдання або створіть контрольну роботу для множинних завдань.");
                  return;
                }
                setShowCreateTask(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Додати завдання
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {lesson.tasks.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-text-secondary">Немає завдань</p>
            </Card>
          ) : (
            lesson.tasks.map((task) => (
              <Card key={task.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-mono text-text-primary mb-2">{task.title}</h3>
                    <div className="text-sm text-text-secondary mb-2 line-clamp-2">
                      {task.description}
                    </div>
                    <div className="text-xs text-text-muted">
                      Тестів: {task.testDataCount}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {user?.userMode === "EDUCATIONAL" && !user?.studentId ? (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => handleViewGrades(task.id)}
                          className="text-xs"
                        >
                          <Users className="w-4 h-4 mr-1" />
                          Оцінки
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleOpenTestDataModal(task.id)}
                          className="text-xs"
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Тести ({task.testDataCount})
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleOpenTaskSettings(task.id)}
                          className="text-xs"
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Налаштування
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => {
                          window.location.href = `/edu/tasks/${task.id}`;
                        }}
                        className="text-xs"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Виконати
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateTask && (
        <Modal 
          open={showCreateTask}
          onClose={() => setShowCreateTask(false)}
          title="Створити завдання"
          showCloseButton={false}
        >
          <div className="p-6 max-w-3xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-mono text-text-primary mb-4">Створити завдання</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-text-secondary mb-2">
                  Назва завдання *
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-text-secondary mb-2">
                  Опис завдання (Markdown) *
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-primary min-h-[150px]"
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-text-secondary mb-2">
                  Шаблон коду *
                </label>
                <textarea
                  value={newTask.template}
                  onChange={(e) => setNewTask({ ...newTask, template: e.target.value })}
                  className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-primary min-h-[200px] font-mono text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowCreateTask(false)}>
                  Скасувати
                </Button>
                <Button onClick={handleCreateTask}>Створити</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add/Edit Question Modal */}
      {showAddQuestion && (
        <Modal
          open={showAddQuestion}
          onClose={() => {
            setShowAddQuestion(false);
            setEditingQuestionIndex(null);
            setNewQuestion({
              question: "",
              options: { А: "", Б: "", В: "", Г: "", Д: "" },
              correct: "А",
            });
          }}
          title={editingQuestionIndex !== null ? "Редагувати питання" : "Додати питання"}
          showCloseButton={false}
        >
          <div className="p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-text-secondary mb-2">
                  Питання *
                </label>
                <textarea
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                  placeholder="Введіть текст питання"
                  className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary resize-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-text-secondary mb-2">
                  Варіанти відповідей *
                </label>
                <div className="space-y-2">
                  {Object.entries(newQuestion.options).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="font-mono w-6 text-text-secondary">{key})</span>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          setNewQuestion({
                            ...newQuestion,
                            options: { ...newQuestion.options, [key]: e.target.value },
                          })
                        }
                        placeholder={`Варіант ${key}`}
                        className="flex-1 px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                      />
                      <input
                        type="radio"
                        name="correct"
                        checked={newQuestion.correct === key}
                        onChange={() => setNewQuestion({ ...newQuestion, correct: key as "А" | "Б" | "В" | "Г" | "Д" })}
                        className="w-4 h-4"
                      />
                      <span className="text-xs text-text-muted">Правильна</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddQuestion(false);
                  setEditingQuestionIndex(null);
                  setNewQuestion({
                    question: "",
                    options: { А: "", Б: "", В: "", Г: "", Д: "" },
                    correct: "А",
                  });
                }}
              >
                Скасувати
              </Button>
              <Button
                onClick={async () => {
                  if (!newQuestion.question.trim()) {
                    alert("Введіть текст питання");
                    return;
                  }
                  if (Object.values(newQuestion.options).some((v) => !v.trim())) {
                    alert("Заповніть всі варіанти відповідей");
                    return;
                  }
                  try {
                    const currentQuiz = lesson?.quizJson
                      ? JSON.parse(lesson.quizJson)
                      : [];
                    const updatedQuiz = [...currentQuiz];
                    
                    if (editingQuestionIndex !== null) {
                      updatedQuiz[editingQuestionIndex] = newQuestion;
                    } else {
                      updatedQuiz.push(newQuestion);
                    }
                    
                    await saveQuiz(parseInt(lessonId!, 10), updatedQuiz);
                    await loadLesson();
                    setShowAddQuestion(false);
                    setEditingQuestionIndex(null);
                    setNewQuestion({
                      question: "",
                      options: { А: "", Б: "", В: "", Г: "", Д: "" },
                      correct: "А",
                    });
                  } catch (error: any) {
                    console.error("Failed to save question:", error);
                    alert(error.response?.data?.message || "Не вдалося зберегти питання");
                  }
                }}
              >
                {editingQuestionIndex !== null ? "Зберегти зміни" : "Додати питання"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Grades Modal */}
      {showGrades && (
        <Modal 
          open={showGrades}
          onClose={() => setShowGrades(false)}
          title="Оцінки учнів"
          showCloseButton={false}
        >
          <div className="p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-mono text-text-primary mb-4">Оцінки учнів</h2>
            <div className="space-y-2">
              {grades.map((item, index) => (
                <div
                  key={index}
                  className="p-3 border border-border bg-bg-surface flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-mono text-text-primary">
                      {item.student.lastName} {item.student.firstName} {item.student.middleName || ""}
                    </div>
                    <div className="text-xs text-text-secondary">{item.student.email}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    {item.grade ? (
                      <>
                        <div className="text-right">
                          <div className={`text-lg font-mono font-bold ${
                            item.grade.total >= 10 ? "text-accent-success" :
                            item.grade.total >= 7 ? "text-accent-warn" :
                            item.grade.total >= 4 ? "text-yellow-500" :
                            "text-accent-error"
                          }`}>
                            {item.grade.total}
                          </div>
                          <div className="text-xs text-text-muted">з 12</div>
                        </div>
                      <Button
                        variant="ghost"
                        onClick={() => window.location.href = `/edu/grades/${item.grade.id}`}
                        className="text-xs"
                      >
                        Деталі
                      </Button>
                      </>
                    ) : (
                      <span className="text-xs text-text-muted">Немає оцінки</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => setShowGrades(false)}>Закрити</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Test Data Management Modal */}
      {showTestDataModal && testDataTaskId && (
        <Modal
          open={showTestDataModal}
          onClose={() => {
            setShowTestDataModal(false);
            setTestDataTaskId(null);
            setTestDataList([]);
            setEditingTestIndex(null);
            setEditingTest(null);
          }}
          title="Управління тестами"
          showCloseButton={false}
        >
          <div className="p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-mono text-text-primary">Тестові дані</h2>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newTestCount}
                  onChange={(e) => setNewTestCount(parseInt(e.target.value) || 10)}
                  className="w-20 px-2 py-1 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                />
                <Button
                  variant="ghost"
                  onClick={() => handleGenerateTests(testDataTaskId, newTestCount)}
                  className="text-xs"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Згенерувати {newTestCount}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingTestIndex(-1);
                    setEditingTest({ input: "", expectedOutput: "", points: 1 });
                  }}
                  className="text-xs"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Додати вручну
                </Button>
              </div>
            </div>

            {loadingTestData ? (
              <div className="text-center py-8 text-text-secondary font-mono">
                Завантаження...
              </div>
            ) : (
              <div className="space-y-3">
                {/* Форма для додавання нового тесту */}
                {editingTestIndex === -1 && (
                  <Card className="p-4 border-2 border-primary">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-mono text-text-primary">Новий тест</h3>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingTestIndex(null);
                            setEditingTest(null);
                          }}
                          className="text-xs p-1 h-6 w-6"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-text-secondary mb-1">
                          Вхідні дані
                        </label>
                        <textarea
                          value={editingTest?.input || ""}
                          onChange={(e) => setEditingTest({ ...editingTest!, input: e.target.value })}
                          placeholder="Наприклад: 5 10"
                          className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary min-h-[80px] resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-text-secondary mb-1">
                          Очікуваний вивід
                        </label>
                        <textarea
                          value={editingTest?.expectedOutput || ""}
                          onChange={(e) => setEditingTest({ ...editingTest!, expectedOutput: e.target.value })}
                          placeholder="Наприклад: 15"
                          className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary min-h-[80px] resize-y"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-mono text-text-secondary mb-1">
                            Бали (1-12)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={editingTest?.points || 1}
                            onChange={(e) => setEditingTest({ ...editingTest!, points: parseInt(e.target.value) || 1 })}
                            className="w-full px-2 py-1 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                          />
                        </div>
                        <Button
                          variant="primary"
                          onClick={handleAddNewTest}
                          className="text-xs"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Додати
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Список існуючих тестів */}
                {testDataList.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-text-secondary mb-4">Немає тестових даних</p>
                    <p className="text-xs text-text-muted">
                      Згенеруйте тести автоматично або додайте їх вручну
                    </p>
                  </Card>
                ) : (
                  testDataList.map((test, index) => (
                    <Card key={test.id} className="p-4">
                      {editingTestIndex === index ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-mono text-text-secondary mb-1">
                              Вхідні дані
                            </label>
                            <textarea
                              value={editingTest?.input || ""}
                              onChange={(e) => setEditingTest({ ...editingTest!, input: e.target.value })}
                              placeholder="Наприклад: 5 10"
                              className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary min-h-[80px] resize-y"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-mono text-text-secondary mb-1">
                              Очікуваний вивід
                            </label>
                            <textarea
                              value={editingTest?.expectedOutput || ""}
                              onChange={(e) => setEditingTest({ ...editingTest!, expectedOutput: e.target.value })}
                              placeholder="Наприклад: 15"
                              className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary min-h-[80px] resize-y"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="block text-xs font-mono text-text-secondary mb-1">
                                Бали (1-12)
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="12"
                                value={editingTest?.points || 1}
                                onChange={(e) => setEditingTest({ ...editingTest!, points: parseInt(e.target.value) || 1 })}
                                className="w-full px-2 py-1 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingTestIndex(null);
                                setEditingTest(null);
                              }}
                              className="text-xs"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="primary"
                              onClick={() => handleSaveTest(test.id, index)}
                              className="text-xs"
                            >
                              <Save className="w-4 h-4 mr-1" />
                              Зберегти
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div>
                              <span className="text-xs font-mono text-text-muted">Вхід:</span>
                              <pre className="text-xs font-mono text-text-secondary bg-bg-code p-2 rounded mt-1 whitespace-pre-wrap">
                                {test.input}
                              </pre>
                            </div>
                            <div>
                              <span className="text-xs font-mono text-text-muted">Очікуваний вивід:</span>
                              <pre className="text-xs font-mono text-text-secondary bg-bg-code p-2 rounded mt-1 whitespace-pre-wrap">
                                {test.expectedOutput}
                              </pre>
                            </div>
                            <div className="text-xs font-mono text-text-muted">
                              Бали: <span className="text-text-primary">{test.points}</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingTestIndex(index);
                                setEditingTest({ input: test.input, expectedOutput: test.expectedOutput, points: test.points });
                              }}
                              className="text-xs p-1 h-6 w-6"
                              title="Редагувати"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => handleDeleteTest(test.id)}
                              className="text-xs p-1 h-6 w-6"
                              title="Видалити"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Task Settings Modal */}
      {showTaskSettings && settingsTask && (
        <Modal
          open={showTaskSettings}
          onClose={() => {
            setShowTaskSettings(false);
            setSettingsTask(null);
          }}
          title="Налаштування завдання"
          showCloseButton={false}
        >
          <div className="p-6 max-w-2xl">
            <h2 className="text-xl font-mono text-text-primary mb-4">{settingsTask.title}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-text-secondary mb-2">
                  Кількість спроб (мінімум 1)
                </label>
                <input
                  type="number"
                  min="1"
                  value={taskMaxAttempts}
                  onChange={(e) => setTaskMaxAttempts(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-muted mt-1">
                  Скільки разів учень може відправити код на перевірку
                </p>
              </div>

              <div>
                <label className="block text-sm font-mono text-text-secondary mb-2">
                  Дедлайн (необов'язково)
                </label>
                <input
                  type="datetime-local"
                  value={taskDeadline}
                  onChange={(e) => setTaskDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-muted mt-1">
                  Після цієї дати учень не зможе відправити код
                </p>
                {taskDeadline && (
                  <Button
                    variant="ghost"
                    onClick={() => setTaskDeadline("")}
                    className="text-xs mt-2"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Прибрати дедлайн
                  </Button>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-mono text-text-secondary">
                  <input
                    type="checkbox"
                    checked={taskIsClosed}
                    onChange={(e) => setTaskIsClosed(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Завдання закрите для відправок
                </label>
                <p className="text-xs text-text-muted mt-1">
                  Якщо увімкнено, учень не зможе відправити код, навіть якщо є спроби та дедлайн не пройшов
                </p>
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowTaskSettings(false);
                    setSettingsTask(null);
                  }}
                >
                  Скасувати
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveTaskSettings}
                >
                  Зберегти
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default LessonDetailsPage;

                {/* Список існуючих тестів */}
                {testDataList.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-text-secondary mb-4">Немає тестових даних</p>
                    <p className="text-xs text-text-muted">
                      Згенеруйте тести автоматично або додайте їх вручну
                    </p>
                  </Card>
                ) : (
                  testDataList.map((test, index) => (
                    <Card key={test.id} className="p-4">
                      {editingTestIndex === index ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-mono text-text-secondary mb-1">
                              Вхідні дані
                            </label>
                            <textarea
                              value={editingTest?.input || ""}
                              onChange={(e) => setEditingTest({ ...editingTest!, input: e.target.value })}
                              placeholder="Наприклад: 5 10"
                              className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary min-h-[80px] resize-y"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-mono text-text-secondary mb-1">
                              Очікуваний вивід
                            </label>
                            <textarea
                              value={editingTest?.expectedOutput || ""}
                              onChange={(e) => setEditingTest({ ...editingTest!, expectedOutput: e.target.value })}
                              placeholder="Наприклад: 15"
                              className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary min-h-[80px] resize-y"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="block text-xs font-mono text-text-secondary mb-1">
                                Бали (1-12)
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="12"
                                value={editingTest?.points || 1}
                                onChange={(e) => setEditingTest({ ...editingTest!, points: parseInt(e.target.value) || 1 })}
                                className="w-full px-2 py-1 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingTestIndex(null);
                                setEditingTest(null);
                              }}
                              className="text-xs"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="primary"
                              onClick={() => handleSaveTest(test.id, index)}
                              className="text-xs"
                            >
                              <Save className="w-4 h-4 mr-1" />
                              Зберегти
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div>
                              <span className="text-xs font-mono text-text-muted">Вхід:</span>
                              <pre className="text-xs font-mono text-text-secondary bg-bg-code p-2 rounded mt-1 whitespace-pre-wrap">
                                {test.input}
                              </pre>
                            </div>
                            <div>
                              <span className="text-xs font-mono text-text-muted">Очікуваний вивід:</span>
                              <pre className="text-xs font-mono text-text-secondary bg-bg-code p-2 rounded mt-1 whitespace-pre-wrap">
                                {test.expectedOutput}
                              </pre>
                            </div>
                            <div className="text-xs font-mono text-text-muted">
                              Бали: <span className="text-text-primary">{test.points}</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingTestIndex(index);
                                setEditingTest({ input: test.input, expectedOutput: test.expectedOutput, points: test.points });
                              }}
                              className="text-xs p-1 h-6 w-6"
                              title="Редагувати"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => handleDeleteTest(test.id)}
                              className="text-xs p-1 h-6 w-6"
                              title="Видалити"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Task Settings Modal */}
      {showTaskSettings && settingsTask && (
        <Modal
          open={showTaskSettings}
          onClose={() => {
            setShowTaskSettings(false);
            setSettingsTask(null);
          }}
          title="Налаштування завдання"
          showCloseButton={false}
        >
          <div className="p-6 max-w-2xl">
            <h2 className="text-xl font-mono text-text-primary mb-4">{settingsTask.title}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-text-secondary mb-2">
                  Кількість спроб (мінімум 1)
                </label>
                <input
                  type="number"
                  min="1"
                  value={taskMaxAttempts}
                  onChange={(e) => setTaskMaxAttempts(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-muted mt-1">
                  Скільки разів учень може відправити код на перевірку
                </p>
              </div>

              <div>
                <label className="block text-sm font-mono text-text-secondary mb-2">
                  Дедлайн (необов'язково)
                </label>
                <input
                  type="datetime-local"
                  value={taskDeadline}
                  onChange={(e) => setTaskDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-muted mt-1">
                  Після цієї дати учень не зможе відправити код
                </p>
                {taskDeadline && (
                  <Button
                    variant="ghost"
                    onClick={() => setTaskDeadline("")}
                    className="text-xs mt-2"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Прибрати дедлайн
                  </Button>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-mono text-text-secondary">
                  <input
                    type="checkbox"
                    checked={taskIsClosed}
                    onChange={(e) => setTaskIsClosed(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Завдання закрите для відправок
                </label>
                <p className="text-xs text-text-muted mt-1">
                  Якщо увімкнено, учень не зможе відправити код, навіть якщо є спроби та дедлайн не пройшов
                </p>
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowTaskSettings(false);
                    setSettingsTask(null);
                  }}
                >
                  Скасувати
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSaveTaskSettings}
                >
                  Зберегти
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

