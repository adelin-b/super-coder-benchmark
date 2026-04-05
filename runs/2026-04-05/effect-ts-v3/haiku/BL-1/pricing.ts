interface PricingResult {
  prixAffiche: number;
  vendorShare: number;
  commissionShare: number;
}

interface MandatePricing {
  prixNetVendeur: number;
  commissionRate: number;
}

interface BatchPricingResult {
  results: PricingResult[];
  totalPrixAffiche: number;
  totalVendorShare: number;
  totalCommissionShare: number;
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculatePricing(
  prixNetVendeur: number,
  commissionRate: number
): PricingResult {
  if (prixNetVendeur <= 0) {
    throw new Error("prixNetVendeur must be greater than 0");
  }
  if (commissionRate < 0 || commissionRate >= 1) {
    throw new Error("commissionRate must be in [0, 1)");
  }

  const prixAffiche = roundToCents(prixNetVendeur / (1 - commissionRate));
  const vendorShare = roundToCents(prixNetVendeur);
  const commissionShare = roundToCents(prixAffiche - vendorShare);

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
  return Math.abs(target - prixAffiche) <= tolerance;
}

function calculateBatchPricing(
  mandates: Array<MandatePricing>
): BatchPricingResult {
  const results = mandates.map((mandate) =>
    calculatePricing(mandate.prixNetVendeur, mandate.commissionRate)
  );

  const totalPrixAffiche = roundToCents(
    results.reduce((sum, r) => sum + r.prixAffiche, 0)
  );
  const totalVendorShare = roundToCents(
    results.reduce((sum, r) => sum + r.vendorShare, 0)
  );
  const totalCommissionShare = roundToCents(
    results.reduce((sum, r) => sum + r.commissionShare, 0)
  );

  return {
    results,
    totalPrixAffiche,
    totalVendorShare,
    totalCommissionShare,
  };
}

export {
  calculatePricing,
  validatePrixTarget,
  calculateBatchPricing,
  PricingResult,
  MandatePricing,
  BatchPricingResult,
};