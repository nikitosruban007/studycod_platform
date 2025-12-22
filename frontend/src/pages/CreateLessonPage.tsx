// frontend/src/pages/CreateLessonPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { createLesson, generateTheoryPreview, getClasses, type CreateLessonRequest } from "../lib/api/edu";
import { ArrowLeft, Sparkles } from "lucide-react";

export const CreateLessonPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [type, setType] = useState<"LESSON" | "CONTROL">("LESSON");
  const [title, setTitle] = useState("");
  const [theory, setTheory] = useState("");
  const [hasTheory, setHasTheory] = useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | undefined>();
  const [controlHasTheory, setControlHasTheory] = useState(false);
  const [controlHasPractice, setControlHasPractice] = useState(true);
  const [generatingTheory, setGeneratingTheory] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [language, setLanguage] = useState<"JAVA" | "PYTHON">("JAVA");

  // Завантажуємо мову програмування з класу
  useEffect(() => {
    const loadClassInfo = async () => {
      if (!classId) return;
      try {
        const classes = await getClasses();
        const classData = classes.find(c => c.id === parseInt(classId, 10));
        if (classData && (classData.language === "JAVA" || classData.language === "PYTHON")) {
          setLanguage(classData.language);
        }
      } catch (error) {
        console.error("Failed to load class info:", error);
      }
    };
    loadClassInfo();
  }, [classId]);

  const handleSubmit = async () => {
    if (!classId || !title.trim()) {
      alert("Заповніть назву уроку");
      return;
    }

    if (type === "CONTROL" && !controlHasTheory && !controlHasPractice) {
      alert("Хоча б одна частина контрольної повинна бути включена");
      return;
    }

    try {
      const lessonData: CreateLessonRequest = {
        type,
        title,
        theory: hasTheory ? theory : undefined,
        hasTheory,
        timeLimitMinutes,
        controlHasTheory,
        controlHasPractice,
      };

      const newLesson = await createLesson(parseInt(classId, 10), lessonData);
      window.location.href = `/edu/lessons/${newLesson.id}`;
    } catch (error: any) {
      console.error("Failed to create lesson:", error);
      alert(error.response?.data?.message || "Не вдалося створити урок");
    }
  };

  const handleGenerateTheory = async () => {
    if (!topicTitle.trim()) {
      alert("Введіть назву теми");
      return;
    }

    setGeneratingTheory(true);
    try {
      const result = await generateTheoryPreview(topicTitle, language);
      setTheory(result.theory);
      setHasTheory(true);
    } catch (error: any) {
      console.error("Failed to generate theory:", error);
      alert(error.response?.data?.message || "Не вдалося згенерувати теорію");
    } finally {
      setGeneratingTheory(false);
    }
  };

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(`/edu/classes/${classId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <h1 className="text-2xl font-mono text-text-primary">Створити урок</h1>
        </div>

        <Card className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-mono text-text-secondary mb-2">Тип</label>
            <div className="flex gap-2">
              <Button
                variant={type === "LESSON" ? "primary" : "ghost"}
                onClick={() => setType("LESSON")}
                className="flex-1"
              >
                Урок
              </Button>
              <Button
                variant={type === "CONTROL" ? "primary" : "ghost"}
                onClick={() => setType("CONTROL")}
                className="flex-1"
              >
                Контрольна
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-mono text-text-secondary mb-2">
              Назва уроку *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-primary"
              placeholder="Наприклад: Вступ до масивів"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-mono text-text-secondary">
              <input
                type="checkbox"
                checked={hasTheory}
                onChange={(e) => setHasTheory(e.target.checked)}
                className="w-4 h-4"
              />
              Додати теорію
            </label>
            {hasTheory && (
              <div className="mt-2">
                <textarea
                  value={theory}
                  onChange={(e) => setTheory(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-primary min-h-[200px]"
                  placeholder="Введіть теорію або згенеруйте через ШІ..."
                />
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    placeholder="Назва теми для генерації"
                    className="flex-1 px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                  />
                  <Button
                    variant="ghost"
                    onClick={handleGenerateTheory}
                    disabled={generatingTheory}
                    className="text-xs"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    {generatingTheory ? "Генерація..." : "Згенерувати"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-mono text-text-secondary mb-2">
              Обмеження по часу (хвилини)
            </label>
            <input
              type="number"
              value={timeLimitMinutes || ""}
              onChange={(e) =>
                setTimeLimitMinutes(e.target.value ? parseInt(e.target.value, 10) : undefined)
              }
              className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-primary"
              placeholder="Необов'язково"
            />
          </div>

          {type === "CONTROL" && (
            <div className="space-y-3 p-4 border border-border bg-bg-surface">
              <h3 className="text-sm font-mono text-text-primary">Частини контрольної:</h3>
              <label className="flex items-center gap-2 text-sm font-mono text-text-secondary">
                <input
                  type="checkbox"
                  checked={controlHasTheory}
                  onChange={(e) => setControlHasTheory(e.target.checked)}
                  className="w-4 h-4"
                />
                Теоретична частина (питання)
              </label>
              <label className="flex items-center gap-2 text-sm font-mono text-text-secondary">
                <input
                  type="checkbox"
                  checked={controlHasPractice}
                  onChange={(e) => setControlHasPractice(e.target.checked)}
                  className="w-4 h-4"
                />
                Практична частина (завдання)
              </label>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => navigate(`/edu/classes/${classId}`)}>
              Скасувати
            </Button>
            <Button onClick={handleSubmit}>Створити урок</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

