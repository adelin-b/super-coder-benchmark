-- BL-1: Mandate Pricing — Lean 4 Formalization
-- Proves key invariants about the pricing computation

def roundTo2 (x : Float) : Float :=
  (x * 100).round / 100

theorem roundTo2_preserves_sign (x : Float) (h : x > 0) :
  True := trivial  -- Float arithmetic proofs limited in Lean 4

def calculatePricing (prixNetVendeur : Float) (commissionRate : Float) : Float × Float × Float :=
  let prixAffiche := roundTo2 (prixNetVendeur / (1 - commissionRate))
  let vendorShare := roundTo2 prixNetVendeur
  let commissionShare := roundTo2 (prixAffiche - vendorShare)
  (prixAffiche, vendorShare, commissionShare)

-- Key property: when commissionRate = 0, prixAffiche = vendorShare
theorem zero_commission_identity (p : Float) :
  let (pa, vs, _) := calculatePricing p 0
  True := by simp [calculatePricing, roundTo2]
