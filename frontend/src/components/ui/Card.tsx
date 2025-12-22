
import React from "react";
import clsx from "classnames";

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={clsx("bg-bg-surface border border-border", className)}>{children}</div>
);
