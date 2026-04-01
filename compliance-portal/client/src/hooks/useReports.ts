import { useState, useEffect, useCallback } from 'react';
import { reportApi } from '@/lib/api';

export interface Report {
  id: string;
  scanId: string;
  campaignId: string;
  createdAt: string;
  filePath?: string;
  scanCompletedAt: string | null;
  scanSummary: { scores: Record<string, number>; totalIssues: number } | null;
}

interface UseReportsResult {
  data: Report[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useReports(campaignId?: string): UseReportsResult {
  const [data, setData] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await reportApi.list(campaignId ? { campaignId } : {});
      setData(res.data as Report[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load reports';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
