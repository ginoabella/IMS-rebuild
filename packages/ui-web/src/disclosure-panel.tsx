'use client';
import type { ComponentProps, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from './cn.js';
import { Button, Panel, PanelHeading } from './primitives.js';

export function DisclosurePanel({
  id,
  title,
  summary,
  open,
  onOpenChange,
  notice,
  closedNotice,
  children,
  className,
  ...props
}: Omit<ComponentProps<'section'>, 'id' | 'title' | 'children'> & {
  id: string;
  title: string;
  summary: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notice?: ReactNode;
  closedNotice?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel
      {...props}
      aria-labelledby={props['aria-label'] ? undefined : `${id}-heading`}
      className={cn('p-4', className)}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <PanelHeading id={`${id}-heading`} className="break-words text-lg">
            {title}
          </PanelHeading>
          {!open && (
            <div
              data-disclosure-summary=""
              className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]"
            >
              {summary}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          className="size-11 shrink-0 p-0"
          data-disclosure-toggle=""
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
          title={`${open ? 'Collapse' : 'Expand'} ${title}`}
          aria-expanded={open}
          aria-controls={`${id}-content`}
          onClick={() => onOpenChange(!open)}
        >
          <ChevronRight
            aria-hidden="true"
            className={cn('transition-transform', open && 'rotate-90')}
          />
        </Button>
      </div>
      {!open && closedNotice && (
        <div className="mt-2 space-y-2">{closedNotice}</div>
      )}
      {notice && <div className="mt-2 space-y-2">{notice}</div>}
      <div id={`${id}-content`} hidden={!open} className="pt-3">
        {children}
      </div>
    </Panel>
  );
}
