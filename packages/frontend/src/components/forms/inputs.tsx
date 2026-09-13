import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea as UITextarea } from '@/components/ui/textarea';
import { Eye, EyeOff } from 'lucide-react';
import { normalizeEmail } from '@oxedindin/shared';

export const TextInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  (props, ref) => <Input ref={ref} {...props} />,
);
TextInput.displayName = 'TextInput';

interface EmailInputProps extends Omit<React.ComponentProps<typeof Input>, 'type' | 'onChange'> {
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  ({ onBlur, onChange, ...props }, ref) => (
    <Input
      ref={ref}
      type="email"
      inputMode="email"
      autoComplete="email"
      onChange={onChange}
      onBlur={(e) => {
        const normalized = normalizeEmail(e.target.value);
        e.target.value = normalized;
        onChange?.(e);
        onBlur?.(e);
      }}
      {...props}
    />
  ),
);
EmailInput.displayName = 'EmailInput';

interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ id, disabled, className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          className={className}
          disabled={disabled}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          disabled={disabled}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<typeof UITextarea>>(
  (props, ref) => <UITextarea ref={ref} {...props} />,
);
Textarea.displayName = 'Textarea';

interface NumberInputProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ min = 0, ...props }, ref) => <Input ref={ref} type="number" min={min} {...props} />,
);
NumberInput.displayName = 'NumberInput';

interface PercentageInputProps extends NumberInputProps {}

export const PercentageInput = React.forwardRef<HTMLInputElement, PercentageInputProps>(
  ({ min = 0, max = 100, ...props }, ref) => (
    <div className="relative">
      <Input ref={ref} type="number" min={min} max={max} step="0.01" className="pr-8" {...props} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
    </div>
  ),
);
PercentageInput.displayName = 'PercentageInput';

interface DateInputProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (props, ref) => <Input ref={ref} type="date" {...props} />,
);
DateInput.displayName = 'DateInput';

interface DateTimeInputProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {}

export const DateTimeInput = React.forwardRef<HTMLInputElement, DateTimeInputProps>(
  (props, ref) => <Input ref={ref} type="datetime-local" {...props} />,
);
DateTimeInput.displayName = 'DateTimeInput';