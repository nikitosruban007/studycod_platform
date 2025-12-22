import React, { useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { User } from '../types';

interface TheoryTopic {
  id: string;
  title: string;
  content: string;
}

const JAVA_THEORY: TheoryTopic[] = [
  {
    id: 'j1',
    title: 'Вступ до Java',
    content: 'Java — це об’єктно-орієнтована мова програмування...',
  },
  {
    id: 'j2',
    title: 'Змінні та типи',
    content:
      'У Java є примітивні типи (int, double) та посилальні типи (String, масиви тощо)...',
  },
  {
    id: 'j3',
    title: 'ООП принципи',
    content: 'Інкапсуляція, успадкування, поліморфізм, абстракція...',
  },
];

const PYTHON_THEORY: TheoryTopic[] = [
  {
    id: 'p1',
    title: 'Вступ до Python',
    content: 'Python — інтерпретована мова програмування високого рівня...',
  },
  {
    id: 'p2',
    title: 'Списки та словники',
    content:
      'List — впорядкована колекція. Dictionary — пари ключ-значення...',
  },
  {
    id: 'p3',
    title: 'Функції',
    content: 'Функції у Python визначаються ключовим словом def...',
  },
];

interface TheoryPageProps {
  user: User;
}

export const TheoryPage: React.FC<TheoryPageProps> = ({ user }) => {
  const topics = user.course === 'PYTHON' ? PYTHON_THEORY : JAVA_THEORY;
  const [selected, setSelected] = useState<TheoryTopic | null>(null);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col md:flex-row gap-6">
      <div className="md:w-1/3 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-900 border-b border-slate-800">
          <h2 className="font-bold text-white flex items-center gap-2">
            <BookOpen size={20} className="text-indigo-400" />
            Курс: {user.course === 'JAVA' ? 'Java' : 'Python'}
          </h2>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {topics.map(topic => (
            <button
              key={topic.id}
              onClick={() => setSelected(topic)}
              className={`w-full text-left p-3 rounded-lg flex justify-between items-center transition-all ${
                selected?.id === topic.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span className="truncate text-sm font-medium">
                {topic.title}
              </span>
              <ChevronRight
                size={16}
                className={`opacity-50 ${
                  selected?.id === topic.id ? 'text-white' : ''
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="md:w-2/3 bg-slate-800 rounded-xl border border-slate-700 p-6 overflow-y-auto">
        {selected ? (
          <div>
            <h1 className="text-2xl font-bold text-white mb-4">
              {selected.title}
            </h1>
            <p className="text-slate-300 leading-relaxed">
              {selected.content}
            </p>
            <div className="mt-8 p-4 bg-slate-900 rounded-lg border-l-4 border-indigo-500">
              <h4 className="font-bold text-white text-sm mb-1">
                Примітка:
              </h4>
              <p className="text-sm text-slate-300">
                У реальному застосунку тут підтягується повний текст лекції з
                бази даних / JSON.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <BookOpen size={64} className="mb-4 opacity-20" />
            <p>Оберіть тему зі списку, щоб розпочати навчання</p>
          </div>
        )}
      </div>
    </div>
  );
};
