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
        { href: '/ui-preview', label: 'UI preview' },
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={
            pathname === item.href ||
            (item.href === '/tenants' && pathname.startsWith('/tenants/'))
              ? 'page'
              : undefined
          }
          className={`flex min-h-11 items-center rounded-md px-3 py-2 font-medium transition-colors ${pathname === item.href || (item.href === '/tenants' && pathname.startsWith('/tenants/')) ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        >
          {item.label}
        </Link>
      ))}
      <p className="px-3 pb-2 pt-6 text-xs uppercase tracking-widest text-subtle">
        Planned areas
      </p>
      {['Asterisk'].map((label) => (
        <div
          key={label}
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-muted-foreground"
        >
          <span>{label}</span>
          <span className="text-xs text-subtle">Pending</span>
        </div>
      ))}
    </nav>
  );
}
