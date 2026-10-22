# Financial regression checks

Run from the repository root:

```sh
python3 tests/financial_checks.py
```

Requires Python 3, Python Playwright, and Chromium at `/usr/bin/chromium`, all available in the prepared cloud environment. The script intercepts its test page locally; it does not need a running HTTP server or Supabase credentials. It exits nonzero if any check fails and writes detailed JSON results into a temporary directory.

The 45 checks use synthetic records and the application's actual JavaScript in Chromium. Test-only references to existing functions are injected into the served response. No financial formulas are substituted. All test state lives in an isolated browser context. The original source file is never instrumented on disk.

Coverage includes moving average cost after restocking and stock depletion; late freight; supplier returns and exchanges; cancellation advances and actual refunds; dated payment installments and persistence; old single-item records; locked costs and period closing; funded-day partner distributions; printed balance-sheet totals; subscriptions and partner-paid expenses; Facebook credit and spending; and purchase/sale save handlers followed by a full page reload.

Never add customer backups, authentication settings, or real financial records as test fixtures. The user's backup and its analysis remain outside the repository.
