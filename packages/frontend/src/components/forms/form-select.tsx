import * as React from 'react';
import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FormSelectProps<T extends FieldValues, TName extends Path<T>> {
  name: TName;
  control: Control<T>;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormSelect<T extends FieldValues, TName extends Path<T>>({
  name,
  control,
  placeholder,
  error,
  disabled,
  className,
  children,
}: FormSelectProps<T, TName>) {
  const { field } = useController({ name, control });
  const value = field.value == null ? '' : String(field.value);

  return (
    <Select
      value={value}
      onValueChange={(next) => field.onChange(next === '' ? undefined : (next as never))}
      disabled={disabled}
    >
      <SelectTrigger error={error} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}