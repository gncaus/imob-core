'use client';

import type { LeadDto, LeadQueue } from '@imob/shared';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, errorMessage } from '@/lib/api';
import { QUEUE_LABEL } from '@/lib/format';
import { LeadCard } from './lead-card';

const QUEUES: LeadQueue[] = ['RENTAL', 'SALES', 'TRIAGE'];

const DESCRIPTIONS: Record<LeadQueue, string> = {
  RENTAL: 'Leads de aluguel, distribuídos entre os corretores de locação.',
  SALES: 'Leads de compra (inclui MCMV), distribuídos entre os corretores de vendas.',
  TRIAGE: 'Leads sem finalidade clara. Mova para Locação ou Vendas depois de conversar.',
};

/** Atualiza sozinho para os leads novos aparecerem durante a demonstração. */
const REFRESH_MS = 10_000;

function useQueueLeads(queue: LeadQueue) {
  return useQuery({
    queryKey: ['leads', queue],
    queryFn: () => api<LeadDto[]>(`/leads?queue=${queue}`),
    refetchInterval: REFRESH_MS,
  });
}

function QueueTab({ queue }: { queue: LeadQueue }) {
  const leads = useQueueLeads(queue);
  return (
    <TabsContent value={queue} className="mt-4">
      <p className="mb-3 text-sm text-muted-foreground">{DESCRIPTIONS[queue]}</p>
      {leads.isError && <p className="text-destructive">{errorMessage(leads.error)}</p>}
      {leads.isPending && <Skeleton className="h-40" />}
      {leads.data?.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">Nenhum lead nesta fila.</p>
      )}
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {leads.data?.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </TabsContent>
  );
}

function QueueCount({ queue }: { queue: LeadQueue }) {
  const leads = useQueueLeads(queue);
  return leads.data ? (
    <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">{leads.data.length}</span>
  ) : null;
}

export default function LeadsPage() {
  return (
    <>
      <PageHeader
        title="Leads"
        description="Leads dos portais já roteados para a fila certa. O motivo de cada decisão aparece no card."
      />
      <Tabs defaultValue="RENTAL">
        <TabsList>
          {QUEUES.map((queue) => (
            <TabsTrigger key={queue} value={queue}>
              {QUEUE_LABEL[queue]}
              <QueueCount queue={queue} />
            </TabsTrigger>
          ))}
        </TabsList>
        {QUEUES.map((queue) => (
          <QueueTab key={queue} queue={queue} />
        ))}
      </Tabs>
    </>
  );
}
