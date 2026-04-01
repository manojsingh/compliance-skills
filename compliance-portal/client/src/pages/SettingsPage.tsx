import { useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WcagRulesManager } from '@/components/wcag/WcagRulesManager';
import { WcagImportExport } from '@/components/wcag/WcagImportExport';
import { WcagImportHistory } from '@/components/wcag/WcagImportHistory';
import { useWcagRules } from '@/hooks/useWcagRules';

export function SettingsPage() {
  const { refetch } = useWcagRules();

  const handleImportComplete = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">WCAG Rules</TabsTrigger>
          <TabsTrigger value="import-export">Import / Export</TabsTrigger>
          <TabsTrigger value="history">Import History</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <WcagRulesManager />
        </TabsContent>

        <TabsContent value="import-export">
          <WcagImportExport onImportComplete={handleImportComplete} />
        </TabsContent>

        <TabsContent value="history">
          <WcagImportHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
