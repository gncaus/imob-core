'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@imob/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api';
import { useLogin } from '@/lib/session';

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const login = useLogin();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit((input) =>
    login.mutate(input, {
      // Só caminhos internos, para o parâmetro não virar redirecionamento para outro site.
      onSuccess: () =>
        router.replace(next?.startsWith('/') && !next.startsWith('//') ? next : '/imoveis'),
    }),
  );

  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...form.register('password')}
        />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>
      {login.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(login.error)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Imob Core</CardTitle>
          <CardDescription>Entre com seu e-mail e senha.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
