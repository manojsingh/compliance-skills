import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CONFIG = {
  sm: { dim: 80, stroke: 6, fontSize: 16, labelSize: 9 },
  md: { dim: 120, stroke: 8, fontSize: 24, labelSize: 11 },
  lg: { dim: 160, stroke: 10, fontSize: 32, labelSize: 13 },
} as const;

function getScoreColor(score: number): string {
  if (score < 50) return '#dc2626';
  if (score < 70) return '#ea580c';
  if (score < 85) return '#ca8a04';
  return '#16a34a';
}

export function ScoreGauge({ score, label, size = 'md' }: ScoreGaugeProps) {
  const config = SIZE_CONFIG[size];
  const radius = (config.dim - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (clampedScore / 100) * circumference;
  const color = getScoreColor(clampedScore);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={config.dim}
        height={config.dim}
        className={cn('-rotate-90')}
      >
        {/* Background track */}
        <circle
          cx={config.dim / 2}
          cy={config.dim / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={config.stroke}
        />
        {/* Score arc */}
        <circle
          cx={config.dim / 2}
          cy={config.dim / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
        {/* Center text */}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="rotate-90 origin-center fill-foreground"
          fontSize={config.fontSize}
          fontWeight="bold"
        >
          {clampedScore}
        </text>
      </svg>
      <span
        className="text-muted-foreground font-medium"
        style={{ fontSize: config.labelSize }}
      >
        {label}
      </span>
    </div>
  );
}
