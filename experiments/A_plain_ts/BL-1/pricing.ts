export interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePricing(
  prixNetVendeur: number,
  commissionRate: number
): PricingResult {
  if (typeof prixNetVendeur !== "number" || isNaN(prixNetVendeur)) {
    throw new PricingError("prixNetVendeur must be a valid number");
  }
  if (typeof commissionRate !== "number" || isNaN(commissionRate)) {
    throw new PricingError("commissionRate must be a valid number");
  }
  if (prixNetVendeur <= 0) {
    throw new PricingError("prixNetVendeur must be greater than 0");
  }
  if (commissionRate < 0 || commissionRate >= 1) {
    throw new PricingError("commissionRate must be in [0, 1)");
  }

  const prixAffiche = roundTo2(prixNetVendeur / (1 - commissionRate));
  const vendorShare = roundTo2(prixNetVendeur);
  const commissionShare = roundTo2(prixAffiche - vendorShare);

  return { prixAffiche, vendorShare, commissionShare };
}

export function validatePrixTarget(
  target: number,
  prixAffiche: number,
  tolerance: number
): boolean {
  if (typeof target !== "number" || isNaN(target)) {
    throw new PricingError("target must be a valid number");
  }
  if (typeof prixAffiche !== "number" || isNaN(prixAffiche)) {
    throw new PricingError("prixAffiche must be a valid number");
  }
  if (typeof tolerance !== "number" || isNaN(tolerance) || tolerance < 0) {
    throw new PricingError("tolerance must be a non-negative number");
  }

  return Math.abs(target - prixAffiche) <= tolerance;
}

export function calculateBatchPricing(
  mandates: Array<{ prixNetVendeur: number; commissionRate: number }>
): {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
} {
  if (!Array.isArray(mandates)) {
    throw new PricingError("mandates must be an array");
  }

  const results = mandates.map((m, i) => {
    try {
      return calculatePricing(m.prixNetVendeur, m.commissionRate);
    } catch (e) {
      if (e instanceof PricingError) {
        throw new PricingError(`Mandate at index ${i}: ${e.message}`);
      }
      throw e;
    }
  });

  const totalPrixAffiche = roundTo2(
    results.reduce((sum, r) => sum + r.prixAffiche, 0)
  );
  const totalVendorShare = roundTo2(
    results.reduce((sum, r) => sum + r.vendorShare, 0)
  );
  const totalCommissionShare = roundTo2(
    results.reduce((sum, r) => sum + r.commissionShare, 0)
  );

  return { results, totalPrixAffiche, totalVendorShare, totalCommissionShare };
}
