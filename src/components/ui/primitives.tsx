import React, { ButtonHTMLAttributes, forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Loader2, AlertCircle, ChevronDown, Search as SearchIcon } from 'lucide-react';

/* -------------------------------------------------------------------------
   Button
   ------------------------------------------------------------------------- */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
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
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bd-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50 disabled:pointer-events-none rounded-full';
  
  const variants = {
    primary: 'bg-tx-primary text-canvas hover:bg-tx-primary/90 active:bg-tx-primary/80',
    secondary: 'bg-surface-neutral text-tx-primary hover:bg-surface-neutral/80 active:bg-surface-neutral/60',
    outline: 'border border-bd-subtle bg-transparent text-tx-primary hover:bg-surface-neutral active:bg-surface-neutral/80',
    ghost: 'bg-transparent text-tx-primary hover:bg-surface-neutral active:bg-surface-neutral/80',
    destructive: 'bg-accent-destructive text-white hover:bg-accent-destructive-hover active:bg-accent-destructive-pressed',
  };
  
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    icon: 'h-10 w-10',
  };

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
});
Button.displayName = 'Button';

/* -------------------------------------------------------------------------
   Card
   ------------------------------------------------------------------------- */

export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`bg-canvas border border-bd-subtle rounded-[24px] shadow-sm overflow-hidden ${className}`} {...props} />
));
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props} />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className = '', ...props }, ref) => (
  <h3 ref={ref} className={`text-lg font-semibold leading-none tracking-tight text-tx-primary ${className}`} {...props} />
));
CardTitle.displayName = 'CardTitle';

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`p-6 pt-0 ${className}`} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`flex items-center p-6 pt-0 ${className}`} {...props} />
));
CardFooter.displayName = 'CardFooter';

/* -------------------------------------------------------------------------
   Input
   ------------------------------------------------------------------------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className = '', ...props }, ref) => {
  return (
    <input
      className={`flex h-12 w-full rounded-[16px] border border-bd-subtle bg-surface-neutral/30 px-4 py-2 text-sm text-tx-primary transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-tx-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bd-focus disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className = '', ...props }, ref) => {
  return (
    <textarea
      className={`flex min-h-[80px] w-full rounded-[16px] border border-bd-subtle bg-surface-neutral/30 px-4 py-3 text-sm text-tx-primary transition-colors placeholder:text-tx-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bd-focus disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

/* -------------------------------------------------------------------------
   Badge
   ------------------------------------------------------------------------- */

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success';
}

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-bd-focus';
  
  const variants = {
    default: 'border-transparent bg-tx-primary text-canvas',
    secondary: 'border-transparent bg-surface-neutral text-tx-primary',
    destructive: 'border-transparent bg-accent-destructive/10 text-accent-destructive',
    success: 'border-transparent bg-accent-success/10 text-accent-success',
    outline: 'text-tx-primary border border-bd-subtle',
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className}`} {...props} />
  );
}

/* -------------------------------------------------------------------------
   Avatar
   ------------------------------------------------------------------------- */

export function Avatar({ seed, className = '', size = 40 }: { seed: string, className?: string, size?: number }) {
  return (
    <div 
      className={`shrink-0 rounded-full overflow-hidden bg-surface-neutral flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`}
        alt="Avatar"
        className="w-full h-full object-cover"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------
   Empty State
   ------------------------------------------------------------------------- */

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-neutral flex items-center justify-center text-tx-muted mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-tx-primary mb-1">{title}</h3>
      <p className="text-sm text-tx-muted max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Loading Skeleton
   ------------------------------------------------------------------------- */

export function Skeleton({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-surface-neutral/50 ${className}`}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------
   Error State
   ------------------------------------------------------------------------- */

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
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-accent-destructive/10 flex items-center justify-center text-accent-destructive mb-4">
        <AlertCircle size={32} />
      </div>
      <h3 className="text-lg font-semibold text-tx-primary mb-1">{title}</h3>
      <p className="text-sm text-tx-muted max-w-sm mb-6">{description}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>Try Again</Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   IconButton
   ------------------------------------------------------------------------- */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  return <Button ref={ref} size="icon" {...props} />;
});
IconButton.displayName = 'IconButton';

/* -------------------------------------------------------------------------
   Select
   ------------------------------------------------------------------------- */

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className = '', children, ...props }, ref) => {
  return (
    <div className="relative w-full">
      <select
        className={`flex h-12 w-full appearance-none rounded-[16px] border border-bd-subtle bg-surface-neutral/30 px-4 py-2 pr-10 text-sm text-tx-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bd-focus disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-tx-muted">
        <ChevronDown size={16} />
      </div>
    </div>
  );
});
Select.displayName = 'Select';

/* -------------------------------------------------------------------------
   Search
   ------------------------------------------------------------------------- */

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className = '', ...props }, ref) => {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-tx-muted">
        <SearchIcon size={16} />
      </div>
      <Input
        ref={ref}
        className={`pl-10 ${className}`}
        {...props}
      />
    </div>
  );
});
SearchInput.displayName = 'SearchInput';

/* -------------------------------------------------------------------------
   Tabs (Basic implementation for simple views)
   ------------------------------------------------------------------------- */
export function Tabs({ 
  tabs, 
  activeTab, 
  onChange, 
  className = '' 
}: { 
  tabs: { id: string; label: string }[]; 
  activeTab: string; 
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label="Navigation Tabs" className={`flex bg-surface-neutral rounded-full p-1 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={`flex-1 py-2 text-center text-[14px] font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-tx-primary focus:ring-offset-1 focus:ring-offset-surface-neutral ${
            activeTab === tab.id ? 'bg-canvas text-tx-primary shadow-sm' : 'text-tx-muted hover:text-tx-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Progress
   ------------------------------------------------------------------------- */
export function Progress({ 
  value, 
  max = 100, 
  className = '', 
  indicatorClassName = '' 
}: { 
  value: number; 
  max?: number; 
  className?: string; 
  indicatorClassName?: string;
}) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`h-2 w-full bg-surface-neutral rounded-full overflow-hidden ${className}`}>
      <div 
        className={`h-full bg-accent-primary transition-all duration-300 ease-out ${indicatorClassName}`} 
        style={{ width: `${percentage}%` }} 
      />
    </div>
  );
}

