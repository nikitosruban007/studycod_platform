
import React from "react";
import { Button } from "./Button";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  closable?: boolean;
  showCloseButton?: boolean;
}

export const Modal: React.FC<Props> = ({ open, title, description, onClose, children, closable = true, showCloseButton = true }) => {
  if (!open) return null;
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 transition-fast ease-out" 
      onClick={closable ? onClose : undefined}
      style={{ backdropFilter: "blur(2px)" }}
    >
      <div 
        className="bg-bg-surface border border-border max-w-[900px] w-[95vw] max-h-[95vh] flex flex-col overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 py-4 border-b border-border flex-shrink-0">
            <h2 className="text-lg font-mono text-text-primary">{title}</h2>
            {description && <p className="text-sm text-text-secondary mt-2 whitespace-pre-line">{description}</p>}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4">
        {children}
        </div>
        {showCloseButton && (
          <div className="px-6 py-4 border-t border-border flex justify-end flex-shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Закрити
          </Button>
        </div>
        )}
      </div>
    </div>
  );
};
