import React from 'react';

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, ...props }) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && (
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {label}
      </label>
    )}
    <input
      {...props}
      className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder:text-slate-600"
    />
  </div>
);
