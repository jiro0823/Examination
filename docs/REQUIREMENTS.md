# IT415 POS Kiosk Requirements Traceability

Audit date: 2026-10-07

## Evidence and Status Rules

- **VERIFIED** means an automated domain test or runtime check executed successfully.
- **IMPLEMENTED** means the source contains the behavior, but the relevant UI/runtime behavior has not been exercised.
- **UNVERIFIED** means the audit could not establish the behavior from an executed test.
- **OPTIONAL** means the feature is outside the required examination scope.

The current automated suite runs with `npm test` and contains 31 passing `node:test` cases. It imports `src/domain/pos.ts` directly; it does not execute `src/main.js` or a browser DOM. Runtime verification was blocked because `dist/domain/pos.js` is missing and the local TypeScript build tool could not be installed in the current offline/proxy environment.

## Required Examination Functionality

| Requirement | Status | Evidence / limitation |
|---|---|---|
| Six reference products and prices | VERIFIED | Product catalog assertion in `tests/pos.test.mjs`. |
| Product cards render and can be selected by tap/click | IMPLEMENTED | `src/main.js` renders product buttons and handles clicks; browser runtime unavailable. |
| Increase/decrease quantity and prevent non-positive quantities | VERIFIED | Domain quantity and boundary tests. |
| Explicitly remove a product | VERIFIED | Domain removal test verifies item removal and recalculated total. |
| Calculate item subtotals and transaction total from numeric values | VERIFIED | Reference cart, quantity, removal, and payment tests. |
| Empty order total is ₱0.00 and Review is disabled | IMPLEMENTED | Render logic derives total from empty cart and disables Review; DOM not exercised. |
| Review displays current order and total | IMPLEMENTED | Review renderer uses current cart; browser runtime unavailable. |
| Back from Review preserves cart, quantities, and total | VERIFIED | Domain navigation tests. |
| Cash, QR, and card methods are selectable | VERIFIED | Domain method selection tests; visible controls not exercised. |
| Insufficient cash is rejected without completing a transaction | VERIFIED | Domain payment test for ₱100 against ₱140. |
| Blank, malformed, negative, and non-finite cash is rejected | VERIFIED | Cash validation tests. |
| Exact cash produces zero change; excess cash calculates change | VERIFIED | Exact and overpayment tests. |
| Cash error feedback appears and UI stays on cash payment | IMPLEMENTED | UI handler displays insufficient-payment feedback and returns; DOM not exercised. |
| QR simulation records total paid and zero change | VERIFIED | QR transaction tests. |
| QR screen displays amount, placeholder, instructions, and confirmation | IMPLEMENTED | Elements exist in `index.html`; browser runtime unavailable. |
| Card simulation records total paid and zero change | VERIFIED | Card transaction tests. |
| Card processing feedback and duplicate-click guard | IMPLEMENTED | UI uses a processing flag, disabled button, and one completion callback; timing not exercised in a browser. |
| Successful completion creates one transaction and reference | VERIFIED | Completion, duplicate completion, and distinct-reference tests. |
| Success screen displays transaction fields and receipt action | IMPLEMENTED | `src/main.js` renders from completed transaction; browser runtime unavailable. |
| Receipt snapshot contains correct items and payment values | VERIFIED | Cash, QR, and card receipt snapshot tests. |
| Receipt UI displays all required fields | IMPLEMENTED | Receipt markup/rendering exists; browser runtime unavailable. |
| New Transaction resets domain transaction state | VERIFIED | Reset tests verify initial state and distinct subsequent reference. |
| New Transaction clears transient inputs, feedback, timer, and rendered receipt | IMPLEMENTED | Reset handler and empty-state renderers clear these values; browser runtime unavailable. |
| Touch targets, keyboard focus, accessible names, responsive layout | IMPLEMENTED | Source/CSS inspection only; interaction and viewport behavior not exercised. |

## Out of Scope

| Feature | Status |
|---|---|
| Real payment gateway | OPTIONAL |
| Database persistence | OPTIONAL |
| Authentication, inventory, admin panel, or analytics | OPTIONAL |

## Verification Blockers

- `node_modules` and `package-lock.json` are absent.
- `npm run typecheck`, `npm run lint`, and `npm run build` require unavailable local `tsc` / `eslint` executables.
- Effective npm offline mode is enabled, and the configured HTTP(S) proxy points to `127.0.0.1:9`; an online-overridden install failed with `ECONNREFUSED`.
- No development/start script is configured. The page requires an HTTP static host and a successful build because `src/main.js` imports `dist/domain/pos.js`.
