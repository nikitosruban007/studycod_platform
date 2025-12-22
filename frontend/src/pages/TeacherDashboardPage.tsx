// frontend/src/pages/TeacherDashboardPage.tsx
import React, { useState, useEffect } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { getClasses, createClass, type Class } from "../lib/api/edu";
import { Plus, Users, BookOpen, FileText } from "lucide-react";

export const TeacherDashboardPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassLanguage, setNewClassLanguage] = useState<"JAVA" | "PYTHON">("JAVA");

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const data = await getClasses();
      setClasses(data);
    } catch (error) {
      console.error("Failed to load classes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;

    try {
      const newClass = await createClass(newClassName, newClassLanguage);
      setClasses([...classes, newClass]);
      setShowCreateClass(false);
      setNewClassName("");
      setNewClassLanguage("JAVA");
    } catch (error) {
      console.error("Failed to create class:", error);
      alert("Не вдалося створити клас");
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-mono text-text-primary">Мої класи</h1>
          <Button onClick={() => setShowCreateClass(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Створити клас
          </Button>
        </div>

        {classes.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-text-secondary mb-4">У вас поки немає класів</p>
            <Button onClick={() => setShowCreateClass(true)}>Створити перший клас</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => (
              <Card key={cls.id} className="p-4 hover:bg-bg-hover transition-fast cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-mono text-text-primary">{cls.name}</h3>
                  <span className="text-xs text-text-muted px-2 py-1 border border-border">
                    {cls.language}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-text-secondary">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{cls.studentsCount} учнів</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1 text-xs"
                    onClick={() => {
                      // Navigate to class details
                      window.location.href = `/edu/classes/${cls.id}`;
                    }}
                  >
                    Відкрити
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreateClass && (
        <Modal 
          open={showCreateClass}
          onClose={() => setShowCreateClass(false)}
          title="Створити клас"
          showCloseButton={false}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-mono text-text-secondary mb-2">
                Назва класу
              </label>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="w-full px-3 py-2 bg-bg-base border border-border text-text-primary font-mono focus:outline-none focus:border-primary"
                placeholder="Наприклад: 10-А"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-mono text-text-secondary mb-2">
                Мова програмування
              </label>
              <select
                value={newClassLanguage}
                onChange={(e) => setNewClassLanguage(e.target.value as "JAVA" | "PYTHON")}
                className="w-full px-3 py-2 bg-bg-base border border-border text-text-primary font-mono focus:outline-none focus:border-primary"
              >
                <option value="JAVA">Java</option>
                <option value="PYTHON">Python</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="ghost" onClick={() => setShowCreateClass(false)}>
                Скасувати
              </Button>
              <Button onClick={handleCreateClass} disabled={!newClassName.trim()}>
                Створити
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};


