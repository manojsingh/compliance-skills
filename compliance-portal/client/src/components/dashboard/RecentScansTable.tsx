import { Link } from 'react-router-dom';
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
import { Inbox, ExternalLink } from 'lucide-react';

export interface RecentScan {
  id: string;
  campaignId: string;
  campaignName: string;
  sites: number;
  status: 'completed' | 'running' | 'pending' | 'failed';
  score: number | null;
  issues: number | null;
  date: string;
}

interface RecentScansTableProps {
  scans: RecentScan[];
}

const STATUS_CONFIG: Record<
  RecentScan['status'],
  { label: string; className: string }
> = {
  completed: {
    label: 'Completed',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  running: {
    label: 'Running',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
  pending: {
    label: 'Pending',
    className: 'bg-muted text-muted-foreground border-border',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  },
};

function getScoreColor(score: number): string {
  if (score < 50) return 'bg-red-500';
  if (score < 70) return 'bg-orange-500';
  if (score < 85) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function RecentScansTable({ scans }: RecentScansTableProps) {
  if (scans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <Inbox className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No scans yet. Create a campaign to start scanning.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campaign</TableHead>
          <TableHead className="text-center">Sites</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Score</TableHead>
          <TableHead className="text-center">Issues</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {scans.map((scan) => {
          const statusCfg = STATUS_CONFIG[scan.status];
          return (
            <TableRow key={scan.id}>
              <TableCell className="font-medium">{scan.campaignName}</TableCell>
              <TableCell className="text-center">{scan.sites}</TableCell>
              <TableCell>
                <Badge variant="outline" className={statusCfg.className}>
                  {statusCfg.label}
                </Badge>
              </TableCell>
              <TableCell>
                {scan.score !== null ? (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn('h-full rounded-full transition-all', getScoreColor(scan.score))}
                        style={{ width: `${scan.score}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{scan.score}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {scan.issues !== null ? (
                  <span className="text-sm">{scan.issues}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(scan.date)}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  to={`/campaigns/${scan.campaignId}`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View Details
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
