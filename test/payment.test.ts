import { describe, it, expect } from "vitest";
import { parsePaymentRequirements, encodePaymentHeader } from "../src/payment";
import type { SignedPayment } from "../src/types";
import {
  VALID_PAYMENT_REQUIREMENTS,
  mock402Response,
  mockInvalid402Response,
  mockIncomplete402Response,
} from "./fixtures/responses";

describe("parsePaymentRequirements", () => {
  it("parses a valid 402 response body", async () => {
    const response = mock402Response();
    const requirements = await parsePaymentRequirements(response);

    expect(requirements.x402Version).toBe(1);
    expect(requirements.scheme).toBe("exact");
    expect(requirements.network).toBe("eip155:2741");
    expect(requirements.amount).toBe("1000");
    expect(requirements.asset).toBe("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
    expect(requirements.recipient).toBe("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  });

  it("includes extra fields when present", async () => {
    const response = mock402Response();
    const requirements = await parsePaymentRequirements(response);

    expect(requirements.extra?.name).toBe("API Access");
    expect(requirements.extra?.description).toBe("Pay to access this endpoint");
  });

  it("handles missing extra fields gracefully", async () => {
    const { extra: _, ...noExtra } = VALID_PAYMENT_REQUIREMENTS;
    const response = new Response(JSON.stringify(noExtra), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });

    const requirements = await parsePaymentRequirements(response);
    expect(requirements.extra).toBeUndefined();
  });

  it("throws on non-JSON 402 response", async () => {
    const response = mockInvalid402Response();
    await expect(parsePaymentRequirements(response)).rejects.toThrow(
      "402 response body is not valid JSON",
    );
  });

  it("throws on missing scheme field", async () => {
    const { scheme: _, ...incomplete } = VALID_PAYMENT_REQUIREMENTS;
    const response = new Response(JSON.stringify(incomplete), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });

    await expect(parsePaymentRequirements(response)).rejects.toThrow(
      "missing or invalid scheme",
    );
  });

  it("throws on missing network field", async () => {
    const { network: _, ...incomplete } = VALID_PAYMENT_REQUIREMENTS;
    const response = new Response(JSON.stringify(incomplete), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });

    await expect(parsePaymentRequirements(response)).rejects.toThrow(
      "missing or invalid network",
    );
  });

  it("throws on missing amount field", async () => {
    const { amount: _, ...incomplete } = VALID_PAYMENT_REQUIREMENTS;
    const response = new Response(JSON.stringify(incomplete), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });

    await expect(parsePaymentRequirements(response)).rejects.toThrow(
      "missing or invalid amount",
    );
  });

  it("throws on missing asset field", async () => {
    const { asset: _, ...incomplete } = VALID_PAYMENT_REQUIREMENTS;
    const response = new Response(JSON.stringify(incomplete), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });

    await expect(parsePaymentRequirements(response)).rejects.toThrow(
      "missing or invalid asset",
    );
  });

  it("throws on missing recipient field", async () => {
    const { recipient: _, ...incomplete } = VALID_PAYMENT_REQUIREMENTS;
    const response = new Response(JSON.stringify(incomplete), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });

    await expect(parsePaymentRequirements(response)).rejects.toThrow(
      "missing or invalid recipient",
    );
  });

  it("throws on missing x402Version field", async () => {
    const response = mockIncomplete402Response();
    await expect(parsePaymentRequirements(response)).rejects.toThrow(
      "missing or invalid scheme",
    );
  });
});

describe("encodePaymentHeader", () => {
  it("encodes a signed payment as base64 JSON", () => {
    const payment: SignedPayment = {
      x402Version: 1,
      scheme: "exact",
      network: "eip155:2741",
      payload: {
        signature: "0xabcdef1234567890",
        authorization: {
          from: "0xaaaa",
          to: "0xbbbb",
          value: "1000",
          validAfter: "0",
          validBefore: "9999999999",
          nonce: "0x1234",
        },
      },
    };

    const encoded = encodePaymentHeader(payment);
    const decoded = JSON.parse(atob(encoded));

    expect(decoded.x402Version).toBe(1);
    expect(decoded.scheme).toBe("exact");
    expect(decoded.payload.signature).toBe("0xabcdef1234567890");
    expect(decoded.payload.authorization.from).toBe("0xaaaa");
    expect(decoded.payload.authorization.value).toBe("1000");
  });

  it("produces a valid base64 string", () => {
    const payment: SignedPayment = {
      x402Version: 1,
      scheme: "exact",
      network: "eip155:2741",
      payload: {
        signature: "0x00",
        authorization: {
          from: "0x00",
          to: "0x00",
          value: "0",
          validAfter: "0",
          validBefore: "0",
          nonce: "0x00",
        },
      },
    };

    const encoded = encodePaymentHeader(payment);
    // Should not throw when decoding
    expect(() => atob(encoded)).not.toThrow();
    expect(JSON.parse(atob(encoded))).toEqual(payment);
  });
});
