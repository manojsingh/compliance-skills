import cron from 'node-cron';

// ---------------------------------------------------------------------------
// Schedule presets for frontend consumption
// ---------------------------------------------------------------------------

export const schedulePresets: Record<string, { cron: string; label: string; description: string }> = {
  daily: {
    cron: '0 0 * * *',
    label: 'Daily',
    description: 'Every day at midnight',
  },
  weekdays: {
    cron: '0 0 * * 1-5',
    label: 'Weekdays',
    description: 'Every weekday (Mon–Fri) at midnight',
  },
  weekly: {
    cron: '0 0 * * 1',
    label: 'Weekly',
    description: 'Every Monday at midnight',
  },
  biweekly: {
    cron: '0 0 1,15 * *',
    label: 'Bi-monthly',
    description: '1st and 15th of each month at midnight',
  },
  monthly: {
    cron: '0 0 1 * *',
    label: 'Monthly',
    description: '1st of each month at midnight',
  },
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isValidCron(expression: string): boolean {
  return cron.validate(expression);
}

// ---------------------------------------------------------------------------
// Human-readable description
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatTime(minute: string, hour: string): string {
  const h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
}

export function describeCron(expression: string): string {
  if (!isValidCron(expression)) return 'Invalid cron expression';

  // Check presets first
  for (const preset of Object.values(schedulePresets)) {
    if (preset.cron === expression) return preset.description;
  }

  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return expression;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const timeStr = minute !== '*' && hour !== '*' ? ` at ${formatTime(minute, hour)}` : '';

  // Every minute
  if (parts.every((p) => p === '*')) return 'Every minute';

  // Specific day of week
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    if (dayOfWeek.includes('-')) {
      const [start, end] = dayOfWeek.split('-').map(Number);
      return `Every ${DAY_NAMES[start]} through ${DAY_NAMES[end]}${timeStr}`;
    }
    const days = dayOfWeek.split(',').map((d) => DAY_NAMES[parseInt(d, 10)] ?? d);
    return `Every ${days.join(', ')}${timeStr}`;
  }

  // Specific day of month
  if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    const days = dayOfMonth.split(',').join(', ');
    return `On day ${days} of every month${timeStr}`;
  }

  // Specific month
  if (month !== '*') {
    const months = month.split(',').map((m) => MONTH_NAMES[parseInt(m, 10)] ?? m);
    return `In ${months.join(', ')}${dayOfMonth !== '*' ? ` on day ${dayOfMonth}` : ''}${timeStr}`;
  }

  // Every N minutes/hours
  if (minute.startsWith('*/')) return `Every ${minute.slice(2)} minutes`;
  if (hour.startsWith('*/') && minute === '0') return `Every ${hour.slice(2)} hours`;

  // Daily at a specific time
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*' && timeStr) {
    return `Every day${timeStr}`;
  }

  return expression;
}

// ---------------------------------------------------------------------------
// Next N run times
// ---------------------------------------------------------------------------

export function getNextRuns(expression: string, count: number = 5): Date[] {
  if (!isValidCron(expression) || count <= 0) return [];

  const runs: Date[] = [];
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return [];

  // Walk forward minute-by-minute from now, checking cron match
  const cursor = new Date();
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1); // start from next minute

  const maxIterations = 366 * 24 * 60; // ~1 year of minutes
  for (let i = 0; i < maxIterations && runs.length < count; i++) {
    if (matchesCron(cursor, parts)) {
      runs.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return runs;
}

function matchesCron(date: Date, parts: string[]): boolean {
  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts;
  return (
    matchField(date.getMinutes(), minuteExpr, 0, 59) &&
    matchField(date.getHours(), hourExpr, 0, 23) &&
    matchField(date.getDate(), domExpr, 1, 31) &&
    matchField(date.getMonth() + 1, monthExpr, 1, 12) &&
    matchField(date.getDay(), dowExpr, 0, 7)
  );
}

function matchField(value: number, expr: string, min: number, max: number): boolean {
  if (expr === '*') return true;

  return expr.split(',').some((part) => {
    // Handle step values: */N or range/N
    if (part.includes('/')) {
      const [rangeExpr, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      if (isNaN(step) || step <= 0) return false;

      let start = min;
      let end = max;

      if (rangeExpr !== '*') {
        if (rangeExpr.includes('-')) {
          [start, end] = rangeExpr.split('-').map(Number);
        } else {
          start = parseInt(rangeExpr, 10);
        }
      }

      if (value < start || value > end) return false;
      return (value - start) % step === 0;
    }

    // Handle ranges: N-M
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      // Handle day-of-week wrap (e.g., 0 matches 7)
      if (max === 7 && (value === 0 || value === 7)) {
        return start <= 0 || end >= 7 || (start <= 7 && value >= start) || (end >= 0 && value <= end);
      }
      return value >= start && value <= end;
    }

    // Plain number
    const num = parseInt(part, 10);
    // Day-of-week: 0 and 7 both represent Sunday
    if (max === 7 && (num === 0 || num === 7)) {
      return value === 0 || value === 7;
    }
    return value === num;
  });
}
