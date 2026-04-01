import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FileText, Activity, Target, AlertTriangle } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { StatCard } from '@/components/dashboard/StatCard';
import { ScoreTrendChart } from '@/components/charts/ScoreTrendChart';
import { IssueSeverityChart } from '@/components/charts/IssueSeverityChart';
import { RecentScansTable } from '@/components/dashboard/RecentScansTable';
import { Loader2 } from 'lucide-react';

export function DashboardPage() {
  const { stats, scoreTrend, issueSeverity, recentScans, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-sm">Failed to load dashboard</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Campaigns"
          value={stats.totalCampaigns}
          subtitle={stats.campaignsTrend}
          icon={<FileText className="h-5 w-5" />}
          iconClassName="bg-blue-500/10 text-blue-500"
        />
        <StatCard
          title="Active Scans"
          value={stats.activeScans}
          subtitle="2 completed today"
          icon={<Activity className="h-5 w-5" />}
          iconClassName="bg-emerald-500/10 text-emerald-500"
        />
        <StatCard
          title="Average Score"
          value={stats.averageScore}
          trend={{ value: stats.scoreTrend, label: 'vs last week' }}
          icon={<Target className="h-5 w-5" />}
          iconClassName="bg-amber-500/10 text-amber-500"
        />
        <StatCard
          title="Issues Found"
          value={stats.totalIssues}
          subtitle={`${stats.criticalIssues} critical`}
          icon={<AlertTriangle className="h-5 w-5" />}
          iconClassName="bg-red-500/10 text-red-500"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Score Trend</CardTitle>
            <CardDescription>Score progression over recent scans</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart data={scoreTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issues by Severity</CardTitle>
            <CardDescription>Distribution of issues across severity levels</CardDescription>
          </CardHeader>
          <CardContent>
            <IssueSeverityChart data={issueSeverity} />
          </CardContent>
        </Card>
      </div>

      {/* Recent scans table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Scans</CardTitle>
          <CardDescription>Latest compliance scan activity</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentScansTable scans={recentScans} />
        </CardContent>
      </Card>
    </div>
  );
}
