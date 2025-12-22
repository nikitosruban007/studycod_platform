import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verifyEmail } from "../lib/api/auth";
import { Button } from "../components/ui/Button";
import type { User } from "../types";

interface Props {
  onAuth: (user: User) => void;
}

export const VerifyEmailPage: React.FC<Props> = ({ onAuth }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Відсутній токен підтвердження");
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const result = await verifyEmail(token);
        setSuccess(true);
        setTimeout(() => {
          onAuth(result.user);
          navigate("/");
        }, 2000);
      } catch (err: any) {
        setError(err?.response?.data?.message ?? "Помилка підтвердження email");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [searchParams, onAuth, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="text-center">
          <div className="text-text-secondary font-mono">Підтвердження email...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="w-full max-w-md bg-bg-surface border border-border p-8">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border border-primary flex items-center justify-center font-mono text-xl text-primary mb-4">
            {success ? "✓" : "✗"}
          </div>
          {success ? (
            <>
              <h1 className="text-xl font-mono text-text-primary mb-4">Email підтверджено!</h1>
              <p className="text-sm font-mono text-text-secondary text-center mb-4">
                Ваш email успішно підтверджено. Зараз ви будете перенаправлені...
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-mono text-text-primary mb-4">Помилка підтвердження</h1>
              <p className="text-sm font-mono text-text-secondary text-center mb-4">
                {error || "Не вдалося підтвердити email"}
              </p>
              <Button onClick={() => navigate("/auth")}>Повернутись до входу</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

