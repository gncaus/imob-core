import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import './globals.css';
import { Providers } from './providers';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Imob Core',
  description: 'Painel de imóveis, portais e leads',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={cn('font-sans', geist.variable)}>
      <body className="min-h-screen bg-muted/40 text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
