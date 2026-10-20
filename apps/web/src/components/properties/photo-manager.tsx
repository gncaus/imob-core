'use client';

import type { PropertyPhotoDto } from '@imob/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, errorMessage } from '@/lib/api';

const MAX_BYTES = 7 * 1024 * 1024;

export function PhotoManager({
  propertyId,
  photos,
}: {
  propertyId: string;
  photos: PropertyPhotoDto[];
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const base = `/properties/${propertyId}/photos`;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['property', propertyId] });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      // Uma por vez, na ordem escolhida: a posição de cada foto segue a ordem de envio.
      const failures: string[] = [];
      for (const file of files) {
        if (file.size > MAX_BYTES) {
          failures.push(`${file.name}: maior que 7 MB`);
          continue;
        }
        const body = new FormData();
        body.append('file', file);
        await api<PropertyPhotoDto>(base, 'POST', body).catch((error: unknown) => {
          failures.push(`${file.name}: ${errorMessage(error)}`);
        });
      }
      return failures;
    },
    onSuccess: (failures, files) => {
      const sent = files.length - failures.length;
      if (sent > 0) toast.success(sent === 1 ? 'Foto enviada.' : `${sent} fotos enviadas.`);
      for (const failure of failures) toast.error(failure);
    },
    onSettled: refresh,
  });

  const reorder = useMutation({
    mutationFn: (photoIds: string[]) =>
      api<PropertyPhotoDto[]>(`${base}/order`, 'PUT', { photoIds }),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: refresh,
  });

  const setPrimary = useMutation({
    mutationFn: (photoId: string) => api(`${base}/${photoId}`, 'PATCH', { isPrimary: true }),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (photoId: string) => api(`${base}/${photoId}`, 'DELETE'),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: refresh,
  });

  const move = (index: number, offset: -1 | 1) => {
    const ids = photos.map((photo) => photo.id);
    const target = index + offset;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder.mutate(ids);
  };

  const busy = upload.isPending || reorder.isPending || setPrimary.isPending || remove.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Fotos ({photos.length})</CardTitle>
          <CardDescription>
            JPG de até 7 MB. Os portais exigem pelo menos 5 fotos e uma principal. Trocar uma foto
            gera um novo endereço, então o portal atualiza a imagem.
          </CardDescription>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (files.length > 0) upload.mutate(files);
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          <ImagePlus />
          {upload.isPending ? 'Enviando…' : 'Enviar fotos'}
        </Button>
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma foto enviada.</p>
        ) : (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map((photo, index) => (
              <li key={photo.id} className="overflow-hidden rounded-lg border bg-background">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- fotos vêm do storage */}
                  <img
                    src={photo.url}
                    alt={photo.caption ?? ''}
                    className="aspect-4/3 w-full object-cover"
                  />
                  {photo.isPrimary && (
                    <Badge className="absolute top-2 left-2">
                      <Star />
                      Principal
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 p-1.5">
                  <div className="flex gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Mover para antes"
                      disabled={busy || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Mover para depois"
                      disabled={busy || index === photos.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    {!photo.isPrimary && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Marcar como principal"
                        disabled={busy}
                        onClick={() => setPrimary.mutate(photo.id)}
                      >
                        <Star />
                      </Button>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Excluir foto"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('Excluir esta foto?')) remove.mutate(photo.id);
                      }}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
