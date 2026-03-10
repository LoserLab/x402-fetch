import { describe, it, expect, vi, beforeEach } from "vitest";
import { createX402Fetch } from "../src/client";
import type { X402WalletClient } from "../src/types";
import {
  VALID_PAYMENT_REQUIREMENTS,
  EXPENSIVE_PAYMENT_REQUIREMENTS,
  mock200Response,
} from "./fixtures/responses";

/** Create a mock wallet client. */
function mockWallet(overrides: Partial<X402WalletClient> = {}): X402WalletClient {
  return {
    account: {
      address: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
      type: "local",
      source: "privateKey",
      publicKey: "0x00" as `0x${string}`,
      signMessage: vi.fn(),
      signTransaction: vi.fn(),
      signTypedData: vi.fn(),
      nonceManager: undefined,
    },
    chain: { id: 2741, name: "Abstract Testnet" } as X402WalletClient["chain"],
    signTypedData: vi.fn().mockResolvedValue("0xmocksignature"),
    ...overrides,
  } as unknown as X402WalletClient;
}

describe("createX402Fetch", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  it("passes through 200 responses unchanged", async () => {
    const okResponse = mock200Response({ result: "ok" });
    fetchSpy.mockResolvedValueOnce(okResponse);

    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet);
    const res = await x402fetch("https://api.example.com/data");

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("passes through non-402 error responses unchanged", async () => {
    const errorResponse = new Response("Not Found", { status: 404 });
    fetchSpy.mockResolvedValueOnce(errorResponse);

    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet);
    const res = await x402fetch("https://api.example.com/missing");

    expect(res.status).toBe(404);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("handles 402 response by signing payment and retrying", async () => {
    const paymentResponse = new Response(JSON.stringify(VALID_PAYMENT_REQUIREMENTS), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
    const successResponse = mock200Response({ premium: true });

    fetchSpy.mockResolvedValueOnce(paymentResponse).mockResolvedValueOnce(successResponse);

    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet);
    const res = await x402fetch("https://api.example.com/premium");

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(wallet.signTypedData).toHaveBeenCalledOnce();
  });

  it("sets X-PAYMENT header on retry request", async () => {
    const paymentResponse = new Response(JSON.stringify(VALID_PAYMENT_REQUIREMENTS), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
    const successResponse = mock200Response();

    fetchSpy.mockResolvedValueOnce(paymentResponse).mockResolvedValueOnce(successResponse);

    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet);
    await x402fetch("https://api.example.com/premium");

    const retryCall = fetchSpy.mock.calls[1];
    const retryInit = retryCall[1] as RequestInit;
    const headers = new Headers(retryInit.headers);

    expect(headers.has("X-PAYMENT")).toBe(true);

    // Verify the header decodes to valid JSON with expected structure
    const decoded = JSON.parse(atob(headers.get("X-PAYMENT")!));
    expect(decoded.x402Version).toBe(1);
    expect(decoded.scheme).toBe("exact");
    expect(decoded.payload.signature).toBe("0xmocksignature");
  });

  it("preserves original request headers on retry", async () => {
    const paymentResponse = new Response(JSON.stringify(VALID_PAYMENT_REQUIREMENTS), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
    const successResponse = mock200Response();

    fetchSpy.mockResolvedValueOnce(paymentResponse).mockResolvedValueOnce(successResponse);

    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet);
    await x402fetch("https://api.example.com/premium", {
      headers: { Authorization: "Bearer token123" },
    });

    const retryCall = fetchSpy.mock.calls[1];
    const retryInit = retryCall[1] as RequestInit;
    const headers = new Headers(retryInit.headers);

    expect(headers.get("Authorization")).toBe("Bearer token123");
    expect(headers.has("X-PAYMENT")).toBe(true);
  });

  it("enforces maxPayment limit", async () => {
    const paymentResponse = new Response(JSON.stringify(EXPENSIVE_PAYMENT_REQUIREMENTS), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });

    fetchSpy.mockResolvedValueOnce(paymentResponse);

    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet, { maxPayment: "1000" });

    await expect(x402fetch("https://api.example.com/expensive")).rejects.toThrow(
      "exceeds maxPayment limit",
    );
    expect(wallet.signTypedData).not.toHaveBeenCalled();
  });

  it("allows payment within maxPayment limit", async () => {
    const paymentResponse = new Response(JSON.stringify(VALID_PAYMENT_REQUIREMENTS), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
    const successResponse = mock200Response();

    fetchSpy.mockResolvedValueOnce(paymentResponse).mockResolvedValueOnce(successResponse);

    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet, { maxPayment: "5000" });
    const res = await x402fetch("https://api.example.com/premium");

    expect(res.status).toBe(200);
  });

  it("calls onPayment callback before signing", async () => {
    const paymentResponse = new Response(JSON.stringify(VALID_PAYMENT_REQUIREMENTS), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
    const successResponse = mock200Response();

    fetchSpy.mockResolvedValueOnce(paymentResponse).mockResolvedValueOnce(successResponse);

    const onPayment = vi.fn();
    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet, { onPayment });
    await x402fetch("https://api.example.com/premium");

    expect(onPayment).toHaveBeenCalledOnce();
    expect(onPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://api.example.com/premium",
        amount: "1000",
        asset: VALID_PAYMENT_REQUIREMENTS.asset,
        recipient: VALID_PAYMENT_REQUIREMENTS.recipient,
        network: "eip155:2741",
        name: "API Access",
        description: "Pay to access this endpoint",
      }),
    );
  });

  it("does not call onPayment for non-402 responses", async () => {
    const okResponse = mock200Response();
    fetchSpy.mockResolvedValueOnce(okResponse);

    const onPayment = vi.fn();
    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet, { onPayment });
    await x402fetch("https://api.example.com/free");

    expect(onPayment).not.toHaveBeenCalled();
  });

  it("throws on invalid 402 response body", async () => {
    const badResponse = new Response("not json", { status: 402 });
    fetchSpy.mockResolvedValueOnce(badResponse);

    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet);

    await expect(x402fetch("https://api.example.com/broken")).rejects.toThrow(
      "not valid JSON",
    );
  });

  it("throws on incomplete 402 response body", async () => {
    const incompleteResponse = new Response(JSON.stringify({ x402Version: 1 }), {
      status: 402,
    });
    fetchSpy.mockResolvedValueOnce(incompleteResponse);

    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet);

    await expect(x402fetch("https://api.example.com/incomplete")).rejects.toThrow(
      "missing or invalid",
    );
  });

  it("passes URL objects correctly", async () => {
    const paymentResponse = new Response(JSON.stringify(VALID_PAYMENT_REQUIREMENTS), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
    const successResponse = mock200Response();

    fetchSpy.mockResolvedValueOnce(paymentResponse).mockResolvedValueOnce(successResponse);

    const onPayment = vi.fn();
    const wallet = mockWallet();
    const x402fetch = createX402Fetch(wallet, { onPayment });
    await x402fetch(new URL("https://api.example.com/url-object"));

    expect(onPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://api.example.com/url-object",
      }),
    );
  });
});
