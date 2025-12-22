import React, { useEffect, useState, Suspense, useCallback, useMemo, startTransition } from "react";
import { Routes, Route, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getMe } from "./lib/api/profile";
import type { User } from "./types";
import { Code2, User as UserIcon, FileText, Home, Menu, X, GraduationCap, BookOpen } from "lucide-react";
import { Button } from "./components/ui/Button";
import { Logo } from "./components/Logo";

// Lazy loading всіх сторінок - завантажуються тільки коли потрібні
const AuthPage = React.lazy(() => import("./pages/AuthPage").then((mod) => ({ default: mod.AuthPage })));
const VerifyEmailPage = React.lazy(() =>
  import("./pages/VerifyEmailPage").then((mod) => ({ default: mod.VerifyEmailPage }))
);
const ResetPasswordPage = React.lazy(() =>
  import("./pages/ResetPasswordPage").then((mod) => ({ default: mod.ResetPasswordPage }))
);
const TasksPage = React.lazy(() => import("./pages/TasksPage").then((mod) => ({ default: mod.TasksPage })));
const GradesPage = React.lazy(() => import("./pages/GradesPage").then((mod) => ({ default: mod.GradesPage })));
const ProfilePage = React.lazy(() => import("./pages/ProfilePage").then((mod) => ({ default: mod.ProfilePage })));
const HomePage = React.lazy(() => import("./pages/HomePage").then((mod) => ({ default: mod.HomePage })));
const TeacherDashboardPage = React.lazy(() =>
  import("./pages/TeacherDashboardPage").then((mod) => ({ default: mod.TeacherDashboardPage }))
);
const ClassDetailsPage = React.lazy(() =>
  import("./pages/ClassDetailsPage").then((mod) => ({ default: mod.ClassDetailsPage }))
);
const CreateLessonPage = React.lazy(() =>
  import("./pages/CreateLessonPage").then((mod) => ({ default: mod.CreateLessonPage }))
);
const StudentDashboardPage = React.lazy(() =>
  import("./pages/StudentDashboardPage").then((mod) => ({ default: mod.StudentDashboardPage }))
);
const StudentLessonsPage = React.lazy(() =>
  import("./pages/StudentLessonsPage").then((mod) => ({ default: mod.StudentLessonsPage }))
);
const LessonDetailsPage = React.lazy(() =>
  import("./pages/LessonDetailsPage").then((mod) => ({ default: mod.LessonDetailsPage }))
);
const StudentTaskPage = React.lazy(() =>
  import("./pages/StudentTaskPage").then((mod) => ({ default: mod.StudentTaskPage }))
);
const GradeDetailsPage = React.lazy(() =>
  import("./pages/GradeDetailsPage").then((mod) => ({ default: mod.GradeDetailsPage }))
);
const SummaryGradesPage = React.lazy(() =>
  import("./pages/SummaryGradesPage").then((mod) => ({ default: mod.SummaryGradesPage }))
);
const ClassGradebookPage = React.lazy(() =>
  import("./pages/ClassGradebookPage").then((mod) => ({ default: mod.ClassGradebookPage }))
);
const GoogleAuthCompletePage = React.lazy(() =>
  import("./pages/GoogleAuthCompletePage").then((mod) => ({ default: mod.GoogleAuthCompletePage }))
);

// Loading fallback компонент
const PageLoader: React.FC = () => (
  <div className="h-screen flex items-center justify-center text-text-primary font-mono bg-bg-base">
    Завантаження...
  </div>
);

type Page = "home" | "tasks" | "grades" | "profile" | "teacher" | "student";

