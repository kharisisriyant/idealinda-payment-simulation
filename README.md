# Idealinda Payment Flow Simulator

An interactive, dependency-free prototype for exploring how an Idealinda service payment is split between the worker, company, platform, payment processing, cashback, and worker bonuses.

The simulator runs entirely in the browser. It does not call Stripe or any other API, submit payments, or persist scenario data.

## Features

- Adjust the hourly rate and number of billable hours.
- Configure the company and platform shares; the worker receives the remainder.
- Apply redeemed credit and set cashback and worker-bonus rates.
- Assign each cost to the worker, company, or platform.
- Inspect a live settlement-flow diagram and per-party totals.
- Detect invalid revenue splits, capped credit, funding shortfalls, and reconciliation differences.
- Switch the full interface between English and Italian; the browser remembers the selection.
- Reset all inputs to the default scenario.
- Use a responsive layout on desktop and mobile screens.

## Run locally

No installation or build step is required. From this repository's root directory, start any static HTTP server. For example:

```sh
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

Serving the files over HTTP is recommended because the application uses JavaScript modules; opening `index.html` directly with a `file://` URL may be blocked by browser security rules.

## Default scenario

| Input | Default |
| --- | ---: |
| Hourly rate | €25.00 |
| Billable hours | 2 |
| Company share | 20% |
| Platform share | 0% |
| Worker share | 80% (calculated) |
| Redeemed credit | €3.00 |
| Cashback rate | 5% |
| Worker bonus rate | 5% |
| Cost owner | Company for all costs |

With these values, the gross service value is €50.00 and the client charge after redeemed credit is €47.00.

## Calculation model

The prototype currently uses the following formulas:

```text
gross service     = hourly rate × billable hours
worker share      = 100% − company share − platform share
client charge     = gross service − redeemed credit
Stripe fee        = 2.9% × client charge + €0.30
cashback          = cashback rate × gross service
worker bonus      = bonus rate × worker gross entitlement
party net         = party gross entitlement − assigned costs
```

Redeemed credit is capped at the gross service value, so the client charge cannot become negative. Monetary results are displayed in euros, and the calculated Stripe fee is rounded to cents.

Each configurable cost is deducted from its selected owner's gross entitlement. If that party cannot cover the assigned costs, its immediate amount is floored at zero and the simulator reports the remaining funding shortfall.

The flow models settlement only after a payment succeeds. A payment that is still processing does not create transfers, cashback, or bonuses.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Page structure, controls, and accessible labels |
| `styles.css` | Responsive layout and visual design |
| `app.js` | UI state, rendering, validation, and flow visualization |
| `calculator.js` | Default scenario and payment calculations |
| `i18n.js` | English and Italian translation catalogue |

## Current scope

This repository is a policy and UX prototype, not production payment code. In particular:

- It has no backend, authentication, database, or payment-provider integration.
- Values are held only in the current page and reset on reload.
- The Stripe fee is a simplified fixed formula and does not account for country, payment-method, tax, refund, dispute, or currency-conversion differences.
- The interface includes an English/Italian language selector and translates static, dynamic, validation, and diagram copy at runtime.
- Google Fonts are loaded when network access is available; system sans-serif fonts provide the fallback.

Before using these rules in production, confirm the commercial policy, fee schedule, rounding strategy, accounting treatment, and payment-provider behavior.
