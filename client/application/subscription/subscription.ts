import { requireCommandHost } from "@nucleum/stores/commands/command-host";
import { type IUserPlan } from "@nucleum/schema/account/subscription";

import { determineIfOffline } from "@nucleum/client/runtime/connectivity";

import {
  determineIfPlanIsActive,
  determineIfSubscriptionExpired
} from "@nucleum/client/runtime/account/plan.utils";

import { logger } from "@nucleum/client/runtime/logging/logger";

import { Action } from "@nucleum/client/config/action.enum";

import account from "@nucleum/stores/account.store";
import { persistenceInstance } from "@nucleum/persistence/persistence";

function unavailableResult(reason: "offline" | "request-failed") {
  return { status: "unavailable" as const, reason };
}

/** Owns subscription mutations and their application presentation. */
export const subscription = {
  async handlePlanStatus(plan: IUserPlan) {
    const isActive = determineIfPlanIsActive(plan);
    if (!isActive) {
      requireCommandHost().runAction(Action.INACTIVE_PLAN);
    }
    let expiry = determineIfSubscriptionExpired(plan);
    if (!expiry.isExpired) return;
    await this.modifySubscription({
      type: "sync"
    });
    plan = account.get()?.plan ?? plan;
    expiry = determineIfSubscriptionExpired(plan);
    if (!expiry.isExpired) return;
    if (!expiry.isWithinBuffer) {
      requireCommandHost().runAction(Action.INACTIVE_PLAN);
    }
  },
  async initiateSubscription(params: any) {
    try {
      const isOffline = await determineIfOffline();
      if (isOffline) return unavailableResult("offline");
      const response = await persistenceInstance.initiateSubscription(params);
      return response || unavailableResult("request-failed");
    } catch (e) {
      logger.error({ at: "initiateSubscription", error: e });
      return unavailableResult("request-failed");
    }
  },
  async modifySubscription(params: any) {
    try {
      const isOffline = await determineIfOffline();
      if (isOffline) return unavailableResult("offline");
      const response = await persistenceInstance.modifySubscription(params);
      if (response && response.userPlan) {
        account.update((n) => {
          n.plan = response.userPlan;
          return n;
        });
      }
      return response || unavailableResult("request-failed");
    } catch (e) {
      logger.error({ at: "modifySubscription", error: e });
      return unavailableResult("request-failed");
    }
  },
  async restorePurchase() {
    try {
      const isOffline = await determineIfOffline();
      if (isOffline) return unavailableResult("offline");
      const response = await persistenceInstance.restorePurchase();
      if (response && response.userPlan) {
        account.update((n) => {
          n.plan = response.userPlan;
          return n;
        });
      }
      return response || unavailableResult("request-failed");
    } catch (e) {
      logger.error({ at: "restorePurchase", error: e });
      return unavailableResult("request-failed");
    }
  },
  async verifyPayment(nonce: string, embedTransaction?: any) {
    try {
      const isOffline = await determineIfOffline();
      if (isOffline) return unavailableResult("offline");
      const response = await persistenceInstance.verifyPayment(
        nonce,
        embedTransaction
      );
      if (response && response.id) {
        const plan = response.userPlan ?? response;
        account.update((n) => {
          n.plan = plan;
          return n;
        });
        return { status: "success" };
      }
      return response || unavailableResult("request-failed");
    } catch (e) {
      logger.error({ at: "verifyPayment", error: e });
      return unavailableResult("request-failed");
    }
  }
};
