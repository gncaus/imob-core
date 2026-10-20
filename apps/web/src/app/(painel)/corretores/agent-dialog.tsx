'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AgentDto,
  createAgentSchema,
  type CreateAgentInput,
  passwordSchema,
} from '@imob/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ApiError, api, errorMessage } from '@/lib/api';
import { QUEUE_LABEL } from '@/lib/format';

type FormValues = Required<Omit<CreateAgentInput, 'active'>> & { active: boolean };

/** Na edição a senha é opcional: em branco mantém a atual. */
const editSchema = createAgentSchema.extend({ password: passwordSchema.or(z.literal('')) });

export function AgentDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: AgentDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = agent !== null;
  const form = useForm<FormValues>({
    resolver: zodResolver(isEdit ? editSchema : createAgentSchema) as never,
    values: {
      name: agent?.name ?? '',
      email: agent?.email ?? '',
      password: '',
      queue: agent?.queue ?? 'RENTAL',
      whatsapp: agent?.whatsapp ?? '',
      active: agent?.active ?? true,
    },
  });
  const { errors } = form.formState;

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      if (!isEdit) return api<AgentDto>('/agents', 'POST', values);
      const { password, ...rest } = values;
      return api<AgentDto>(`/agents/${agent.id}`, 'PATCH', password ? values : rest);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success(isEdit ? 'Corretor atualizado.' : 'Corretor cadastrado.');
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        for (const issue of error.issues) {
          form.setError(issue.path as keyof FormValues, { message: issue.message });
        }
      }
      toast.error(errorMessage(error));
    },
  });

  const field = (name: keyof FormValues, label: string, props: Record<string, unknown> = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} aria-invalid={Boolean(errors[name])} {...props} {...form.register(name)} />
      {errors[name] && <p className="text-sm text-destructive">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar corretor' : 'Novo corretor'}</DialogTitle>
          <DialogDescription>
            O corretor entra na roleta da fila escolhida enquanto estiver ativo.
          </DialogDescription>
        </DialogHeader>
        <form
          id="agent-form"
          className="grid gap-3"
          noValidate
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
        >
          {field('name', 'Nome')}
          {field('email', 'E-mail', { type: 'email', autoComplete: 'off' })}
          {field('password', isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha', {
            type: 'password',
            autoComplete: 'new-password',
          })}
          {field('whatsapp', 'WhatsApp', { placeholder: '(27) 99999-0000', inputMode: 'tel' })}
          <div className="grid gap-1.5">
            <Label htmlFor="queue">Fila</Label>
            <Controller
              control={form.control}
              name="queue"
              render={({ field: queueField }) => (
                <Select value={queueField.value} onValueChange={queueField.onChange}>
                  <SelectTrigger id="queue" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RENTAL">{QUEUE_LABEL.RENTAL}</SelectItem>
                    <SelectItem value="SALES">{QUEUE_LABEL.SALES}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="active"
              render={({ field: activeField }) => (
                <Switch
                  id="active"
                  checked={activeField.value}
                  onCheckedChange={activeField.onChange}
                />
              )}
            />
            <Label htmlFor="active">Ativo (recebe leads)</Label>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="agent-form" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
