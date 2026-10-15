'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Platform console navigation" className="space-y-1">
      {[
        { href: '/', label: 'Home' },
        { href: '/tenants', label: 'Tenants' },
        { href: '/pbx-nodes', label: 'PBX nodes' },
        { href: '/ui-preview', label: 'UI preview' },
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={
            pathname === item.href ||
            (['/tenants', '/pbx-nodes'].includes(item.href) &&
              pathname.startsWith(`${item.href}/`))
              ? 'page'
              : undefined
          }
          className={`flex min-h-11 items-center rounded-md px-3 py-2 font-medium transition-colors ${pathname === item.href || (['/tenants', '/pbx-nodes'].includes(item.href) && pathname.startsWith(`${item.href}/`)) ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
