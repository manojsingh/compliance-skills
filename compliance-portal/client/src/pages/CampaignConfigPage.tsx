import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Save, Play, ArrowLeft, Loader2, Upload } from 'lucide-react';
import { SiteInput, isValidUrl, type SiteEntry } from '@/components/campaigns/SiteInput';
import { ComplianceLevelSelector } from '@/components/campaigns/ComplianceLevelSelector';
import { ScanDepthSlider } from '@/components/campaigns/ScanDepthSlider';
import { MaxPagesInput } from '@/components/campaigns/MaxPagesInput';
import { ConcurrencySettings } from '@/components/campaigns/ConcurrencySettings';
import { ScheduleSelector } from '@/components/campaigns/ScheduleSelector';
import type { ComplianceLevel, Campaign, CampaignSite } from '../../../shared/types';
import { campaignApi } from '@/lib/api';

interface FormState {
  name: string;
  description: string;
  sites: SiteEntry[];
  complianceLevel: ComplianceLevel;
  scanDepth: number;
  maxPagesToScan: number | null;
  siteConcurrency: number;
  pageConcurrency: number;
  recurring: boolean;
  scheduleCron: string | null;
}

interface FormErrors {
  name?: string;
  sites?: string;
}

export function CampaignConfigPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(isEditMode);
  const [errors, setErrors] = useState<FormErrors>({});

  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    sites: [{ url: '', label: '' }],
    complianceLevel: 'AA',
    scanDepth: 2,
    maxPagesToScan: null,
    siteConcurrency: 2,
    pageConcurrency: 3,
    recurring: false,
    scheduleCron: null,
  });

  // In edit mode, load the existing campaign and pre-fill the form
  useEffect(() => {
    if (!isEditMode || !id) return;
    setIsLoadingCampaign(true);
    campaignApi
      .get(id)
      .then((res) => {
        const c = res.data as Campaign & { sites: CampaignSite[] };
        setForm({
          name: c.name,
          description: (c as Campaign & { description?: string }).description ?? '',
          sites:
            c.sites.length > 0
              ? c.sites.map((s) => ({ url: s.url, label: s.label }))
              : [{ url: '', label: '' }],
          complianceLevel: c.complianceLevel,
          scanDepth: c.scanDepth,
          maxPagesToScan: c.maxPagesToScan,
          siteConcurrency: c.siteConcurrency,
          pageConcurrency: c.pageConcurrency,
          recurring: Boolean(c.scheduleCron),
          scheduleCron: c.scheduleCron,
        });
      })
      .catch(() => {
        toast.error('Failed to load campaign');
        navigate('/campaigns');
      })
      .finally(() => setIsLoadingCampaign(false));
  }, [id, isEditMode, navigate]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in errors) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function updateSite(index: number, field: 'url' | 'label', value: string) {
    setForm((prev) => {
      const sites = [...prev.sites];
      const existing = sites[index]!;
      sites[index] = { ...existing, [field]: value };
      return { ...prev, sites };
    });
    if (errors.sites) setErrors((prev) => ({ ...prev, sites: undefined }));
  }

  function addSite() {
    setForm((prev) => ({ ...prev, sites: [...prev.sites, { url: '', label: '' }] }));
  }

  function removeSite(index: number) {
    setForm((prev) => ({
      ...prev,
      sites: prev.sites.filter((_, i) => i !== index),
    }));
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      let entries: SiteEntry[] = [];

      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'json') {
        try {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) {
            toast.error('JSON file must contain an array');
            return;
          }
          entries = parsed.map((item: unknown) => {
            if (typeof item === 'string') return { url: item.trim(), label: '' };
            if (typeof item === 'object' && item !== null && 'url' in item) {
              const obj = item as { url: string; label?: string };
              return { url: obj.url.trim(), label: obj.label?.trim() ?? '' };
            }
            return { url: '', label: '' };
          });
        } catch {
          toast.error('Invalid JSON file');
          return;
        }
      } else if (ext === 'csv') {
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const firstLine = lines[0]?.toLowerCase().trim() ?? '';
        const startIdx = firstLine.startsWith('url') ? 1 : 0;
        const dataLines = lines.slice(startIdx);

        // Handle the case where all URLs are on a single comma-separated line
        // (e.g. "https://a.com, https://b.com, https://c.com") rather than
        // one URL per row.  We detect this by checking if the single line
        // contains more than one http(s) URL.
        const isSingleLineFmt =
          dataLines.length === 1 &&
          (dataLines[0]?.match(/https?:\/\//g) ?? []).length > 1;

        if (isSingleLineFmt) {
          entries = (dataLines[0] ?? '')
            .split(',')
            .map((p) => p.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean)
            .map((url) => ({ url, label: '' }));
        } else {
          entries = dataLines.map((line) => {
            const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
            return { url: parts[0] ?? '', label: parts[1] ?? '' };
          });
        }
      } else {
        entries = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'))
          .map((url) => ({ url, label: '' }));
      }

      // Auto-generate labels from hostname where missing
      entries = entries.map((entry) => {
        if (!entry.label && entry.url) {
          try {
            const hostname = new URL(entry.url).hostname.replace(/^www\./, '');
            return { ...entry, label: hostname };
          } catch {
            return entry;
          }
        }
        return entry;
      });

      // Filter valid URLs only
      const valid = entries.filter((e) => {
        try {
          const u = new URL(e.url);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          return false;
        }
      });

      // Deduplicate against existing sites
      const existingUrls = new Set(form.sites.map((s) => s.url.toLowerCase().trim()));
      const newEntries = valid.filter((e) => !existingUrls.has(e.url.toLowerCase().trim()));

      const skipped = entries.length - newEntries.length;

      if (newEntries.length === 0) {
        toast.error('No new valid URLs found in file');
        return;
      }

      setForm((prev) => {
        const hasOnlyEmpty = prev.sites.length === 1 && !prev.sites[0]!.url.trim();
        const existingSites = hasOnlyEmpty ? [] : prev.sites;
        return { ...prev, sites: [...existingSites, ...newEntries] };
      });

      if (errors.sites) setErrors((prev) => ({ ...prev, sites: undefined }));

      const msg = `Imported ${newEntries.length} site${newEntries.length !== 1 ? 's' : ''}`;
      if (skipped > 0) {
        toast.success(`${msg} (${skipped} skipped — duplicate or invalid)`);
      } else {
        toast.success(msg);
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  }

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = 'Campaign name is required';
    const validSites = form.sites.filter((s) => s.url.trim());
    if (validSites.length === 0) errs.sites = 'At least one site URL is required';
    else if (validSites.some((s) => !isValidUrl(s.url))) errs.sites = 'One or more URLs are invalid';
    return errs;
  }

  async function handleSubmit(runNow = false) {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Please fix the form errors before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      const validSites = form.sites.filter((s) => s.url.trim());
      const payload = {
        name: form.name.trim(),
        complianceLevel: form.complianceLevel,
        categories: ['accessibility'] as const,
        scanDepth: form.scanDepth,
        maxPagesToScan: form.maxPagesToScan,
        siteConcurrency: form.siteConcurrency,
        pageConcurrency: form.pageConcurrency,
        scheduleCron: form.recurring ? form.scheduleCron : null,
        sites: validSites.map((s) => ({ url: s.url.trim(), label: s.label.trim() })),
      };

      if (isEditMode && id) {
        // Update existing campaign
        await campaignApi.update(id, {
          name: payload.name,
          complianceLevel: payload.complianceLevel,
          categories: payload.categories,
          scanDepth: payload.scanDepth,
          maxPagesToScan: payload.maxPagesToScan,
          siteConcurrency: payload.siteConcurrency,
          pageConcurrency: payload.pageConcurrency,
          scheduleCron: payload.scheduleCron,
          sites: payload.sites,
        });

        if (runNow) {
          await campaignApi.startScan(id);
          toast.success('Campaign updated and scan started!');
        } else {
          toast.success('Campaign updated successfully!');
        }
        navigate(`/campaigns/${id}`);
      } else {
        // Create new campaign
        const res = await campaignApi.create(payload);
        const campaign = res.data as { id: string };

        if (runNow) {
          await campaignApi.startScan(campaign.id);
          toast.success('Campaign created and scan started!');
        } else {
          toast.success('Campaign created successfully!');
        }
        navigate(`/campaigns/${campaign.id}`);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string; details?: string[] } } } };
      const details = axiosErr?.response?.data?.error?.details;
      if (details && Array.isArray(details)) {
        toast.error(details.join('. '));
      } else {
        const msg = axiosErr?.response?.data?.error?.message ??
          (isEditMode ? 'Failed to update campaign' : 'Failed to create campaign');
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(isEditMode ? `/campaigns/${id}` : '/campaigns')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold">
          {isEditMode ? 'Edit Campaign' : 'New Campaign'}
        </h2>
      </div>

      {isLoadingCampaign ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
      {/* Section 1 — Campaign Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Details</CardTitle>
          <CardDescription>Name and describe your audit campaign</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Campaign Name *</Label>
            <Input
              id="campaign-name"
              placeholder="e.g. Corporate Website Audit"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-desc">Description</Label>
            <textarea
              id="campaign-desc"
              placeholder="Optional description of this campaign's purpose and scope..."
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Target Websites */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target Websites</CardTitle>
          <CardDescription>Add the websites to scan for compliance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.sites.map((site, i) => (
            <SiteInput
              key={i}
              site={site}
              index={i}
              onChange={updateSite}
              onRemove={removeSite}
              canRemove={form.sites.length > 1}
            />
          ))}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addSite}>
              <Plus className="h-4 w-4 mr-1" />
              Add Website
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              Import from File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.json"
              className="hidden"
              onChange={handleFileImport}
            />
            <span className="text-xs text-muted-foreground">.txt, .csv, or .json</span>
          </div>
          {errors.sites && <p className="text-xs text-destructive">{errors.sites}</p>}
        </CardContent>
      </Card>

      {/* Section 3 — Compliance Level */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance Level</CardTitle>
          <CardDescription>Choose the WCAG conformance level to audit against</CardDescription>
        </CardHeader>
        <CardContent>
          <ComplianceLevelSelector
            value={form.complianceLevel}
            onChange={(v) => updateField('complianceLevel', v)}
          />
        </CardContent>
      </Card>

      {/* Section 4 — Scan Depth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scan Depth</CardTitle>
          <CardDescription>How deep should the crawler navigate from the starting URL</CardDescription>
        </CardHeader>
        <CardContent>
          <ScanDepthSlider
            value={form.scanDepth}
            onChange={(v) => updateField('scanDepth', v)}
          />
        </CardContent>
      </Card>

      {/* Section 5 — Maximum Pages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Page Limit</CardTitle>
          <CardDescription>Limit the number of pages to scan per website</CardDescription>
        </CardHeader>
        <CardContent>
          <MaxPagesInput
            value={form.maxPagesToScan}
            onChange={(v) => updateField('maxPagesToScan', v)}
          />
        </CardContent>
      </Card>

      {/* Section 6 — Performance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Settings</CardTitle>
          <CardDescription>Control scan concurrency to optimize speed and resource usage</CardDescription>
        </CardHeader>
        <CardContent>
          <ConcurrencySettings
            siteConcurrency={form.siteConcurrency}
            pageConcurrency={form.pageConcurrency}
            onSiteConcurrencyChange={(v) => updateField('siteConcurrency', v)}
            onPageConcurrencyChange={(v) => updateField('pageConcurrency', v)}
          />
        </CardContent>
      </Card>

      {/* Section 7 — Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule</CardTitle>
          <CardDescription>Run once or set up recurring scans</CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleSelector
            recurring={form.recurring}
            cron={form.scheduleCron}
            onRecurringChange={(v) => updateField('recurring', v)}
            onCronChange={(v) => updateField('scheduleCron', v)}
          />
        </CardContent>
      </Card>

      {/* Form Actions */}
      <Separator />
      <div className="flex items-center gap-3 pb-6">
        <Button onClick={() => handleSubmit(false)} disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          {isEditMode ? 'Save Changes' : 'Create Campaign'}
        </Button>
        <Button variant="outline" onClick={() => handleSubmit(true)} disabled={isSubmitting}>
          <Play className="h-4 w-4 mr-1.5" />
          {isEditMode ? 'Save & Run Scan' : 'Create & Run Now'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate(isEditMode ? `/campaigns/${id}` : '/campaigns')}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
        </>
      )}
    </div>
  );
}
