'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { post, type Quote } from '@/lib/store-client';

export type CartItem = {
  key: string; // product id + variant
  id: string; // Strapi documentId
  slug: string;
  name: string;
  variant: string | null;
  price: number;
  image: string | null;
  qty: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (item: Omit<CartItem, 'key' | 'qty'>, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  drawer: boolean;
  setDrawer: (open: boolean) => void;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = 'fv-cart-v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* storage unavailable: cart lives in memory only */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items, ready]);

  const add = useCallback<CartCtx['add']>((item, qty = 1) => {
    const key = item.id + '::' + (item.variant || '');
    setItems((cur) => {
      const found = cur.find((i) => i.key === key);
      if (found) return cur.map((i) => (i.key === key ? { ...i, qty: Math.min(99, i.qty + qty) } : i));
      return [...cur, { ...item, key, qty }];
    });
  }, []);
  const setQty = useCallback((key: string, qty: number) => {
    setItems((cur) => (qty <= 0 ? cur.filter((i) => i.key !== key) : cur.map((i) => (i.key === key ? { ...i, qty: Math.min(99, qty) } : i))));
  }, []);
  const remove = useCallback((key: string) => setItems((cur) => cur.filter((i) => i.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartCtx>(() => ({
    items, ready, add, setQty, remove, clear, drawer, setDrawer,
    count: items.reduce((n, i) => n + i.qty, 0),
    subtotal: items.reduce((n, i) => n + i.qty * i.price, 0),
  }), [items, ready, add, setQty, remove, clear, drawer]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

/** Live prices and stock problems for the bag, re-asked shortly after the bag changes. */
export function useQuote(active = true) {
  const { items, ready } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!active || !ready || !items.length) { setQuote(null); return; }
    const t = setTimeout(async () => {
      const r = await post<Quote>('/api/quote', { items: items.map((i) => ({ id: i.id, variant: i.variant, quantity: i.qty })) });
      setQuote(r.data); setError(r.error);
    }, 250);
    return () => clearTimeout(t);
  }, [items, ready, active]);
  const problem = (i: { id: string; variant: string | null }) => quote?.problems.find((p) => p.id === i.id && (p.variant ?? null) === (i.variant ?? null))?.message;
  const live = (i: { id: string; variant: string | null }) => quote?.lines.find((l) => l.id === i.id && l.variant === i.variant);
  return { quote, error, problem, live };
}
