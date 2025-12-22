import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Logo } from "../components/Logo";
import type { User, Task } from "../types";
import {
    FileText,
    GraduationCap,
    BookOpen,
    Users,
    TrendingUp,
    Clock,
} from "lucide-react";
import { listTasks } from "../lib/api/tasks";
import {
    getClasses,
    getStudentLessons,
    getStudentGrades,
    type Class,
    type Lesson,
    type Grade,
} from "../lib/api/edu";

interface Props {
    user: User;
    onNavigate: (page: "tasks" | "grades" | "profile" | "teacher" | "student") => void;
}

export const HomePage: React.FC<Props> = ({ user, onNavigate }) => {
    const isEducational = user.userMode === "EDUCATIONAL";
    const isStudent = !!user.studentId;
    const isTeacher = isEducational && !isStudent;

    const [lastTask, setLastTask] = useState<Task | null>(null);
    const [classes, setClasses] = useState<Class[]>([]);
    const [studentLessons, setStudentLessons] = useState<Lesson[]>([]);
    const [studentGrades, setStudentGrades] = useState<Grade[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isEducational && !isStudent && !isTeacher) {
            listTasks().then((tasks) => {
                if (tasks.length) setLastTask(tasks[0]);
            });
        } else if (isTeacher) {
            setLoading(true);
            getClasses()
                .then(setClasses)
                .finally(() => setLoading(false));
        } else if (isStudent && user.studentId) {
            setLoading(true);
            Promise.all([
                getStudentLessons(),
                getStudentGrades(user.studentId),
            ])
                .then(([lessons, gradesData]) => {
                    setStudentLessons(lessons);
                    setStudentGrades(gradesData.grades || []);
                })
                .finally(() => setLoading(false));
        }
    }, [isEducational, isStudent, isTeacher, user.studentId]);

    const totalStudents = classes.reduce(
        (sum, cls) => sum + cls.studentsCount,
        0
    );

    const activeLessons = useMemo(() => {
        if (!studentLessons.length) return 0;

        const gradesByLesson = new Map<number, Grade[]>();
        studentGrades.forEach((g) => {
            const id = g.task.lesson.id;
            if (!gradesByLesson.has(id)) gradesByLesson.set(id, []);
            gradesByLesson.get(id)!.push(g);
        });

        return studentLessons.filter((lesson) => {
            const grades = gradesByLesson.get(lesson.id) || [];
            return (
                grades.length < lesson.tasksCount ||
                grades.some((g) => g.total < 6)
            );
        }).length;
    }, [studentLessons, studentGrades]);

    const recentGrades = [...studentGrades]
        .sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
        )
        .slice(0, 3);

    const averageGrade =
        studentGrades.length > 0
            ? Math.round(
            (studentGrades.reduce((s, g) => s + g.total, 0) /
                studentGrades.length) *
            10
        ) / 10
            : null;

    return (
        <div className="h-full flex items-center justify-center bg-bg-base p-6 overflow-y-auto">
            <div className="max-w-2xl w-full space-y-6">
                {/* HEADER */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <Logo size={48} />
                        <h1 className="text-2xl font-mono text-text-primary">
                            StudyCod {isEducational ? "EDU" : ""}
                        </h1>
                    </div>
                    <p className="text-sm font-mono text-text-secondary">
                        Привіт, {user.username}
                    </p>
                </div>

                {/* === СТАТИСТИКА ВЧИТЕЛЯ === */}
                {isTeacher && !loading && (
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="p-4">
                            <Users className="w-5 h-5 text-primary" />
                            <p className="text-xs">Класів</p>
                            <p className="text-xl">{classes.length}</p>
                        </Card>
                        <Card className="p-4">
                            <GraduationCap className="w-5 h-5 text-primary" />
                            <p className="text-xs">Учнів</p>
                            <p className="text-xl">{totalStudents}</p>
                        </Card>
                    </div>
                )}

                {/* === СТАТИСТИКА СТУДЕНТА === */}
                {isStudent && !loading && (
                    <div className="grid grid-cols-2 gap-4">
                        {averageGrade !== null && (
                            <Card className="p-4">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                <p className="text-xs">Середній бал</p>
                                <p className="text-xl">{averageGrade.toFixed(1)}</p>
                            </Card>
                        )}
                        <Card className="p-4">
                            <Clock className="w-5 h-5 text-primary" />
                            <p className="text-xs">Активних уроків</p>
                            <p className="text-xl">{activeLessons}</p>
                        </Card>
                    </div>
                )}

                {/* === ОСТАННІ ОЦІНКИ === */}
                {isStudent && recentGrades.length > 0 && (
                    <Card className="p-4">
                        <h3 className="text-sm mb-3">Останні оцінки</h3>
                        {recentGrades.map((g) => (
                            <div key={g.id} className="flex justify-between text-sm">
                                <span>{g.task.title}</span>
                                <span>{g.total}/12</span>
                            </div>
                        ))}
                    </Card>
                )}

                {/* === КНОПКА === */}
                {isStudent ? (
                    <Button onClick={() => onNavigate("student")}>
                        <BookOpen className="w-5 h-5" /> Мій журнал
                    </Button>
                ) : isTeacher || isEducational ? (
                    <Button onClick={() => onNavigate("teacher")}>
                        <GraduationCap className="w-5 h-5" /> Мої класи
                    </Button>
                ) : (
                    <Button onClick={() => onNavigate("tasks")}>
                        <FileText className="w-5 h-5" /> Продовжити навчання
                    </Button>
                )}
            </div>
        </div>
    );
};

export default HomePage;
