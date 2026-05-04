import { z } from "zod";

export const priceCalculationInputSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1),
  printTechniqueId: z.string().uuid().optional(),
  printColors: z.number().int().min(1).max(12).optional(),
});

export const priceTierSummarySchema = z.object({
  minQuantity: z.number().int().min(1),
  unitNetCents: z.number().int().min(0),
  active: z.boolean(),
});

export const priceCalculationResponseSchema = z.object({
  quantity: z.number().int().min(1),
  moq: z.number().int().min(1),
  isMoqSatisfied: z.boolean(),
  productUnitNetCents: z.number().int().min(0),
  productTotalNetCents: z.number().int().min(0),
  printSetupNetCents: z.number().int().min(0),
  printUnitNetCents: z.number().int().min(0),
  printTotalNetCents: z.number().int().min(0),
  subtotalNetCents: z.number().int().min(0),
  vatCents: z.number().int().min(0),
  totalGrossCents: z.number().int().min(0),
  activeTierMinQuantity: z.number().int().min(1),
  activePrintTierMinQuantity: z.number().int().min(1).nullable(),
  tiers: z.array(priceTierSummarySchema),
});

export type PriceCalculationInput = z.infer<typeof priceCalculationInputSchema>;
export type PriceCalculationResponse = z.infer<
  typeof priceCalculationResponseSchema
>;
