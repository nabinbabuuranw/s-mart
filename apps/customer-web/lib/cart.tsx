'use client';
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';

/** The server's cart view. Totals are the server's; the client never prices anything. */
export interface CartView { items: any[]; subtotal: number; discountTotal: number; couponDiscount: number; shippingFee: number; taxTotal: number; total: number }
const EMPTY: CartView = { items: [], subtotal: 0, discountTotal: 0, couponDiscount: 0, shippingFee: 0, taxTotal: 0, total: 0 };

interface CartState { cart: CartView; count: number; reload: () => Promise<void>; setCart: (c: CartView) => void }
const Ctx = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartView>(EMPTY);
  const reload = useCallback(async () => {
    if (!user) { setCart(EMPTY); return; }
    try { setCart(await api<CartView>('/me/cart', { quiet: true })); } catch { /* keep last */ }
  }, [user]);
  useEffect(() => { reload(); }, [reload]);
  const count = cart.items.reduce((n, i) => n + (i.quantity || 0), 0);
  return <Ctx.Provider value={{ cart, count, reload, setCart }}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart outside CartProvider');
  return c;
}
