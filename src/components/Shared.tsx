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
    <header className="flex items-center justify-between px-5 py-4 shrink-0">
      <div className="flex items-center justify-center shrink-0 min-w-[44px]">
        {leftIcon}
      </div>
      <h1 className="text-[22px] font-semibold text-tx-primary flex-1 text-center px-2 truncate">
        {title}
      </h1>
      <div className="flex items-center justify-center shrink-0 min-w-[44px] justify-end">
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
    <div className="flex bg-surface-neutral rounded-full p-1 mx-5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 py-2.5 text-center text-[15px] font-medium rounded-full transition-colors ${
            active === opt ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted'
          }`}
        >
          {opt}
        </button>
      ))}
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
  const bgClass = {
    lime: 'bg-accent-primary',
    olive: 'bg-surface-muted',
    neutral: 'bg-surface-neutral',
  }[tone];

  const valColor = tone === 'olive' ? 'text-tx-inverse' : 'text-tx-primary';
  const labelColor = tone === 'olive' ? 'text-tx-inverse' : 'text-tx-muted';

  return (
    <div className={`p-4 rounded-[24px] flex flex-col justify-center ${bgClass}`}>
      <div className={`text-[36px] font-light leading-tight ${valColor}`}>{value}</div>
      <div className={`text-[13px] mt-1 font-medium ${labelColor}`}>{label}</div>
    </div>
  );
}

export function ExpandableHeader({ label, onExpand }: { label: string; onExpand?: () => void }) {
  return (
    <button onClick={onExpand} className="flex items-center justify-between w-full px-5 py-2">
      <span className="text-[17px] font-medium text-tx-primary">{label}</span>
      <ChevronsUpDown size={18} className="text-tx-muted" />
    </button>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  onClick,
  trailing = <ChevronRight size={20} className="text-tx-muted" />,
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
    <div className="relative mb-2 rounded-[20px] overflow-hidden bg-surface-neutral border border-bd-subtle touch-pan-y">
      {/* Background Actions */}
      {swipeable && (
        <div className="absolute inset-0 flex justify-end items-center px-4 gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onComplete?.(); setOffset(0); }}
            className="w-10 h-10 rounded-full bg-accent-primary flex items-center justify-center text-tx-primary"
            aria-label="Complete item"
          >
            <Check size={20} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(); setOffset(0); }}
            className="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center text-tx-inverse"
            aria-label="Delete item"
          >
            <Trash2 size={20} />
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
        className={`w-full flex items-center px-4 py-3 bg-canvas active:bg-canvas/80 transition-transform ${isSwiping ? 'duration-0' : 'duration-300'} ease-out`}
        onClick={(e) => {
          if (offset < 0) {
            e.stopPropagation();
            setOffset(0);
          } else {
            onClick?.();
          }
        }}
      >
        {icon && <div className="shrink-0 mr-3 pointer-events-none">{icon}</div>}
        <div className="flex-1 min-w-0 pointer-events-none">
          <div className="text-[16px] font-medium text-tx-primary truncate">{title}</div>
          {subtitle && <div className="text-[13px] text-tx-muted truncate mt-0.5">{subtitle}</div>}
        </div>
        {trailing && <div className="shrink-0 ml-3 pointer-events-none">{trailing}</div>}
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
    olive: 'bg-surface-muted',
    neutral: 'bg-surface-neutral',
  }[tone];

  return (
    <div className="w-full flex items-center gap-3">
      <div className="flex-1 h-2 bg-surface-neutral rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${fillClass}`}
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      {label && <span className="text-[13px] text-tx-muted font-medium w-9 text-right">{label}</span>}
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
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
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
      <div className="absolute inset-0 flex items-center justify-center">
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
    <div className="flex flex-col gap-2 mb-6">
      <div className="px-5 text-[15px] font-medium text-tx-primary">
        {date}, <span className="text-tx-muted font-normal">{weekday}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto px-5 pb-2 no-scrollbar">
        {events.map((evt, i) => (
          <div
            key={i}
            onClick={evt.onClick}
            className={`flex flex-col justify-center h-16 min-w-[120px] px-4 rounded-[20px] bg-canvas border border-bd-subtle shrink-0 ${evt.onClick ? 'cursor-pointer active:bg-surface-neutral' : ''}`}
          >
            <div className="text-[13px] font-medium text-tx-primary">{evt.startTime}</div>
            <div className="text-[13px] text-tx-muted mt-0.5 truncate">{evt.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
