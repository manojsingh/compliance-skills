import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileBarChart, Download, Loader2, Plus, ExternalLink } from 'lucide-react';
import { reportApi, scanApi } from '@/lib/api';
import { useReports } from '@/hooks/useReports';
import { toast } from 'sonner';

function getScoreColor(score: number): string {
  if (score < 50) return 'text-red-600';
  if (score < 70) return 'text-orange-600';
  if (score < 85) return 'text-amber-600';
  return 'text-emerald-600';
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ReportsPage() {
  const navigate = useNavigate();
  const { data: reports, isLoading, refetch } = useReports();
  const [generating, setGenerating] = useState<Set<string>>(new Set());

  async function handleGenerate(scanId: string) {
    setGenerating((prev) => new Set(prev).add(scanId));
    try {
      await reportApi.generate(scanId, true);
      toast.success('Report generated successfully!');
      refetch();
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGenerating((prev) => {
        const next = new Set(prev);
        next.delete(scanId);
        return next;
      });
    }
  }

  // Derive score from summary
  function getScore(report: { scanSummary: { scores: Record<string, number> } | null }): number {
    if (!report.scanSummary?.scores) return 0;
    const vals = Object.values(report.scanSummary.scores).filter((v) => v > 0);
    return vals.length > 0
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : 0;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Compliance Reports</CardTitle>
              <CardDescription>All generated PDF reports across campaigns</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <FileBarChart className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-sm font-medium">No reports generated yet</p>
              <p className="text-xs mt-1">
                Open a campaign, complete a scan, then click &quot;Generate Report&quot;.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => navigate('/campaigns')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Go to Campaigns
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Generated</TableHead>
                    <TableHead>Scan Completed</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Issues</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => {
                    const score = getScore(report);
                    const isGenerating = generating.has(report.scanId);
                    return (
                      <TableRow key={report.id}>
                        <TableCell className="text-sm">
                          {formatDateTime(report.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(report.scanCompletedAt ?? '')}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn('font-bold tabular-nums', getScoreColor(score))}>
                            {score}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {report.scanSummary?.totalIssues ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/15 text-emerald-700 border-emerald-500/20"
                          >
                            Ready
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isGenerating}
                              onClick={() => handleGenerate(report.scanId)}
                              title="Regenerate report"
                            >
                              {isGenerating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => reportApi.download(report.id)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
