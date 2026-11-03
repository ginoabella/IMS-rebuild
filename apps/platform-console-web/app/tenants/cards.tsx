'use client';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { DisclosurePanel } from '@myims/ui-web';
const CardsContext = createContext<{
  openIds: string[];
  setOpen: (id: string, open: boolean) => void;
} | null>(null);

export function TenantCardProvider({ children }: { children: ReactNode }) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const setOpen = useCallback((id: string, open: boolean) => {
    setOpenIds((current) =>
      current.includes(id) === open
        ? current
        : open
          ? [...current, id]
          : current.filter((entry) => entry !== id),
    );
  }, []);
  return (
    <CardsContext.Provider value={{ openIds, setOpen }}>
      {children}
    </CardsContext.Provider>
  );
}
export function TenantCard(
  props: Omit<ComponentProps<typeof DisclosurePanel>, 'open' | 'onOpenChange'>,
) {
  const cards = useContext(CardsContext);
  if (!cards)
    throw new Error('Tenant cards require their owner-bound page provider');
  return (
    <DisclosurePanel
      {...props}
      open={cards.openIds.includes(props.id)}
      onOpenChange={(open) => cards.setOpen(props.id, open)}
    />
  );
}
