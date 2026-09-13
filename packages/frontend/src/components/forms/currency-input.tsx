import * as React from 'react';
import { Input } from '@/components/ui/input';
import { formatMoneyCents } from '@oxedindin/shared';

interface CurrencyInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  value?: number | null;
  onChange?: (cents: number | undefined) => void;
}

/**
 * Currency input backed by integer cents (the single money representation used
 * across the app). The user types digits and the value is always masked as
 * `R$ 1.250,50`; the last two digits are cents. Backspace/clear work naturally.
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder, ...props }, ref) => {
    const [display, setDisplay] = React.useState(() =>
      value != null && value > 0 ? formatMoneyCents(value) : '',
    );

    React.useEffect(() => {
      setDisplay(value != null && value > 0 ? formatMoneyCents(value) : '');
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '');
      if (digits.length === 0) {
        setDisplay('');
        onChange?.(undefined);
        return;
      }
      const cents = parseInt(digits, 10);
      if (!Number.isFinite(cents)) return;
      setDisplay(formatMoneyCents(cents));
      onChange?.(cents);
    };

    return (
      <Input
        ref={ref}
        inputMode="numeric"
        type="text"
        placeholder={placeholder ?? 'R$ 0,00'}
        value={display}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
CurrencyInput.displayName = 'CurrencyInput';