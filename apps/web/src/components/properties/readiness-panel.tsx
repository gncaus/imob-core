import type { PropertyDto } from '@imob/shared';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** Mostra o que falta para o imóvel entrar no feed (regras calculadas pela API). */
export function ReadinessPanel({ property }: { property: PropertyDto }) {
  const { ready, issues } = property.readiness;

  if (ready) {
    return (
      <Alert className="border-emerald-600/40 text-emerald-800">
        <CheckCircle2 />
        <AlertTitle>Pronto para os portais</AlertTitle>
        <AlertDescription>
          {property.publishToPortals
            ? 'Este imóvel está no feed do Grupo OLX (ZAP, Viva Real e OLX).'
            : 'Tudo certo, mas a publicação está desligada: ligue-a para o imóvel entrar no feed.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-amber-500/50">
      <CircleAlert className="text-amber-600" />
      <AlertTitle>
        {issues.length === 1 ? '1 pendência' : `${issues.length} pendências`} para entrar nos
        portais
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {issues.map((issue) => (
            <li key={issue.code}>{issue.message}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
