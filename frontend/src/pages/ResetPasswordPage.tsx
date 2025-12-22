// frontend/src/pages/ResetPasswordPage.tsx
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { resetPassword } from "../lib/api/auth";

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Токен відновлення паролю відсутній");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("Токен відновлення паролю відсутній");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Введіть новий пароль та підтвердження");
      return;
    }

    if (newPassword.length < 6) {
      setError("Пароль повинен містити мінімум 6 символів");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Паролі не співпадають");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setSuccess("Пароль успішно змінено! Перенаправлення на сторінку входу...");
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Помилка зміни паролю");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base" style={{ minWidth: "1280px" }}>
      <div className="w-full max-w-md bg-bg-surface border border-border p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 border border-primary flex items-center justify-center font-mono text-xl text-primary">
            &lt;/&gt;
          </div>
          <h1 className="mt-4 text-xl font-mono text-text-primary">Відновлення паролю</h1>
        </div>

        {!token ? (
          <div className="text-xs font-mono text-accent-error border border-accent-error bg-bg-code px-3 py-2">
            Токен відновлення паролю відсутній або недійсний
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-text-secondary mb-1 block">Новий пароль</label>
              <input
                type="password"
                className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="text-xs font-mono text-text-secondary mb-1 block">Підтвердження паролю</label>
              <input
                type="password"
                className="w-full border border-border bg-bg-code px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-primary transition-fast"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Обробка..." : "Змінити пароль"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-xs font-mono text-text-secondary hover:text-primary transition-fast"
              >
                Повернутись до входу
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};









