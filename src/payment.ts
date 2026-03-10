import type { X402WalletClient, PaymentRequirements, SignedPayment } from "./types";

/** ERC-3009 TransferWithAuthorization EIP-712 types. */
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/**
 * Parse payment requirements from a 402 response.
 * Reads the JSON body and validates the required fields.
 */
export async function parsePaymentRequirements(
  response: Response,
): Promise<PaymentRequirements> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("x402-fetch: 402 response body is not valid JSON");
  }

  const data = body as Record<string, unknown>;

  if (typeof data.x402Version !== "number") {
    throw new Error("x402-fetch: missing or invalid x402Version in 402 response");
  }
  if (typeof data.scheme !== "string") {
    throw new Error("x402-fetch: missing or invalid scheme in 402 response");
  }
  if (typeof data.network !== "string") {
    throw new Error("x402-fetch: missing or invalid network in 402 response");
  }
  if (typeof data.amount !== "string") {
    throw new Error("x402-fetch: missing or invalid amount in 402 response");
  }
  if (typeof data.asset !== "string") {
    throw new Error("x402-fetch: missing or invalid asset in 402 response");
  }
  if (typeof data.recipient !== "string") {
    throw new Error("x402-fetch: missing or invalid recipient in 402 response");
  }

  return {
    x402Version: data.x402Version as number,
    scheme: data.scheme as string,
    network: data.network as string,
    amount: data.amount as string,
    asset: data.asset as string,
    recipient: data.recipient as string,
    extra: data.extra as PaymentRequirements["extra"],
  };
}

/**
 * Generate a random bytes32 nonce for ERC-3009.
 */
function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}` as `0x${string}`;
}

/**
 * Sign an ERC-3009 transferWithAuthorization using EIP-712 typed data.
 * Returns the signed payment object ready to be encoded as the X-PAYMENT header.
 */
export async function signPayment(
  wallet: X402WalletClient,
  requirements: PaymentRequirements,
): Promise<SignedPayment> {
  const from = wallet.account.address;
  const to = requirements.recipient as `0x${string}`;
  const value = requirements.amount;
  const validAfter = "0";
  const validBefore = String(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
  const nonce = randomNonce();

  const signature = await wallet.signTypedData({
    domain: {
      name: "USD Coin",
      version: "2",
      chainId: wallet.chain!.id,
      verifyingContract: requirements.asset as `0x${string}`,
    },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from,
      to,
      value: BigInt(value),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce,
    },
  });

  return {
    x402Version: requirements.x402Version,
    scheme: requirements.scheme,
    network: requirements.network,
    payload: {
      signature,
      authorization: {
        from,
        to,
        value,
        validAfter,
        validBefore,
        nonce,
      },
    },
  };
}

/**
 * Encode a signed payment as a base64 string for the X-PAYMENT header.
 */
export function encodePaymentHeader(payment: SignedPayment): string {
  const json = JSON.stringify(payment);
  return btoa(json);
}
