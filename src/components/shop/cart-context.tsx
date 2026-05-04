"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  useAddToCart,
  useCartItems,
  useMergeGuestCartIntoDb,
  type CartItem,
  type CartLineInput,
} from "@/hooks/use-cart";

type CartContextValue = {
  items: CartItem[];
  count: number;
  addItem: (line: CartLineInput) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const cartQuery = useCartItems();
  const addMutation = useAddToCart();
  const mergeMutation = useMergeGuestCartIntoDb();
  const mergeRef = useRef(mergeMutation.mutateAsync);
  const items = cartQuery.data ?? [];

  mergeRef.current = mergeMutation.mutateAsync;

  useEffect(() => {
    void mergeRef.current();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return;
      void mergeRef.current();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    return {
      items,
      count,
      addItem: async (line) => {
        await addMutation.mutateAsync(line);
      },
    };
  }, [items, addMutation]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
