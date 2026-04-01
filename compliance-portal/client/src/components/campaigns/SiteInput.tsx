import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, Globe, AlertCircle } from 'lucide-react';

export interface SiteEntry {
  url: string;
  label: string;
}

interface SiteInputProps {
  site: SiteEntry;
  index: number;
  onChange: (index: number, field: 'url' | 'label', value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  error?: string;
}

function isValidUrl(url: string): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function SiteInput({ site, index, onChange, onRemove, canRemove, error }: SiteInputProps) {
  const urlInvalid = site.url.length > 0 && !isValidUrl(site.url);
  const showError = error || (urlInvalid ? 'Please enter a valid HTTP(S) URL' : undefined);

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground mt-5">
        <Globe className="h-4 w-4" />
      </div>
      <div className="flex-1 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`site-url-${index}`} className="text-xs text-muted-foreground">
            URL
          </Label>
          <Input
            id={`site-url-${index}`}
            placeholder="https://www.example.com"
            value={site.url}
            onChange={(e) => onChange(index, 'url', e.target.value)}
            className={showError ? 'border-destructive' : ''}
          />
          {showError && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {showError}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`site-label-${index}`} className="text-xs text-muted-foreground">
            Label
          </Label>
          <Input
            id={`site-label-${index}`}
            placeholder="Main Website"
            value={site.label}
            onChange={(e) => onChange(index, 'label', e.target.value)}
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="mt-5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        aria-label="Remove site"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export { isValidUrl };
