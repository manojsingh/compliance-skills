import { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { wcagApi } from '@/lib/api';
import { useWcagRules, type WcagCriterion } from '@/hooks/useWcagRules';
import { CriterionEditDialog } from './CriterionEditDialog';
import { cn } from '@/lib/utils';

const LEVEL_COLORS: Record<string, string> = {
  A: 'bg-blue-100 text-blue-800 border-blue-200',
  AA: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  AAA: 'bg-purple-100 text-purple-800 border-purple-200',
};

export function WcagRulesManager() {
  const { criteria, stats, principles, guidelines, isLoading, error, refetch } =
    useWcagRules();

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [principleFilter, setPrincipleFilter] = useState<string>('all');
  const [collapsedPrinciples, setCollapsedPrinciples] = useState<Set<string>>(
    new Set(),
  );
  const [collapsedGuidelines, setCollapsedGuidelines] = useState<Set<string>>(
    new Set(),
  );

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCriterion, setEditingCriterion] =
    useState<WcagCriterion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WcagCriterion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    return criteria.filter((c) => {
      if (levelFilter !== 'all' && c.level !== levelFilter) return false;
      if (principleFilter !== 'all' && c.principle !== principleFilter)
        return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.criterionId.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [criteria, search, levelFilter, principleFilter]);

  // Group criteria into a tree: principle → guideline → criteria
  const tree = useMemo(() => {
    const principleMap = new Map<
      string,
      {
        id: string;
        name: string;
        guidelines: Map<
          string,
          { id: string; name: string; criteria: WcagCriterion[] }
        >;
      }
    >();

    for (const c of filtered) {
      if (!principleMap.has(c.principle)) {
        principleMap.set(c.principle, {
          id: c.principle,
          name: c.principleName || `Principle ${c.principle}`,
          guidelines: new Map(),
        });
      }
      const p = principleMap.get(c.principle)!;
      if (!p.guidelines.has(c.guideline)) {
        p.guidelines.set(c.guideline, {
          id: c.guideline,
          name: c.guidelineName || `Guideline ${c.guideline}`,
          criteria: [],
        });
      }
      p.guidelines.get(c.guideline)!.criteria.push(c);
    }

    return Array.from(principleMap.values()).sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
  }, [filtered]);

  const togglePrinciple = (id: string) => {
    setCollapsedPrinciples((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGuideline = (id: string) => {
    setCollapsedGuidelines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEdit = (criterion: WcagCriterion) => {
    setEditingCriterion(criterion);
    setEditDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCriterion(null);
    setEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await wcagApi.deleteCriterion(deleteTarget.id);
      toast.success(`Deleted criterion ${deleteTarget.criterionId}`);
      refetch();
    } catch {
      toast.error('Failed to delete criterion');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleSave = async () => {
    setEditDialogOpen(false);
    setEditingCriterion(null);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">
          Loading WCAG rules...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={refetch} className="ml-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">WCAG 2.1 Guidelines</h3>
          <p className="text-sm text-muted-foreground">
            Manage WCAG success criteria and axe-core rule mappings
          </p>
        </div>
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Rule
        </Button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="flex flex-wrap gap-3">
          <StatBadge label="Total Criteria" value={stats.totalCriteria} />
          <StatBadge
            label="Level A"
            value={stats.byLevel.A}
            className="text-blue-700 bg-blue-50 border-blue-200"
          />
          <StatBadge
            label="Level AA"
            value={stats.byLevel.AA}
            className="text-indigo-700 bg-indigo-50 border-indigo-200"
          />
          <StatBadge
            label="Level AAA"
            value={stats.byLevel.AAA}
            className="text-purple-700 bg-purple-50 border-purple-200"
          />
          <StatBadge
            label="Automated (axe-core)"
            value={stats.automated}
            icon={<CheckCircle2 className="h-3 w-3 text-emerald-600" />}
          />
          <StatBadge
            label="Manual testing"
            value={stats.manual}
            icon={<BookOpen className="h-3 w-3 text-amber-600" />}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="A">Level A</SelectItem>
            <SelectItem value="AA">Level AA</SelectItem>
            <SelectItem value="AAA">Level AAA</SelectItem>
          </SelectContent>
        </Select>

        <Select value={principleFilter} onValueChange={setPrincipleFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Principles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Principles</SelectItem>
            {principles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.id}. {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tree View */}
      <Card>
        <CardContent className="p-0">
          {tree.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No criteria found matching your filters.
            </div>
          ) : (
            <div className="divide-y">
              {tree.map((principle) => {
                const isPCollapsed = collapsedPrinciples.has(principle.id);
                const guidelineList = Array.from(
                  principle.guidelines.values(),
                ).sort((a, b) =>
                  a.id.localeCompare(b.id, undefined, { numeric: true }),
                );
                const criteriaCount = guidelineList.reduce(
                  (sum, g) => sum + g.criteria.length,
                  0,
                );

                return (
                  <div key={principle.id}>
                    {/* Principle Header */}
                    <button
                      onClick={() => togglePrinciple(principle.id)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      {isPCollapsed ? (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-semibold text-sm">
                        Principle {principle.id}: {principle.name}
                      </span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {criteriaCount} criteria
                      </Badge>
                    </button>

                    {/* Guidelines */}
                    {!isPCollapsed &&
                      guidelineList.map((guideline) => {
                        const isGCollapsed = collapsedGuidelines.has(
                          guideline.id,
                        );
                        return (
                          <div key={guideline.id}>
                            {/* Guideline Header */}
                            <button
                              onClick={() => toggleGuideline(guideline.id)}
                              className="flex w-full items-center gap-2 pl-10 pr-4 py-2 text-left hover:bg-muted/30 transition-colors"
                            >
                              {isGCollapsed ? (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <span className="text-sm font-medium text-muted-foreground">
                                {guideline.id} {guideline.name}
                              </span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {guideline.criteria.length}
                              </span>
                            </button>

                            {/* Criteria */}
                            {!isGCollapsed &&
                              guideline.criteria
                                .sort((a, b) =>
                                  a.criterionId.localeCompare(b.criterionId, undefined, {
                                    numeric: true,
                                  }),
                                )
                                .map((criterion) => (
                                  <CriterionRow
                                    key={criterion.id}
                                    criterion={criterion}
                                    onEdit={handleEdit}
                                    onDelete={setDeleteTarget}
                                  />
                                ))}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Add Dialog */}
      <CriterionEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        criterion={editingCriterion}
        guidelines={guidelines}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Criterion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete criterion{' '}
              <strong>{deleteTarget?.criterionId}</strong> (
              {deleteTarget?.name})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CriterionRow({
  criterion,
  onEdit,
  onDelete,
}: {
  criterion: WcagCriterion;
  onEdit: (c: WcagCriterion) => void;
  onDelete: (c: WcagCriterion) => void;
}) {
  const isAutomated = criterion.axeRules && criterion.axeRules.length > 0;
  return (
    <div className="group flex items-center gap-3 pl-16 pr-4 py-2 hover:bg-muted/20 transition-colors">
      <span className="text-sm font-mono text-muted-foreground w-12 shrink-0">
        {criterion.criterionId}
      </span>
      <span className="text-sm flex-1 truncate">{criterion.name}</span>
      <Badge
        variant="outline"
        className={cn('text-[10px] px-1.5 py-0', LEVEL_COLORS[criterion.level])}
      >
        {criterion.level}
      </Badge>
      {isAutomated ? (
        <span className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          <span className="hidden sm:inline">automated</span>
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-amber-600">
          <BookOpen className="h-3 w-3" />
          <span className="hidden sm:inline">manual</span>
        </span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onEdit(criterion)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(criterion)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function StatBadge({
  label,
  value,
  className,
  icon,
}: {
  label: string;
  value: number;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
        className,
      )}
    >
      {icon}
      <span className="font-bold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
