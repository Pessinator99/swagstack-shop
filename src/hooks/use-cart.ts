"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const CART_STORAGE_KEY = "swagstack.cart.v1";

export type CartLineInput = {
  productId: string;
  productSlug: string;
  productName: string;
  quantity: number;
  variantId?: string;
  variantLabel?: string;
  printTechniqueId?: string;
  printTechniqueName?: string;
  printColors?: number;
};

export type CartItem = CartLineInput & {
  id: string;
  customerId?: string;
  addedAt?: string;
  imageUrl?: string | null;
  printAreaName?: string;
};

export type CartSummaryItem = {
  id: string;
  quantity: number;
  productId: string;
  productName: string;
  productSlug: string;
  productMoq: number;
  variantLabel: string | null;
  printTechniqueName: string | null;
  printAreaName: string | null;
  printColors: number | null;
  imageUrl: string | null;
  productUnitNetCents: number;
  lineSubtotalNetCents: number;
  lineVatCents: number;
  lineTotalGrossCents: number;
};

export type CartSummary = {
  itemCount: number;
  vatRatePercent: number;
  freeShippingThresholdCents: number;
  shippingNetCents: number;
  freeShippingRemainingCents: number;
  subtotalNetCents: number;
  vatAmountCents: number;
  totalGrossCents: number;
  items: CartSummaryItem[];
};

function pickJoined<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function readGuestCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGuestCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

function sameConfig(a: CartLineInput, b: CartLineInput) {
  return (
    a.productId === b.productId &&
    (a.variantId ?? null) === (b.variantId ?? null) &&
    (a.printTechniqueId ?? null) === (b.printTechniqueId ?? null) &&
    (a.printColors ?? null) === (b.printColors ?? null)
  );
}

async function findExistingCartItem(args: {
  supabase: ReturnType<typeof getSupabaseBrowserClient>;
  customerId: string;
  productId: string;
  variantId?: string;
  printTechniqueId?: string;
  printColors?: number;
}) {
  const { supabase, customerId, productId, variantId, printTechniqueId, printColors } = args;

  let query = supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("customer_id", customerId)
    .eq("product_id", productId);

  query = variantId ? query.eq("variant_id", variantId) : query.is("variant_id", null);
  query = printTechniqueId
    ? query.eq("print_technique_id", printTechniqueId)
    : query.is("print_technique_id", null);
  query =
    printColors != null ? query.eq("print_colors", printColors) : query.is("print_colors", null);

  return query.maybeSingle();
}

export function useCurrentUser() {
  const supabase = getSupabaseBrowserClient();
  return useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user ?? null;
    },
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function useCartItems() {
  const supabase = getSupabaseBrowserClient();
  const currentUser = useCurrentUser();
  return useQuery({
    queryKey: ["cart-items"],
    enabled: !currentUser.isLoading,
    staleTime: 30_000,
    queryFn: async (): Promise<CartItem[]> => {
      const user = currentUser.data;

      if (!user) {
        return readGuestCart();
      }

      const { data, error } = await supabase
        .from("cart_items")
        .select(
          `
          id, customer_id, product_id, variant_id, print_technique_id, print_colors, quantity, added_at,
          product:products(id, slug, name, base_images),
          variant:product_variants(id, variant_value),
          technique:print_techniques(
            id, technique_name,
            print_area:print_areas(name)
          )
        `,
        )
        .eq("customer_id", user.id)
        .order("added_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const product = pickJoined(row.product);
        const primaryImageUrl =
          Array.isArray(product?.base_images) && product.base_images.length
            ? (product.base_images.find((img: unknown) =>
                typeof img === "object" &&
                img != null &&
                (img as { is_primary?: boolean }).is_primary,
              ) as { url?: string } | undefined)?.url ??
              (product.base_images[0] as { url?: string })?.url ??
              null
            : null;

        const technique = pickJoined(row.technique);
        const printAreaName = pickJoined(technique?.print_area)?.name ?? undefined;

        return {
          id: row.id,
          customerId: row.customer_id,
          productId: row.product_id,
          productSlug: product?.slug ?? "",
          productName: product?.name ?? "",
          quantity: row.quantity,
          variantId: row.variant_id ?? undefined,
          variantLabel: pickJoined(row.variant)?.variant_value ?? undefined,
          printTechniqueId: row.print_technique_id ?? undefined,
          printTechniqueName: technique?.technique_name ?? undefined,
          printAreaName,
          printColors: row.print_colors ?? undefined,
          imageUrl: primaryImageUrl,
          addedAt: row.added_at,
        };
      });
    },
  });
}

export function useCartSummary() {
  const currentUser = useCurrentUser();
  return useQuery({
    queryKey: ["cart-summary"],
    enabled: !currentUser.isLoading,
    staleTime: 10_000,
    queryFn: async (): Promise<CartSummary> => {
      if (!currentUser.data) {
        return {
          itemCount: 0,
          vatRatePercent: 19,
          freeShippingThresholdCents: 25_000,
          shippingNetCents: 0,
          freeShippingRemainingCents: 25_000,
          subtotalNetCents: 0,
          vatAmountCents: 0,
          totalGrossCents: 0,
          items: [],
        };
      }
      const res = await fetch("/api/cart/summary", { method: "GET" });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Warenkorb-Summary konnte nicht geladen werden.");
      }
      return (await res.json()) as CartSummary;
    },
  });
}

