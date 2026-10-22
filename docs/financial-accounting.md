# Financial accounting changes in v168

The previous cost calculation averaged every historical purchase while retaining old sale cost stamps. Selling out a batch and restocking at a different price could inflate profit and leave book inventory value after the quantity reached zero. The new calculation uses one dated moving-average ledger for sale costs, supplier return costs, and remaining inventory value.

## Cost and date rules

- The cost pool is separate for each item, color, and size. Purchases add quantity, invoice cost, and allocated inward transport. Delivered sale quantities remove cost at the average available on their delivery date.
- Supplier returns remove their book cost. The difference between that cost and the supplier's credit is a return or exchange loss/gain. An exchange loss already encoded in legacy `xloss` is included in the credit calculation, so it is not charged twice.
- Backdated inward transport follows its existing purchase allocation. Its sold portion reaches cost of sales; it cannot become inventory value for an already depleted batch.
- Legacy records lack reliable intraday transaction timestamps. Purchases are processed before supplier returns, then deliveries on the same date; records within each category retain their array order. `at` is a modification timestamp and is not treated as the transaction time.
- Open-period costs are recalculated from these dated movements without rewriting the saved records on load. A later-dated purchase cannot change an earlier sale's cost. Correcting an earlier movement can change subsequent open-period costs.
- Existing closed periods retain their saved costs. When the user explicitly closes a period, the current computed sale costs and supplier return costs are saved before the lock is applied. Residual inventory value without quantity from an old locked period is surfaced in the accounting audit rather than silently written off.
- Refusal shipping charges are included in the refusal month, using `cancelledAt`, with the original order date as a fallback for legacy records that have no refusal date.

## Cash and customer advances

Cancelling an order does not imply that a refund was paid. A direct customer advance remains in cash and in the customer's credit balance until an actual cash-out/refund entry is recorded.

New direct collections append dated `receipts` to the sale and maintain the legacy `paid` total. The cash ledger uses individual receipt dates. Legacy orders remain readable using their existing `date`, `dep`, and `paidAt`. Dates already overwritten by older versions cannot be recovered from a backup and are not fabricated. Explicit corrections to a saved collection total are recorded as dated adjustments.

## Reports and distributions

- Inventory screens and the financial balance sheet use the same cost ledger.
- The printed balance sheet includes prepaid expenses and partner expense payables. Monetary amounts are printed to two decimals, including small balances.
- The reconciliation detail includes prepaid expenses and partner payables as well.
- Forecast profit on the dashboard is explicitly labelled as a forecast. The actual financial income statement continues to recognize delivered sales.
- Partner weights exclude days with no invested capital. A distribution period with no capital is rejected instead of assigning an undistributed amount to the first partner.
- Fixed expense accounting has not changed: subscriptions are recognized over their recorded service duration. The existing 90-day startup-cost allocation is labelled as a pricing estimate; it does not replace the income statement's expense recognition.

## Review, rollout, and rollback

This change is prepared on a separate branch. It does not change the live site, merge into `main`, or write to any Supabase database. Real customer backups and their financial analysis are excluded from the repository.

Review the change and the before/after analysis before deploying. Keep the original JSON backup and the prior HTML version. Validate in a separate browser profile/origin with a copy of the data so the test cannot write to the operational browser storage or production sync project.

Use the same application version across staff devices when adopting the change. Older clients do not understand the new receipt history and can still replace aggregate payment fields. Returning to v167 restores its old calculations and loses the per-installment date view; retain a current JSON export if testing records receipts or closes a period. Reverting the HTML alone is not a data rollback.

Validation: `python3 tests/financial_checks.py` exercises the financial scenarios and browser persistence. The private backup was separately replayed with an independent accounting implementation, matching every delivered order's cost and closing inventory under the stated same-day ordering rule.
