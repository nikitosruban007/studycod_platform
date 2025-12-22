// frontend/src/pages/StudentLessonsPage.tsx
import React, { useState, useEffect } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { getMyStudentInfo, getStudentLessons, type Lesson } from "../lib/api/edu";
import { BookOpen, Clock, FileText } from "lucide-react";

export const StudentLessonsPage: React.FC = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [classInfo, setClassInfo] = useState<any>(null);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      const studentInfo = await getMyStudentInfo();
      setClassInfo(studentInfo.student.class);
      // Використовуємо спеціальний endpoint для учнів
      const data = await getStudentLessons();
      setLessons(data);
    } catch (error) {
      console.error("Failed to load lessons:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-primary font-mono">
        Завантаження...
      </div>
    );
  }

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-mono text-text-primary mb-6">
          Уроки {classInfo?.name && `• ${classInfo.name}`}
        </h1>

        {lessons.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-text-secondary">Поки немає уроків</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <Card key={lesson.id} className="p-4 hover:bg-bg-hover transition-fast">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-text-secondary" />
                      <h3 className="text-lg font-mono text-text-primary">{lesson.title}</h3>
                      <span className="text-xs text-text-muted px-2 py-1 border border-border">
                        {lesson.type === "LESSON" ? "Урок" : "Контрольна"}
                      </span>
                    </div>
                    {lesson.timeLimitMinutes && (
                      <div className="flex items-center gap-1 text-xs text-text-secondary mb-2">
                        <Clock className="w-3 h-3" />
                        <span>Обмеження: {lesson.timeLimitMinutes} хв</span>
                      </div>
                    )}
                    <div className="text-xs text-text-muted">
                      Завдань: {lesson.tasksCount}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      window.location.href = `/edu/lessons/${lesson.id}`;
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Відкрити
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


