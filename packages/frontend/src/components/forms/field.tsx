import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  id: string;
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ id, label, error, hint, required, className, children }: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor={id} className={error ? 'text-destructive' : undefined}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {React.cloneElement(children as React.ReactElement, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : hintId,
      })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}