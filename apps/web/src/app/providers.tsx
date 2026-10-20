'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ApiError } from '@/lib/api';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Erros 4xx não melhoram tentando de novo.
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status < 500) && failureCount < 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
