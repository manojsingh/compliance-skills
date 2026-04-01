import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, Globe, WifiOff } from 'lucide-react';
import type { CampaignSite, ScanResult } from '../../../../shared/types';

interface SiteResultsTableProps {
  sites: CampaignSite[];
  results: ScanResult[];
}

function getScoreColor(score: number): string {
  if (score < 50) return 'bg-red-500';
  if (score < 70) return 'bg-orange-500';
  if (score < 85) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getScoreTextColor(score: number): string {
  if (score < 50) return 'text-red-600';
  if (score < 70) return 'text-orange-600';
  if (score < 85) return 'text-amber-600';
  return 'text-emerald-600';
}

export function SiteResultsTable({ sites, results }: SiteResultsTableProps) {
  const [expandedSite, setExpandedSite] = useState<string | null>(null);

  // Aggregate results per site
  const siteAggregates = sites.map((site) => {
    const siteResults = results.filter((r) => r.siteId === site.id);
    const avgScore =
      siteResults.length > 0
        ? Math.round(siteResults.reduce((sum, r) => sum + r.score, 0) / siteResults.length)
        : null;
    const totalIssues = siteResults.reduce((sum, r) => sum + r.issuesCount, 0);
    const pageUrls = [...new Set(siteResults.map((r) => r.pageUrl))];
    // A site is considered unreachable if its only result has an error in details and score=0
    const isUnreachable =
      siteResults.length === 1 &&
      siteResults[0]!.score === 0 &&
      typeof (siteResults[0]!.details as Record<string, unknown>)?.error === 'string';
    const errorMessage = isUnreachable
      ? ((siteResults[0]!.details as Record<string, unknown>).error as string)
      : null;
    return { site, results: siteResults, avgScore, totalIssues, pageUrls, isUnreachable, errorMessage };
  });

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Site</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead className="text-center">Issues</TableHead>
              <TableHead className="text-center">Pages</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {siteAggregates.map(({ site, results: siteResults, avgScore, totalIssues, pageUrls, isUnreachable, errorMessage }) => {
              const isExpanded = expandedSite === site.id;
              // Per-page aggregates
              const pageAggregates = pageUrls.map((pageUrl) => {
                const pageResults = siteResults.filter((r) => r.pageUrl === pageUrl);
                const pageAvg = Math.round(
                  pageResults.reduce((sum, r) => sum + r.score, 0) / pageResults.length
                );
                const pageIssues = pageResults.reduce((sum, r) => sum + r.issuesCount, 0);
                return { pageUrl, score: pageAvg, issues: pageIssues };
              });

              return (
                <>
                  <TableRow
                    key={site.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50',
                      isUnreachable && 'opacity-60',
                    )}
                    onClick={() => setExpandedSite(isExpanded ? null : site.id)}
                  >
                    <TableCell className="w-8">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isUnreachable ? (
                          <WifiOff className="h-4 w-4 text-destructive" />
                        ) : (
                          <Globe className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{site.label || site.url}</span>
                        {isUnreachable && (
                          <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20 ml-1">
                            Unreachable
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{site.url}</TableCell>
                    <TableCell className="text-center">
                      {isUnreachable ? (
                        <span className="text-xs text-destructive/70">{errorMessage}</span>
                      ) : avgScore !== null ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-2 w-12 overflow-hidden rounded-full bg-secondary">
                            <div
                              className={cn('h-full rounded-full', getScoreColor(avgScore))}
                              style={{ width: `${avgScore}%` }}
                            />
                          </div>
                          <span className={cn('text-sm font-medium', getScoreTextColor(avgScore))}>
                            {avgScore}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{isUnreachable ? '—' : totalIssues}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {isUnreachable ? '0' : pageUrls.length}
                    </TableCell>
                  </TableRow>
                  {/* Expanded page results */}
                  {isExpanded &&
                    pageAggregates.map((page) => (
                      <TableRow key={`${site.id}-${page.pageUrl}`} className="bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={2} className="pl-12">
                          <span className="text-sm text-muted-foreground">{page.pageUrl}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-2 w-10 overflow-hidden rounded-full bg-secondary">
                              <div
                                className={cn('h-full rounded-full', getScoreColor(page.score))}
                                style={{ width: `${page.score}%` }}
                              />
                            </div>
                            <span className={cn('text-xs font-medium', getScoreTextColor(page.score))}>
                              {page.score}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs">{page.issues}</span>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    ))}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
