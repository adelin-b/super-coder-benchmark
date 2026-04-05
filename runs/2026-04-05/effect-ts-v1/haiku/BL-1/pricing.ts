interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

function roundToTwoDec(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculatePricing(prixNetVendeur: number, commissionRate: number): PricingResult {
  if (prixNetVendeur <= 0) {
    throw new Error('prixNetVendeur must be greater than 0');
  }
  if (commissionRate < 0 || commissionRate >= 1) {
    throw new Error('commissionRate must be in [0, 1)');
  }

  const prixAffiche = roundToTwoDec(prixNetVendeur / (1 - commissionRate));
  const vendorShare = roundToTwoDec(prixNetVendeur);
  const commissionShare = roundToTwoDec(prixAffiche - vendorShare);

  return {
    prixAffiche,
    vendorShare,
    commissionShare
  };
}

function validatePrixTarget(target: number, prixAffiche: number, tolerance: number): boolean {
  return target >= prixAffiche - tolerance && target <= prixAffiche + tolerance;
}

function calculateBatchPricing(
  mandates: Array<{ prixNetVendeur: number; commissionRate: number }>
): {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
} {
  const results: PricingResult[] = [];
  let totalPrixAffiche = 0;
  let totalVendorShare = 0;
  let totalCommissionShare = 0;

  for (const mandate of mandates) {
    const result = calculatePricing(mandate.prixNetVendeur, mandate.commissionRate);
    results.push(result);
    totalPrixAffiche = roundToTwoDec(totalPrixAffiche + result.prixAffiche);
    totalVendorShare = roundToTwoDec(totalVendorShare + result.vendorShare);
    totalCommissionShare = roundToTwoDec(totalCommissionShare + result.commissionShare);
  }

  return {
    results,
    totalPrixAffiche,
    totalVendorShare,
    totalCommissionShare
  };
}

export { PricingResult, calculatePricing, validatePrixTarget, calculateBatchPricing };