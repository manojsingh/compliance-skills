import { useState, useEffect, useCallback } from 'react';
import type { ScoreTrendDataPoint } from '@/components/charts/ScoreTrendChart';
import type { SeverityDataPoint } from '@/components/charts/IssueSeverityChart';
import type { RecentScan } from '@/components/dashboard/RecentScansTable';
import { dashboardApi } from '@/lib/api';

export interface DashboardStats {
  totalCampaigns: number;
  activeScans: number;
  averageScore: number;
  totalIssues: number;
  criticalIssues: number;
  campaignsTrend: string;
  scoreTrend: number;
}

export interface UseDashboardResult {
  stats: DashboardStats;
  scoreTrend: ScoreTrendDataPoint[];
  issueSeverity: SeverityDataPoint[];
  recentScans: RecentScan[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const defaultStats: DashboardStats = {
  totalCampaigns: 0,
  activeScans: 0,
  averageScore: 0,
  totalIssues: 0,
  criticalIssues: 0,
  campaignsTrend: '',
  scoreTrend: 0,
};

export function useDashboard(): UseDashboardResult {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrendDataPoint[]>([]);
  const [issueSeverity, setIssueSeverity] = useState<SeverityDataPoint[]>([]);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [summaryRes, recentRes] = await Promise.all([
        dashboardApi.getSummary(),
        dashboardApi.getRecentScans(10),
      ]);

      const summary = summaryRes.data;
      const totalIssues =
        (summary.issuesBySeverity?.critical ?? 0) +
        (summary.issuesBySeverity?.serious ?? 0) +
        (summary.issuesBySeverity?.moderate ?? 0) +
        (summary.issuesBySeverity?.minor ?? 0);

      setStats({
        totalCampaigns: summary.totalCampaigns ?? 0,
        activeScans: summary.totalScans ?? 0,
        averageScore: Math.round((summary.avgScore ?? 0) * 10) / 10,
        totalIssues,
        criticalIssues: summary.issuesBySeverity?.critical ?? 0,
        campaignsTrend: summary.totalCampaigns > 0 ? `${summary.totalCampaigns} total` : '',
        scoreTrend: 0,
      });

      setIssueSeverity([
        { name: 'Critical', value: summary.issuesBySeverity?.critical ?? 0, color: '#dc2626' },
        { name: 'Serious', value: summary.issuesBySeverity?.serious ?? 0, color: '#ea580c' },
        { name: 'Moderate', value: summary.issuesBySeverity?.moderate ?? 0, color: '#ca8a04' },
        { name: 'Minor', value: summary.issuesBySeverity?.minor ?? 0, color: '#2563eb' },
      ]);

      // Map recent scans to the RecentScan shape the table expects
      const scans: RecentScan[] = (recentRes.data as Array<{
        id: string;
        campaignId: string;
        campaignName: string;
        siteCount: number;
        liveIssueCount: number;
        status: 'completed' | 'running' | 'pending' | 'failed';
        summary: { totalIssues: number; scores: Record<string, number> } | null;
        startedAt: string | null;
        completedAt: string | null;
      }>).map((s) => {
        const avgScore = s.summary?.scores
          ? Math.round(
              Object.values(s.summary.scores).reduce((a: number, b: number) => a + b, 0) /
                Math.max(Object.values(s.summary.scores).filter((v: number) => v > 0).length, 1)
            )
          : null;
        return {
          id: s.id,
          campaignId: s.campaignId,
          campaignName: s.campaignName,
          sites: s.siteCount ?? 0,
          status: s.status,
          score: avgScore,
          issues: s.liveIssueCount ?? s.summary?.totalIssues ?? null,
          date: s.completedAt ?? s.startedAt ?? '',
        };
      });

      setRecentScans(scans);
      setScoreTrend([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, scoreTrend, issueSeverity, recentScans, isLoading, error, refetch: fetchData };
}
