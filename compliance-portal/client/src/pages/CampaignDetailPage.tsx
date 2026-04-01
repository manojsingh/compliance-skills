import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Play,
  Pencil,
  Trash2,
  ArrowLeft,
  Calendar,
  Layers,
  Shield,
  Loader2,
  Download,
  FileBarChart,
  ClipboardCheck,
} from 'lucide-react';
import { useCampaignDetail } from '@/hooks/useCampaignDetail';
import { useReports } from '@/hooks/useReports';
import { campaignApi, reportApi } from '@/lib/api';
import { ScoreGauge } from '@/components/charts/ScoreGauge';
import { ScoreTrendChart } from '@/components/charts/ScoreTrendChart';
import { SiteResultsTable } from '@/components/campaigns/SiteResultsTable';
import { IssuesList } from '@/components/campaigns/IssuesList';
import { AuditLog } from '@/components/campaigns/AuditLog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20' },
  paused: { label: 'Paused', className: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/20' },
  completed: { label: 'Completed', className: 'bg-blue-500/15 text-blue-700 border-blue-500/20' },
};

const LEVEL_COLORS: Record<string, string> = {
  A: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  AA: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/20',
  AAA: 'bg-purple-500/15 text-purple-700 border-purple-500/20',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, triggerScan, isScanRunning } = useCampaignDetail(id);
  const { data: reports, refetch: refetchReports } = useReports(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Build result-to-site and result-to-page maps for issues
  const { resultToSite, resultToPage } = useMemo(() => {
    if (!data) return { resultToSite: {}, resultToPage: {} };
    const rts: Record<string, string> = {};
    const rtp: Record<string, string> = {};
    for (const r of data.scanResults) {
      const site = data.campaign.sites.find((s) => s.id === r.siteId);
      rts[r.id] = site?.label ?? r.siteId;
      rtp[r.id] = r.pageUrl;
    }
    return { resultToSite: rts, resultToPage: rtp };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p>Campaign not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/campaigns')}>
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const { campaign, latestScan, scanResults, issues, scoreTrend } = data;
  const summary = latestScan?.summary;
  const statusCfg = STATUS_CONFIG[campaign.status]!;

  async function handleDelete() {
    try {
      await campaignApi.delete(id!);
      setDeleteOpen(false);
      toast.success('Campaign deleted');
      navigate('/campaigns');
    } catch {
      toast.error('Failed to delete campaign');
      setDeleteOpen(false);
    }
  }

  async function handleRunScan() {
    try {
      await triggerScan();
      toast.success('Scan started! Results will appear shortly.');
    } catch {
      toast.error('Failed to start scan');
    }
  }

  async function handleGenerateReport() {
    if (!data?.latestScan) {
      toast.error('No completed scan to generate a report from');
      return;
    }
    setIsGenerating(true);
    try {
      await reportApi.generate(data.latestScan.id, true);
      toast.success('Report generated successfully!');
      refetchReports();
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDownloadReport(reportId: string) {
    reportApi.download(reportId);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{campaign.name}</h2>
              <Badge variant="outline" className={statusCfg.className}>
                {statusCfg.label}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{campaign.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleRunScan} disabled={isScanRunning}>
            {isScanRunning ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            {isScanRunning ? 'Scanning…' : 'Run Scan'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/campaigns/${id}/edit`)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Campaign</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{campaign.name}&quot;? This action cannot be undone. All scan history and reports will be permanently removed.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete}>Delete Campaign</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sites">Sites</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="audit-log">Audit Log</TabsTrigger>
        </TabsList>

        {/* Tab 1 — Overview */}
        <TabsContent value="overview" className="space-y-6">
          {/* Config summary */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Shield className="h-5 w-5 text-indigo-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Compliance</p>
                  <Badge variant="outline" className={LEVEL_COLORS[campaign.complianceLevel]}>
                    Level {campaign.complianceLevel}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Layers className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Scan Depth</p>
                  <p className="text-sm font-medium">{campaign.scanDepth} levels</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Calendar className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Schedule</p>
                  <p className="text-sm font-medium">{campaign.scheduleCron ? 'Weekly' : 'One-time'}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scores */}
          {summary && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Latest Scan Score</CardTitle>
                  <CardDescription>
                    {latestScan?.completedAt ? formatDateTime(latestScan.completedAt) : 'Pending'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <ScoreGauge score={summary.scores.accessibility} label="Accessibility" size="lg" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Issues Summary</CardTitle>
                  <CardDescription>{issues.length} total issues found</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Critical', count: summary.criticalCount, color: 'bg-red-500', textColor: 'text-red-600' },
                      { label: 'Serious', count: summary.seriousCount, color: 'bg-orange-500', textColor: 'text-orange-600' },
                      { label: 'Moderate', count: summary.moderateCount, color: 'bg-yellow-500', textColor: 'text-yellow-600' },
                      { label: 'Minor', count: summary.minorCount, color: 'bg-blue-500', textColor: 'text-blue-600' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 rounded-lg border p-3">
                        <div className={cn('h-3 w-3 rounded-full', item.color)} />
                        <div>
                          <p className={cn('text-xl font-bold', item.textColor)}>{item.count}</p>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Score trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score History</CardTitle>
              <CardDescription>Score progression across recent scans</CardDescription>
            </CardHeader>
            <CardContent>
              <ScoreTrendChart data={scoreTrend} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2 — Sites */}
        <TabsContent value="sites">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Sites</CardTitle>
              <CardDescription>
                {campaign.sites.length} sites — click a row to see per-page results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SiteResultsTable sites={campaign.sites} results={scanResults} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3 — Issues */}
        <TabsContent value="issues">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issues from Latest Scan</CardTitle>
              <CardDescription>
                {issues.length} issues found — filter and sort to prioritize fixes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IssuesList
                issues={issues}
                sites={campaign.sites}
                resultToSite={resultToSite}
                resultToPage={resultToPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4 — Reports */}
        <TabsContent value="reports">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Reports</CardTitle>
                <CardDescription>Generated compliance reports for this campaign</CardDescription>
              </div>
              <Button size="sm" onClick={handleGenerateReport} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <FileBarChart className="h-4 w-4 mr-1" />
                )}
                Generate Report
              </Button>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <FileBarChart className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">No reports generated yet</p>
                  <p className="text-xs mt-1">Generate a report from the latest scan results</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report Date</TableHead>
                        <TableHead>Scan Date</TableHead>
                        <TableHead className="text-center">Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Download</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((report) => {
                        const score = report.scanSummary?.scores
                          ? Math.round(
                              Object.values(report.scanSummary.scores)
                                .filter((v) => v > 0)
                                .reduce((a, b) => a + b, 0) /
                                Math.max(
                                  Object.values(report.scanSummary.scores).filter((v) => v > 0).length,
                                  1
                                )
                            )
                          : 0;
                        return (
                          <TableRow key={report.id}>
                            <TableCell className="text-sm">{formatDateTime(report.createdAt)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {report.scanCompletedAt ? formatDate(report.scanCompletedAt) : '—'}
                            </TableCell>
                            <TableCell className="text-center font-medium">{score}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/20">
                                Ready
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadReport(report.id)}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                PDF
                              </Button>
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
        </TabsContent>
        {/* Tab 5 — Audit Log */}
        <TabsContent value="audit-log">
          {latestScan && latestScan.status === 'completed' ? (
            <AuditLog scanId={latestScan.id} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <ClipboardCheck className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No completed scan available</p>
                <p className="text-xs mt-1">Run a scan to see the audit log</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
