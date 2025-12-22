// frontend/src/pages/SummaryGradesPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import {
  getStudents,
  getSummaryGrades,
  createSummaryGrade,
  updateSummaryGrade,
  getTaskGrades,
  type Student,
  type SummaryGradeGroup,
} from "../lib/api/edu";
import { ArrowLeft, Plus, FileText } from "lucide-react";

export const SummaryGradesPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [summaryGrades, setSummaryGrades] = useState<SummaryGradeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [gradeName, setGradeName] = useState("");
  const [studentGrades, setStudentGrades] = useState<Record<number, number>>({});
  const [editingGrade, setEditingGrade] = useState<{ id: number; studentId: number; currentGrade: number } | null>(null);

  useEffect(() => {
    if (classId) {
      loadData();
    }
  }, [classId]);

  const loadData = async () => {
    if (!classId) return;
    try {
      const [studentsData, summaryData] = await Promise.all([
        getStudents(parseInt(classId, 10)),
        getSummaryGrades(parseInt(classId, 10)),
      ]);
      setStudents(studentsData);
      setSummaryGrades(summaryData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSummary = async () => {
    if (!classId || !gradeName.trim()) {
      alert("Введіть назву оцінки");
      return;
    }

    // Якщо є ручні оцінки, передаємо їх, інакше система автоматично порахує
    const grades = Object.entries(studentGrades)
      .filter(([_, grade]) => grade > 0)
      .map(([studentId, grade]) => ({
        studentId: parseInt(studentId, 10),
        grade: grade,
      }));

    try {
      await createSummaryGrade(parseInt(classId, 10), {
        name: gradeName,
        studentGrades: grades.length > 0 ? grades : undefined, // Якщо немає ручних, система порахує автоматично
      });
      setShowCreate(false);
      setGradeName("");
      setStudentGrades({});
      await loadData();
    } catch (error: any) {
      console.error("Failed to create summary grade:", error);
      alert(error.response?.data?.message || "Не вдалося створити оцінку");
    }
  };

  const handleUpdateGrade = async (summaryGradeId: number, newGrade: number) => {
    if (!classId) return;
    try {
      await updateSummaryGrade(parseInt(classId, 10), summaryGradeId, newGrade);
      setEditingGrade(null);
      await loadData();
    } catch (error: any) {
      console.error("Failed to update grade:", error);
      alert(error.response?.data?.message || "Не вдалося оновити оцінку");
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
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(`/edu/classes/${classId}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            <h1 className="text-2xl font-mono text-text-primary">Проміжні оцінки</h1>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Створити
          </Button>
        </div>

        {summaryGrades.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-text-secondary">Поки немає проміжних оцінок</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {summaryGrades.map((group, index) => (
              <Card key={index} className="p-4">
                <h2 className="text-lg font-mono text-text-primary mb-4">{group.name}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {group.grades.map((g) => {
                    const isEditing = editingGrade?.studentId === g.studentId && editingGrade?.id === g.id;
                    return (
                      <div
                        key={g.studentId}
                        className="p-2 border border-border bg-bg-surface text-sm relative"
                      >
                        <div className="text-text-secondary text-xs mb-1 line-clamp-1">
                          {g.studentName}
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max="12"
                              step="0.1"
                              defaultValue={editingGrade?.currentGrade || g.grade}
                              onBlur={(e) => {
                                const newGrade = parseFloat(e.target.value);
                                if (!isNaN(newGrade) && newGrade >= 1 && newGrade <= 12) {
                                  handleUpdateGrade(g.id, newGrade);
                                }
                                setEditingGrade(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                } else if (e.key === "Escape") {
                                  setEditingGrade(null);
                                }
                              }}
                              autoFocus
                              className="w-16 px-2 py-1 bg-bg-base border border-primary text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                            />
                          </div>
                        ) : (
                          <div 
                            className="text-lg font-mono text-primary cursor-pointer hover:bg-bg-hover px-1 rounded"
                            onClick={() => {
                              setEditingGrade({
                                id: g.id,
                                studentId: g.studentId,
                                currentGrade: g.grade,
                              });
                            }}
                            title="Натисніть для редагування"
                          >
                            {g.grade}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Summary Grade Modal */}
      {showCreate && (
        <Modal 
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="Створити проміжну оцінку"
          showCloseButton={false}
        >
          <div className="p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-mono text-text-primary mb-4">Створити проміжну оцінку</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-text-secondary mb-2">
                  Назва оцінки *
                </label>
                <input
                  type="text"
                  value={gradeName}
                  onChange={(e) => setGradeName(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-primary"
                  placeholder="Наприклад: Тематична 1, Проміжна"
                />
              </div>
              <div>
                <label className="block text-sm font-mono text-text-secondary mb-2">
                  Оцінки учнів
                </label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center gap-3 p-2 border border-border">
                      <div className="flex-1 text-sm font-mono text-text-primary">
                        {student.lastName} {student.firstName} {student.middleName || ""}
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        step="0.1"
                        value={studentGrades[student.id] || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            const newGrades = { ...studentGrades };
                            delete newGrades[student.id];
                            setStudentGrades(newGrades);
                          } else {
                            setStudentGrades({
                              ...studentGrades,
                              [student.id]: parseFloat(value) || 0,
                            });
                          }
                        }}
                        className="w-20 px-2 py-1 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                        placeholder="Авто"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowCreate(false)}>
                  Скасувати
                </Button>
                <Button onClick={handleCreateSummary}>Створити</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};


