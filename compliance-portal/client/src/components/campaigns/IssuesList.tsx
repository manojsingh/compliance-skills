import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ExternalLink, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import type { ScanIssue, ComplianceLevel } from '../../../../shared/types';

interface IssuesListProps {
  issues: ScanIssue[];
  sites?: { id: string; url: string; label: string }[];
  resultToSite?: Record<string, string>;
  resultToPage?: Record<string, string>;
}

const SEVERITY_CONFIG: Record<string, { label: string; className: string; order: number }> = {
  critical: { label: 'Critical', className: 'bg-red-500/15 text-red-700 border-red-500/20', order: 0 },
  serious: { label: 'Serious', className: 'bg-orange-500/15 text-orange-700 border-orange-500/20', order: 1 },
  moderate: { label: 'Moderate', className: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/20', order: 2 },
  minor: { label: 'Minor', className: 'bg-blue-500/15 text-blue-700 border-blue-500/20', order: 3 },
};

type SortField = 'severity' | 'criterion' | 'level';
type GroupBy = 'none' | 'severity' | 'criterion' | 'site';

export function IssuesList({ issues, resultToSite, resultToPage }: IssuesListProps) {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Set<string>>(new Set());
  const [levelFilter, setLevelFilter] = useState<Set<ComplianceLevel>>(new Set());
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortAsc, setSortAsc] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = [...issues];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.description.toLowerCase().includes(q) ||
          i.wcagCriterion.toLowerCase().includes(q) ||
          i.element.toLowerCase().includes(q)
      );
    }

    if (severityFilter.size > 0) {
      result = result.filter((i) => severityFilter.has(i.severity));
    }

    if (levelFilter.size > 0) {
      result = result.filter((i) => levelFilter.has(i.wcagLevel));
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'severity') {
        cmp = (SEVERITY_CONFIG[a.severity]?.order ?? 9) - (SEVERITY_CONFIG[b.severity]?.order ?? 9);
      } else if (sortField === 'criterion') {
        cmp = a.wcagCriterion.localeCompare(b.wcagCriterion);
      } else if (sortField === 'level') {
        cmp = a.wcagLevel.localeCompare(b.wcagLevel);
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [issues, search, severityFilter, levelFilter, sortField, sortAsc]);

  function toggleSeverity(sev: string) {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  }

  function toggleLevel(level: ComplianceLevel) {
    setLevelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortAsc ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />
    ) : null;

  // Group issues
  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', items: filtered }];

    const map = new Map<string, ScanIssue[]>();
    for (const issue of filtered) {
      let key = '';
      if (groupBy === 'severity') key = issue.severity;
      else if (groupBy === 'criterion') key = issue.wcagCriterion;
      else if (groupBy === 'site') key = resultToSite?.[issue.resultId] ?? 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(issue);
    }
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [filtered, groupBy, resultToSite]);

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search issues by description, criterion, or element..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(showFilters && 'bg-accent')}
        >
          <Filter className="h-4 w-4 mr-1" />
          Filters
          {(severityFilter.size + levelFilter.size) > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
              {severityFilter.size + levelFilter.size}
            </Badge>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-6 rounded-lg border bg-muted/30 p-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Severity</p>
            <div className="flex gap-3">
              {['critical', 'serious', 'moderate', 'minor'].map((sev) => (
                <label key={sev} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={severityFilter.has(sev)}
                    onCheckedChange={() => toggleSeverity(sev)}
                  />
                  <span className="capitalize">{sev}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">WCAG Level</p>
            <div className="flex gap-3">
              {(['A', 'AA', 'AAA'] as ComplianceLevel[]).map((level) => (
                <label key={level} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={levelFilter.has(level)}
                    onCheckedChange={() => toggleLevel(level)}
                  />
                  <span>{level}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Group by</p>
            <div className="flex gap-1">
              {(['none', 'severity', 'criterion', 'site'] as GroupBy[]).map((g) => (
                <Button
                  key={g}
                  type="button"
                  variant={groupBy === g ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs capitalize"
                  onClick={() => setGroupBy(g)}
                >
                  {g === 'none' ? 'None' : g}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {issues.length} issues
      </p>

      {/* Issues table */}
      {groups.map(({ key, items }) => (
        <div key={key}>
          {groupBy !== 'none' && key && (
            <h4 className="mb-2 text-sm font-semibold capitalize border-b pb-1">
              {key} ({items.length})
            </h4>
          )}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24 cursor-pointer" onClick={() => toggleSort('severity')}>
                    Severity<SortIcon field="severity" />
                  </TableHead>
                  <TableHead className="w-24 cursor-pointer" onClick={() => toggleSort('criterion')}>
                    Criterion<SortIcon field="criterion" />
                  </TableHead>
                  <TableHead className="w-16 cursor-pointer" onClick={() => toggleSort('level')}>
                    Level<SortIcon field="level" />
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden lg:table-cell">Element</TableHead>
                  {resultToPage && <TableHead className="hidden xl:table-cell">Page</TableHead>}
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((issue) => {
                  const sevConfig = SEVERITY_CONFIG[issue.severity];
                  return (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <Badge variant="outline" className={sevConfig?.className}>
                          {sevConfig?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{issue.wcagCriterion}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {issue.wcagLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{issue.description}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[200px] truncate block">
                          {issue.element}
                        </code>
                      </TableCell>
                      {resultToPage && (
                        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground truncate max-w-[180px]">
                          {resultToPage[issue.resultId] ?? '—'}
                        </TableCell>
                      )}
                      <TableCell>
                        <a
                          href={issue.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No issues match the current filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
