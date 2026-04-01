import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Layers } from 'lucide-react';

interface ScanDepthSliderProps {
  value: number;
  onChange: (depth: number) => void;
}

const depthLabels: Record<number, { label: string; pages: string }> = {
  1: { label: 'Single page only', pages: '~1 page' },
  2: { label: 'Homepage + direct links', pages: '~5–10 pages' },
  3: { label: '3 levels deep', pages: '~15–25 pages' },
  4: { label: '4 levels deep', pages: '~25–40 pages' },
  5: { label: 'Full site crawl (max 50 pages)', pages: '~30–50 pages' },
};

export function ScanDepthSlider({ value, onChange }: ScanDepthSliderProps) {
  const current = depthLabels[value] ?? depthLabels[2]!;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{current!.label}</span>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {current!.pages}
        </span>
      </div>
      <Slider
        min={1}
        max={5}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v!)}
        className="w-full"
      />
      <div className="flex justify-between px-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'text-xs transition-colors',
              n === value ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
