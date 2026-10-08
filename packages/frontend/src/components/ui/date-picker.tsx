import * as React from 'react';
import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  subDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: ((value: string) => void) | ((e: any) => void) | any;
  onBlur?: (() => void) | ((e: any) => void) | any;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: string | number;
  max?: string | number;
  [key: string]: any;
}

export const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      id,
      name,
      value,
      defaultValue = '',
      onChange,
      onBlur,
      placeholder = 'dd/mm/aaaa',
      disabled = false,
      className,
      min,
      max,
      ...restProps
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState<string>(value ?? defaultValue ?? '');

    const resolvedValue = value !== undefined ? value : internalValue;

    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    // Selected date representation
    const selectedDate = React.useMemo(() => {
      if (!resolvedValue) return null;
      try {
        const parsed = parseISO(resolvedValue);
        return isValid(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }, [resolvedValue]);

    // Current viewed month in the calendar popover
    const [viewDate, setViewDate] = React.useState<Date>(() => selectedDate || new Date());

    React.useEffect(() => {
      if (selectedDate) {
        setViewDate(selectedDate);
      }
    }, [selectedDate]);

    const triggerChange = (val: string) => {
      setInternalValue(val);
      if (!onChange) return;
      const syntheticEvent = {
        target: { name: name || id, id, value: val },
        currentTarget: { name: name || id, id, value: val },
        value: val,
      };
      // Support both event-based (RHF register) and direct string (Controller)
      try {
        (onChange as any)(val);
      } catch {
        // ignore
      }
      try {
        (onChange as any)(syntheticEvent);
      } catch {
        // ignore
      }
    };

    const handleSelectDay = (day: Date) => {
      const iso = format(day, 'yyyy-MM-dd');
      triggerChange(iso);
      setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      triggerChange('');
    };

    const handleToday = () => {
      const today = new Date();
      handleSelectDay(today);
    };

    const handleYesterday = () => {
      const yesterday = subDays(new Date(), 1);
      handleSelectDay(yesterday);
    };

    // Calculate calendar grid days
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const formattedDisplay = selectedDate ? format(selectedDate, 'dd/MM/yyyy') : null;

    const monthYearTitle = React.useMemo(() => {
      const formatted = format(viewDate, 'MMMM yyyy', { locale: ptBR });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }, [viewDate]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            id={id}
            name={name}
            type="button"
            disabled={disabled}
            onBlur={onBlur}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors',
              'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              !resolvedValue && 'text-muted-foreground',
              className
            )}
            {...restProps}
          >
            <div className="flex items-center gap-2 overflow-hidden truncate">
              <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{formattedDisplay || placeholder}</span>
            </div>
            {resolvedValue && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange?.('');
                  }
                }}
                className="ml-2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Limpar data"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-auto p-3 shadow-xl border bg-card text-card-foreground rounded-xl"
          align="start"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-3">
            <span className="text-sm font-semibold text-foreground tracking-wide">
              {monthYearTitle}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                onClick={() => setViewDate((prev) => subMonths(prev, 1))}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                onClick={() => setViewDate((prev) => addMonths(prev, 1))}
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <span
                key={day}
                className="text-[11px] font-medium text-muted-foreground/80 py-1"
              >
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const isCurrentMonth = isSameMonth(day, viewDate);
              const isCurrentDay = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    'h-8 w-8 rounded-lg text-xs font-normal transition-all flex items-center justify-center',
                    !isCurrentMonth && 'text-muted-foreground/35 hover:text-muted-foreground',
                    isCurrentMonth && !isSelected && 'text-foreground hover:bg-accent hover:text-accent-foreground',
                    isCurrentDay && !isSelected && 'border border-primary text-primary font-semibold',
                    isSelected && 'bg-primary text-primary-foreground font-semibold shadow hover:bg-primary/90'
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Quick Buttons Footer */}
          <div className="flex items-center justify-between border-t mt-3 pt-2.5 text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="h-7 px-2 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
            >
              Hoje
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleYesterday}
              className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Ontem
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 px-2 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Limpar
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }
);

DatePicker.displayName = 'DatePicker';
