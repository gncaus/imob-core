'use client';

import type { FeedStatusDto } from '@imob/shared';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/api';

export default function FeedPage() {
  const status = useQuery({
    queryKey: ['feed-status'],
    queryFn: () => api<FeedStatusDto>('/feeds/vrsync/status'),
  });

  if (status.isError) return <p className="text-destructive">{errorMessage(status.error)}</p>;
  if (!status.data) return <Skeleton className="h-96" />;
  const { feedUrl, includedCount, included, excluded } = status.data;

  const copy = async () => {
    await navigator.clipboard.writeText(feedUrl);
    toast.success('URL copiada.');
  };

  return (
    <>
      <PageHeader
        title="Feed dos portais"
        description="Arquivo VRSync lido pelo Grupo OLX (ZAP, Viva Real e OLX) a cada 12 horas, aproximadamente."
      />
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>URL do feed</CardTitle>
            <CardDescription>Cadastre este endereço na integração do Grupo OLX.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={feedUrl}
              className="font-mono"
              onFocus={(event) => event.target.select()}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={copy}>
                <Copy />
                Copiar
              </Button>
              <Button variant="outline" asChild>
                <a href={feedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Abrir
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" />
                {includedCount === 1 ? '1 imóvel no feed' : `${includedCount} imóveis no feed`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {included.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum imóvel pronto e publicado ainda.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {included.map((item) => (
                    <li key={item.id} className="py-2">
                      <Link href={`/imoveis/${item.id}`} className="hover:underline">
                        <span className="font-mono text-xs text-muted-foreground">{item.code}</span>{' '}
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleAlert className="size-5 text-amber-600" />
                {excluded.length === 1
                  ? '1 imóvel fora do feed'
                  : `${excluded.length} imóveis fora do feed`}
              </CardTitle>
              <CardDescription>E o que falta para cada um entrar.</CardDescription>
            </CardHeader>
            <CardContent>
              {excluded.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todos os imóveis estão no feed.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {excluded.map((item) => (
                    <li key={item.id} className="py-2">
                      <Link href={`/imoveis/${item.id}`} className="font-medium hover:underline">
                        <span className="font-mono text-xs text-muted-foreground">{item.code}</span>{' '}
                        {item.title}
                      </Link>
                      <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                        {item.issues.map((issue) => (
                          <li key={issue.code}>{issue.message}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
