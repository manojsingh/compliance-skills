import { cn } from '@/lib/utils';
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { ComplianceLevel } from '../../../../shared/types';

interface ComplianceLevelSelectorProps {
  value: ComplianceLevel;
  onChange: (level: ComplianceLevel) => void;
}

const levels: {
  value: ComplianceLevel;
  label: string;
  description: string;
  criteria: number;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Shield;
}[] = [
  {
    value: 'A',
    label: 'Level A',
    description: 'Basic accessibility — 30 criteria',
    criteria: 30,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    icon: Shield,
  },
  {
    value: 'AA',
    label: 'Level AA',
    description: 'Recommended standard — 50 criteria (includes Level A)',
    criteria: 50,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    icon: ShieldCheck,
  },
  {
    value: 'AAA',
    label: 'Level AAA',
    description: 'Highest standard — 78 criteria (includes Level A & AA)',
    criteria: 78,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    icon: ShieldAlert,
  },
];

export function ComplianceLevelSelector({ value, onChange }: ComplianceLevelSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {levels.map((level) => {
          const isSelected = value === level.value;
          const Icon = level.icon;
          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onChange(level.value)}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all hover:shadow-sm',
                isSelected
                  ? `${level.borderColor} ${level.bgColor} shadow-sm`
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <Icon className={cn('h-6 w-6', isSelected ? level.color : 'text-muted-foreground')} />
              <div>
                <p className={cn('text-sm font-semibold', isSelected ? level.color : 'text-foreground')}>
                  {level.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{level.description}</p>
              </div>
              {isSelected && (
                <div className={cn('absolute -top-px -right-px h-3 w-3 rounded-full border-2 border-white', level.color.replace('text-', 'bg-'))} />
              )}
            </button>
          );
        })}
      </div>
      {/* Strictness indicator */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">Strictness</span>
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              value === 'A' ? 'w-[38%] bg-blue-500' : value === 'AA' ? 'w-[64%] bg-indigo-500' : 'w-full bg-purple-500'
            )}
          />
        </div>
        <span className="text-xs font-medium w-12 text-right">
          {levels.find(l => l.value === value)?.criteria} rules
        </span>
      </div>
    </div>
  );
}
