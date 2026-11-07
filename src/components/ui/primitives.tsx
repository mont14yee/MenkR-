import React, { 
  ButtonHTMLAttributes, 
  forwardRef, 
  InputHTMLAttributes, 
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  useState,
  useRef,
  useEffect
} from 'react';
import { 
  Loader2, 
  AlertCircle, 
  ChevronDown, 
  Search as SearchIcon, 
  X as CloseIcon,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';

/* -------------------------------------------------------------------------
   Button Component
   ------------------------------------------------------------------------- */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'warm' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  type = 'button',
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bd-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]';
  
  const variants = {
    // Primary Charcoal (#1C1C1A)
    primary: 'bg-tx-primary text-canvas hover:bg-tx-primary/90 active:bg-tx-primary/80 shadow-xs border border-transparent',
    // Selective Lime Accent (#E7F45A)
    accent: 'bg-accent-primary text-tx-primary font-semibold hover:bg-accent-primary-hover active:bg-accent-primary-pressed shadow-xs border border-transparent',
    // Selective Warm Orange Accent (#F2A93E)
    warm: 'bg-accent-warm text-white font-medium hover:bg-accent-warm-hover active:bg-accent-warm-pressed shadow-xs border border-transparent',
    // Neutral Surface
    secondary: 'bg-surface-neutral text-tx-primary hover:bg-surface-neutral/80 active:bg-surface-neutral/60 border border-bd-subtle',
    // Clean Hairline Outline
    outline: 'border border-bd-subtle bg-canvas text-tx-primary hover:bg-surface-neutral/50 active:bg-surface-neutral shadow-xs',
    // Minimal Ghost
    ghost: 'bg-transparent text-tx-primary hover:bg-surface-neutral/60 active:bg-surface-neutral',
    // Accessible Destructive
    destructive: 'bg-accent-destructive text-white hover:bg-accent-destructive-hover active:bg-accent-destructive-pressed shadow-xs border border-transparent',
  };
  
  const sizes = {
    xs: 'h-7 px-2.5 text-xs rounded-md gap-1.5',
    sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
    md: 'h-10 px-4 text-sm rounded-xl gap-2',
    lg: 'h-12 px-5 text-base rounded-xl gap-2.5',
    icon: 'h-10 w-10 p-0 rounded-xl justify-center',
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
      )}
      {children && <span className="truncate">{children}</span>}
      {!isLoading && rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
    </button>
  );
});
Button.displayName = 'Button';

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(({ className = '', size = 'icon', ...props }, ref) => {
  return <Button ref={ref} size={size} className={className} {...props} />;
});
IconButton.displayName = 'IconButton';

