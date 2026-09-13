import type { IAppMenuStore } from "@21n/layout/navigation/app-menu.type";
import { Resource } from "@nucleum/datafn/resource.enum";
import { appStore } from "@nucleum/stores/app.store";
import { get, writable } from "svelte/store";
import { logger } from "@nucleum/client/runtime/logging/logger";
import { Product } from "@nucleum/client/config/product.type";
import { datafn } from "@nucleum/datafn/datafn.store";
import {
  acknowledgeOptimisticKvEntries,
  addOptimisticKvEntries,
  applyOptimisticKvEntries,
  removeOptimisticKvEntries
} from "@nucleum/datafn/optimisticKv.utils";
import type { OptimisticKvEntries } from "@nucleum/datafn/optimisticKv.type";

const appMenuSignal = datafn.kv.signal<IAppMenuStore>(Resource.appMenu, {
  defaultValue: {}
});
const appMenuLocal = writable<IAppMenuStore>({});
const pendingAppMenuValues: OptimisticKvEntries = new Map();
let appMenuNamespace = datafn.currentNamespace();

function migrateLegacyNucleusAppMenu(data: IAppMenuStore): IAppMenuStore {
  if (data.nucleus && !data[Product.NUCLEUM]) {
    return {
      ...data,
      [Product.NUCLEUM]: { ...data.nucleus }
    };
  }
  return data;
}

appMenuSignal.subscribe((value) => {
  const namespace = datafn.currentNamespace();
  if (namespace !== appMenuNamespace) {
    pendingAppMenuValues.clear();
    appMenuNamespace = namespace;
  }
  const migrated = migrateLegacyNucleusAppMenu(value ?? {});
  acknowledgeOptimisticKvEntries(pendingAppMenuValues, migrated);
  appMenuLocal.set(applyOptimisticKvEntries(migrated, pendingAppMenuValues));
});

export const appMenuStore = {
  subscribe: appMenuLocal.subscribe,
  get() {
    return get(appMenuLocal);
  },
  setUserMenuItems(items: string[]) {
    const current = this.get();
    const context = get(appStore).product;
    logger.log({ context: "setting user app menu items", current });
    this.modify({
      ...current,
      [context]: {
        ...current[context],
        user: items
      }
    });
  },

  addUserMenuItem(item: string) {
    const current = this.get();
    const context = get(appStore).product;
    logger.log({ context: "adding user app menu item", current });
    if (current[context]?.user?.includes(item)) return;
    this.modify({
      ...current,
      [context]: {
        ...current[context],
        user: [...(current[context]?.user ?? []), item]
      }
    });
  },
  removeUserMenuItem(item: string) {
    const current = this.get();
    const context = get(appStore).product;
    logger.log({ context: "removing user app menu item", current });
    if (!current[context]?.user?.includes(item)) return;
    this.modify({
      ...current,
      [context]: {
        ...current[context],
        user: current[context]?.user?.filter((x) => x != item)
      }
    });
  },
  modify(n: Partial<IAppMenuStore>) {
    const mutationTokens = addOptimisticKvEntries(pendingAppMenuValues, n);
    appMenuLocal.update((current) => ({ ...current, ...n }) as IAppMenuStore);
    const mutation = datafn.kv.merge(Resource.appMenu, n);
    const rollbackPendingValues = () => {
      removeOptimisticKvEntries(pendingAppMenuValues, mutationTokens);
      const current = migrateLegacyNucleusAppMenu(appMenuSignal.get() ?? {});
      appMenuLocal.set(applyOptimisticKvEntries(current, pendingAppMenuValues));
    };
    void mutation.then((result) => {
      if (!result.ok) rollbackPendingValues();
    }, rollbackPendingValues);
    return mutation;
  },
  loader(data: IAppMenuStore) {
    if (!data || typeof data !== "object") return;
    const migrated = migrateLegacyNucleusAppMenu(data);
    appMenuLocal.set(migrated);
    return datafn.kv.set(Resource.appMenu, migrated);
  },
  destroy() {
    appMenuSignal.dispose();
  }
};
