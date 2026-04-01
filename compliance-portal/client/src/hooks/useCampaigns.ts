import { useState, useEffect, useCallback } from 'react';
import type { Campaign } from '../../../shared/types';
import { campaignApi } from '@/lib/api';

export interface CampaignWithMeta extends Campaign {
  description?: string;
  siteCount: number;
  scanCount: number;
  latestScore: number | null;
  lastScanDate: string | null;
  scheduleLabel: string | null;
}

interface UseCampaignsResult {
  campaigns: CampaignWithMeta[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

function getScheduleLabel(cron: string | null): string | null {
  if (!cron) return null;
  if (cron.includes('* * 1')) return 'Weekly';
  if (cron.includes('* * *')) return 'Daily';
  if (cron.includes('1,15 *')) return 'Bi-weekly';
  if (cron.includes('1 * *')) return 'Monthly';
  return 'Scheduled';
}

export function useCampaigns(): UseCampaignsResult {
  const [campaigns, setCampaigns] = useState<CampaignWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await campaignApi.list();
      const items: CampaignWithMeta[] = (res.data as Array<Campaign & {
        siteCount?: number;
        scanCount?: number;
        latestScanStatus: string | null;
        latestScanId: string | null;
        latestScanSummary?: string | null;
        latestScanDate?: string | null;
        sites?: Array<{ id: string; url: string; label: string }>;
      }>).map((c) => {
        // Parse the latest scan summary to extract the average score
        let latestScore: number | null = null;
        if (c.latestScanSummary) {
          try {
            const summary = JSON.parse(c.latestScanSummary) as { scores?: Record<string, number> };
            if (summary?.scores) {
              const vals = Object.values(summary.scores).filter((v) => v > 0);
              if (vals.length > 0) {
                latestScore = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
              }
            }
          } catch { /* ignore parse errors */ }
        }
        return {
          ...c,
          siteCount: c.siteCount ?? c.sites?.length ?? 0,
          latestScore,
          lastScanDate: c.latestScanDate ?? null,
          scheduleLabel: getScheduleLabel(c.scheduleCron),
        };
      });
      setCampaigns(items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load campaigns';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { campaigns, isLoading, error, refetch: fetchData };
}
