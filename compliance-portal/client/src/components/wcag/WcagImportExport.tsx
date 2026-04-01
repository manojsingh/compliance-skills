import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileJson,
  FileSpreadsheet,
  Download,
  RotateCcw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { wcagApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PreviewItem {
  criterionId: string;
  name: string;
  level: string;
  status: 'new' | 'update' | 'unchanged';
}

interface PreviewResult {
  criteria: PreviewItem[];
  guidelines: number;
  principles: number;
  warnings: string[];
  importId?: string;
}

export function WcagImportExport({
  onImportComplete,
}: {
  onImportComplete?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(null);
    }
  };

  const handleUploadPreview = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const res = await wcagApi.importFile(selectedFile, importMode);
      setPreview(res.data);
      toast.success('File parsed successfully');
    } catch {
      toast.error('Failed to parse file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setIsConfirming(true);
    try {
      await wcagApi.confirmImport({
        importId: preview.importId,
        mode: importMode,
      });
      toast.success('Import completed successfully');
      setSelectedFile(null);
      setPreview(null);
      onImportComplete?.();
    } catch {
      toast.error('Failed to confirm import');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await wcagApi.resetToDefaults();
      toast.success('WCAG rules reset to built-in defaults');
      setShowResetDialog(false);
      onImportComplete?.();
    } catch {
      toast.error('Failed to reset rules');
    } finally {
      setIsResetting(false);
    }
  };

  const getFileIcon = (name: string) => {
    if (name.endsWith('.json')) return <FileJson className="h-5 w-5" />;
    if (name.endsWith('.csv')) return <FileSpreadsheet className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import WCAG Rules</CardTitle>
          <CardDescription>
            Upload a file to import or update WCAG criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 cursor-pointer transition-colors',
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50',
            )}
          >
            <Upload
              className={cn(
                'h-8 w-8',
                dragActive ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <div className="text-center">
              <p className="text-sm font-medium">
                {selectedFile
                  ? selectedFile.name
                  : 'Drop file here or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supported: PDF, CSV, JSON
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              {getFileIcon(selectedFile.name)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  setPreview(null);
                }}
              >
                Remove
              </Button>
            </div>
          )}

          {/* Import Mode */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Import Mode</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="accent-primary"
                />
                <span className="text-sm">Merge (add/update existing)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-primary"
                />
                <span className="text-sm">Replace (clear &amp; add)</span>
              </label>
            </div>
          </div>

          <Button
            onClick={handleUploadPreview}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload &amp; Preview
          </Button>

          {/* Preview */}
          {preview && (
            <div className="space-y-3 pt-2">
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-2">Import Preview</h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">
                    {preview.criteria.length} criteria
                  </Badge>
                  <Badge variant="secondary">
                    {preview.guidelines} guidelines
                  </Badge>
                  <Badge variant="secondary">
                    {preview.principles} principles
                  </Badge>
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Warnings</span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {preview.warnings.map((w, i) => (
                      <li
                        key={i}
                        className="text-xs text-amber-700 ml-6 list-disc"
                      >
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="rounded-md border max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-16">Level</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.criteria.slice(0, 50).map((item) => (
                      <TableRow key={item.criterionId}>
                        <TableCell className="font-mono text-xs">
                          {item.criterionId}
                        </TableCell>
                        <TableCell className="text-sm">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {item.level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.status === 'new' ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              New
                            </span>
                          ) : item.status === 'update' ? (
                            <span className="flex items-center gap-1 text-xs text-blue-600">
                              <RefreshCw className="h-3 w-3" />
                              Update
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Unchanged
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.criteria.length > 50 && (
                <p className="text-xs text-muted-foreground">
                  Showing 50 of {preview.criteria.length} criteria
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleConfirmImport} disabled={isConfirming}>
                  {isConfirming && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Confirm Import
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export</CardTitle>
          <CardDescription>
            Download current WCAG rules in your preferred format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => wcagApi.exportRules('json')}
            >
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => wcagApi.exportRules('csv')}
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reset to Defaults</CardTitle>
          <CardDescription>
            Replace all custom rules with the built-in WCAG 2.1 defaults
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setShowResetDialog(true)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Built-in Defaults
            </Button>
            <p className="text-xs text-muted-foreground">
              ⚠️ This will replace all custom rules
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset WCAG Rules</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all current WCAG rules and replace them with the
              built-in defaults. Any custom rules or modifications will be lost.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              Reset All Rules
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
