import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, History } from 'lucide-react';
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
import { wcagApi } from '@/lib/api';

interface ImportRecord {
  id: string;
  date: string;
  sourceType: string;
  filename: string;
  recordsImported: number;
  mode: string;
}

export function WcagImportHistory() {
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await wcagApi.getImportHistory();
      setHistory(res.data ?? []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load import history';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const sourceTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      json: 'bg-amber-100 text-amber-800 border-amber-200',
      csv: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      pdf: 'bg-red-100 text-red-800 border-red-200',
      seed: 'bg-slate-100 text-slate-800 border-slate-200',
    };
    return (
      <Badge
        variant="outline"
        className={variants[type.toLowerCase()] ?? ''}
      >
        {type.toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            className="ml-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Import History
        </CardTitle>
        <CardDescription>Record of all WCAG rule imports</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No import history found.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead>Mode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      {formatDate(record.date)}
                    </TableCell>
                    <TableCell>{sourceTypeBadge(record.sourceType)}</TableCell>
                    <TableCell className="text-sm font-mono truncate max-w-[200px]">
                      {record.filename}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {record.recordsImported}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {record.mode}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
