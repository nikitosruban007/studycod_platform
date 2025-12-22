
import React, { useState } from "react";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/Logo";
import { register, login, resendVerificationEmail, requestPasswordReset, resetPassword } from "../lib/api/auth";
import { registerTeacher, studentLogin } from "../lib/api/edu";
import type { User, CourseLanguage } from "../types";

interface Props {
  onAuth: (user: User) => void;
}

type Mode = "login" | "register";
type UserMode = "PERSONAL" | "EDUCATIONAL";

export const AuthPage: React.FC<Props> = ({ onAuth }) => {
  const [userMode, setUserMode] = useState<UserMode>("PERSONAL");
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [course, setCourse] = useState<CourseLanguage>("JAVA");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDay, setBirthDay] = useState<number | "">("");
  const [birthMonth, setBirthMonth] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (mode === "login") {
        try {
          // Спочатку пробуємо вхід як учень (для EDU режиму)
          if (userMode === "EDUCATIONAL") {
            try {
              const studentResult = await studentLogin(username.trim(), password);
              // Якщо успішно - це учень
              // Створюємо User-подібний об'єкт для сумісності
              const studentUser = {
                id: studentResult.student.id,
                username: studentResult.student.username,
                course: studentResult.student.language,
                lang: studentResult.student.language,
                difus: 0,
                avatarUrl: null,
                userMode: "EDUCATIONAL" as const,
                studentId: studentResult.student.id,
                classId: studentResult.student.classId,
                className: studentResult.student.className,
                firstName: studentResult.student.firstName,
                lastName: studentResult.student.lastName,
                middleName: studentResult.student.middleName,
                email: studentResult.student.email,
              };
              onAuth(studentUser as any);
              return;
            } catch (studentErr: any) {
              // Якщо не учень, пробуємо як вчитель
              // Продовжуємо до звичайного login
            }
          }
          
          // Звичайний вхід (вчитель або Personal)
          const user = await login(username.trim(), password);
          // Перевірка режиму
          if (userMode === "PERSONAL" && user.userMode === "EDUCATIONAL") {
            setError("Цей акаунт призначений для EDU режиму. Оберіть вкладку 'EDU'.");
            return;
          }
          if (userMode === "EDUCATIONAL" && user.userMode === "PERSONAL") {
            setError("Цей акаунт призначений для Personal режиму. Оберіть вкладку 'Personal'.");
            return;
          }
          onAuth(user);
        } catch (loginErr: any) {
          const loginErrorMessage = loginErr?.response?.data?.message ?? "Помилка авторизації";
          if (loginErrorMessage === "EMAIL_NOT_VERIFIED" && userMode === "EDUCATIONAL") {
            setError("Email не підтверджено. Перевірте вашу пошту та підтвердіть email перед входом.");
            setEmailSent(true);
            // Спробуємо знайти email з username (якщо це email)
            if (username.includes("@")) {
              setEmail(username);
            }
          } else {
            setError(loginErrorMessage);
          }
          return;
        }
      } else {
        // Registration
        if (userMode === "EDUCATIONAL") {
          // Teacher registration for EDU mode
          if (!email.trim()) {
            setError("Email обов'язковий для реєстрації вчителя");
            return;
          }
          const result = await registerTeacher(
            username.trim(),
            email.trim(),
            password,
            course
          );
          // Для EDU режиму email підтвердження обов'язкове
          if (result.requiresEmailVerification) {
            setEmailSent(true);
            setSuccess("Реєстрація вчителя успішна! Перевірте вашу пошту для підтвердження email. Після підтвердження ви зможете увійти.");
          } else if (result.user && result.token) {
            // Якщо токен повернуто (не повинно бути для EDU)
            setSuccess("Реєстрація вчителя успішна!");
            setTimeout(() => {
              onAuth(result.user);
            }, 1500);
          }
        } else {
          // Regular Personal mode registration
          const result = await register(username.trim(), email.trim(), password, course);
          if (result.requiresEmailVerification) {
            setEmailSent(true);
            setSuccess("Реєстрація успішна! Перевірте вашу пошту для підтвердження.");
          } else if (result.user && result.token) {
            onAuth(result.user);
          }
        }
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message ?? "Помилка авторизації";
      setError(errorMessage);
      if (errorMessage === "EMAIL_NOT_VERIFIED") {
        setEmailSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email.trim()) {
      setError("Введіть email для повторної відправки");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resendVerificationEmail(email.trim());
      setSuccess("Лист підтвердження відправлено повторно!");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Помилка відправки листа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base" style={{ minWidth: "1280px" }}>
      <div className="w-full max-w-md bg-bg-surface border border-border p-8">
        <div className="flex flex-col items-center mb-6">
          <Logo size={48} />
          <h1 className="mt-4 text-xl font-mono text-text-primary">
            {mode === "login"
              ? userMode === "EDUCATIONAL"
                ? "Вхід EDU"
                : "Вхід Personal"
              : userMode === "EDUCATIONAL"
              ? "Реєстрація вчителя (EDU)"
              : "Реєстрація (Personal)"}
          </h1>
        </div>
        <div className="flex mb-4 border border-border bg-bg-code p-1">
          <button
            onClick={() => {
              setUserMode("PERSONAL");
              setMode("login");
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2 text-xs font-mono transition-fast ${
              userMode === "PERSONAL"
                ? "bg-bg-hover text-text-primary border border-border"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Personal
          </button>
          <button
            onClick={() => {
              setUserMode("EDUCATIONAL");
              setMode("login");
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2 text-xs font-mono transition-fast ${
              userMode === "EDUCATIONAL"
                ? "bg-bg-hover text-text-primary border border-border"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            EDU
          </button>
        </div>
        {emailSent ? (
          <div className="space-y-4">
            <div className="text-xs font-mono text-text-primary border border-primary bg-bg-code px-3 py-2">
              {success || "Перевірте вашу пошту для підтвердження email. Після підтвердження ви зможете увійти."}
            </div>
            <div>
              <label className="text-xs font-mono text-text-secondary mb-1 block">Email</label>
              <input
                type="email"
                className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <Button type="button" onClick={handleResendEmail} className="w-full" disabled={loading}>
              {loading ? "Відправка..." : "Відправити лист повторно"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setEmailSent(false);
                setSuccess(null);
                setError(null);
              }}
              className="w-full text-xs font-mono text-text-secondary hover:text-text-primary transition-fast"
            >
              Повернутись до реєстрації
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-text-secondary mb-1 block">Логін</label>
              <input
                className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            {mode === "register" && (
              <>
                <div>
                  <label className="text-xs font-mono text-text-secondary mb-1 block">Email</label>
                  <input
                    type="email"
                    className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-mono text-text-secondary mb-1 block">Ім'я</label>
                    <input
                      type="text"
                      className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-text-secondary mb-1 block">Прізвище</label>
                    <input
                      type="text"
                      className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-mono text-text-secondary mb-1 block">День народження (без року)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-mono text-text-secondary mb-1 block">День</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
                        value={birthDay}
                        onChange={(e) => setBirthDay(e.target.value ? Number(e.target.value) : "")}
                        placeholder="1-31"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-text-secondary mb-1 block">Місяць</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
                        value={birthMonth}
                        onChange={(e) => setBirthMonth(e.target.value ? Number(e.target.value) : "")}
                        placeholder="1-12"
                        required
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-mono text-text-secondary mb-1 block">Пароль</label>
              <input
                type="password"
                className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          {mode === "register" && (
            <div>
              <label className="text-xs font-mono text-text-secondary mb-2 block">Мова курсу</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCourse("JAVA")}
                  className={`flex-1 py-2 px-4 border text-xs font-mono transition-fast ${
                    course === "JAVA"
                      ? "border-primary bg-bg-hover text-primary"
                      : "border-border text-text-secondary hover:border-primary/50"
                  }`}
                >
                  Java
                </button>
                <button
                  type="button"
                  onClick={() => setCourse("PYTHON")}
                  className={`flex-1 py-2 px-4 border text-xs font-mono transition-fast ${
                    course === "PYTHON"
                      ? "border-primary bg-bg-hover text-primary"
                      : "border-border text-text-secondary hover:border-primary/50"
                  }`}
                >
                  Python
                </button>
              </div>
            </div>
          )}
          {mode === "login" && (
            <div className="text-center space-y-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs font-mono text-text-secondary hover:text-primary transition-fast block w-full"
              >
                Немає аккаунту? <span className="text-primary">Зареєструватись</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs font-mono text-text-secondary hover:text-primary transition-fast block w-full"
              >
                Забули пароль? <span className="text-primary">Відновити</span>
              </button>
            </div>
          )}
          {mode === "register" && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs font-mono text-text-secondary hover:text-primary transition-fast"
              >
                Вже є аккаунт? <span className="text-primary">Увійти</span>
              </button>
            </div>
          )}
            {error && (
              <div className="text-xs font-mono text-accent-error border border-accent-error bg-bg-code px-3 py-2">
                {error}
              </div>
            )}
            {success && (
              <div className="text-xs font-mono text-primary border border-primary bg-bg-code px-3 py-2">
                {success}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading 
                ? "Обробка..." 
                : mode === "login"
                ? "Увійти"
                : "Зареєструватись"}
            </Button>
            {mode === "login" && (
              <div className="mt-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-bg-surface text-text-secondary font-mono">або</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/auth/google`;
                  }}
                  className="mt-4 w-full flex items-center justify-center gap-2 border border-border bg-bg-code hover:bg-bg-hover px-4 py-2 text-sm font-mono text-text-primary transition-fast"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Увійти через Google
                </button>
              </div>
            )}
          </form>
        )}

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-mono text-text-secondary mb-1 block">Email</label>
              <input
                type="email"
                className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            {error && (
              <div className="text-xs font-mono text-accent-error border border-accent-error bg-bg-code px-3 py-2">
                {error}
              </div>
            )}
            {success && (
              <div className="text-xs font-mono text-primary border border-primary bg-bg-code px-3 py-2">
                {success}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail("");
                  setError(null);
                  setSuccess(null);
                }}
                className="flex-1"
              >
                Скасувати
              </Button>
              <Button
                onClick={async () => {
                  if (!resetEmail.trim()) {
                    setError("Введіть email");
                    return;
                  }
                  setLoading(true);
                  setError(null);
                  setSuccess(null);
                  try {
                    await requestPasswordReset(resetEmail.trim());
                    setSuccess("Лист з інструкціями відправлено на вашу пошту!");
                    setTimeout(() => {
                      setShowForgotPassword(false);
                      setResetEmail("");
                    }, 2000);
                  } catch (err: any) {
                    setError(err?.response?.data?.message || "Помилка відправки листа");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex-1"
              >
                {loading ? "Відправка..." : "Відправити"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
