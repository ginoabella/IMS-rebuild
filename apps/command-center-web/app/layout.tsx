import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '@myims/ui-web';
import { AppNavigation } from './navigation';

export const metadata: Metadata = {
  title: 'MyIMS | Command center',
  description: 'MyIMS application foundation',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell
          name="Command center"
          description="Tenant workspace"
          navigation={<AppNavigation />}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
