// frontend/src/pages/StudentDashboardPage.tsx
import React, { useState, useEffect } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { getStudentGrades, getMyStudentInfo, type Grade, type SummaryGrade } from "../lib/api/edu";
import { FileText, BookOpen } from "lucide-react";
import type { User } from "../types";

interface Props {
  user: User;
}

// Функція для визначення кольору оцінки (від червоного до зеленого)
const getGradeColor = (grade: number): string => {
  if (grade <= 0) return "text-text-muted";
  // Градієнт від червоного (1) до зеленого (12)
  // 1-3: червоний, 4-6: помаранчевий, 7-9: жовтий, 10-12: зелений
  if (grade >= 10) return "text-accent-success"; // Зелений
  if (grade >= 7) return "text-accent-warn"; // Жовтий
  if (grade >= 4) return "text-yellow-500"; // Помаранчевий
  return "text-accent-error"; // Червоний
};

export const StudentDashboardPage: React.FC<Props> = ({ user }) => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [summaryGrades, setSummaryGrades] = useState<SummaryGrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGrades();
  }, []);

  const loadGrades = async () => {
    try {
      const studentInfo = await getMyStudentInfo();
      const data = await getStudentGrades(studentInfo.student.id);
      setGrades(data.grades || []);
      setSummaryGrades(data.summaryGrades || []);
    } catch (error) {
      console.error("Failed to load grades:", error);
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-mono text-text-primary">Мій журнал</h1>
          <Button
            variant="ghost"
            onClick={() => {
              window.location.href = "/edu/lessons";
            }}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Уроки
          </Button>
        </div>

        {grades.length === 0 && summaryGrades.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-text-secondary">У вас поки немає оцінок</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Проміжні оцінки */}
            {summaryGrades.length > 0 && (
              <div>
                <h2 className="text-lg font-mono text-text-primary mb-3">Проміжні оцінки</h2>
                <div className="space-y-3">
                  {summaryGrades.map((summaryGrade) => (
                    <Card key={summaryGrade.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-text-secondary" />
                            <h3 className="text-lg font-mono text-text-primary">
                              {summaryGrade.name}
                            </h3>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className={`text-2xl font-mono font-bold ${getGradeColor(summaryGrade.grade)}`}>
                            {summaryGrade.grade}
                          </div>
                          <div className="text-xs text-text-muted">з 12</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-text-muted">
                        {new Date(summaryGrade.createdAt).toLocaleDateString("uk-UA")}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Оцінки за завдання */}
            {grades.length > 0 && (
              <div>
                <h2 className="text-lg font-mono text-text-primary mb-3">Оцінки за завдання</h2>
                <div className="space-y-3">
                  {grades.map((grade) => (
                    <Card key={grade.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-text-secondary" />
                            <h3 className="text-lg font-mono text-text-primary">
                              {grade.task.title}
                            </h3>
                          </div>
                          <div className="text-sm text-text-secondary mb-2">
                            {grade.task.lesson.title} • {grade.task.lesson.type === "LESSON" ? "Урок" : "Контрольна"}
                          </div>
                          <Button
                            variant="ghost"
                            className="text-xs mt-2"
                            onClick={() => {
                              window.location.href = `/edu/tasks/${grade.task.id}`;
                            }}
                          >
                            Переглянути завдання
                          </Button>
                          {grade.feedback && (
                            <div className="text-sm text-text-muted mt-2 p-2 bg-bg-surface border border-border">
                              {grade.feedback}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className={`text-2xl font-mono font-bold ${getGradeColor(grade.total)}`}>
                            {grade.total}
                          </div>
                          <div className="text-xs text-text-muted">з 12</div>
                          <div className="text-xs text-text-secondary">
                            {grade.testsPassed}/{grade.testsTotal} тестів
                          </div>
                          {grade.isManuallyGraded && (
                            <span className="text-xs text-text-muted px-2 py-1 border border-border">
                              Ручна оцінка
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-text-muted">
                        {new Date(grade.createdAt).toLocaleDateString("uk-UA")}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