export function useAddToCart() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (line: CartLineInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const existing = readGuestCart();
        const idx = existing.findIndex((item) => sameConfig(item, line));
        if (idx < 0) {
          existing.unshift({
            id: crypto.randomUUID(),
            ...line,
          });
        } else {
          existing[idx] = {
            ...existing[idx],
            quantity: existing[idx].quantity + line.quantity,
          };
        }
        writeGuestCart(existing);
        return;
      }

      const existingRes = await findExistingCartItem({
        supabase,
        customerId: user.id,
        productId: line.productId,
        variantId: line.variantId,
        printTechniqueId: line.printTechniqueId,
        printColors: line.printColors,
      });

      if (existingRes.error) throw existingRes.error;

      if (existingRes.data) {
        const { error: updateError } = await supabase
          .from("cart_items")
          .update({ quantity: existingRes.data.quantity + line.quantity })
          .eq("id", existingRes.data.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("cart_items").insert({
          customer_id: user.id,
          product_id: line.productId,
          variant_id: line.variantId ?? null,
          print_technique_id: line.printTechniqueId ?? null,
          print_colors: line.printColors ?? null,
          quantity: line.quantity,
        });
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart-items"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-summary"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Hinzufügen fehlgeschlagen.");
    },
  });
}

export function useMergeGuestCartIntoDb() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const guestItems = readGuestCart();
      if (!guestItems.length) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      for (const item of guestItems) {
        const existingRes = await findExistingCartItem({
          supabase,
          customerId: user.id,
          productId: item.productId,
          variantId: item.variantId,
          printTechniqueId: item.printTechniqueId,
          printColors: item.printColors,
        });

        if (existingRes.error) throw existingRes.error;

        if (existingRes.data) {
          const { error: updateError } = await supabase
            .from("cart_items")
            .update({ quantity: existingRes.data.quantity + item.quantity })
            .eq("id", existingRes.data.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from("cart_items").insert({
            customer_id: user.id,
            product_id: item.productId,
            variant_id: item.variantId ?? null,
            print_technique_id: item.printTechniqueId ?? null,
            print_colors: item.printColors ?? null,
            quantity: item.quantity,
          });
          if (insertError) throw insertError;
        }
      }

      window.localStorage.removeItem(CART_STORAGE_KEY);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart-items"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-summary"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Warenkorb-Merge fehlgeschlagen.");
    },
  });
}

export function useUpdateCartItem() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();
  const timers = useRef<Map<string, number>>(new Map());

  const mutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", id);
      if (error) throw error;
      return { id, quantity };
    },
    onMutate: async ({ id, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ["cart-items"] });
      const previous = queryClient.getQueryData<CartItem[]>(["cart-items"]);
      if (previous) {
        queryClient.setQueryData<CartItem[]>(["cart-items"], (curr = []) =>
          curr.map((item) => (item.id === id ? { ...item, quantity } : item)),
        );
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["cart-items"], context.previous);
      }
      toast.error(error instanceof Error ? error.message : "Menge konnte nicht aktualisiert werden.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart-items"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-summary"] });
    },
  });

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) {
        window.clearTimeout(timer);
      }
      timers.current.clear();
    };
  }, []);

  const queueDebouncedUpdate = (id: string, quantity: number) => {
    const existing = timers.current.get(id);
    if (existing) window.clearTimeout(existing);
    const next = window.setTimeout(() => {
      mutation.mutate({ id, quantity: Math.max(1, Math.round(quantity)) });
      timers.current.delete(id);
    }, 500);
    timers.current.set(id, next);
  };

  return { ...mutation, queueDebouncedUpdate };
}

export function useRemoveFromCart() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["cart-items"] });
      const previous = queryClient.getQueryData<CartItem[]>(["cart-items"]);
      if (previous) {
        queryClient.setQueryData<CartItem[]>(["cart-items"], (curr = []) =>
          curr.filter((item) => item.id !== id),
        );
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["cart-items"], context.previous);
      toast.error(error instanceof Error ? error.message : "Artikel konnte nicht entfernt werden.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart-items"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-summary"] });
    },
  });
}

export function useClearCart() {
  const supabase = getSupabaseBrowserClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        writeGuestCart([]);
        return;
      }
      const { error } = await supabase.from("cart_items").delete().eq("customer_id", user.id);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["cart-items"] });
      const previous = queryClient.getQueryData<CartItem[]>(["cart-items"]);
      queryClient.setQueryData<CartItem[]>(["cart-items"], []);
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["cart-items"], context.previous);
      toast.error(error instanceof Error ? error.message : "Warenkorb konnte nicht geleert werden.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart-items"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-summary"] });
    },
  });
}
