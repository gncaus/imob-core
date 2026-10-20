'use client';

import type { LeadDto, LeadQueue } from '@imob/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Route, UserRound } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, errorMessage } from '@/lib/api';
import {
  formatDateTime,
  leadTypeLabel,
  originLabel,
  QUEUE_LABEL,
  TEMPERATURE_LABEL,
} from '@/lib/format';

const QUEUES = Object.keys(QUEUE_LABEL) as LeadQueue[];

export function LeadCard({ lead }: { lead: LeadDto }) {
  const queryClient = useQueryClient();
  const move = useMutation({
    mutationFn: (queue: LeadQueue) => api<LeadDto>(`/leads/${lead.id}/queue`, 'PATCH', { queue }),
    onSuccess: (moved) => {
      toast.success(
        moved.agent
          ? `Lead movido para ${QUEUE_LABEL[moved.queue!]} e atribuído a ${moved.agent.name}.`
          : `Lead movido para ${QUEUE_LABEL[moved.queue!]}.`,
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{lead.name ?? 'Sem nome'}</CardTitle>
            <p className="text-xs text-muted-foreground">{formatDateTime(lead.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{originLabel(lead.origin)}</Badge>
            <Badge variant="outline">{leadTypeLabel(lead.leadType)}</Badge>
            {lead.temperature && (
              <Badge variant="outline">Temperatura {TEMPERATURE_LABEL[lead.temperature]}</Badge>
            )}
            {lead.isSimilarListing && <Badge variant="outline">Imóvel semelhante</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <p>
          <span className="text-muted-foreground">Imóvel: </span>
          {lead.property ? (
            <Link
              href={`/imoveis/${lead.property.id}`}
              className="underline-offset-4 hover:underline"
            >
              {lead.property.code} · {lead.property.title}
            </Link>
          ) : (
            <span>
              {lead.clientListingId ? `${lead.clientListingId} (não encontrado)` : 'Sem anúncio'}
            </span>
          )}
        </p>
        <p className="flex items-center gap-1.5">
          <UserRound className="size-4 text-muted-foreground" />
          {lead.agent ? (
            lead.agent.name
          ) : (
            <span className="text-muted-foreground">Sem corretor</span>
          )}
        </p>
        <p className="flex items-start gap-1.5">
          <Route className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{lead.status === 'RECEIVED' ? 'Roteando…' : lead.routingReason}</span>
        </p>
        {lead.message && (
          <p className="line-clamp-3 rounded-md bg-muted px-2 py-1.5 text-muted-foreground">
            {lead.message}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {lead.whatsappLink ? (
            <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" asChild>
              <a href={lead.whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle />
                WhatsApp
              </a>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Sem telefone</span>
          )}
          <Select
            value=""
            disabled={lead.status !== 'ROUTED' || move.isPending}
            onValueChange={(queue) => move.mutate(queue as LeadQueue)}
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue placeholder="Mover para…" />
            </SelectTrigger>
            <SelectContent>
              {QUEUES.filter((queue) => queue !== lead.queue).map((queue) => (
                <SelectItem key={queue} value={queue}>
                  {QUEUE_LABEL[queue]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
