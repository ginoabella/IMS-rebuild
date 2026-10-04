import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '@myims/ui-web';
import { AppNavigation } from './navigation';

export const metadata: Metadata = {
  title: 'MyIMS | Platform console',
  description: 'MyIMS application foundation',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell
          name="Platform console"
          description="Platform workspace"
          navigation={<AppNavigation />}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
