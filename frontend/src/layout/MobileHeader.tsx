import React from 'react';
import { Code2, Menu } from 'lucide-react';

interface MobileHeaderProps {
  onOpenMenu: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ onOpenMenu }) => (
  <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
    <div className="flex items-center space-x-2">
      <div className="bg-indigo-600 p-1.5 rounded">
        <Logo size={20} />
      </div>
      <span className="font-bold text-lg">StudyCod</span>
    </div>
    <button onClick={onOpenMenu} className="p-2">
      <Menu size={24} />
    </button>
  </div>
);
