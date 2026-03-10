import type { WalletClient, Account, Chain, Transport } from "viem";

/**
 * Payment requirements returned by a 402 response.
 */
export interface PaymentRequirements {
  x402Version: number;
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  recipient: string;
  extra?: {
    name?: string;
    description?: string;
    [key: string]: unknown;
  };
}

/**
 * Details passed to the onPayment callback before signing.
 */
export interface PaymentDetails {
  url: string;
  amount: string;
  asset: string;
  recipient: string;
  network: string;
  name?: string;
  description?: string;
}

/**
 * Signed payment payload sent in the X-PAYMENT header.
 */
export interface SignedPayment {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
  };
}

/**
 * Configuration options for createX402Fetch.
 */
export interface X402Config {
  /** Maximum payment amount in token units (e.g. "0.01"). Rejects payments above this. */
  maxPayment?: string;
  /** Callback invoked before a payment is signed. Useful for logging or user confirmation. */
  onPayment?: (details: PaymentDetails) => void | Promise<void>;
}

/**
 * A viem WalletClient with an account attached.
 */
export type X402WalletClient = WalletClient<Transport, Chain, Account>;

/**
 * Fetch function signature returned by createX402Fetch.
 */
export type X402Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
