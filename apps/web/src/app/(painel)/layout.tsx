'use client';

import { Building2, Inbox, LogOut, Rss, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useLogout, useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/imoveis', label: 'Imóveis', icon: Building2 },
  { href: '/leads', label: 'Leads', icon: Inbox },
  { href: '/corretores', label: 'Corretores', icon: Users },
  { href: '/feed', label: 'Feed dos portais', icon: Rss },
];

export default function PanelLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useSession();
  const logout = useLogout();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b bg-background md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <Link href="/imoveis" className="text-lg font-semibold">
            Imob Core
          </Link>
          <div className="flex items-center gap-2 md:mt-1">
            <p className="truncate text-sm text-muted-foreground">{session.data?.name ?? ' '}</p>
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="Sair"
              onClick={() => logout.mutate()}
            >
              <LogOut />
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap hover:bg-muted',
                pathname.startsWith(href) && 'bg-muted font-medium',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-2 py-4 md:block">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
