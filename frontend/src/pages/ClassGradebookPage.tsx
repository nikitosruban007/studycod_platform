// frontend/src/pages/ClassGradebookPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  getClassGradebook,
  type GradebookResponse,
  type GradebookStudent,
  type GradebookLesson,
} from "../lib/api/edu";
import { ArrowLeft, Download } from "lucide-react";

export const ClassGradebookPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [gradebook, setGradebook] = useState<GradebookResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<number | "all">("all");

  useEffect(() => {
    if (classId) {
      loadGradebook();
    }
  }, [classId]);

  const loadGradebook = async () => {
    if (!classId) return;
    try {
      const data = await getClassGradebook(parseInt(classId, 10));
      setGradebook(data);
    } catch (error) {
      console.error("Failed to load gradebook:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade: number | null) => {
    if (grade === null) return "text-text-muted";
    // Градієнт від червоного (1) до зеленого (12)
    if (grade >= 10) return "text-accent-success font-bold"; // Зелений
    if (grade >= 7) return "text-accent-warn font-semibold"; // Жовтий
    if (grade >= 4) return "text-yellow-500 font-semibold"; // Помаранчевий
    return "text-accent-error font-semibold"; // Червоний
  };

  const exportToCSV = () => {
    if (!gradebook) return;

    const headers = ["Учень", ...gradebook.lessons.flatMap(l => 
      l.tasks.map(t => `${l.title} - ${t.title}`)
    )];
    
    const rows = gradebook.students.map(student => {
      const studentName = student.studentName;
      const grades = student.grades.map(g => g.grade ?? "");
      return [studentName, ...grades];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `journal_${classId}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-primary font-mono">
        Завантаження...
      </div>
    );
  }

  if (!gradebook) {
    return (
      <div className="h-full flex items-center justify-center text-text-primary font-mono">
        Не вдалося завантажити журнал
      </div>
    );
  }

  // Фільтруємо завдання за вибраним уроком
  const filteredLessons = selectedLesson === "all" 
    ? gradebook.lessons 
    : gradebook.lessons.filter(l => l.id === selectedLesson);

  const allTasks = filteredLessons.flatMap(l => l.tasks.map(t => ({
    ...t,
    lessonId: l.id,
    lessonTitle: l.title,
  })));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 p-6 pb-4">
        <div className="max-w-full mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate(`/edu/classes/${classId}`)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
              <h1 className="text-2xl font-mono text-text-primary">Журнал класу</h1>
            </div>
            <Button onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Експорт CSV
            </Button>
          </div>

          {/* Фільтр по урокам */}
          <Card className="p-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono text-text-secondary">Фільтр:</span>
              <button
                onClick={() => setSelectedLesson("all")}
                className={`px-3 py-1 text-xs font-mono border transition-fast ${
                  selectedLesson === "all"
                    ? "border-primary bg-bg-hover text-text-primary"
                    : "border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                Всі уроки
              </button>
              {gradebook.lessons.map(lesson => (
                <button
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson.id)}
                  className={`px-3 py-1 text-xs font-mono border transition-fast ${
                    selectedLesson === lesson.id
                      ? "border-primary bg-bg-hover text-text-primary"
                      : "border-border text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {lesson.title}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Scrollable table container */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-full mx-auto">
          {/* Таблиця журналу */}
          <Card className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-bg-surface">
                      <th className="px-4 py-3 text-left text-sm font-mono text-text-primary sticky left-0 bg-bg-surface z-10 border-r border-border">
                        Учень
                      </th>
                      {allTasks.map(task => (
                        <th
                          key={task.id}
                          className="px-3 py-3 text-center text-xs font-mono text-text-secondary border-r border-border min-w-[80px]"
                          title={`${task.lessonTitle} - ${task.title}`}
                        >
                          <div className="max-w-[120px] truncate">
                            {task.title}
                          </div>
                          <div className="text-[10px] text-text-muted mt-1">
                            {task.lessonTitle}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gradebook.students.map(student => (
                      <tr
                        key={student.studentId}
                        className="border-b border-border hover:bg-bg-hover transition-fast"
                      >
                        <td className="px-4 py-2 text-sm font-mono text-text-primary sticky left-0 bg-bg-base z-10 border-r border-border">
                          {student.studentName}
                        </td>
                        {allTasks.map(task => {
                          const grade = student.grades.find(g => g.taskId === task.id);
                          return (
                            <td
                              key={task.id}
                              className={`px-3 py-2 text-center text-sm font-mono border-r border-border ${getGradeColor(grade?.grade ?? null)}`}
                            >
                              {grade?.grade ?? "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {gradebook.students.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-text-secondary">Немає учнів у класі</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};


