
import React from "react";
import clsx from "classnames";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export const Button: React.FC<Props> = ({ variant = "primary", className, ...props }) => {
  const base =
    "inline-flex items-center justify-center px-4 py-2 text-sm font-mono transition-fast ease-out focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed";
  
  const variants: Record<string, string> = {
    primary: "border border-primary text-primary hover:bg-primary hover:text-bg-base active:bg-primary active:text-bg-base",
    secondary: "border border-secondary text-secondary hover:bg-secondary hover:text-bg-base active:bg-secondary active:text-bg-base",
    ghost: "border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary active:bg-bg-hover",
  };
  
  return <button className={clsx(base, variants[variant], className)} {...props} />;
};
