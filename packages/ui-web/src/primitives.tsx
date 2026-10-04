import type { ComponentProps, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn.js';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-strong',
        secondary:
          'border border-subtle bg-muted text-foreground hover:bg-card',
        destructive:
          'bg-destructive text-primary-foreground hover:brightness-110',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);

export function Button({
  className,
  variant,
  pending,
  disabled,
  children,
  type = 'button',
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { pending?: boolean }) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant }), className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {children}
    </button>
  );
}

export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('min-w-0 rounded-xl border bg-card p-5', className)}
      {...props}
    />
  );
}

export function PanelHeading({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('font-display text-xl font-semibold', className)}
      {...props}
    />
  );
}

export function Divider({ className, ...props }: ComponentProps<'hr'>) {
  return <hr className={cn('my-5 border-border', className)} {...props} />;
}

const control =
  'min-h-11 w-full min-w-0 rounded-md border border-subtle bg-elevated px-3 py-2 text-foreground placeholder:text-subtle disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(control, 'min-h-24 resize-y', className)}
      {...props}
    />
  );
}
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(control, className)} {...props} />;
}
export function Checkbox({
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={cn('size-5 shrink-0 accent-primary', className)}
      {...props}
    />
  );
}

export function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-medium">
        {label}{' '}
        <span className="text-xs font-normal text-muted-foreground">
          ({optional ? 'optional' : 'required'})
        </span>
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="rounded-md bg-elevated p-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export type Tone = 'info' | 'success' | 'warning' | 'error';
const toneClasses: Record<Tone, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
};

export function Badge({
  tone = 'info',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-md bg-elevated px-2 py-1 text-xs font-medium',
        toneClasses[tone],
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Feedback({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className="rounded-xl border bg-elevated p-4"
    >
      <p className={cn('font-semibold', toneClasses[tone])}>{title}</p>
      {children && (
        <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      )}
    </div>
  );
}

export function ContentState({
  kind,
  title,
  children,
  action,
}: {
  kind: 'loading' | 'empty' | 'no-results' | 'error';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role={
        kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined
      }
      aria-busy={kind === 'loading' || undefined}
      className="rounded-xl border border-dashed bg-elevated p-5"
    >
      <p className={cn('font-medium', kind === 'error' && 'text-destructive')}>
        {title}
      </p>
      {children && <div className="mt-1 text-muted-foreground">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <table
      className={cn(
        'w-full text-left text-sm [&_th]:bg-elevated [&_th]:px-3 [&_th]:py-3 [&_th]:font-medium [&_th]:text-muted-foreground [&_td]:border-t [&_td]:px-3 [&_td]:py-3',
        className,
      )}
      {...props}
    />
  );
}
