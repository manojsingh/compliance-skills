import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Info } from 'lucide-react';

interface ConcurrencySettingsProps {
  siteConcurrency: number;
  pageConcurrency: number;
  onSiteConcurrencyChange: (value: number) => void;
  onPageConcurrencyChange: (value: number) => void;
}

export function ConcurrencySettings({
  siteConcurrency,
  pageConcurrency,
  onSiteConcurrencyChange,
  onPageConcurrencyChange,
}: ConcurrencySettingsProps) {
  return (
    <div className="space-y-6">
      {/* Site Concurrency */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="site-concurrency" className="text-sm font-medium">
            Site Concurrency
          </Label>
          <span className="text-sm font-semibold text-primary">
            {siteConcurrency} {siteConcurrency === 1 ? 'site' : 'sites'}
          </span>
        </div>
        
        <Slider
          id="site-concurrency"
          min={1}
          max={5}
          step={1}
          value={[siteConcurrency]}
          onValueChange={(vals) => onSiteConcurrencyChange(vals[0] ?? 2)}
          className="w-full"
        />
        
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <p>
            How many websites to scan simultaneously. Higher values speed up multi-site campaigns
            but use more system resources. <strong>Recommended: 2</strong>
          </p>
        </div>
      </div>

      {/* Page Concurrency */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="page-concurrency" className="text-sm font-medium">
            Page Concurrency
          </Label>
          <span className="text-sm font-semibold text-primary">
            {pageConcurrency} {pageConcurrency === 1 ? 'page' : 'pages'}
          </span>
        </div>
        
        <Slider
          id="page-concurrency"
          min={1}
          max={10}
          step={1}
          value={[pageConcurrency]}
          onValueChange={(vals) => onPageConcurrencyChange(vals[0] ?? 3)}
          className="w-full"
        />
        
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <p>
            How many pages per website to scan in parallel. Higher values speed up scanning
            but may overwhelm slower sites or consume more memory. <strong>Recommended: 3</strong>
          </p>
        </div>
      </div>

      {/* Performance Impact Note */}
      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground border">
        <p className="font-medium mb-1">Performance Impact</p>
        <p>
          Total concurrent browser tabs: <strong>{siteConcurrency} × {pageConcurrency} = {siteConcurrency * pageConcurrency} tabs</strong>
        </p>
        <p className="mt-1">
          Higher concurrency speeds up scans but increases CPU and memory usage. Adjust based on
          your system resources and network capacity.
        </p>
      </div>
    </div>
  );
}
