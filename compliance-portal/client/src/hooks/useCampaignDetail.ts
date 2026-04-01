import { useState, useEffect, useCallback, useRef } from 'react';
import type { Campaign, CampaignSite, Scan, ScanSummary, ScanResult, ScanIssue } from '../../../shared/types';
import { campaignApi, scanApi } from '@/lib/api';

export interface CampaignDetailData {
  campaign: Campaign & { description?: string; sites: CampaignSite[] };
  latestScan: Scan | null;
  scans: Scan[];
  scanResults: ScanResult[];
  issues: ScanIssue[];
  scoreTrend: { date: string; accessibility: number }[];
}

interface UseCampaignDetailResult {
  data: CampaignDetailData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  triggerScan: () => Promise<Scan | null>;
  isScanRunning: boolean;
}

export function useCampaignDetail(id: string | undefined): UseCampaignDetailResult {
  const [data, setData] = useState<CampaignDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScanRunning, setIsScanRunning] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);

      // Fetch campaign detail (includes sites and latestScan from server)
      const campaignRes = await campaignApi.get(id);
      const campaignData = campaignRes.data as Campaign & {
        sites: CampaignSite[];
        latestScan: Scan | null;
      };

      // Fetch scans for this campaign
      const scansRes = await campaignApi.listScans(id);
      const scans = scansRes.data as Scan[];

      const latestScan = campaignData.latestScan ?? (scans.length > 0 ? scans[0]! : null);

      // Fetch results and issues for the latest scan if available
      let scanResults: ScanResult[] = [];
      let issues: ScanIssue[] = [];

      if (latestScan && latestScan.status === 'completed') {
        const [resultsRes, issuesRes] = await Promise.all([
          scanApi.getResults(latestScan.id),
          scanApi.getIssues(latestScan.id),
        ]);
        scanResults = resultsRes.data as ScanResult[];
        issues = issuesRes.data as ScanIssue[];
      }

      // Build score trend from scan history
      const scoreTrend = scans
        .filter((s): s is Scan & { summary: ScanSummary } =>
          s.status === 'completed' && s.summary !== null
        )
        .reverse()
        .map((s) => ({
          date: new Date(s.completedAt ?? s.startedAt ?? '').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          accessibility: s.summary.scores.accessibility ?? 0,
        }));

      setData({
        campaign: {
          ...campaignData,
          sites: campaignData.sites ?? [],
        },
        latestScan,
        scans,
        scanResults,
        issues,
        scoreTrend,
      });

      // Check if any scan is currently running
      const hasRunning = scans.some((s) => s.status === 'running' || s.status === 'pending');
      setIsScanRunning(hasRunning);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load campaign';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for scan status when a scan is running
  useEffect(() => {
    if (isScanRunning) {
      pollRef.current = setInterval(() => {
        fetchData();
      }, 5000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isScanRunning, fetchData]);

  const triggerScan = useCallback(async (): Promise<Scan | null> => {
    if (!id) return null;
    try {
      const res = await campaignApi.startScan(id);
      const scan = res.data as Scan;
      setIsScanRunning(true);
      // Refetch to update UI immediately
      await fetchData();
      return scan;
    } catch (err) {
      throw err;
    }
  }, [id, fetchData]);

  if (!id) return { data: null, isLoading: false, error: 'No campaign ID', refetch: fetchData, triggerScan, isScanRunning: false };

  return { data, isLoading, error, refetch: fetchData, triggerScan, isScanRunning };
}
