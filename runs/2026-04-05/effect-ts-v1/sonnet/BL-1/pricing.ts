// pricing.ts

export interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculatePricing(
  prixNetVendeur: number,
  commissionRate: number
): PricingResult {
  if (prixNetVendeur <= 0) {
    throw new RangeError(
      `prixNetVendeur must be > 0, received ${prixNetVendeur}`
    );
  }
  if (commissionRate < 0 || commissionRate >= 1) {
    throw new RangeError(
      `commissionRate must be in [0, 1), received ${commissionRate}`
    );
  }

  const prixAffiche = round2(prixNetVendeur / (1 - commissionRate));
  const vendorShare = round2(prixNetVendeur);
  const commissionShare = round2(prixAffiche - vendorShare);

  return { prixAffiche, vendorShare, commissionShare };
}

export function validatePrixTarget(
  target: number,
  prixAffiche: number,
  tolerance: number
): boolean {
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
  const results: PricingResult[] = mandates.map(({ prixNetVendeur, commissionRate }) =>
    calculatePricing(prixNetVendeur, commissionRate)
  );

  // Sum per-item rounded values to avoid floating-point accumulation error
  const totalPrixAffiche = round2(
    results.reduce((acc, r) => round2(acc + r.prixAffiche), 0)
  );
  const totalVendorShare = round2(
    results.reduce((acc, r) => round2(acc + r.vendorShare), 0)
  );
  const totalCommissionShare = round2(
    results.reduce((acc, r) => round2(acc + r.commissionShare), 0)
  );

  return { results, totalPrixAffiche, totalVendorShare, totalCommissionShare };
}