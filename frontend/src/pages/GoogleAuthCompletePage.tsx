import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import type { CourseLanguage } from "../types";

interface Props {
  onAuth: (user: any) => void;
}

export const GoogleAuthCompletePage: React.FC<Props> = ({ onAuth }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [course, setCourse] = useState<CourseLanguage>("JAVA");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDay, setBirthDay] = useState<number | "">("");
  const [birthMonth, setBirthMonth] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleData, setGoogleData] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setError("Токен відсутній. Будь ласка, спробуйте знову.");
      return;
    }

    // Декодуємо токен для отримання даних від Google
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const payload = JSON.parse(jsonPayload);
      
      if (payload.firstName) setFirstName(payload.firstName);
      if (payload.lastName) setLastName(payload.lastName);
      if (payload.birthDay) setBirthDay(Number(payload.birthDay));
      if (payload.birthMonth) setBirthMonth(Number(payload.birthMonth));
      if (payload.email) {
        const suggestedUsername = payload.email.split("@")[0];
        setUsername(suggestedUsername);
      }
      setGoogleData(payload);
    } catch (err) {
      console.error("Error decoding token:", err);
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError("Логін обов'язковий");
      return;
    }

    if (!password) {
      setError("Пароль обов'язковий");
      return;
    }

    if (password !== confirmPassword) {
      setError("Паролі не співпадають");
      return;
    }

    if (password.length < 6) {
      setError("Пароль має бути мінімум 6 символів");
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError("Ім'я та прізвище обов'язкові");
      return;
    }

    if (!birthDay || !birthMonth) {
      setError("День та місяць народження обов'язкові");
      return;
    }

    if (birthDay < 1 || birthDay > 31 || birthMonth < 1 || birthMonth > 12) {
      setError("Невірна дата народження");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/auth/google/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          username: username.trim(),
          password,
          course,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          birthDay: Number(birthDay),
          birthMonth: Number(birthMonth),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Помилка завершення реєстрації");
        return;
      }

      // Зберігаємо токен та перенаправляємо
      if (data.token) {
        localStorage.setItem("token", data.token);
        onAuth(data.user);
      }
    } catch (err: any) {
      setError(err?.message || "Помилка завершення реєстрації");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="w-full max-w-md bg-bg-surface border border-border p-8">
          <div className="text-xs font-mono text-accent-error border border-accent-error bg-bg-code px-3 py-2">
            Токен відсутній. Будь ласка, спробуйте знову.
          </div>
          <Button onClick={() => navigate("/")} className="w-full mt-4">
            Повернутись на головну
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base" style={{ minWidth: "1280px" }}>
      <div className="w-full max-w-md bg-bg-surface border border-border p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 border border-primary flex items-center justify-center font-mono text-xl text-primary">
            &lt;/&gt;
          </div>
          <h1 className="mt-4 text-xl font-mono text-text-primary">
            Завершення реєстрації
          </h1>
          <p className="mt-2 text-xs font-mono text-text-secondary text-center">
            Заповніть додаткову інформацію для завершення реєстрації через Google
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-mono text-text-secondary mb-1 block">Логін</label>
            <input
              type="text"
              className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            {googleData?.email && (
              <p className="mt-1 text-xs font-mono text-text-secondary">
                Запропоновано з email: {googleData.email.split("@")[0]}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-mono text-text-secondary mb-1 block">Пароль</label>
            <input
              type="password"
              className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="text-xs font-mono text-text-secondary mb-1 block">Підтвердити пароль</label>
            <input
              type="password"
              className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
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

          {error && (
            <div className="text-xs font-mono text-accent-error border border-accent-error bg-bg-code px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Обробка..." : "Завершити реєстрацію"}
          </Button>
        </form>
      </div>
    </div>
  );
};

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Обробка..." : "Завершити реєстрацію"}
          </Button>
        </form>
      </div>
    </div>
  );
};
