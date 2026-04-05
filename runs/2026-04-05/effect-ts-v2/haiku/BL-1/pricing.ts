interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

interface BatchPricingResult {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculatePricing(
  prixNetVendeur: number,
  commissionRate: number
): PricingResult {
  if (prixNetVendeur <= 0) {
    throw new Error("prixNetVendeur must be > 0");
  }
  if (commissionRate < 0 || commissionRate >= 1) {
    throw new Error("commissionRate must be in [0, 1)");
  }

  const prixAffiche = round2(prixNetVendeur / (1 - commissionRate));
  const vendorShare = round2(prixNetVendeur);
  const commissionShare = round2(prixAffiche - vendorShare);

  return {
    prixAffiche,
    vendorShare,
    commissionShare,
  };
}

function validatePrixTarget(
  target: number,
  prixAffiche: number,
  tolerance: number
): boolean {
  const lower = round2(prixAffiche - tolerance);
  const upper = round2(prixAffiche + tolerance);
  return target >= lower && target <= upper;
}

function calculateBatchPricing(
  mandates: Array<{ prixNetVendeur: number; commissionRate: number }>
): BatchPricingResult {
  const results: PricingResult[] = [];
  let totalPrixAffiche = 0;
  let totalVendorShare = 0;
  let totalCommissionShare = 0;

  for (const mandate of mandates) {
    const result = calculatePricing(
      mandate.prixNetVendeur,
      mandate.commissionRate
    );
    results.push(result);

    totalPrixAffiche = round2(totalPrixAffiche + result.prixAffiche);
    totalVendorShare = round2(totalVendorShare + result.vendorShare);
    totalCommissionShare = round2(
      totalCommissionShare + result.commissionShare
    );
  }

  return {
    results,
    totalPrixAffiche,
    totalVendorShare,
    totalCommissionShare,
  };
}

export { PricingResult, BatchPricingResult, calculatePricing, validatePrixTarget, calculateBatchPricing };