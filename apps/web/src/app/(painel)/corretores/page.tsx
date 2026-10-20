'use client';

import type { AgentDto } from '@imob/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, QUEUE_LABEL } from '@/lib/format';
import { useIsAdmin } from '@/lib/session';
import { AgentDialog } from './agent-dialog';

function formatPhone(digits: string): string {
  return digits.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
}

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState<AgentDto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const agents = useQuery({ queryKey: ['agents'], queryFn: () => api<AgentDto[]>('/agents') });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['agents'] });

  const toggleActive = useMutation({
    mutationFn: (agent: AgentDto) => api(`/agents/${agent.id}`, 'PATCH', { active: !agent.active }),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (agent: AgentDto) => api(`/agents/${agent.id}`, 'DELETE'),
    onSuccess: () => toast.success('Corretor excluído.'),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: refresh,
  });

  const openDialog = (agent: AgentDto | null) => {
    setEditing(agent);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Corretores"
        description="Cada fila tem sua roleta: o próximo lead vai para o corretor ativo que recebeu lead há mais tempo."
        actions={
          isAdmin && (
            <Button onClick={() => openDialog(null)}>
              <Plus />
              Novo corretor
            </Button>
          )
        }
      />

      {agents.isError && <p className="text-destructive">{errorMessage(agents.error)}</p>}
      {agents.isPending && <Skeleton className="h-48" />}
      {agents.data && (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Fila</TableHead>
                <TableHead className="hidden md:table-cell">WhatsApp</TableHead>
                <TableHead className="hidden lg:table-cell">Último lead</TableHead>
                <TableHead>Ativo</TableHead>
                {isAdmin && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum corretor cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {agents.data.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{QUEUE_LABEL[agent.queue]}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatPhone(agent.whatsapp)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {formatDateTime(agent.lastLeadAt)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={agent.active}
                      disabled={!isAdmin || toggleActive.isPending}
                      onCheckedChange={() => toggleActive.mutate(agent)}
                      aria-label={agent.active ? 'Desativar corretor' : 'Ativar corretor'}
                    />
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Editar"
                          onClick={() => openDialog(agent)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Excluir"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm(`Excluir ${agent.name}?`)) remove.mutate(agent);
                          }}
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AgentDialog agent={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
