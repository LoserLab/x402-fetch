import type { PaymentRequirements } from "../../src/types";

/** Valid 402 payment requirements body. */
export const VALID_PAYMENT_REQUIREMENTS: PaymentRequirements = {
  x402Version: 1,
  scheme: "exact",
  network: "eip155:2741",
  amount: "1000",
  asset: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  extra: {
    name: "API Access",
    description: "Pay to access this endpoint",
  },
};

/** A 402 payment requirements body with a large amount. */
export const EXPENSIVE_PAYMENT_REQUIREMENTS: PaymentRequirements = {
  ...VALID_PAYMENT_REQUIREMENTS,
  amount: "5000000",
};

/** Create a mock 402 Response with the given payment requirements. */
export function mock402Response(
  requirements: PaymentRequirements = VALID_PAYMENT_REQUIREMENTS,
): Response {
  return new Response(JSON.stringify(requirements), {
    status: 402,
    statusText: "Payment Required",
    headers: { "Content-Type": "application/json" },
  });
}

/** Create a mock 200 OK Response. */
export function mock200Response(body: unknown = { data: "premium content" }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "application/json" },
  });
}

/** Create a mock 402 Response with invalid (non-JSON) body. */
export function mockInvalid402Response(): Response {
  return new Response("Not JSON", {
    status: 402,
    statusText: "Payment Required",
    headers: { "Content-Type": "text/plain" },
  });
}

/** Create a mock 402 Response with missing required fields. */
export function mockIncomplete402Response(): Response {
  return new Response(JSON.stringify({ x402Version: 1 }), {
    status: 402,
    statusText: "Payment Required",
    headers: { "Content-Type": "application/json" },
  });
}
