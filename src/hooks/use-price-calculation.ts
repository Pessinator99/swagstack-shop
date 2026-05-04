"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  PriceCalculationInput,
  PriceCalculationResponse,
} from "@/lib/pricing/price-calculation-schema";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);

  return debounced;
}

export function usePriceCalculation(input: PriceCalculationInput | null) {
  const debouncedInput = useDebouncedValue(input, 300);
  const queryKey = useMemo(
    () => [
      "price-calculate",
      debouncedInput?.productId ?? null,
      debouncedInput?.variantId ?? null,
      debouncedInput?.quantity ?? null,
      debouncedInput?.printTechniqueId ?? null,
      debouncedInput?.printColors ?? null,
    ],
    [debouncedInput],
  );

  return useQuery({
    queryKey,
    enabled: Boolean(debouncedInput),
    queryFn: async () => {
      const res = await fetch("/api/price/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(debouncedInput),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Preisberechnung fehlgeschlagen.");
      }
      return (await res.json()) as PriceCalculationResponse;
    },
  });
}
