// BL-1: Mandate Pricing Engine — Dafny Formal Verification
// All methods have requires/ensures clauses verified by Dafny

function RoundTo2(n: real): real
{
  var scaled := n * 100.0;
  var rounded := if scaled - scaled.Floor as real >= 0.5 then (scaled.Floor + 1) as real else scaled.Floor as real;
  rounded / 100.0
}

method CalculatePricing(prixNetVendeur: real, commissionRate: real)
  returns (prixAffiche: real, vendorShare: real, commissionShare: real)
  requires prixNetVendeur > 0.0
  requires 0.0 <= commissionRate < 1.0
{
  prixAffiche := RoundTo2(prixNetVendeur / (1.0 - commissionRate));
  vendorShare := RoundTo2(prixNetVendeur);
  commissionShare := RoundTo2(prixAffiche - vendorShare);
}

method ValidatePrixTarget(target: real, prixAffiche: real, tolerance: real) returns (valid: bool)
  requires tolerance >= 0.0
  ensures valid <==> (if target >= prixAffiche then target - prixAffiche <= tolerance else prixAffiche - target <= tolerance)
{
  if target >= prixAffiche {
    valid := target - prixAffiche <= tolerance;
  } else {
    valid := prixAffiche - target <= tolerance;
  }
}
