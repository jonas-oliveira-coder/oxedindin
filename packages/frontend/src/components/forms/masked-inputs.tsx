import * as React from 'react';
import { Input } from '@/components/ui/input';
import { formatCpf, formatCnpj, formatPhone, formatCep, onlyDigits } from '@oxedindin/shared';

interface MaskedInputProps extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (raw: string) => void;
  formatter: (raw: string) => string;
}

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ value, onChange, formatter, ...props }, ref) => {
    const raw = value ?? '';
    const [display, setDisplay] = React.useState(formatter(raw));

    React.useEffect(() => {
      setDisplay(formatter(value ?? ''));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = onlyDigits(e.target.value);
      setDisplay(formatter(cleaned));
      onChange?.(cleaned);
    };

    return <Input ref={ref} inputMode="numeric" value={display} onChange={handleChange} {...props} />;
  },
);
MaskedInput.displayName = 'MaskedInput';

export const CpfInput = React.forwardRef<HTMLInputElement, Omit<MaskedInputProps, 'formatter'>>(
  (props, ref) => <MaskedInput ref={ref} formatter={formatCpf} maxLength={14} {...props} />,
);
CpfInput.displayName = 'CpfInput';

export const CnpjInput = React.forwardRef<HTMLInputElement, Omit<MaskedInputProps, 'formatter'>>(
  (props, ref) => <MaskedInput ref={ref} formatter={formatCnpj} maxLength={18} {...props} />,
);
CnpjInput.displayName = 'CnpjInput';

export const PhoneInput = React.forwardRef<HTMLInputElement, Omit<MaskedInputProps, 'formatter'>>(
  (props, ref) => <MaskedInput ref={ref} formatter={formatPhone} maxLength={15} {...props} />,
);
PhoneInput.displayName = 'PhoneInput';

export const CepInput = React.forwardRef<HTMLInputElement, Omit<MaskedInputProps, 'formatter'>>(
  (props, ref) => <MaskedInput ref={ref} formatter={formatCep} maxLength={9} {...props} />,
);
CepInput.displayName = 'CepInput';