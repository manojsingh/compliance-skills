import { useState, useEffect } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { wcagApi } from '@/lib/api';
import type { WcagCriterion, WcagGuideline } from '@/hooks/useWcagRules';

interface CriterionEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criterion: WcagCriterion | null;
  guidelines: WcagGuideline[];
  onSave: () => void;
}

interface FormData {
  criterionId: string;
  name: string;
  level: 'A' | 'AA' | 'AAA';
  guideline: string;
  description: string;
  helpUrl: string;
  axeRules: string[];
}

const emptyForm: FormData = {
  criterionId: '',
  name: '',
  level: 'A',
  guideline: '',
  description: '',
  helpUrl: '',
  axeRules: [],
};

export function CriterionEditDialog({
  open,
  onOpenChange,
  criterion,
  guidelines,
  onSave,
}: CriterionEditDialogProps) {
  const isEdit = !!criterion;
  const [form, setForm] = useState<FormData>(emptyForm);
  const [newAxeRule, setNewAxeRule] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (criterion) {
        setForm({
          criterionId: criterion.criterionId,
          name: criterion.name,
          level: criterion.level,
          guideline: criterion.guideline,
          description: criterion.description,
          helpUrl: criterion.helpUrl || '',
          axeRules: [...(criterion.axeRules || [])],
        });
      } else {
        setForm(emptyForm);
      }
      setNewAxeRule('');
    }
  }, [open, criterion]);

  const updateField = <K extends keyof FormData>(
    key: K,
    value: FormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addAxeRule = () => {
    const rule = newAxeRule.trim();
    if (rule && !form.axeRules.includes(rule)) {
      updateField('axeRules', [...form.axeRules, rule]);
      setNewAxeRule('');
    }
  };

  const removeAxeRule = (rule: string) => {
    updateField(
      'axeRules',
      form.axeRules.filter((r) => r !== rule),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.criterionId.trim() || !form.name.trim()) {
      toast.error('Criterion ID and Name are required');
      return;
    }

    setIsSaving(true);
    try {
      if (isEdit && criterion) {
        await wcagApi.updateCriterion(criterion.id, form);
        toast.success(`Updated criterion ${form.criterionId}`);
      } else {
        await wcagApi.createCriterion(form);
        toast.success(`Created criterion ${form.criterionId}`);
      }
      onSave();
    } catch {
      toast.error(
        isEdit ? 'Failed to update criterion' : 'Failed to create criterion',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Criterion' : 'Add Criterion'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update WCAG success criterion ${criterion?.criterionId}`
              : 'Add a new WCAG success criterion'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="criterionId">Criterion ID</Label>
              <Input
                id="criterionId"
                placeholder="e.g. 1.1.1"
                value={form.criterionId}
                onChange={(e) => updateField('criterionId', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <div className="flex gap-3 pt-2">
                {(['A', 'AA', 'AAA'] as const).map((lvl) => (
                  <label
                    key={lvl}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="level"
                      value={lvl}
                      checked={form.level === lvl}
                      onChange={() => updateField('level', lvl)}
                      className="accent-primary"
                    />
                    <span className="text-sm font-medium">{lvl}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. Non-text Content"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guideline">Guideline</Label>
            <Select
              value={form.guideline}
              onValueChange={(v) => updateField('guideline', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select guideline..." />
              </SelectTrigger>
              <SelectContent>
                {guidelines.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.id} — {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Success criterion description..."
              rows={3}
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="helpUrl">Help URL</Label>
            <Input
              id="helpUrl"
              type="url"
              placeholder="https://www.w3.org/WAI/..."
              value={form.helpUrl}
              onChange={(e) => updateField('helpUrl', e.target.value)}
            />
          </div>

          {/* Axe-core Rules */}
          <div className="space-y-2">
            <Label>Axe-core Rules</Label>
            {form.axeRules.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.axeRules.map((rule) => (
                  <span
                    key={rule}
                    className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-xs font-mono"
                  >
                    {rule}
                    <button
                      type="button"
                      onClick={() => removeAxeRule(rule)}
                      className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="e.g. image-alt"
                value={newAxeRule}
                onChange={(e) => setNewAxeRule(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAxeRule();
                  }
                }}
                className="text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAxeRule}
                disabled={!newAxeRule.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {isEdit ? 'Save Changes' : 'Create Criterion'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
