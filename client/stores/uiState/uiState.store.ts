import { Resource } from "@nucleum/datafn/resource.enum";
import { logger } from "@nucleum/client/runtime/logging/logger";
import { derived, get, writable } from "svelte/store";
import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";
import { appStore } from "@nucleum/stores/app.store";

import { datafn } from "@nucleum/datafn/datafn.store";
import { Action } from "@nucleum/client/config/action.enum";

import {
  UIState,
  UIStateScope,
  type IUIStateParams,
  type IUIStateStore
} from "@nucleum/stores/uiState/uiState.type";
import context from "@nucleum/stores/context.store";

import { parse, stringify } from "@21n/shared-utils/json.utils";
import { migrateLegacyNucleusProductKeys } from "@nucleum/stores/productKeyMigration.utils";
import {
  acknowledgeOptimisticKvEntries,
  addOptimisticKvEntries,
  applyOptimisticKvEntries,
  removeOptimisticKvEntries
} from "@nucleum/datafn/optimisticKv.utils";
import type { OptimisticKvEntries } from "@nucleum/datafn/optimisticKv.type";

const uiStateSeed: IUIStateStore = {
  $local: {}
};
const uiStateSignal = datafn.kv.signal<IUIStateStore>(Resource.uiState, {
  defaultValue: uiStateSeed
});
const uiStateLocal = writable<IUIStateStore>(uiStateSeed);
const pendingUiStateValues: OptimisticKvEntries = new Map();
const legacyUiStateKeys = new Map([
  ["manualLogRecentGoals", UIState.manualLogRecentObjectives],
  ["goalPanelSelection", UIState.objectivePanelSelection]
]);

function migrateLegacyUiStateKeys(data: IUIStateStore): IUIStateStore {
  const migrated = migrateLegacyNucleusProductKeys(data);
  Object.entries(migrated).forEach(([key, value]) => {
    legacyUiStateKeys.forEach((currentKey, legacyKey) => {
      if (!key.includes(legacyKey)) return;
      const nextKey = key.replace(legacyKey, currentKey);
      if (!Object.prototype.hasOwnProperty.call(migrated, nextKey)) {
        migrated[nextKey] = value;
      }
    });
  });
  return migrated;
}

function resolveStoredLocalState(): IUIStateStore["$local"] {
  try {
    if (typeof window === "undefined") return {};
    const savedState = window.localStorage.getItem("uiState");
    if (!savedState) return {};
    const parsed = parse(savedState);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return migrateLegacyUiStateKeys(parsed as IUIStateStore);
  } catch (error) {
    logger.error({ context: "uiState.store - resolveStoredLocalState", error });
    return {};
  }
}

function refreshUiStateLocal() {
  const migrated = migrateLegacyUiStateKeys(uiStateSignal.get() ?? uiStateSeed);
  const optimistic = applyOptimisticKvEntries(migrated, pendingUiStateValues);
  uiStateLocal.set({
    ...uiStateSeed,
    ...optimistic,
    $local: resolveStoredLocalState()
  });
}

uiStateSignal.subscribe((value) => {
  acknowledgeOptimisticKvEntries(
    pendingUiStateValues,
    migrateLegacyUiStateKeys(value ?? uiStateSeed)
  );
  refreshUiStateLocal();
});

export const uiState = {
  subscribe: uiStateLocal.subscribe,
  get() {
    return get(uiStateLocal);
  },
  /** Observes a scoped preference across data, product, and device changes. */
  observeState(
    keyParam: Action | UIState | ResourceAccessPoint,
    params?: IUIStateParams
  ) {
    return derived([uiStateLocal, appStore, context], () =>
      uiState.getState(keyParam, params)
    );
  },
  resolveKey(keyParam: string, params?: IUIStateParams) {
    let key: string = keyParam;
    const product = get(appStore).product;
    const ctx = get(context);
    let prefix = "";
    if (params?.scope === UIStateScope.DEVICE) {
      prefix = `${product}-${ctx.embed}`;
    } else if (params?.scope === UIStateScope.PRODUCT) {
      prefix = product;
    }
    if (prefix) {
      key = `${prefix}-${key}`;
    }
    if (params?.subVariables) {
      params.subVariables.forEach((subVariable) => {
        key = `${key}_${subVariable}`;
      });
    }
    return key;
  },
  setState(
    keyParam: Action | UIState | ResourceAccessPoint,
    value: any,
    params?: IUIStateParams
  ) {
    const key = this.resolveKey(keyParam, params);
    if (params?.scope === UIStateScope.DAP) {
      try {
        if (typeof window !== "undefined") {
          const savedStateObj = resolveStoredLocalState();
          savedStateObj[key] = value;
          window.localStorage.setItem("uiState", stringify(savedStateObj));
          refreshUiStateLocal();
        }
      } catch (error) {
        logger.error({
          context: "uiState.store - setState",
          key,
          value,
          error
        });
      }
    } else {
      this.modify({ [key]: value });
      logger.log({ context: "uiState.store - setState", key, value });
    }
  },
  getState(
    keyParam: Action | UIState | ResourceAccessPoint,
    params?: IUIStateParams
  ) {
    const key = this.resolveKey(keyParam, params);
    if (params?.scope === UIStateScope.DAP) {
      try {
        if (typeof window === "undefined") {
          return undefined;
        }
        const savedState = window.localStorage.getItem("uiState");
        if (!savedState) return undefined;
        const savedStateObj = parse(savedState);
        return savedStateObj[key] ?? undefined;
      } catch (error) {
        logger.error({ context: "uiState.store - getState", key, error });
        return undefined;
      }
    }
    return this.get()[key];
  },
  getResourceState(
    resource: Resource,
    location: ResourceAccessPoint,
    keyParam: UIState
  ) {
    const key = `${resource}-${location}-${keyParam}`;
    return this.get()[key];
  },
  setResourceState(
    resource: Resource,
    location: ResourceAccessPoint,
    keyParam: UIState,
    value: any
  ) {
    const key = `${resource}-${location}-${keyParam}`;
    this.modify({ [key]: value });
    logger.log({ context: "uiState.store - setResourceState", key, value });
  },
  modify(n: Partial<IUIStateStore>) {
    const mutationTokens = addOptimisticKvEntries(pendingUiStateValues, n);
    uiStateLocal.update((current) => ({ ...current, ...n }));
    const mutation = datafn.kv.merge(Resource.uiState, n);
    const rollbackPendingValues = () => {
      removeOptimisticKvEntries(pendingUiStateValues, mutationTokens);
      refreshUiStateLocal();
    };
    void mutation.then((result) => {
      if (!result.ok) rollbackPendingValues();
    }, rollbackPendingValues);
    return mutation;
  },
  loader(data: IUIStateStore) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    const migrated = migrateLegacyUiStateKeys(data);
    uiStateLocal.set({
      ...uiStateSeed,
      ...migrated,
      $local: resolveStoredLocalState()
    });
    return datafn.kv.set(Resource.uiState, migrated);
  },
  destroy() {
    uiStateSignal.dispose();
  }
};