/* -------------------------------------------------------------------------
   Input & Form Controls
   ------------------------------------------------------------------------- */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  className = '',
  error = false,
  leftAddon,
  rightAddon,
  disabled,
  ...props
}, ref) => {
  const borderStyles = error 
    ? 'border-accent-destructive focus-visible:ring-accent-destructive' 
    : 'border-bd-subtle focus-visible:ring-bd-focus focus-visible:border-tx-primary';

  if (leftAddon || rightAddon) {
    return (
      <div className={`relative flex items-center w-full rounded-xl border bg-canvas ${borderStyles} ${disabled ? 'opacity-50 cursor-not-allowed bg-surface-neutral/20' : ''}`}>
        {leftAddon && <div className="pl-3.5 pr-1 text-tx-muted flex items-center shrink-0">{leftAddon}</div>}
        <input
          ref={ref}
          disabled={disabled}
          className={`flex h-10 w-full bg-transparent px-3.5 py-2 text-sm text-tx-primary placeholder:text-tx-muted outline-none disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {rightAddon && <div className="pr-3.5 pl-1 text-tx-muted flex items-center shrink-0">{rightAddon}</div>}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      disabled={disabled}
      className={`flex h-10 w-full rounded-xl border bg-canvas px-3.5 py-2 text-sm text-tx-primary transition-colors placeholder:text-tx-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-neutral/20 ${borderStyles} ${className}`}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  className = '',
  error = false,
  ...props
}, ref) => {
  const borderStyles = error 
    ? 'border-accent-destructive focus-visible:ring-accent-destructive' 
    : 'border-bd-subtle focus-visible:ring-bd-focus focus-visible:border-tx-primary';

  return (
    <textarea
      ref={ref}
      className={`flex min-h-[80px] w-full rounded-xl border bg-canvas px-3.5 py-2.5 text-sm text-tx-primary transition-colors placeholder:text-tx-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-neutral/20 ${borderStyles} ${className}`}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  className = '',
  children,
  error = false,
  ...props
}, ref) => {
  const borderStyles = error 
    ? 'border-accent-destructive' 
    : 'border-bd-subtle focus-visible:border-tx-primary';

  return (
    <div className="relative w-full">
      <select
        ref={ref}
        className={`flex h-10 w-full appearance-none rounded-xl border bg-canvas px-3.5 py-2 pr-10 text-sm text-tx-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bd-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50 ${borderStyles} ${className}`}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-tx-muted">
        <ChevronDown size={15} />
      </div>
    </div>
  );
});
Select.displayName = 'Select';

export const SearchInput = forwardRef<HTMLInputElement, InputProps>(({
  className = '',
  value,
  onChange,
  placeholder = 'Search...',
  ...props
}, ref) => {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-tx-muted">
        <SearchIcon size={15} />
      </div>
      <Input
        ref={ref}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`pl-9.5 pr-8 ${className}`}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange && onChange({ target: { value: '' } } as any)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-tx-muted hover:text-tx-primary transition-colors"
          aria-label="Clear search"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
});
SearchInput.displayName = 'SearchInput';

/* -------------------------------------------------------------------------
   Dropdown Menu Component
   ------------------------------------------------------------------------- */

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function DropdownMenu({
  trigger,
  items,
  align = 'right',
  className = '',
}: {
  trigger: React.ReactNode;
  items: (DropdownItem | 'divider')[];
  align?: 'left' | 'right';
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div
          role="menu"
          className={`absolute z-50 mt-1.5 w-48 rounded-xl border border-bd-subtle bg-canvas shadow-lg py-1 text-sm focus:outline-none transition-all ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${className}`}
        >
          {items.map((item, idx) => {
            if (item === 'divider') {
              return <div key={`div-${idx}`} className="my-1 border-t border-bd-subtle" />;
            }
            return (
              <button
                key={item.id}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    setIsOpen(false);
                  }
                }}
                className={`flex items-center gap-2.5 w-full px-3.5 py-2 text-left text-xs font-medium transition-colors ${
                  item.danger
                    ? 'text-accent-destructive hover:bg-accent-destructive/10'
                    : 'text-tx-primary hover:bg-surface-neutral/60'
                } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {item.icon && <span className="shrink-0 text-current">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Card & Metric Components
   ------------------------------------------------------------------------- */

export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ 
  className = '', 
  ...props 
}, ref) => (
  <div 
    ref={ref} 
    className={`bg-canvas border border-bd-subtle rounded-2xl shadow-xs overflow-hidden transition-all duration-150 ${className}`} 
    {...props} 
  />
));
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`flex flex-col space-y-1 p-5 ${className}`} {...props} />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className = '', ...props }, ref) => (
  <h3 ref={ref} className={`text-base font-semibold tracking-tight text-tx-primary ${className}`} {...props} />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className = '', ...props }, ref) => (
  <p ref={ref} className={`text-xs text-tx-muted mt-0.5 leading-relaxed ${className}`} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`p-5 pt-0 ${className}`} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`flex items-center p-5 pt-0 border-t border-bd-subtle/50 mt-4 ${className}`} {...props} />
));
CardFooter.displayName = 'CardFooter';

export function MetricCard({
  label,
  value,
  delta,
  deltaType = 'positive',
  subtext,
  accent,
  className = '',
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
  subtext?: string;
  accent?: 'lime' | 'warm' | 'charcoal' | 'none';
  className?: string;
}) {
  const accentTopBorder = {
    lime: 'border-t-2 border-t-accent-primary',
    warm: 'border-t-2 border-t-accent-warm',
    charcoal: 'border-t-2 border-t-tx-primary',
    none: '',
  }[accent || 'none'];

  return (
    <div className={`p-4 rounded-xl border border-bd-subtle bg-canvas shadow-xs flex flex-col justify-between ${accentTopBorder} ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-tx-muted">{label}</span>
        {delta && (
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
            deltaType === 'positive' 
              ? 'text-accent-success bg-accent-success/10' 
              : deltaType === 'negative' 
                ? 'text-accent-destructive bg-accent-destructive/10' 
                : 'text-tx-muted bg-surface-neutral'
          }`}>
            {delta}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-tx-primary font-mono tabular-nums">
          {value}
        </span>
      </div>

      {subtext && (
        <span className="text-[11px] text-tx-muted mt-1 truncate">{subtext}</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Badge Component
   ------------------------------------------------------------------------- */

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'lime' | 'warm' | 'secondary' | 'outline' | 'destructive' | 'success' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({ 
  className = '', 
  variant = 'default', 
  size = 'md',
  ...props 
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-semibold transition-colors focus:outline-none';
  
  const variants = {
    default: 'bg-tx-primary text-canvas border border-transparent',
    lime: 'bg-accent-primary/80 text-tx-primary border border-accent-primary-hover',
    warm: 'bg-accent-warm/20 text-accent-warm border border-accent-warm/40',
    secondary: 'bg-surface-neutral text-tx-primary border border-bd-subtle',
    outline: 'text-tx-primary border border-bd-subtle bg-canvas',
    destructive: 'bg-accent-destructive/10 text-accent-destructive border border-accent-destructive/20',
    success: 'bg-accent-success/10 text-accent-success border border-accent-success/20',
    info: 'bg-accent-info/10 text-accent-info border border-accent-info/20',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.2 rounded-md',
    md: 'text-[11px] px-2.5 py-0.5 rounded-lg',
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
  );
}

/* -------------------------------------------------------------------------
   Data Table Components
   ------------------------------------------------------------------------- */

export const Table = forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(({ className = '', ...props }, ref) => (
  <div className="relative w-full overflow-x-auto rounded-xl border border-bd-subtle bg-canvas shadow-xs">
    <table ref={ref} className={`w-full caption-bottom text-xs text-left ${className}`} {...props} />
  </div>
));
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className = '', ...props }, ref) => (
  <thead ref={ref} className={`bg-surface-neutral/40 border-b border-bd-subtle ${className}`} {...props} />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className = '', ...props }, ref) => (
  <tbody ref={ref} className={`divide-y divide-bd-subtle/70 ${className}`} {...props} />
));
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className = '', ...props }, ref) => (
  <tr 
    ref={ref} 
    className={`transition-colors hover:bg-surface-neutral/30 data-[state=selected]:bg-surface-neutral/50 ${className}`} 
    {...props} 
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className = '', ...props }, ref) => (
  <th 
    ref={ref} 
    className={`h-9 px-3.5 text-left align-middle font-semibold text-tx-secondary text-[11px] uppercase tracking-wider ${className}`} 
    {...props} 
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className = '', ...props }, ref) => (
  <td ref={ref} className={`p-3.5 align-middle text-tx-primary ${className}`} {...props} />
));
TableCell.displayName = 'TableCell';

