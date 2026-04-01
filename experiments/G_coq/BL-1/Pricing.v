(* BL-1: Mandate Pricing — Coq Formalization *)
(* Proves invariants on integer-scaled pricing (cents) *)

From Stdlib Require Import ZArith Lia.
Open Scope Z_scope.

(* Work in cents to avoid real number complexity *)
Definition calculate_prix_affiche (net_cents : Z) (comm_rate_bps : Z) : Z :=
  (* comm_rate_bps is in basis points (e.g., 500 = 5%) *)
  (* prixAffiche = net / (1 - rate) = net * 10000 / (10000 - rate_bps) *)
  (net_cents * 10000) / (10000 - comm_rate_bps).

Definition commission_share (prix_affiche net_cents : Z) : Z :=
  prix_affiche - net_cents.

(* INV2: prixAffiche >= prixNetVendeur when commission >= 0 *)
Theorem prix_geq_net : forall net rate,
  net > 0 -> 0 <= rate -> rate < 10000 ->
  calculate_prix_affiche net rate >= net.
Proof.
  intros net rate Hnet Hrate Hlt.
  unfold calculate_prix_affiche.
  apply Z.le_ge.
  apply Z.div_le_lower_bound.
  - lia.
  - nia.
Qed.

(* INV3: commission_share >= 0 when rate >= 0 *)
Theorem commission_non_negative : forall net rate,
  net > 0 -> 0 <= rate -> rate < 10000 ->
  commission_share (calculate_prix_affiche net rate) net >= 0.
Proof.
  intros. unfold commission_share.
  assert (Hge: calculate_prix_affiche net rate >= net) by (apply prix_geq_net; assumption).
  lia.
Qed.

(* INV5: zero commission → prix = net *)
Theorem zero_commission : forall net,
  net > 0 ->
  calculate_prix_affiche net 0 = net.
Proof.
  intros net Hnet. unfold calculate_prix_affiche.
  (* net * 10000 / (10000 - 0) = net * 10000 / 10000 = net *)
  replace (10000 - 0) with 10000 by lia.
  apply Z.div_mul. lia.
Qed.
