'use client';

import type { LoginInput, SessionUser } from '@imob/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export const meQueryKey = ['auth', 'me'] as const;

export function useSession() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => api<{ user: SessionUser }>('/auth/me').then((body) => body.user),
    staleTime: 5 * 60 * 1000,
  });
}

export function useIsAdmin(): boolean {
  return useSession().data?.role === 'ADMIN';
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api<{ user: SessionUser }>('/auth/login', 'POST', input),
    onSuccess: ({ user }) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', 'POST'),
    onSettled: () => {
      queryClient.clear();
      // Recarga completa de propósito: descarta o cache e o estado da sessão anterior.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    },
  });
}
