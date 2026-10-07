import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { backendRequest, sessionDto } from '../auth/server';
import { consoleReturnPath } from '../auth/return-path';
import { ConsoleAccess } from '../auth/console-access';
export const dynamic = 'force-dynamic';
export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const incoming = new Headers(await headers());
  const response = await backendRequest('session', incoming, 'GET');
  if (response.status === 401)
    redirect(
      `/sign-in?returnTo=${encodeURIComponent(consoleReturnPath(incoming.get('x-myims-path')))}`,
    );
  let identity: unknown = null;
  if (response.ok) {
    try {
      identity = await response.json();
    } catch {
      /* Fail closed. */
    }
  }
  if (!sessionDto(identity))
    return (
      <main className="p-6" role="alert">
        <h1>Platform console</h1>
        <p>
          {response.status === 403
            ? 'Access denied.'
            : response.status === 429
              ? 'Too many requests. Wait for the retry interval before reloading.'
              : 'Service unavailable. Reload to retry.'}
        </p>
      </main>
    );
  return <ConsoleAccess initial={identity}>{children}</ConsoleAccess>;
}
