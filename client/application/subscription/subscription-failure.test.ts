import { describe, expect, it, vi } from "vitest";

vi.mock("@nucleum/client/runtime/connectivity", () => ({
  determineIfOffline: async () => false
}));
vi.mock("@nucleum/persistence/persistence", () => ({
  persistenceInstance: {
    initiateSubscription: async () => undefined,
    modifySubscription: async () => undefined,
    restorePurchase: async () => undefined,
    verifyPayment: async () => undefined
  }
}));
vi.mock("@nucleum/stores/account.store", () => ({
  default: { get: vi.fn(() => ({})), update: vi.fn() }
}));

import { subscription } from "./subscription";

describe("subscription transport failure contract", () => {
  it.each([
    ["initiateSubscription", () => subscription.initiateSubscription({})],
    ["modifySubscription", () => subscription.modifySubscription({})],
    ["restorePurchase", () => subscription.restorePurchase()],
    ["verifyPayment", () => subscription.verifyPayment("nonce")]
  ] as const)(
    "normalizes swallowed persistence failures for %s",
    async (_, run) => {
      await expect(run()).resolves.toEqual({
        status: "unavailable",
        reason: "request-failed"
      });
    }
  );
});
