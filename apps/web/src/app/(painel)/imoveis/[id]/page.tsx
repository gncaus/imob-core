'use client';

import type { CreatePropertyInput, PropertyDto } from '@imob/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { PhotoManager } from '@/components/properties/photo-manager';
import { PropertyForm } from '@/components/properties/property-form';
import { ReadinessPanel } from '@/components/properties/readiness-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useIsAdmin } from '@/lib/session';

export default function EditPropertyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const property = useQuery({
    queryKey: ['property', id],
    queryFn: () => api<PropertyDto>(`/properties/${id}`),
  });

  const save = async (payload: CreatePropertyInput) => {
    const updated = await api<PropertyDto>(`/properties/${id}`, 'PATCH', payload);
    queryClient.setQueryData(['property', id], updated);
    await queryClient.invalidateQueries({ queryKey: ['properties'] });
    toast.success('Alterações salvas.');
  };

  const remove = useMutation({
    mutationFn: () => api(`/properties/${id}`, 'DELETE'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Imóvel excluído.');
      router.push('/imoveis');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (property.isError) return <p className="text-destructive">{errorMessage(property.error)}</p>;
  if (!property.data) return <Skeleton className="h-96" />;
  const data = property.data;

  return (
    <>
      <Button variant="link" className="mb-2 px-0" asChild>
        <Link href="/imoveis">
          <ArrowLeft />
          Imóveis
        </Link>
      </Button>
      <PageHeader
        title={data.title}
        description={`${data.code} · atualizado em ${formatDateTime(data.updatedAt)}`}
        actions={
          isAdmin && (
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(`Excluir o imóvel ${data.code}? Esta ação não pode ser desfeita.`)
                ) {
                  remove.mutate();
                }
              }}
            >
              <Trash2 />
              Excluir
            </Button>
          )
        }
      />
      <div className="grid gap-4">
        <ReadinessPanel property={data} />
        <PhotoManager propertyId={data.id} photos={data.photos} />
        {/* key: remonta o formulário com os valores salvos quando o imóvel muda. */}
        <PropertyForm
          key={data.updatedAt}
          property={data}
          submitLabel="Salvar alterações"
          onSubmit={save}
        />
      </div>
    </>
  );
}