/* -------------------------------------------------------------------------
   Tabs (Segmented Control)
   ------------------------------------------------------------------------- */

export function Tabs({ 
  tabs, 
  activeTab, 
  onChange, 
  className = '' 
}: { 
  tabs: { id: string; label: string; count?: number }[]; 
  activeTab: string; 
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div 
      role="tablist" 
      aria-label="Navigation Tabs" 
      className={`inline-flex items-center bg-surface-neutral/60 p-1 rounded-xl border border-bd-subtle ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bd-focus ${
              isActive 
                ? 'bg-canvas text-tx-primary shadow-xs' 
                : 'text-tx-muted hover:text-tx-primary'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                isActive ? 'bg-surface-neutral text-tx-primary' : 'bg-transparent text-tx-muted'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Visual Data Charts (Lightweight SVG)
   ------------------------------------------------------------------------- */

export function MetricBarChart({
  data,
  height = 120,
  className = '',
}: {
  data: { label: string; value: number; active?: boolean }[];
  height?: number;
  className?: string;
}) {
  if (!data || data.length === 0) return null;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      <div className="flex items-end gap-2 w-full pt-4" style={{ height: `${height}px` }}>
        {data.map((item, idx) => {
          const heightPct = Math.max(8, Math.round((item.value / maxValue) * 100));
          return (
            <div key={`bar-${idx}`} className="flex-1 flex flex-col items-center h-full justify-end group relative">
              {/* Tooltip */}
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-tx-primary text-canvas text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap pointer-events-none font-mono tabular-nums z-10">
                {item.value}
              </div>

              <div 
                className={`w-full rounded-t-md transition-all duration-300 ${
                  item.active 
                    ? 'bg-accent-primary border-t border-accent-primary-pressed' 
                    : 'bg-surface-neutral hover:bg-tx-primary/30'
                }`}
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-[10px] text-tx-muted font-medium mt-1 truncate max-w-full">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Progress Indicators
   ------------------------------------------------------------------------- */

export function Progress({ 
  value, 
  max = 100, 
  variant = 'primary',
  className = '', 
}: { 
  value: number; 
  max?: number; 
  variant?: 'primary' | 'accent' | 'warm';
  className?: string; 
}) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));

  const variantColors = {
    primary: 'bg-tx-primary',
    accent: 'bg-accent-primary',
    warm: 'bg-accent-warm',
  };

  return (
    <div className={`h-2 w-full bg-surface-neutral/70 rounded-full overflow-hidden border border-bd-subtle/50 ${className}`}>
      <div 
        className={`h-full ${variantColors[variant]} transition-all duration-300 ease-out`} 
        style={{ width: `${percentage}%` }} 
      />
    </div>
  );
}

/* -------------------------------------------------------------------------
   States: Empty, Skeleton, Error
   ------------------------------------------------------------------------- */

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action 
}: { 
  icon?: React.ReactNode; 
  title: string; 
  description: string; 
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-bd-subtle bg-canvas/50">
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-surface-neutral/60 flex items-center justify-center text-tx-muted mb-3 border border-bd-subtle">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-tx-primary mb-1">{title}</h3>
      <p className="text-xs text-tx-muted max-w-xs mb-4 leading-relaxed">{description}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-neutral/70 ${className}`}
      {...props}
    />
  );
}

export function ErrorState({ 
  title = "Something went wrong", 
  description = "We encountered an unexpected error. Please try again.", 
  onRetry 
}: { 
  title?: string; 
  description?: string; 
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl border border-accent-destructive/20 bg-accent-destructive/5">
      <div className="w-12 h-12 rounded-xl bg-accent-destructive/10 flex items-center justify-center text-accent-destructive mb-3 border border-accent-destructive/20">
        <AlertCircle size={24} />
      </div>
      <h3 className="text-sm font-semibold text-tx-primary mb-1">{title}</h3>
      <p className="text-xs text-tx-muted max-w-sm mb-4 leading-relaxed">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>Try Again</Button>
      )}
    </div>
  );
}
