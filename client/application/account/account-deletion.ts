import { navigation } from "@21n/layout/navigation/navigation";
import { get } from "svelte/store";

import { performApiCall } from "@21n/utils/network.utils";

import {
  confirmationNotification,
  toasts
} from "@nucleum/stores/notification.store";
import { ButtonVariant } from "@21n/elements/button/button.type";
import { appStore } from "@nucleum/stores/app.store";
import { hasLegacyCloudSession } from "@21n/utils/account.utils";

import {
  clientStorage,
  deleteIndexedDbDatabase
} from "@nucleum/persistence/persistence.utils";
import { ClientStorageKey } from "@nucleum/persistence/persistence.type";
import { logger } from "@nucleum/client/runtime/logging/logger";

import { clearDatafnLocalData } from "@nucleum/datafn/datafn.store";

import { dispatchCustomEvent } from "@21n/utils/browser.utils";
import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";

import { clearLegacySurrealLocalData } from "@nucleum/persistence/legacyLocalDataBackup";
import account from "@nucleum/stores/account.store";

/** Owns account deletion confirmation and durable cleanup. */
export const accountDeletion = {
  async delete() {
    confirmationNotification.notify({
      title: "Account deletion confirmation",
      message: "Are you sure you want to delete your account?",
      confirmAction: {
        label: "Delete",
        variant: ButtonVariant.DANGER,
        callback: async () => {
          return this.confirmDelete();
        }
      }
    });
  },
  async confirmDelete() {
    let isDeleted = false;
    try {
      dispatchCustomEvent(GlobalEvent.APP_LOADING_STATUS, {
        message: `Deleting account...`
      });
      const authFnDeleteStatus = await this.tryConfirmAuthFnDelete();
      if (authFnDeleteStatus === "failed") {
        return false;
      }
      if (authFnDeleteStatus === "deleted") {
        await this.completeConfirmedAccountDeletion();
        isDeleted = true;
        return true;
      }

      const result = await performApiCall(
        "v2/account/deleteAccount",
        "POST",
        {}
      );
      if (!result?.ok) {
        toasts.error("Failed to delete account. Please try again later.");
        return false;
      }
      const data = await result.json();
      if (data?.error) {
        toasts.error(data.error);
        return false;
      }
      await this.completeConfirmedAccountDeletion();
      isDeleted = true;
      return true;
    } catch (e) {
      logger.error({ at: "confirmDelete", error: e });
      toasts.error("Failed to delete account. Please try again later.");
      return false;
    } finally {
      dispatchCustomEvent(GlobalEvent.APP_LOADING_STATUS, {
        message: isDeleted ? `Account deleted.` : "Account deletion failed.",
        subMessage: "",
        isFinished: true
      });
    }
  },
  async completeConfirmedAccountDeletion() {
    const cleanupOperations = [
      ["datafn", () => clearDatafnLocalData()],
      ["legacy", () => this.clearLegacyFluxLocalData()]
    ] as const;
    for (const [name, operation] of cleanupOperations) {
      try {
        await operation();
      } catch (error) {
        logger.error({ at: `accountDeletion.delete.cleanup.${name}`, error });
      }
    }
    await account.signOut({ isPreventRedirect: true });
    navigation.gotoPath("/signup?msg=deleted");
  },
  async clearLegacyFluxLocalData() {
    const accountData = account.get();
    const dapId = await clientStorage.get(ClientStorageKey.DAP_ID);
    const cleanupErrors: unknown[] = [];
    const identities = new Set(
      [accountData.userId, accountData.userInfo?.id, dapId]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.replace(/^user:/, ""))
    );
    const product = get(appStore).product;
    const databaseNames = new Set<string>();
    for (const identity of identities) {
      const prefix = `${identity}-1`;
      databaseNames.add(prefix);
    }
    const indexedDb = indexedDB as IDBFactory & {
      databases?: () => Promise<Array<{ name?: string }>>;
    };
    const listedDatabases =
      typeof indexedDb.databases === "function"
        ? await indexedDb.databases().catch(() => [])
        : [];
    for (const database of listedDatabases ?? []) {
      const databaseName = database.name;
      if (
        databaseName &&
        Array.from(identities).some((identity) => {
          const prefix = `${identity}-1-`;
          return (
            databaseName === `${identity}-1` ||
            (databaseName.startsWith(prefix) &&
              databaseName.endsWith("-search")) ||
            (databaseName.startsWith(`searchfn-${prefix}`) &&
              databaseName.endsWith("-search"))
          );
        })
      ) {
        databaseNames.add(databaseName);
      }
    }
    const deletionResults = await Promise.allSettled(
      Array.from(databaseNames, (name) => deleteIndexedDbDatabase(name))
    );
    cleanupErrors.push(
      ...deletionResults
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected"
        )
        .map((result) => result.reason)
    );
    try {
      await clearLegacySurrealLocalData(product, Array.from(identities));
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length) {
      throw new Error(
        cleanupErrors
          .map((error) =>
            error instanceof Error ? error.message : String(error)
          )
          .join("; ")
      );
    }
  },
  async tryConfirmAuthFnDelete(): Promise<"deleted" | "not-authfn" | "failed"> {
    try {
      const { authClient } =
        await import("@nucleum/client/runtime/account/auth");
      const response = await (
        await authClient({
          isPreventCachedInstance: true
        })
      ).deleteAccount();
      if (response.ok) {
        return "deleted";
      }
      if (
        response.error.code === "AUTHFN_UNAUTHENTICATED" &&
        (await hasLegacyCloudSession())
      ) {
        return "not-authfn";
      }
      toasts.error(
        response.error.message ??
          "Failed to delete account. Please try again later."
      );
      return "failed";
    } catch (error) {
      logger.error({ at: "tryConfirmAuthFnDelete", error });
      if (await hasLegacyCloudSession()) {
        return "not-authfn";
      }
      toasts.error("Failed to delete account. Please try again later.");
      return "failed";
    }
  }
};
