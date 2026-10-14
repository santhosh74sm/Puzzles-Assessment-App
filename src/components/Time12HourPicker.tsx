import { parse12HourComponents } from '../utils/dateTime.ts';

const HOURS_12 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export interface Time12HourPickerProps {
  value: string; // e.g. "10:30 AM" or "10:30" or "00:00"
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

export function Time12HourPicker({
  value,
  onChange,
  disabled = false,
  id,
}: Time12HourPickerProps) {
  const { hour, minute, period } = parse12HourComponents(value);

  const handleHourChange = (newHour: string) => {
    onChange(`${newHour}:${minute} ${period}`);
  };

  const handleMinuteChange = (newMinute: string) => {
    onChange(`${hour}:${newMinute} ${period}`);
  };

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    onChange(`${hour}:${minute} ${newPeriod}`);
  };

  return (
    <div className="flex items-center gap-1.5 w-full">
      {/* Hour Selector */}
      <select
        id={id ? `${id}-hour` : undefined}
        value={hour}
        disabled={disabled}
        onChange={(e) => handleHourChange(e.target.value)}
        aria-label="Hour (12-hour format)"
        className="flex-1 min-w-[50px] px-2 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white text-center outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors"
      >
        {HOURS_12.map((h) => (
          <option key={h} value={h} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono">
            {h}
          </option>
        ))}
      </select>

      <span className="text-slate-400 dark:text-slate-500 font-bold font-mono text-sm shrink-0">:</span>

      {/* Minute Selector */}
      <select
        id={id ? `${id}-minute` : undefined}
        value={minute}
        disabled={disabled}
        onChange={(e) => handleMinuteChange(e.target.value)}
        aria-label="Minute"
        className="flex-1 min-w-[50px] px-2 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white text-center outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono">
            {m}
          </option>
        ))}
      </select>

      {/* AM/PM Toggle Buttons */}
      <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handlePeriodChange('AM')}
          aria-label="Set AM"
          className={`px-2.5 py-1.5 rounded-md text-xs font-semibold font-mono transition-colors cursor-pointer ${
            period === 'AM'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          AM
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handlePeriodChange('PM')}
          aria-label="Set PM"
          className={`px-2.5 py-1.5 rounded-md text-xs font-semibold font-mono transition-colors cursor-pointer ${
            period === 'PM'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          PM
        </button>
      </div>
    </div>
  );
}
