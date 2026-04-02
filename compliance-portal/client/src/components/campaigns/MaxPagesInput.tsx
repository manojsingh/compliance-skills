import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface MaxPagesInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

export function MaxPagesInput({ value, onChange }: MaxPagesInputProps) {
  const isUnlimited = value === null;

  const handleCheckboxChange = (checked: boolean) => {
    if (checked) {
      onChange(null); // Set to unlimited
    } else {
      onChange(50); // Default to 50 pages
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      onChange(val);
    } else if (e.target.value === '') {
      onChange(1); // Minimum value
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="max-pages" className="text-sm font-medium">
          Maximum Pages per Site
        </Label>
        <span className="text-xs text-muted-foreground">
          {isUnlimited ? 'Unlimited' : `${value} page${value !== 1 ? 's' : ''}`}
        </span>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="unlimited-pages"
            checked={isUnlimited}
            onCheckedChange={handleCheckboxChange}
          />
          <label
            htmlFor="unlimited-pages"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Scan all pages
          </label>
        </div>
        
        {!isUnlimited && (
          <div className="flex-1 max-w-[200px]">
            <Input
              id="max-pages"
              type="number"
              min={1}
              value={value ?? 50}
              onChange={handleInputChange}
              disabled={isUnlimited}
              className="w-full"
            />
          </div>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        {isUnlimited
          ? 'Scans will crawl all discoverable pages on each site (up to system limit of 50 pages).'
          : `Each site will be scanned up to ${value} page${value !== 1 ? 's' : ''}, regardless of scan depth.`}
      </p>
    </div>
  );
}
