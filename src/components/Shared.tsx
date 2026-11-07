import React, { type ReactNode, useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronsUpDown, Check, Trash2 } from 'lucide-react';
import { Tone } from '../types';

export function Header({
  leftIcon,
  title,
  rightIcon,
}: {
  leftIcon?: ReactNode;
  title: ReactNode;
  rightIcon?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between px-5 py-3.5 border-b border-bd-subtle/60 bg-canvas/80 backdrop-blur-sm shrink-0 sticky top-0 z-20">
      <div className="flex items-center justify-center shrink-0 min-w-[40px]">
        {leftIcon}
      </div>
      <h1 className="text-lg md:text-xl font-semibold text-tx-primary flex-1 text-center px-2 truncate tracking-tight">
        {title}
      </h1>
      <div className="flex items-center justify-center shrink-0 min-w-[40px] justify-end">
        {rightIcon}
      </div>
    </header>
  );
}

export function TabPill({
  options,
  active,
  onChange,
}: {
  options: [string, string];
  active: string;
  onChange: (val: string) => void;
}) {
  return (
    <div 
      role="tablist"
      aria-label="Filter Options"
      className="flex bg-surface-neutral/70 rounded-xl p-1 mx-5 border border-bd-subtle"
    >
      {options.map((opt) => {
        const isActive = active === opt;
        return (
          <button
            key={opt}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt)}
            className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bd-focus ${
              isActive 
                ? 'bg-canvas text-tx-primary shadow-xs' 
                : 'text-tx-muted hover:text-tx-primary'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function StatCard({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: Tone;
}) {
  // Selective accent styling: clean background with subtle accent indicator
  const accentBorder = {
    lime: 'border-t-2 border-t-accent-primary',
    olive: 'border-t-2 border-t-tx-primary',
    neutral: 'border-t-2 border-t-bd-medium',
  }[tone];

  const badgeBg = {
    lime: 'bg-accent-primary/20 text-tx-primary',
    olive: 'bg-surface-neutral text-tx-primary',
    neutral: 'bg-surface-neutral/60 text-tx-muted',
  }[tone];

  return (
    <div className={`p-4 rounded-xl border border-bd-subtle bg-canvas shadow-xs flex flex-col justify-between ${accentBorder} transition-all duration-150`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-tx-muted">{label}</span>
        <span className={`w-2 h-2 rounded-full ${tone === 'lime' ? 'bg-accent-primary' : tone === 'olive' ? 'bg-tx-primary' : 'bg-surface-muted'}`} />
      </div>
      <div className="text-3xl font-bold tracking-tight text-tx-primary font-mono tabular-nums leading-none">
        {value}
      </div>
    </div>
  );
}

export function ExpandableHeader({ label, onExpand }: { label: string; onExpand?: () => void }) {
  return (
    <button 
      onClick={onExpand} 
      className="flex items-center justify-between w-full px-5 py-2 hover:bg-surface-neutral/40 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bd-focus"
    >
      <span className="text-sm font-semibold text-tx-primary">{label}</span>
      <ChevronsUpDown size={16} className="text-tx-muted" />
    </button>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  onClick,
  trailing = <ChevronRight size={18} className="text-tx-muted" />,
  swipeable = false,
  onComplete,
  onDelete,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  swipeable?: boolean;
  onComplete?: () => void;
  onDelete?: () => void;
  key?: React.Key;
}) {
  const [offset, setOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!swipeable) return;
    startXRef.current = e.clientX;
    currentXRef.current = startXRef.current;
    setIsSwiping(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isSwiping) return;
    currentXRef.current = e.clientX;
    const diff = currentXRef.current - startXRef.current;
    if (diff < 0) {
      setOffset(Math.max(diff, -140));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isSwiping) return;
    setIsSwiping(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (offset < -70) {
      setOffset(-140);
    } else {
      setOffset(0);
    }
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      if (offset < 0) setOffset(0);
    };
    if (offset < 0) {
      document.addEventListener('pointerdown', handleGlobalClick);
    }
    return () => document.removeEventListener('pointerdown', handleGlobalClick);
  }, [offset]);

  return (
    <div className="relative mb-2 rounded-xl overflow-hidden bg-surface-neutral/50 border border-bd-subtle touch-pan-y shadow-xs">
      {/* Background Actions */}
      {swipeable && (
        <div className="absolute inset-0 flex justify-end items-center px-4 gap-3 bg-surface-neutral">
          <button 
            onClick={(e) => { e.stopPropagation(); onComplete?.(); setOffset(0); }}
            className="w-9 h-9 rounded-lg bg-accent-primary flex items-center justify-center text-tx-primary hover:bg-accent-primary-hover active:scale-95 transition-all"
            aria-label="Complete item"
          >
            <Check size={18} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(); setOffset(0); }}
            className="w-9 h-9 rounded-lg bg-accent-destructive text-white flex items-center justify-center hover:bg-accent-destructive-hover active:scale-95 transition-all"
            aria-label="Delete item"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}

      {/* Foreground Row */}
      <div 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ transform: `translateX(${offset}px)` }}
        className={`w-full flex items-center px-4 py-3 bg-canvas hover:bg-surface-neutral/30 active:bg-surface-neutral/50 transition-transform ${isSwiping ? 'duration-0' : 'duration-200'} ease-out cursor-pointer select-none`}
        onClick={(e) => {
          if (offset < 0) {
            e.stopPropagation();
            setOffset(0);
          } else {
            onClick?.();
          }
        }}
      >
        {icon && <div className="shrink-0 mr-3 pointer-events-none text-tx-muted">{icon}</div>}
        <div className="flex-1 min-w-0 pointer-events-none">
          <div className="text-sm font-semibold text-tx-primary truncate">{title}</div>
          {subtitle && <div className="text-xs text-tx-muted truncate mt-0.5">{subtitle}</div>}
        </div>
        {trailing && <div className="shrink-0 ml-3 pointer-events-none text-tx-muted">{trailing}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({
  progress,
  tone = 'lime',
  label,
}: {
  progress: number;
  tone?: Tone;
  label?: string;
}) {
  const fillClass = {
    lime: 'bg-accent-primary',
    olive: 'bg-tx-primary',
    neutral: 'bg-surface-muted',
  }[tone];

  return (
    <div className="w-full flex items-center gap-3">
      <div className="flex-1 h-2 bg-surface-neutral rounded-full overflow-hidden border border-bd-subtle/50">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${fillClass}`}
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      {label && <span className="text-xs text-tx-muted font-mono tabular-nums w-10 text-right">{label}</span>}
    </div>
  );
}

export function CircularProgress({
  progress,
  size = 80,
  strokeWidth = 6,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-neutral)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-accent-primary)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono tabular-nums">
        {children}
      </div>
    </div>
  );
}

export const DayAgendaRow: React.FC<{
  date: string;
  weekday: string;
  events: { startTime: string; label: string; onClick?: () => void }[];
}> = ({ date, weekday, events }) => {
  return (
    <div className="flex flex-col gap-2 mb-5">
      <div className="px-5 text-sm font-semibold text-tx-primary">
        {date}, <span className="text-tx-muted font-normal">{weekday}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto px-5 pb-2 no-scrollbar">
        {events.map((evt, i) => (
          <div
            key={i}
            onClick={evt.onClick}
            className={`flex flex-col justify-center h-14 min-w-[120px] px-3.5 rounded-xl bg-canvas border border-bd-subtle shrink-0 shadow-xs transition-colors ${evt.onClick ? 'cursor-pointer hover:bg-surface-neutral/40 active:bg-surface-neutral' : ''}`}
          >
            <div className="text-xs font-semibold text-tx-primary font-mono tabular-nums">{evt.startTime}</div>
            <div className="text-xs text-tx-muted mt-0.5 truncate max-w-[140px]">{evt.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
