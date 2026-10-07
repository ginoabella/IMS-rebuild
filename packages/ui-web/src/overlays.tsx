'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { X } from 'lucide-react';
import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Button } from './primitives.js';
import { cn } from './cn.js';

const OverlayContext = createContext<{
  active: boolean;
  container?: RefObject<HTMLElement | null>;
}>({ active: true });

// Presentation only: callers retain form values outside the portalled content.
export function OverlayScope({
  active,
  container,
  children,
}: {
  active: boolean;
  container: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <OverlayContext.Provider value={{ active, container }}>
      {children}
    </OverlayContext.Provider>
  );
}

export function Overlay({
  trigger,
  title,
  description,
  children,
  kind = 'dialog',
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  kind?: 'dialog' | 'sheet';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const scope = useContext(OverlayContext);
  const active = useRef(scope.active);
  active.current = scope.active;
  const [localOpen, setLocalOpen] = useState(false);
  return (
    <DialogPrimitive.Root
      open={scope.active && (open ?? localOpen)}
      onOpenChange={(next) => {
        setLocalOpen(next);
        onOpenChange?.(next);
      }}
    >
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal container={scope.container?.current ?? undefined}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-background/80" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(event) => {
            if (!active.current) event.preventDefault();
          }}
          className={cn(
            'fixed z-50 max-h-dvh overflow-y-auto border bg-card p-6 shadow-xl',
            kind === 'sheet'
              ? 'inset-y-0 right-0 w-full max-w-sm'
              : 'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="font-display text-2xl font-semibold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                className="shrink-0 px-3"
                aria-label="Close"
              >
                <X aria-hidden="true" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="mt-2 text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
          <div className="mt-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function OverflowMenu({
  trigger,
  items,
}: {
  trigger: ReactNode;
  items: { label: string; onSelect: () => void }[];
}) {
  const scope = useContext(OverlayContext);
  const active = useRef(scope.active);
  active.current = scope.active;
  const [open, setOpen] = useState(false);
  return (
    <MenuPrimitive.Root open={scope.active && open} onOpenChange={setOpen}>
      <MenuPrimitive.Trigger asChild>{trigger}</MenuPrimitive.Trigger>
      <MenuPrimitive.Portal container={scope.container?.current ?? undefined}>
        <MenuPrimitive.Content
          onCloseAutoFocus={(event) => {
            if (!active.current) event.preventDefault();
          }}
          sideOffset={6}
          className="z-50 min-w-40 rounded-md border bg-card p-1 shadow-xl"
        >
          {items.map((item) => (
            <MenuPrimitive.Item
              key={item.label}
              onSelect={item.onSelect}
              className="min-h-11 cursor-pointer rounded-md px-3 py-3 text-sm outline-none focus:bg-muted focus:ring-2 focus:ring-ring"
            >
              {item.label}
            </MenuPrimitive.Item>
          ))}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

export function Tabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
}) {
  return (
    <TabsPrimitive.Root defaultValue={tabs[0]?.id}>
      <TabsPrimitive.List
        aria-label="Preview sections"
        className="flex flex-wrap gap-1 rounded-md bg-elevated p-1"
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            className="min-h-11 rounded-md px-4 py-2 text-muted-foreground hover:bg-muted data-[state=active]:bg-muted data-[state=active]:text-primary"
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Content
          key={tab.id}
          value={tab.id}
          className="mt-4 rounded-md p-1"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
