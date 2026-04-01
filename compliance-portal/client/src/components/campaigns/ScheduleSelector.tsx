import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface ScheduleSelectorProps {
  recurring: boolean;
  cron: string | null;
  onRecurringChange: (recurring: boolean) => void;
  onCronChange: (cron: string | null) => void;
}

const presets = [
  { label: 'Daily', cron: '0 10 * * *', description: 'Every day at 10:00 AM' },
  { label: 'Weekly', cron: '0 10 * * 1', description: 'Every Monday at 10:00 AM' },
  { label: 'Bi-weekly', cron: '0 6 1,15 * *', description: '1st and 15th of each month at 6:00 AM' },
  { label: 'Monthly', cron: '0 10 1 * *', description: '1st of each month at 10:00 AM' },
];

function getNextRunDate(cron: string): string {
  const now = new Date();
  const parts = cron.split(' ');
  if (parts.length < 5) return 'Invalid cron';
  const hour = parseInt(parts[1]!, 10);
  const next = new Date(now);
  next.setHours(hour, parseInt(parts[0]!, 10), 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getHumanReadable(cron: string): string {
  const preset = presets.find(p => p.cron === cron);
  if (preset) return preset.description;
  return `Custom schedule: ${cron}`;
}

export function ScheduleSelector({ recurring, cron, onRecurringChange, onCronChange }: ScheduleSelectorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={!recurring ? 'default' : 'outline'}
          size="sm"
          onClick={() => { onRecurringChange(false); onCronChange(null); }}
        >
          <Clock className="h-4 w-4 mr-1.5" />
          Run once
        </Button>
        <Button
          type="button"
          variant={recurring ? 'default' : 'outline'}
          size="sm"
          onClick={() => { onRecurringChange(true); if (!cron) onCronChange(presets[1]!.cron); }}
        >
          <Calendar className="h-4 w-4 mr-1.5" />
          Schedule recurring
        </Button>
      </div>

      {/* Preset buttons */}
      {recurring && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onCronChange(preset.cron)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm transition-all hover:shadow-sm',
                  cron === preset.cron
                    ? 'border-primary bg-primary/5 font-medium text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Advanced cron input */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Advanced: Custom cron expression
          </button>

          {showAdvanced && (
            <div className="space-y-1">
              <Label htmlFor="cron-input" className="text-xs text-muted-foreground">
                Cron Expression
              </Label>
              <Input
                id="cron-input"
                placeholder="0 10 * * 1"
                value={cron ?? ''}
                onChange={(e) => onCronChange(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          )}

          {/* Schedule preview */}
          {cron && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-medium">
                {getHumanReadable(cron)}
              </p>
              <p className="text-xs text-muted-foreground">
                Next run: {getNextRunDate(cron)}
              </p>
            </div>
          )}
        </div>
      )}

      {!recurring && (
        <p className="text-xs text-muted-foreground">
          The scan will run once when you create or manually trigger it.
        </p>
      )}
    </div>
  );
}
