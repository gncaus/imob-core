'use client';

import type { PropertyPurpose, PropertySummaryDto } from '@imob/shared';
import { useQuery } from '@tanstack/react-query';
import { ImageOff, Plus } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ReadinessBadge } from '@/components/readiness-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/api';
import { formatCents, PURPOSE_LABEL } from '@/lib/format';

type ReadyFilter = 'all' | 'true' | 'false';
type PurposeFilter = 'all' | PropertyPurpose;

function priceSummary(property: PropertySummaryDto): string {
  const prices = [];
  if (property.salePriceCents !== null) prices.push(formatCents(property.salePriceCents));
  if (property.rentPriceCents !== null) prices.push(`${formatCents(property.rentPriceCents)}/mês`);
  return prices.join(' · ') || 'Sem preço';
}

export default function PropertiesPage() {
  const [search, setSearch] = useState('');
  const [purpose, setPurpose] = useState<PurposeFilter>('all');
  const [ready, setReady] = useState<ReadyFilter>('all');
  const deferredSearch = useDeferredValue(search.trim());

  const params = new URLSearchParams();
  if (deferredSearch) params.set('search', deferredSearch);
  if (purpose !== 'all') params.set('purpose', purpose);
  if (ready !== 'all') params.set('ready', ready);
  const query = params.toString();

  const properties = useQuery({
    queryKey: ['properties', query],
    queryFn: () => api<PropertySummaryDto[]>(`/properties${query ? `?${query}` : ''}`),
  });

  return (
    <>
      <PageHeader
        title="Imóveis"
        description="Cadastro e situação de cada imóvel para os portais do Grupo OLX."
        actions={
          <Button asChild>
            <Link href="/imoveis/novo">
              <Plus />
              Novo imóvel
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Buscar por código, título, bairro ou cidade"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={purpose} onValueChange={(value) => setPurpose(value as PurposeFilter)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as finalidades</SelectItem>
            {Object.entries(PURPOSE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ready} onValueChange={(value) => setReady(value as ReadyFilter)}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="true">Prontos para portais</SelectItem>
            <SelectItem value="false">Com pendências</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {properties.isError && <p className="text-destructive">{errorMessage(properties.error)}</p>}
      {properties.isPending && (
        <div className="grid gap-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-24" />
          ))}
        </div>
      )}
      {properties.data?.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">Nenhum imóvel encontrado.</p>
      )}

      <div className="grid gap-3">
        {properties.data?.map((property) => (
          <Link key={property.id} href={`/imoveis/${property.id}`}>
            <Card className="flex flex-row items-center gap-4 p-3 transition-colors hover:bg-muted/50">
              {property.primaryPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- fotos vêm do storage, sem otimização
                <img
                  src={property.primaryPhotoUrl}
                  alt=""
                  className="size-20 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-20 shrink-0 items-center justify-center rounded-md bg-muted">
                  <ImageOff className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{property.code}</span>
                  <ReadinessBadge {...property.readiness} />
                  {!property.publishToPortals && (
                    <span className="text-xs text-muted-foreground">Publicação desligada</span>
                  )}
                </div>
                <p className="truncate font-medium">{property.title}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {PURPOSE_LABEL[property.purpose]} · {priceSummary(property)}
                  {property.neighborhood && ` · ${property.neighborhood}, ${property.city ?? ''}`}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
