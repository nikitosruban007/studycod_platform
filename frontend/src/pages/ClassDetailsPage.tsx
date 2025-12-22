// frontend/src/pages/ClassDetailsPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import {
  getStudents,
  getLessons,
  addStudents,
  exportStudents,
  importStudents,
  type Student,
  type Lesson,
  type StudentCredentials,
} from "../lib/api/edu";
import { Users, BookOpen, Plus, Download, Upload, ArrowLeft, FileText } from "lucide-react";

export const ClassDetailsPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [newStudents, setNewStudents] = useState([
    { firstName: "", lastName: "", middleName: "", email: "" },
  ]);
  const [credentials, setCredentials] = useState<StudentCredentials[]>([]);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    if (classId) {
      loadData();
    }
  }, [classId]);

  const loadData = async () => {
    if (!classId) return;
    try {
      const [studentsData, lessonsData] = await Promise.all([
        getStudents(parseInt(classId, 10)),
        getLessons(parseInt(classId, 10)),
      ]);
      setStudents(studentsData || []);
      setLessons(lessonsData || []);
    } catch (error: any) {
      console.error("Failed to load data:", error);
      alert(error.response?.data?.message || "Не вдалося завантажити дані");
      setStudents([]);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudentRow = () => {
    setNewStudents([...newStudents, { firstName: "", lastName: "", middleName: "", email: "" }]);
  };

  const handleRemoveStudentRow = (index: number) => {
    setNewStudents(newStudents.filter((_, i) => i !== index));
  };

  const handleStudentChange = (index: number, field: string, value: string) => {
    const updated = [...newStudents];
    updated[index] = { ...updated[index], [field]: value };
    setNewStudents(updated);
  };

  const handleSubmitStudents = async () => {
    if (!classId) return;

    const validStudents = newStudents.filter(
      (s) => s.firstName.trim() && s.lastName.trim() && s.email.trim()
    );

    if (validStudents.length === 0) {
      alert("Додайте хоча б одного учня");
      return;
    }

    try {
      const result = await addStudents(parseInt(classId, 10), validStudents);
      setCredentials(result.credentials);
      setShowCredentials(true);
      setNewStudents([{ firstName: "", lastName: "", middleName: "", email: "" }]);
      await loadData();
    } catch (error: any) {
      console.error("Failed to add students:", error);
      alert(error.response?.data?.message || "Не вдалося додати учнів");
    }
  };

  const handleExport = async () => {
    if (!classId) return;
    try {
      const blob = await exportStudents(parseInt(classId, 10));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `students_${classId}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export:", error);
      alert("Не вдалося експортувати");
    }
  };

  const handleImport = async () => {
    if (!classId || !importFile) {
      alert("Виберіть CSV файл");
      return;
    }

    try {
      const text = await importFile.text();
      const result = await importStudents(parseInt(classId, 10), text);
      setCredentials(result.credentials);
      setShowCredentials(true);
      setShowImport(false);
      setImportFile(null);
      await loadData();
    } catch (error: any) {
      console.error("Failed to import:", error);
      alert(error.response?.data?.message || "Не вдалося імпортувати учнів");
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
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          <h1 className="text-2xl font-mono text-text-primary">Деталі класу</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Students Section */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-mono text-text-primary flex items-center gap-2">
                <Users className="w-5 h-5" />
                Учні ({students.length})
              </h2>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleExport} className="text-xs">
                  <Download className="w-4 h-4 mr-1" />
                  Експорт
                </Button>
                <Button variant="ghost" onClick={() => setShowImport(true)} className="text-xs">
                  <Upload className="w-4 h-4 mr-1" />
                  Імпорт
                </Button>
                <Button onClick={() => setShowAddStudents(true)} className="text-xs">
                  <Plus className="w-4 h-4 mr-1" />
                  Додати
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {students.length === 0 ? (
                <p className="text-text-secondary text-sm">Немає учнів</p>
              ) : (
                students.map((student) => (
                  <div
                    key={student.id}
                    className="p-2 border border-border hover:bg-bg-hover transition-fast"
                  >
                    <div className="text-sm font-mono text-text-primary">
                      {student.lastName} {student.firstName} {student.middleName || ""}
                    </div>
                    <div className="text-xs text-text-secondary">{student.email}</div>
                    <div className="text-xs text-text-muted">@{student.generatedUsername}</div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Lessons Section */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-mono text-text-primary flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Уроки ({lessons.length})
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/edu/classes/${classId}/gradebook`)}
                  className="text-xs"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Журнал
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/edu/classes/${classId}/summary-grades`)}
                  className="text-xs"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Проміжні
                </Button>
                <Button
                  onClick={() => navigate(`/edu/classes/${classId}/lessons/new`)}
                  className="text-xs"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Створити
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {lessons.length === 0 ? (
                <p className="text-text-secondary text-sm">Немає уроків</p>
              ) : (
                lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="p-2 border border-border hover:bg-bg-hover transition-fast cursor-pointer"
                    onClick={() => navigate(`/edu/lessons/${lesson.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-mono text-text-primary">{lesson.title}</div>
                      <span className="text-xs text-text-muted px-2 py-1 border border-border">
                        {lesson.type === "LESSON" ? "Урок" : "Контрольна"}
                      </span>
                    </div>
                    {lesson.timeLimitMinutes && (
                      <div className="text-xs text-text-secondary mt-1">
                        Обмеження: {lesson.timeLimitMinutes} хв
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Add Students Modal */}
      {showAddStudents && (
        <Modal 
          open={showAddStudents}
          onClose={() => setShowAddStudents(false)}
          title="Додати учнів"
          showCloseButton={false}
        >
          <div className="p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-mono text-text-primary mb-4">Додати учнів</h2>
            <div className="space-y-3">
              {newStudents.map((student, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <input
                    type="text"
                    placeholder="Прізвище"
                    value={student.lastName}
                    onChange={(e) => handleStudentChange(index, "lastName", e.target.value)}
                    className="col-span-3 px-2 py-1 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Ім'я"
                    value={student.firstName}
                    onChange={(e) => handleStudentChange(index, "firstName", e.target.value)}
                    className="col-span-3 px-2 py-1 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="По-батькові"
                    value={student.middleName}
                    onChange={(e) => handleStudentChange(index, "middleName", e.target.value)}
                    className="col-span-3 px-2 py-1 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={student.email}
                    onChange={(e) => handleStudentChange(index, "email", e.target.value)}
                    className="col-span-2 px-2 py-1 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
                  />
                  {newStudents.length > 1 && (
                    <button
                      onClick={() => handleRemoveStudentRow(index)}
                      className="col-span-1 px-2 py-1 border border-accent-error text-accent-error hover:bg-accent-error hover:text-bg-base transition-fast text-sm"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <Button variant="ghost" onClick={handleAddStudentRow} className="w-full text-xs">
                <Plus className="w-4 h-4 mr-1" />
                Додати рядок
              </Button>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="ghost" onClick={() => setShowAddStudents(false)}>
                Скасувати
              </Button>
              <Button onClick={handleSubmitStudents}>Додати учнів</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImport && (
        <Modal
          open={showImport}
          onClose={() => {
            setShowImport(false);
            setImportFile(null);
          }}
          title="Імпорт учнів з CSV"
          showCloseButton={false}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-mono text-text-secondary mb-2">
                CSV файл
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 bg-bg-surface border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-text-muted mt-2">
                Формат: Ім'я,Прізвище,По-батькові,Email,Username,Password
                <br />
                <span className="text-text-secondary">
                  Username та Password опціональні - якщо не вказані, система згенерує їх автоматично
                </span>
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowImport(false);
                  setImportFile(null);
                }}
              >
                Скасувати
              </Button>
              <Button onClick={handleImport} disabled={!importFile}>
                Імпортувати
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Credentials Modal */}
      {showCredentials && (
        <Modal 
          open={showCredentials}
          onClose={() => setShowCredentials(false)}
          title="Облікові дані учнів (збережіть!)"
          showCloseButton={false}
        >
          <div className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="space-y-2 mb-4">
              {credentials.map((cred, index) => (
                <div
                  key={index}
                  className="p-3 border border-border bg-bg-surface font-mono text-sm"
                >
                  <div className="text-text-primary">
                    {cred.lastName} {cred.firstName} {cred.middleName || ""}
                  </div>
                  <div className="text-text-secondary mt-1">
                    Email: {cred.email}
                  </div>
                  <div className="text-text-secondary">
                    Username: <span className="text-primary">{cred.username}</span>
                  </div>
                  <div className="text-text-secondary">
                    Password: <span className="text-primary">{cred.password}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button onClick={() => setShowCredentials(false)}>Закрити</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ClassDetailsPage;

