import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderKanban, Search, Trash2, LayoutGrid, List, Pencil, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useCampaigns, type CampaignWithMeta } from '@/hooks/useCampaigns';
import { campaignApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function CampaignCard({
  campaign,
  onClick,
  isSelected,
  onSelect,
  selectionMode,
}: {
  campaign: CampaignWithMeta;
  onClick: () => void;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  selectionMode: boolean;
}) {
  const statusCfg = STATUS_CONFIG[campaign.status] ?? { label: campaign.status, className: '' };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/20',
        isSelected && 'ring-2 ring-destructive/50 border-destructive/30',
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {selectionMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(checked === true)}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{campaign.name}</h3>
              {campaign.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{campaign.description}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className={cn('ml-2 shrink-0', statusCfg.className)}>
            {statusCfg.label}
          </Badge>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className={cn('text-xs', LEVEL_COLORS[campaign.complianceLevel])}>
            {campaign.complianceLevel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {campaign.siteCount} site{campaign.siteCount !== 1 ? 's' : ''}
          </span>
          {campaign.scheduleLabel && (
            <span className="text-xs text-muted-foreground">• {campaign.scheduleLabel}</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          {campaign.latestScore !== null ? (
            <div className="flex items-center gap-2">
              <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn('h-full rounded-full transition-all', getScoreColor(campaign.latestScore))}
                  style={{ width: `${campaign.latestScore}%` }}
                />
              </div>
              <span className={cn('text-sm font-bold', getScoreTextColor(campaign.latestScore))}>
                {campaign.latestScore}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No scans yet</span>
          )}
          <div className="flex items-center gap-2">
            {campaign.scanCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {campaign.scanCount} scan{campaign.scanCount !== 1 ? 's' : ''}
              </span>
            )}
            {campaign.lastScanDate && (
              <span className="text-xs text-muted-foreground">
                {formatDate(campaign.lastScanDate)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignRow({
  campaign,
  onClick,
  isSelected,
  onSelect,
  selectionMode,
  onEdit,
  onScan,
}: {
  campaign: CampaignWithMeta;
  onClick: () => void;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  selectionMode: boolean;
  onEdit: (e: React.MouseEvent) => void;
  onScan: (e: React.MouseEvent) => void;
}) {
  const statusCfg = STATUS_CONFIG[campaign.status] ?? { label: campaign.status, className: '' };

  return (
    <TableRow
      className={cn(
        'cursor-pointer hover:bg-muted/50 transition-colors',
        isSelected && 'bg-destructive/5',
      )}
      onClick={onClick}
    >
      {selectionMode && (
        <TableCell className="w-10 pr-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(checked === true)}
            onClick={(e) => e.stopPropagation()}
          />
        </TableCell>
      )}
      <TableCell className="font-medium">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="truncate max-w-[220px]">{campaign.name}</span>
          {campaign.description && (
            <span className="text-xs text-muted-foreground truncate max-w-[220px]">
              {campaign.description}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusCfg.className}>
          {statusCfg.label}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn('text-xs', LEVEL_COLORS[campaign.complianceLevel])}>
          {campaign.complianceLevel}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {campaign.siteCount} site{campaign.siteCount !== 1 ? 's' : ''}
      </TableCell>
      <TableCell>
        {campaign.latestScore !== null ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn('h-full rounded-full', getScoreColor(campaign.latestScore))}
                style={{ width: `${campaign.latestScore}%` }}
              />
            </div>
            <span className={cn('text-sm font-semibold tabular-nums', getScoreTextColor(campaign.latestScore))}>
              {campaign.latestScore}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {campaign.scanCount > 0 ? (
          <div className="flex flex-col gap-0.5">
            <span>{campaign.scanCount} scan{campaign.scanCount !== 1 ? 's' : ''}</span>
            {campaign.lastScanDate && (
              <span className="text-xs">{formatDate(campaign.lastScanDate)}</span>
            )}
          </div>
        ) : (
          <span className="text-xs">No scans yet</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit campaign">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onScan} title="Run scan">
            <Play className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CampaignsPage() {
  const navigate = useNavigate();
  const { campaigns, isLoading, refetch } = useCampaigns();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('campaigns-view-mode') as 'grid' | 'list') ?? 'grid';
  });

  const selectionMode = selectedIds.size > 0;

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return campaigns;
    const q = searchQuery.toLowerCase();
    return campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.complianceLevel.toLowerCase().includes(q)
    );
  }, [campaigns, searchQuery]);

  const toggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('campaigns-view-mode', mode);
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      await campaignApi.bulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      refetch();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleRunScan = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await campaignApi.startScan(id);
      navigate(`/campaigns/${id}`);
    } catch (err) {
      console.error('Failed to start scan:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectionMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
              >
                {selectedIds.size === filtered.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Delete {selectedIds.size} Campaign{selectedIds.size !== 1 ? 's' : ''}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7',
                viewMode === 'grid' && 'bg-background shadow-sm',
              )}
              onClick={() => toggleViewMode('grid')}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7',
                viewMode === 'list' && 'bg-background shadow-sm',
              )}
              onClick={() => toggleViewMode('list')}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button onClick={() => navigate('/campaigns/new')}>
            <Plus className="h-4 w-4 mr-1" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search campaigns by name, description, or level..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <FolderKanban className="h-12 w-12 mb-4 opacity-40" />
              {campaigns.length === 0 ? (
                <>
                  <p className="text-sm font-medium">No campaigns yet</p>
                  <p className="text-xs mt-1">Create your first campaign to get started.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">No campaigns match your search</p>
                  <p className="text-xs mt-1">Try a different search term.</p>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  if (campaigns.length === 0) navigate('/campaigns/new');
                  else setSearchQuery('');
                }}
              >
                {campaigns.length === 0 ? (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Create Campaign
                  </>
                ) : (
                  'Clear Search'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {filtered.length} campaign{filtered.length !== 1 ? 's' : ''}
            </p>
            {!selectionMode && filtered.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={toggleSelectAll}
              >
                Select campaigns
              </Button>
            )}
          </div>

          {/* Grid view */}
          {viewMode === 'grid' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onClick={() => {
                    if (selectionMode) {
                      toggleSelect(campaign.id, !selectedIds.has(campaign.id));
                    } else {
                      navigate(`/campaigns/${campaign.id}`);
                    }
                  }}
                  isSelected={selectedIds.has(campaign.id)}
                  onSelect={(checked) => toggleSelect(campaign.id, checked)}
                  selectionMode={selectionMode}
                />
              ))}
            </div>
          )}

          {/* List view */}
          {viewMode === 'list' && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {selectionMode && <TableHead className="w-10 pr-0" />}
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Sites</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Scans</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((campaign) => (
                    <CampaignRow
                      key={campaign.id}
                      campaign={campaign}
                      onClick={() => {
                        if (selectionMode) {
                          toggleSelect(campaign.id, !selectedIds.has(campaign.id));
                        } else {
                          navigate(`/campaigns/${campaign.id}`);
                        }
                      }}
                      isSelected={selectedIds.has(campaign.id)}
                      onSelect={(checked) => toggleSelect(campaign.id, checked)}
                      selectionMode={selectionMode}
                      onEdit={(e) => {
                        e.stopPropagation();
                        navigate(`/campaigns/${campaign.id}/edit`);
                      }}
                      onScan={(e) => handleRunScan(e, campaign.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} campaign{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected campaign{selectedIds.size !== 1 ? 's' : ''} along with all associated sites, scans, and reports. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
