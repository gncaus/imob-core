'use client';

import type { CreatePropertyInput, PropertyDto } from '@imob/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { PropertyForm } from '@/components/properties/property-form';
import { api } from '@/lib/api';

export default function NewPropertyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const create = async (payload: CreatePropertyInput) => {
    const property = await api<PropertyDto>('/properties', 'POST', payload);
    await queryClient.invalidateQueries({ queryKey: ['properties'] });
    toast.success('Imóvel cadastrado. Agora envie as fotos.');
    router.push(`/imoveis/${property.id}`);
  };

  return (
    <>
      <PageHeader
        title="Novo imóvel"
        description="Salve um rascunho a qualquer momento: as pendências aparecem depois de salvar."
      />
      <PropertyForm submitLabel="Cadastrar imóvel" onSubmit={create} />
    </>
  );
}
