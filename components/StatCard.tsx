import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, sub, icon }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 transition-transform hover:scale-[1.02]">
    <div className="bg-slate-50 p-3 rounded-lg">
      {icon}
    </div>
    <div>
      <div className="text-xs text-slate-500 font-medium">{title}</div>
      <div className="text-lg font-bold text-slate-800 leading-none my-1">{value}</div>
      <div className="text-[10px] text-slate-400">{sub}</div>
    </div>
  </div>
);