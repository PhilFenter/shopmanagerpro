import { useAuth } from '@/hooks/useAuth';
import { hasFinancialAccess } from '@/hooks/useJobs';
import { QuotesList } from '@/components/quotes/QuotesList';
import { PricingMatrixView } from '@/components/quotes/PricingMatrixView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, FileText } from 'lucide-react';

export default function Quotes() {
  const { role } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Quotes & Pricing
        </h1>
        <p className="text-muted-foreground">
          Create quotes, manage pricing matrices, and convert to jobs
        </p>
      </div>

      <Tabs defaultValue="quotes">
        <TabsList>
          <TabsTrigger value="quotes" className="gap-2">
            <FileText className="h-4 w-4" />
            Quotes
          </TabsTrigger>
          {hasFinancialAccess(role) && (
            <TabsTrigger value="pricing" className="gap-2">
              <Calculator className="h-4 w-4" />
              Pricing Matrices
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="quotes" className="mt-4">
          <QuotesList />
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <PricingMatrixView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
