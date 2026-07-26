import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import { formatDate, parseLocalDate } from '@nexkan/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  id?: string;
  value: string; // YYYY-MM-DD or ''
  onChange: (date: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

function formatYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DatePicker({
  id,
  value,
  onChange,
  required = false,
  placeholder = 'Select due date...',
  className,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current selected date or fallback to today
  const selectedDate = useMemo(() => {
    if (!value) return null;
    try {
      return parseLocalDate(value);
    } catch {
      return null;
    }
  }, [value]);

  const [viewDate, setViewDate] = useState<Date>(() => selectedDate ?? new Date());

  // Update viewDate when value changes
  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    }
  }, [selectedDate]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePresetSelect = useCallback(
    (daysToAdd: number) => {
      const target = new Date();
      target.setDate(target.getDate() + daysToAdd);
      const formatted = formatYYYYMMDD(target);
      onChange(formatted);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleDateSelect = useCallback(
    (day: number, isCurrentMonth: boolean, monthOffset: number) => {
      if (!isCurrentMonth) return;
      const target = new Date(viewDate.getFullYear(), viewDate.getMonth() + monthOffset, day);
      const formatted = formatYYYYMMDD(target);
      onChange(formatted);
      setIsOpen(false);
    },
    [viewDate, onChange]
  );

  const handlePrevMonth = useCallback(() => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  // Compute calendar grid
  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday-first indexing (0 = Mon, 6 = Sun)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        monthOffset: -1,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        isCurrentMonth: true,
        monthOffset: 0,
      });
    }

    // Next month padding to fill grid to multiple of 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        monthOffset: 1,
      });
    }

    return days;
  }, [viewDate]);

  const todayStr = useMemo(() => formatYYYYMMDD(new Date()), []);

  const monthYearLabel = useMemo(() => {
    return viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [viewDate]);

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          id={id}
          onClick={() => setIsOpen(prev => !prev)}
          className={cn(
            'flex-1 flex items-center justify-between h-9 px-3 text-sm rounded-lg border bg-background hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-150',
            value ? 'text-foreground font-mono font-medium' : 'text-muted-foreground',
            isOpen && 'border-primary ring-2 ring-primary/20'
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{value ? formatDate(value) : placeholder}</span>
          </div>
          {value && !required && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => {
                e.stopPropagation();
                onChange('');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onChange('');
                }
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Clear due date"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150">
          {/* Presets Header */}
          <div className="flex items-center gap-1 mb-3 pb-2.5 border-b border-border/60">
            <Clock className="h-3.5 w-3.5 text-muted-foreground mr-1 shrink-0" />
            <div className="grid grid-cols-4 gap-1 w-full">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-mono px-1 hover:bg-primary/10 hover:text-primary"
                onClick={() => handlePresetSelect(0)}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-mono px-1 hover:bg-primary/10 hover:text-primary"
                onClick={() => handlePresetSelect(1)}
              >
                Tmrw
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-mono px-1 hover:bg-primary/10 hover:text-primary"
                onClick={() => handlePresetSelect(3)}
              >
                +3d
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs font-mono px-1 hover:bg-primary/10 hover:text-primary"
                onClick={() => handlePresetSelect(7)}
              >
                +1w
              </Button>
            </div>
          </div>

          {/* Month / Year Header */}
          <div className="flex items-center justify-between mb-2 px-1">
            <h4 className="font-display font-semibold text-xs text-foreground tracking-tight">
              {monthYearLabel}
            </h4>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
                onClick={handlePrevMonth}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
                onClick={handleNextMonth}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
              <span key={day} className="text-[10px] font-mono font-medium text-muted-foreground/70">
                {day}
              </span>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarGrid.map((item, index) => {
              if (!item.isCurrentMonth) {
                return (
                  <span key={index} className="h-7 w-7 flex items-center justify-center text-[11px] font-mono text-muted-foreground/30 select-none">
                    {item.day}
                  </span>
                );
              }

              const cellDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), item.day);
              const cellStr = formatYYYYMMDD(cellDate);
              const isSelected = value === cellStr;
              const isToday = todayStr === cellStr;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleDateSelect(item.day, true, 0)}
                  className={cn(
                    'h-7 w-7 rounded-lg text-[11px] font-mono flex items-center justify-center transition-all duration-150 cursor-pointer',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                      : 'hover:bg-accent text-foreground',
                    isToday && !isSelected && 'border border-primary/60 font-semibold text-primary'
                  )}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Footer Bar */}
          {!required && value && (
            <div className="mt-2.5 pt-2 border-t border-border/60 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] font-mono text-destructive hover:bg-destructive/10 px-2"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
              >
                Clear Date
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
