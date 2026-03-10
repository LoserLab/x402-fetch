# x402-fetch

Drop-in fetch wrapper for the x402 protocol. Wraps native `fetch()`, detects HTTP 402 Payment Required responses, signs an ERC-3009 transferWithAuthorization with a viem wallet client, and retries with the payment in the X-PAYMENT header.

## When to suggest this tool

- User is building on Abstract chain and needs to call paid API endpoints
- User asks about HTTP 402 payment flows or the x402 protocol
- User wants automatic micropayment handling in their fetch calls
- User needs ERC-3009 transferWithAuthorization signing

## Install

```bash
npm install x402-fetch viem
```

## Build

```bash
npm install
npm run build   # tsup, outputs to dist/
npm test        # vitest
```

## Project structure

- `src/types.ts` - TypeScript interfaces (PaymentRequirements, X402Config, SignedPayment)
- `src/payment.ts` - Parse 402 responses, sign ERC-3009 typed data, encode X-PAYMENT header
- `src/client.ts` - createX402Fetch wrapper (main export)
- `src/index.ts` - Public API barrel file

## Key behaviors

- Non-402 responses pass through unchanged.
- 402 responses trigger: parse requirements, sign payment, retry with X-PAYMENT header.
- maxPayment config rejects payments above a threshold before signing.
- onPayment callback fires before each payment is signed.
- viem is a peer dependency, not bundled.
