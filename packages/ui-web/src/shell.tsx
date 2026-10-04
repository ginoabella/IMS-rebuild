'use client';

import { useState, type ReactNode } from 'react';
import { Menu, Radio } from 'lucide-react';
import { Overlay } from './overlays.js';
import { Badge, Button } from './primitives.js';

export function AppShell({
  name,
  description,
  navigation,
  children,
}: {
  name: string;
  description: string;
  navigation: ReactNode;
  children: ReactNode;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="fixed -top-20 left-4 z-[60] rounded-md bg-primary px-4 py-3 font-semibold text-primary-foreground focus:top-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-elevated px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="md:hidden">
            <Overlay
              kind="sheet"
              title="Navigation"
              description={name}
              open={navigationOpen}
              onOpenChange={setNavigationOpen}
              trigger={
                <Button
                  variant="ghost"
                  className="px-3"
                  aria-label="Open navigation"
                >
                  <Menu aria-hidden="true" />
                </Button>
              }
            >
              <div
                onClick={(event) => {
                  if (
                    event.target instanceof Element &&
                    event.target.closest('a[href]')
                  )
                    setNavigationOpen(false);
                }}
              >
                {navigation}
              </div>
            </Overlay>
          </div>
          <span className="hidden size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:inline-flex">
            <Radio aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight">
              MyIMS
            </p>
            <p className="text-xs text-muted-foreground">{name}</p>
          </div>
        </div>
        <Badge tone="warning">Foundation preview</Badge>
      </header>
      <div className="flex min-h-[calc(100dvh-4rem)]">
        <aside className="hidden w-56 shrink-0 border-r bg-elevated md:block">
          <div className="sticky top-16 space-y-5 p-4">
            <p className="px-3 text-xs uppercase tracking-widest text-subtle">
              {description}
            </p>
            {navigation}
            <p className="border-t px-3 pt-4 text-xs leading-relaxed text-muted-foreground">
              Features will appear here as they are delivered.
            </p>
          </div>
        </aside>
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 p-4 md:p-6"
        >
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
