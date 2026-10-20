import { CheckCircle2, CircleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ReadinessBadge({ ready, issueCount }: { ready: boolean; issueCount: number }) {
  if (ready) {
    return (
      <Badge className="bg-emerald-600 text-white">
        <CheckCircle2 />
        Pronto para portais
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500 text-amber-700">
      <CircleAlert />
      {issueCount === 1 ? '1 pendência' : `${issueCount} pendências`}
    </Badge>
  );
}
