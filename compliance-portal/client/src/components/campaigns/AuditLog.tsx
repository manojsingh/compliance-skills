import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  MinusCircle,
  Loader2,
  ClipboardCheck,
  ChevronRight,
} from 'lucide-react';
import { scanApi } from '@/lib/api';
import type { ScanAuditEntry, ScanAuditSummary, ScanResult, ScanIssue } from '../../../../shared/types';

interface AuditLogProps {
  scanId: string;
}

const CATEGORY_CONFIG = {
  accessibility: { label: 'Accessibility', color: 'text-indigo-600', bgBar: 'bg-indigo-500' },
} as const;

const STATUS_ORDER: Record<string, number> = {
  error: 0,
  'not-run': 1,
  failed: 2,
  passed: 3,
};

function getEntryStatus(entry: ScanAuditEntry): 'passed' | 'failed' | 'error' | 'not-run' {
  if (!entry.executed) return 'not-run';
  if (entry.errorMessage) return 'error';
  if (entry.passed === true) return 'passed';
  if (entry.passed === false) return 'failed';
  return 'not-run';
}

function StatusBadge({ entry }: { entry: ScanAuditEntry }) {
  const status = getEntryStatus(entry);

  switch (status) {
    case 'passed':
      return (
        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/20 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Passed
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="bg-red-500/15 text-red-700 border-red-500/20 gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    case 'error':
      return (
        <span title={entry.errorMessage ?? undefined}>
          <Badge variant="outline" className="bg-orange-500/15 text-orange-700 border-orange-500/20 gap-1 cursor-help">
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        </span>
      );
    default:
      return (
        <Badge variant="outline" className="bg-gray-500/15 text-gray-500 border-gray-500/20 gap-1">
          <MinusCircle className="h-3 w-3" />
          Not Run
        </Badge>
      );
  }
}

function CoverageBar({ percent, className }: { percent: number; className?: string }) {
  const color = percent >= 90 ? 'bg-emerald-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className={cn('h-2 w-full rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full transition-all', color)}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function CategoryCoverageBar({ percent, bgClass }: { percent: number; bgClass: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted mt-2">
      <div
        className={cn('h-full rounded-full transition-all', bgClass)}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export function AuditLog({ scanId }: AuditLogProps) {
  const [entries, setEntries] = useState<ScanAuditEntry[]>([]);
  const [summary, setSummary] = useState<ScanAuditSummary | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [issues, setIssues] = useState<ScanIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      try {
        const [entriesRes, summaryRes, resultsRes, issuesRes] = await Promise.all([
          scanApi.getAuditLog(scanId),
          scanApi.getAuditSummary(scanId),
          scanApi.getResults(scanId),
          scanApi.getIssues(scanId),
        ]);
        if (!cancelled) {
          setEntries(entriesRes.data);
          setSummary(summaryRes.data);
          setResults(resultsRes.data);
          setIssues(issuesRes.data);
        }
      } catch {
        // Silently handle — component will show empty state
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [scanId]);

  const filteredEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const aOrder = STATUS_ORDER[getEntryStatus(a)] ?? 99;
      const bOrder = STATUS_ORDER[getEntryStatus(b)] ?? 99;
      return aOrder - bOrder;
    });
  }, [entries]);

  const issuesByAuditEntry = useMemo(() => {
    const map = new Map<string, ScanIssue[]>();

    const resultLookup = new Map<string, string>();
    for (const r of results) {
      const key = `${r.category}|${r.siteId}|${r.pageUrl}`;
      resultLookup.set(key, r.id);
    }

    const issuesByResult = new Map<string, ScanIssue[]>();
    for (const issue of issues) {
      const arr = issuesByResult.get(issue.resultId) ?? [];
      arr.push(issue);
      issuesByResult.set(issue.resultId, arr);
    }

    for (const entry of entries) {
      if (entry.passed !== false || !entry.executed) continue;

      const resultKey = `${entry.category}|${entry.siteId}|${entry.pageUrl}`;
      const resultId = resultLookup.get(resultKey);
      if (!resultId) continue;

      const resultIssues = issuesByResult.get(resultId) ?? [];
      let matched: ScanIssue[];

      if (entry.category === 'accessibility') {
        matched = resultIssues.filter((i) => i.wcagCriterion === entry.ruleId);
      } else {
        matched = resultIssues.filter((i) =>
          i.description.toLowerCase().includes(entry.ruleName.toLowerCase())
        );
      }

      if (matched.length > 0) {
        map.set(entry.id, matched);
      }
    }

    return map;
  }, [entries, results, issues]);

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <ClipboardCheck className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No audit log entries found</p>
          <p className="text-xs mt-1">The scan may not have generated any rule coverage data</p>
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="space-y-6">
      {/* Overall Coverage Bar */}
      {summary && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Overall Rule Coverage</p>
              <p className="text-sm font-bold">{Math.round(summary.coveragePercent)}%</p>
            </div>
            <CoverageBar percent={summary.coveragePercent} />
            <p className="text-xs text-muted-foreground mt-2">
              {summary.totalExecuted} of {summary.totalExpected} rules executed
              &nbsp;·&nbsp;{summary.totalPassed} passed&nbsp;·&nbsp;{summary.totalFailed} failed&nbsp;·&nbsp;{summary.totalErrored} errored
            </p>
          </CardContent>
        </Card>
      )}

      {/* Category Coverage Card */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-1 max-w-md">
          {(() => {
            const cfg = CATEGORY_CONFIG.accessibility;
            const catData = summary.byCategory['accessibility'];
            if (!catData) return null;
            const coveragePct = catData.expected > 0
              ? Math.round((catData.executed / catData.expected) * 100)
              : 0;

            return (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className={cn('text-sm font-medium', cfg.color)}>{cfg.label}</p>
                    <p className={cn('text-2xl font-bold', cfg.color)}>{coveragePct}%</p>
                  </div>
                  <CategoryCoverageBar percent={coveragePct} bgClass={cfg.bgBar} />
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span>{catData.executed}/{catData.expected} executed</span>
                    <span>{catData.passed} passed</span>
                    <span>{catData.failed} failed</span>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rules</CardTitle>
          <CardDescription>
            {filteredEntries.length} rule{filteredEntries.length !== 1 ? 's' : ''} shown
          </CardDescription>
        </CardHeader>
        <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule ID</TableHead>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Page URL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No rules found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEntries.map((entry) => {
                        const entryIssues = issuesByAuditEntry.get(entry.id) ?? [];
                        const isExpandable = entryIssues.length > 0;
                        const isExpanded = expandedRows.has(entry.id);

                        return (
                          <React.Fragment key={entry.id}>
                            <TableRow
                              className={cn(isExpandable && 'cursor-pointer hover:bg-muted/50')}
                              onClick={() => isExpandable && toggleRow(entry.id)}
                            >
                              <TableCell className="font-mono text-xs">
                                <div className="flex items-center gap-1">
                                  {isExpandable && (
                                    <ChevronRight className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-90')} />
                                  )}
                                  {entry.ruleId}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{entry.ruleName}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <StatusBadge entry={entry} />
                                  {isExpandable && (
                                    <span className="text-xs text-muted-foreground">
                                      ({entryIssues.length})
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {entry.pageUrl ?? '—'}
                              </TableCell>
                            </TableRow>

                            {isExpanded && entryIssues.map((issue) => (
                              <TableRow key={issue.id} className="bg-muted/30">
                                <TableCell colSpan={4} className="py-3 px-6">
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs">
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'text-xs',
                                          issue.severity === 'critical' && 'bg-red-500/15 text-red-700 border-red-500/20',
                                          issue.severity === 'serious' && 'bg-orange-500/15 text-orange-700 border-orange-500/20',
                                          issue.severity === 'moderate' && 'bg-yellow-500/15 text-yellow-700 border-yellow-500/20',
                                          issue.severity === 'minor' && 'bg-blue-500/15 text-blue-700 border-blue-500/20',
                                        )}
                                      >
                                        {issue.severity}
                                      </Badge>
                                      <span className="text-muted-foreground">{issue.description}</span>
                                      {issue.helpUrl && (
                                        <a
                                          href={issue.helpUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-500 hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Learn more ↗
                                        </a>
                                      )}
                                    </div>
                                    {issue.element && (
                                      <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto font-mono border whitespace-pre-wrap break-all">
                                        <code>{issue.element}</code>
                                      </pre>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
        </CardContent>
      </Card>
    </div>
  );
}
