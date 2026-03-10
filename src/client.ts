import type { X402WalletClient, X402Config, X402Fetch, PaymentDetails } from "./types";
import { parsePaymentRequirements, signPayment, encodePaymentHeader } from "./payment";

/**
 * Create a fetch wrapper that automatically handles HTTP 402 payment flows.
 *
 * On a 402 response, the wrapper parses payment requirements, signs an ERC-3009
 * transferWithAuthorization with the provided viem wallet client, and retries the
 * request with the signed payment in the X-PAYMENT header.
 *
 * Non-402 responses pass through unchanged.
 */
export function createX402Fetch(
  wallet: X402WalletClient,
  config: X402Config = {},
): X402Fetch {
  const { maxPayment, onPayment } = config;

  return async function x402Fetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    const response = await fetch(input, init);

    if (response.status !== 402) {
      return response;
    }

    const requirements = await parsePaymentRequirements(response);

    // Enforce max payment limit
    if (maxPayment !== undefined) {
      const requested = parseFloat(requirements.amount);
      const limit = parseFloat(maxPayment);
      if (isNaN(requested) || isNaN(limit)) {
        throw new Error(
          `x402-fetch: unable to compare payment amounts (requested: ${requirements.amount}, limit: ${maxPayment})`,
        );
      }
      if (requested > limit) {
        throw new Error(
          `x402-fetch: payment of ${requirements.amount} exceeds maxPayment limit of ${maxPayment}`,
        );
      }
    }

    // Invoke callback before signing
    if (onPayment) {
      const details: PaymentDetails = {
        url: typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
        amount: requirements.amount,
        asset: requirements.asset,
        recipient: requirements.recipient,
        network: requirements.network,
        name: requirements.extra?.name as string | undefined,
        description: requirements.extra?.description as string | undefined,
      };
      await onPayment(details);
    }

    const signed = await signPayment(wallet, requirements);
    const paymentHeader = encodePaymentHeader(signed);

    // Rebuild headers with X-PAYMENT
    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set("X-PAYMENT", paymentHeader);

    return fetch(input, {
      ...init,
      headers: retryHeaders,
    });
  };
}
