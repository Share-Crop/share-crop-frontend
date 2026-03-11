import React from 'react';

// Tailwind-based stat card; parent Grid still controls 2x2 vs 1x4 layout.
const StatCard = ({ icon, iconBg, iconColor, value, label }) => {
  return (
    <div
      className="flex h-[130px] w-full items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg box-border"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="ml-3 flex flex-col">
        <div
          className="font-semibold text-slate-900"
          style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)' }}
        >
          {value}
        </div>
        <div
          className="text-xs text-slate-500"
          style={{ fontSize: 'clamp(0.7rem, 2.2vw, 0.8rem)' }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};

export default StatCard;

