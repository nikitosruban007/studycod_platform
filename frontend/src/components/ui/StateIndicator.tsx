import React from "react";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type State = "idle" | "evaluating" | "success" | "error" | "logic-warning";

interface Props {
  state: State;
  message?: string;
  className?: string;
}

export const StateIndicator: React.FC<Props> = ({ state, message, className }) => {
  if (state === "idle") return null;

  const config = {
    evaluating: {
      icon: Loader2,
      color: "text-secondary",
      bg: "bg-bg-code",
      border: "border-secondary",
      message: message || "Оцінювання...",
    },
    success: {
      icon: CheckCircle2,
      color: "text-accent-success",
      bg: "bg-bg-code",
      border: "border-accent-success",
      message: message || "Успішно",
    },
    error: {
      icon: XCircle,
      color: "text-accent-error",
      bg: "bg-bg-code",
      border: "border-accent-error",
      message: message || "Помилка",
    },
    "logic-warning": {
      icon: AlertTriangle,
      color: "text-accent-logic-warn",
      bg: "bg-bg-code",
      border: "border-accent-logic-warn",
      message: message || "Попередження",
    },
  };

  const { icon: Icon, color, bg, border, message: displayMessage } = config[state];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 border text-xs font-mono ${color} ${bg} ${border} ${className || ""} ${
        state === "evaluating" ? "animate-pulse" : ""
      }`}
    >
      <Icon className={`w-3 h-3 ${state === "evaluating" ? "animate-spin" : ""}`} />
      <span>{displayMessage}</span>
    </div>
  );
};


