import React, { useEffect, useState } from 'react';
import { BookOpen, Code2, Terminal, Play, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { listTasks, submitTask, saveDraft } from '../../lib/api/tasks';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import type { User, Task } from '../../types';

interface TasksPageProps {
  user: User;
}

export const TasksPage: React.FC<TasksPageProps> = ({ user }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [code, setCode] = useState<string>('');
  const [consoleOutput, setConsoleOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listTasks();
        setTasks(data);
        if (data.length > 0) {
          setActiveTask(data[0]);
          setCode(data[0].userCode || data[0].starterCode || '');
        }
      } catch (err: any) {
        setError(err.message ?? 'Не вдалося завантажити завдання');
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (activeTask) {
      setCode(activeTask.userCode || activeTask.starterCode || '');
      setConsoleOutput('');
    }
  }, [activeTask?.id]);

  const handleRun = async () => {
    if (!activeTask) return;
    setIsRunning(true);
    setError(null);
    setConsoleOutput('Функція запуску коду поки що недоступна. Використовуй "Здати" для перевірки коду.');

    try {
      // TODO: Implement run task endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err: any) {
      setConsoleOutput('');
      setError(err.message ?? 'Помилка під час запуску коду');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSave = async () => {
    if (!activeTask) return;
    setError(null);
    try {
      await saveDraft(activeTask.id, code);
      setConsoleOutput(prev => (prev ? prev + '\n\n[System] Чернетку збережено.' : '[System] Чернетку збережено.'));
    } catch (err: any) {
      setError(err.message ?? 'Не вдалося зберегти чернетку');
    }
  };

  const handleSubmit = async () => {
    if (!activeTask) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await submitTask(activeTask.id, code);
      let text = `[AI Review] Завдання відправлено на перевірку.`;
      if (res.grade) {
        text += `\nОцінка: ${res.grade.total}`;
        text += `\nПрацездатність: ${res.grade.workScore}/5`;
        text += `\nОптимізація: ${res.grade.optimizationScore}/4`;
        text += `\nАкадем. доброчесність: ${res.grade.integrityScore}/3`;
        if (res.grade.aiFeedback) {
          text += `\n\nКоментар: ${res.grade.aiFeedback}`;
        }
      }
      setConsoleOutput(text);
      // Reload tasks to get updated status
      const data = await listTasks();
      setTasks(data);
      const updated = data.find(t => t.id === activeTask.id);
      if (updated) {
        setActiveTask(updated);
      }
    } catch (err: any) {
      setError(err.message ?? 'Не вдалося здати завдання');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)] text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-2 p-2 md:p-4 bg-[#0B0F19]">
      {/* Список завдань */}
      <div className="w-64 md:w-72 flex flex-col gap-2 bg-slate-900/50 rounded-lg border border-slate-800 p-3 overflow-y-auto">
        <div className="flex justify-between items-center mb-2 px-1">
          <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider">
            Мої завдання
          </h2>
        </div>
        {tasks.map(task => (
          <button
            key={task.id}
            onClick={() => setActiveTask(task)}
            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-left group ${
              activeTask?.id === task.id
                ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-100'
                : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex flex-col gap-1 overflow-hidden">
              <span
                className={`font-medium truncate ${
                  activeTask?.id === task.id
                    ? 'text-indigo-300'
                    : 'text-slate-300'
                }`}
              >
                {task.title}
              </span>
              <div className="flex items-center gap-2">
                {task.status && (
                  <Badge
                    color={
                      task.status === 'GRADED'
                        ? 'green'
                        : task.status === 'SUBMITTED'
                        ? 'yellow'
                        : 'blue'
                    }
                  >
                    {task.status === 'GRADED' ? 'Оцінено' : task.status === 'SUBMITTED' ? 'Очікує' : 'Відкрито'}
                  </Badge>
                )}
                <span className="text-[10px] opacity-60">#{task.id}</span>
              </div>
            </div>
            {task.status === 'GRADED' && (
              <CheckCircle2
                size={16}
                className="text-emerald-500 shrink-0"
              />
            )}
          </button>
        ))}
        {tasks.length === 0 && !error && (
          <div className="text-slate-500 text-sm p-4">
            Завдань поки що немає.
          </div>
        )}
      </div>

      {/* Основна зона */}
      <div className="flex-1 flex gap-2 overflow-hidden">
        {/* Опис завдання */}
        <div className="w-1/3 min-w-[260px] bg-slate-900/80 rounded-lg border border-slate-800 p-4 md:p-6 overflow-y-auto backdrop-blur-sm">
          {activeTask ? (
            <div className="prose prose-invert max-w-none">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="p-2 bg-slate-800 rounded-lg">
                  <BookOpen size={24} className="text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-bold text-white m-0">
                    {activeTask.title}
                  </h1>
                  <p className="text-slate-400 text-xs md:text-sm m-0">
                    Мова:{' '}
                    <span className="text-indigo-400 font-mono">
                      {user.course === 'JAVA' ? 'Java' : 'Python'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4 text-slate-300 text-sm leading-relaxed">
                {activeTask.descriptionMarkdown && (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{activeTask.descriptionMarkdown}</p>
                  </div>
                )}
                <div className="mt-4 md:mt-8 p-3 md:p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-start gap-3">
                  <AlertCircle
                    size={20}
                    className="text-indigo-400 shrink-0 mt-0.5"
                  />
                  <div>
                    <h4 className="font-bold text-indigo-300 text-sm mb-1">
                      Порада
                    </h4>
                    <p className="text-xs text-indigo-200/70">
                      Не забудь зберегти чернетку перед здачею, щоб не
                      втратити код.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Обери завдання зліва
            </div>
          )}
        </div>

        {/* Редактор + консоль */}
        <div className="flex-1 flex flex-col gap-2 min-w-[320px]">
          {/* Toolbar */}
          <div className="h-10 md:h-12 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between px-3 md:px-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs md:text-sm">
              <Code2 size={16} />
              <span className="font-mono">
                main.{user.course === 'PYTHON' ? 'py' : 'java'}
              </span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="secondary"
                className="h-8 text-xs px-2 md:px-3"
                onClick={handleSave}
              >
                <Save className="w-4 h-4 mr-1" />
                Зберегти
              </Button>
              <Button
                variant="primary"
                className="h-8 text-xs px-2 md:px-3"
                onClick={handleRun}
                disabled={isRunning || !activeTask}
              >
                <Play className="w-4 h-4 mr-1" />
                Запустити
              </Button>
              <Button
                variant="primary"
                className="h-8 text-xs px-2 md:px-3 bg-emerald-600 hover:bg-emerald-500"
                onClick={handleSubmit}
                disabled={isSubmitting || !activeTask}
              >
                Здати
              </Button>
            </div>
          </div>

          {/* Редактор */}
          <div className="flex-1 bg-[#0f1420] rounded-lg border border-slate-800 relative overflow-hidden flex">
            <div className="w-8 md:w-10 bg-[#0B0F19] border-r border-slate-800 text-slate-600 font-mono text-[10px] md:text-xs pt-3 md:pt-4 flex flex-col items-center select-none">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="h-4 md:h-6">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              className="flex-1 bg-transparent text-slate-200 font-mono text-xs md:text-sm p-3 md:p-4 resize-none focus:outline-none leading-5 md:leading-6 selection:bg-indigo-500/30"
              spellCheck={false}
            />
          </div>

          {/* Консоль */}
          <div className="h-32 md:h-40 bg-[#05080f] rounded-lg border border-slate-800 flex flex-col">
            <div className="h-8 border-b border-slate-800 flex items-center px-3 bg-slate-900/50">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Terminal size={12} /> Консоль
              </span>
            </div>
            <div className="flex-1 p-2 md:p-3 font-mono text-[10px] md:text-xs overflow-y-auto text-slate-300 whitespace-pre-wrap">
              {consoleOutput ? (
                consoleOutput
              ) : (
                <span className="text-slate-600 italic">
                  // Результат виконання зʼявиться тут...
                </span>
              )}
              {error && (
                <div className="mt-2 text-red-400">
                  [Error] {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
