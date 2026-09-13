import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  determineIfOffline: vi.fn(),
  initiateSubscription: vi.fn(),
  modifySubscription: vi.fn(),
  restorePurchase: vi.fn(),
  verifyPayment: vi.fn(),
  updateAccount: vi.fn(),
  logError: vi.fn()
}));

vi.mock("@nucleum/client/runtime/connectivity", () => ({
  determineIfOffline: mocks.determineIfOffline
}));

vi.mock("@nucleum/persistence/persistence", () => ({
  persistenceInstance: {
    initiateSubscription: mocks.initiateSubscription,
    modifySubscription: mocks.modifySubscription,
    restorePurchase: mocks.restorePurchase,
    verifyPayment: mocks.verifyPayment
  }
}));

vi.mock("@nucleum/stores/account.store", () => ({
  default: {
    get: vi.fn(() => ({})),
    update: mocks.updateAccount
  }
}));

vi.mock("@nucleum/stores/commands/command-host", () => ({
  requireCommandHost: vi.fn(() => ({ runAction: vi.fn() }))
}));

vi.mock("@nucleum/client/runtime/account/plan.utils", () => ({
  determineIfPlanIsActive: vi.fn(() => true),
  determineIfSubscriptionExpired: vi.fn(() => ({
    isExpired: false,
    isWithinBuffer: false
  }))
}));

vi.mock("@nucleum/client/runtime/logging/logger", () => ({
  logger: { error: mocks.logError }
}));

import { subscription } from "@nucleum/application/subscription/subscription";

describe("subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.determineIfOffline.mockResolvedValue(false);
  });

  it.each([
    ["modifySubscription", mocks.modifySubscription, [{ type: "sync" }]],
    ["restorePurchase", mocks.restorePurchase, []],
    ["verifyPayment", mocks.verifyPayment, ["payment-nonce"]]
  ] as const)(
    "returns an unavailable result for offline %s calls",
    async (method, persistenceMethod, args) => {
      mocks.determineIfOffline.mockResolvedValue(true);

      const result = await (subscription[method] as (...input: any[]) => any)(
        ...args
      );

      expect(result).toEqual({ status: "unavailable", reason: "offline" });
      expect(persistenceMethod).not.toHaveBeenCalled();
    }
  );

  it("returns an unavailable result when payment verification fails", async () => {
    const failure = new Error("network unavailable");
    mocks.verifyPayment.mockRejectedValue(failure);

    await expect(subscription.verifyPayment("payment-nonce")).resolves.toEqual({
      status: "unavailable",
      reason: "request-failed"
    });
    expect(mocks.logError).toHaveBeenCalledWith({
      at: "verifyPayment",
      error: failure
    });
  });

  it("stores the verified plan and reports success", async () => {
    const plan = { id: "plan-1", plan: "NUCLEUS" };
    mocks.verifyPayment.mockResolvedValue({ id: "payment-1", userPlan: plan });

    await expect(subscription.verifyPayment("payment-nonce")).resolves.toEqual({
      status: "success"
    });
    expect(mocks.updateAccount).toHaveBeenCalledOnce();

    const update = mocks.updateAccount.mock.calls[0][0];
    expect(update({ plan: undefined })).toEqual({ plan });
  });
});
