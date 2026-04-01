import { useState, useEffect, useCallback } from 'react';
import { wcagApi } from '@/lib/api';

export interface WcagCriterion {
  id: string;
  criterionId: string;
  name: string;
  level: 'A' | 'AA' | 'AAA';
  principle: string;
  principleName: string;
  guideline: string;
  guidelineName: string;
  description: string;
  helpUrl: string;
  axeRules: string[];
}

export interface WcagStats {
  totalCriteria: number;
  byLevel: { A: number; AA: number; AAA: number };
  automated: number;
  manual: number;
}

export interface WcagPrinciple {
  id: string;
  name: string;
}

export interface WcagGuideline {
  id: string;
  name: string;
  principleId: string;
}

export interface UseWcagRulesResult {
  criteria: WcagCriterion[];
  stats: WcagStats | null;
  principles: WcagPrinciple[];
  guidelines: WcagGuideline[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const defaultStats: WcagStats = {
  totalCriteria: 0,
  byLevel: { A: 0, AA: 0, AAA: 0 },
  automated: 0,
  manual: 0,
};

export function useWcagRules(level?: string): UseWcagRulesResult {
  const [criteria, setCriteria] = useState<WcagCriterion[]>([]);
  const [stats, setStats] = useState<WcagStats | null>(null);
  const [principles, setPrinciples] = useState<WcagPrinciple[]>([]);
  const [guidelines, setGuidelines] = useState<WcagGuideline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [criteriaRes, statsRes, principlesRes, guidelinesRes] =
        await Promise.all([
          wcagApi.getCriteria(level),
          wcagApi.getStats(),
          wcagApi.getPrinciples(),
          wcagApi.getGuidelines(),
        ]);

      setCriteria(criteriaRes.data ?? []);
      setStats(statsRes.data ?? defaultStats);
      setPrinciples(principlesRes.data ?? []);
      setGuidelines(guidelinesRes.data ?? []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load WCAG rules';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [level]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    criteria,
    stats,
    principles,
    guidelines,
    isLoading,
    error,
    refetch: fetchData,
  };
}