const AppContent: React.FC = React.memo(() => {
  const [page, setPage] = useState<Page>("home");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);

  // Cleanup старих записів localStorage (старіше 30 днів)
  useEffect(() => {
    const cleanupOldStorage = () => {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 днів

      keys.forEach((key) => {
        if (key.startsWith("quiz_") || key.startsWith("task_")) {
          const timestampKey = `${key}_timestamp`;
          const timestamp = localStorage.getItem(timestampKey);
          
          if (timestamp) {
            const age = now - parseInt(timestamp, 10);
            if (age > maxAge) {
              localStorage.removeItem(key);
              localStorage.removeItem(timestampKey);
            }
          } else {
            // Якщо немає timestamp, видаляємо старі записи (безпека)
            localStorage.removeItem(key);
          }
        }
      });
    };

    // Виконуємо cleanup при завантаженні
    cleanupOldStorage();
    
    // Cleanup кожні 24 години
    const interval = setInterval(cleanupOldStorage, 24 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((u) => {
        setUser(u);
        // Auto-redirect to tasks if coming from auth (тільки для Personal)
        const fromAuth = sessionStorage.getItem("fromAuth");
        if (fromAuth && (!u.userMode || u.userMode === "PERSONAL")) {
          startTransition(() => {
            setPage("tasks");
          });
          sessionStorage.removeItem("fromAuth");
        } else if (fromAuth && u.userMode === "EDUCATIONAL" && u.studentId) {
          // Для учнів - на сторінку журналу
          startTransition(() => {
            setPage("student");
          });
          sessionStorage.removeItem("fromAuth");
        } else if (fromAuth && u.userMode === "EDUCATIONAL" && !u.studentId) {
          // Для вчителів - на сторінку класів
          startTransition(() => {
            setPage("teacher");
          });
          sessionStorage.removeItem("fromAuth");
        }
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.error("Failed to get user:", error);
        }
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    startTransition(() => {
      setPage("home");
    });
  }, []);

  const handleSetPage = useCallback((newPage: Page) => {
    startTransition(() => {
      setPage(newPage);
    });
    setNavOpen(false);
  }, []);

  const handleToggleNav = useCallback(() => {
    setNavOpen((prev) => !prev);
  }, []);

  const handleCloseNav = useCallback(() => {
    setNavOpen(false);
  }, []);

  // Мемоізація курсів та режимів - ВСІ hooks ПЕРЕД умовними return
  // Використовуємо стабільні значення, щоб уникнути зміни кількості hooks
  const courseLabel = useMemo(() => {
    if (!user) return "Java";
    return user.course === "JAVA" ? "Java" : "Python";
  }, [user?.course]);
  const userModeLabel = useMemo(() => {
    if (!user) return "Personal";
    return user.userMode === "EDUCATIONAL" ? "EDU" : "Personal";
  }, [user?.userMode]);

  // Умовні return ПІСЛЯ всіх hooks
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-text-primary font-mono">
        Завантаження...
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={(u) => { setUser(u); sessionStorage.setItem("fromAuth", "true"); }} />;
  }

  return (
    <div className="h-screen bg-bg-base text-text-primary overflow-hidden">
      {/* Global Header */}
      <header className="h-16 border-b border-border bg-bg-surface flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Logo size={24} className="text-primary" />
            <span className="text-lg font-mono text-text-primary">StudyCod</span>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="px-3 py-1 border border-border text-sm font-mono text-text-secondary">
            {courseLabel}
          </div>
          {user.userMode && (
            <>
              <div className="h-6 w-px bg-border" />
              <div className="px-3 py-1 border border-border text-sm font-mono text-text-secondary">
                {userModeLabel}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Navigation Tabs - видимі для Personal mode */}
          {(!user.userMode || user.userMode === "PERSONAL") && (
            <>
              <button
                onClick={() => handleSetPage("home")}
                className={`px-4 py-2 text-sm font-mono border transition-fast flex items-center gap-2 ${
                  page === "home"
                    ? "border-primary bg-bg-hover text-primary"
                    : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                <Home className="w-4 h-4" />
                Головна
              </button>
              <button
                onClick={() => handleSetPage("tasks")}
                className={`px-4 py-2 text-sm font-mono border transition-fast flex items-center gap-2 ${
                  page === "tasks"
                    ? "border-primary bg-bg-hover text-primary"
                    : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                <FileText className="w-4 h-4" />
                Завдання
              </button>
              <button
                onClick={() => handleSetPage("grades")}
                className={`px-4 py-2 text-sm font-mono border transition-fast flex items-center gap-2 ${
                  page === "grades"
                    ? "border-primary bg-bg-hover text-primary"
                    : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                <FileText className="w-4 h-4" />
                Оцінки
              </button>
            </>
          )}

          {/* Navigation для Educational mode */}
          {user.userMode === "EDUCATIONAL" && !user.studentId && (
            <button
              onClick={() => handleSetPage("teacher")}
              className={`px-4 py-2 text-sm font-mono border transition-fast flex items-center gap-2 ${
                page === "teacher"
                  ? "border-primary bg-bg-hover text-primary"
                  : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Мої класи
            </button>
          )}

          {user.userMode === "EDUCATIONAL" && user.studentId && (
            <>
              <button
                onClick={() => handleSetPage("student")}
                className={`px-4 py-2 text-sm font-mono border transition-fast flex items-center gap-2 ${
                  page === "student"
                    ? "border-primary bg-bg-hover text-primary"
                    : "border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Мій журнал
              </button>
              <button
                onClick={() => {
                  window.location.href = "/edu/lessons";
                }}
                className="px-4 py-2 text-sm font-mono border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-fast flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Уроки
              </button>
            </>
          )}

          <div className="h-6 w-px bg-border mx-2" />

          {/* Profile & Menu */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSetPage("profile")}
              className={`w-8 h-8 border flex items-center justify-center hover:bg-bg-hover transition-fast ${
                page === "profile" ? "border-primary" : "border-border"
              }`}
              title="Профіль"
            >
              <UserIcon className="w-4 h-4 text-text-secondary" />
            </button>
            <div className="relative">
              <button
                onClick={handleToggleNav}
                className="w-8 h-8 border border-border flex items-center justify-center hover:bg-bg-hover transition-fast"
                title="Меню"
              >
                {navOpen ? <X className="w-4 h-4 text-text-secondary" /> : <Menu className="w-4 h-4 text-text-secondary" />}
              </button>
              {navOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={handleCloseNav} />
                  <div className="absolute right-0 top-10 z-40 bg-bg-surface border border-border min-w-[180px]">
                    <nav className="flex flex-col">
                      <button
                        onClick={handleLogout}
                        className="px-4 py-2 text-left text-sm font-mono hover:bg-bg-hover transition-fast text-accent-error"
                      >
                        Вийти
                      </button>
                    </nav>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<PageLoader />}>
          {page === "home" && <HomePage user={user} onNavigate={handleSetPage} />}
          {page === "tasks" && user.userMode !== "EDUCATIONAL" && <TasksPage user={user} />}
          {page === "grades" && user.userMode !== "EDUCATIONAL" && <GradesPage onNavigate={handleSetPage} />}
          {page === "teacher" && user.userMode === "EDUCATIONAL" && !user.studentId && <TeacherDashboardPage />}
          {page === "student" && user.userMode === "EDUCATIONAL" && <StudentDashboardPage user={user} />}
        {page === "profile" && <ProfilePage user={user} onUserChange={setUser} />}
        </Suspense>
      </main>
    </div>
  );
});

AppContent.displayName = "AppContent";

export const App: React.FC = () => {
  return (
    <Routes>
      <Route
        path="/verify-email"
        element={
          <Suspense fallback={<PageLoader />}>
            <VerifyEmailWrapper />
          </Suspense>
        }
      />
      <Route
        path="/auth/reset-password"
        element={
          <Suspense fallback={<PageLoader />}>
            <ResetPasswordPage />
          </Suspense>
        }
      />
      <Route
        path="/auth/google/complete"
        element={
          <Suspense fallback={<PageLoader />}>
            <GoogleAuthWrapper />
          </Suspense>
        }
      />
      <Route
        path="/auth/google/success"
        element={
          <Suspense fallback={<PageLoader />}>
            <GoogleAuthSuccessWrapper />
          </Suspense>
        }
      />
      <Route
        path="/auth/google/error"
        element={
          <Suspense fallback={<PageLoader />}>
            <GoogleAuthErrorPage />
          </Suspense>
        }
      />
      <Route
        path="/edu/*"
        element={
          <Suspense fallback={<PageLoader />}>
            <EduRoutes />
          </Suspense>
        }
      />
      <Route path="*" element={<AppContent />} />
    </Routes>
  );
};

const EduRoutes: React.FC = React.memo(() => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((u) => {
        if (u.userMode !== "EDUCATIONAL") {
          window.location.href = "/";
          return;
        }
        setUser(u);
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.error("EduRoutes: Failed to get user", error);
        }
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = useCallback((u: User) => {
    setUser(u);
  }, []);

  // ВСІ hooks ПЕРЕД умовними return
  const courseLabel = useMemo(() => {
    if (!user) return "Java";
    return user.course === "JAVA" ? "Java" : "Python";
  }, [user?.course]);

  // Умовні return ПІСЛЯ всіх hooks
  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <AuthPage onAuth={handleAuth} />
      </Suspense>
    );
  }

  return (
    <div className="h-screen bg-bg-base text-text-primary overflow-hidden flex flex-col">
      <header className="h-16 border-b border-border bg-bg-surface flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Logo size={24} className="text-primary" />
            <span className="text-lg font-mono text-text-primary">StudyCod EDU</span>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="px-3 py-1 border border-border text-sm font-mono text-text-secondary">
            {courseLabel}
          </div>
        </div>
        <button
          onClick={() => window.location.href = "/"}
          className="px-4 py-2 border border-border text-sm font-mono hover:bg-bg-hover transition-fast"
        >
          На головну
        </button>
      </header>
      <main className="flex-1 overflow-hidden flex flex-col">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/classes/:classId" element={<ClassDetailsPage />} />
            <Route path="/classes/:classId/lessons/new" element={<CreateLessonPage />} />
            <Route path="/classes/:classId/summary-grades" element={<SummaryGradesPage />} />
            <Route path="/classes/:classId/gradebook" element={<ClassGradebookPage />} />
            <Route path="/lessons" element={<StudentLessonsPage />} />
            <Route path="/lessons/:lessonId" element={<LessonDetailsPage />} />
            <Route path="/tasks/:taskId" element={<StudentTaskPage />} />
            <Route path="/grades/:gradeId" element={<GradeDetailsPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
});

EduRoutes.displayName = "EduRoutes";

const VerifyEmailWrapper: React.FC = React.memo(() => {
  const navigate = useNavigate();

  const handleAuth = useCallback(
    (u: User) => {
      navigate("/");
    },
    [navigate]
  );

  return (
    <Suspense fallback={<PageLoader />}>
      <VerifyEmailPage onAuth={handleAuth} />
    </Suspense>
  );
});

VerifyEmailWrapper.displayName = "VerifyEmailWrapper";

const GoogleAuthWrapper: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const handleAuth = useCallback((user: User) => {
    sessionStorage.setItem("fromAuth", "true");
    navigate("/");
    window.location.reload();
  }, [navigate]);
  return <GoogleAuthCompletePage onAuth={handleAuth} />;
});
GoogleAuthWrapper.displayName = "GoogleAuthWrapper";

const GoogleAuthSuccessWrapper: React.FC = React.memo(() => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      sessionStorage.setItem("fromAuth", "true");
      navigate("/");
      window.location.reload();
    } else {
      navigate("/");
    }
  }, [token, navigate]);

  return <PageLoader />;
});
GoogleAuthSuccessWrapper.displayName = "GoogleAuthSuccessWrapper";

const GoogleAuthErrorPage: React.FC = React.memo(() => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="w-full max-w-md bg-bg-surface border border-border p-8">
        <div className="text-xs font-mono text-accent-error border border-accent-error bg-bg-code px-3 py-2">
          Помилка авторизації через Google. Спробуйте ще раз.
        </div>
        <Button onClick={() => navigate("/")} className="w-full mt-4">
          Повернутись на головну
        </Button>
      </div>
    </div>
  );
});
GoogleAuthErrorPage.displayName = "GoogleAuthErrorPage";
