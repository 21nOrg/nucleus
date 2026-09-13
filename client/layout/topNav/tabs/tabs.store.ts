import { navigation } from "@21n/layout/navigation/navigation";
import { requireCommandHost } from "@nucleum/stores/commands/command-host";
import { tabState } from "@21n/layout/topNav/tabs/tab-state";
import { AccessMode, ResourceAccessPoint } from "@nucleum/datafn/resource.type";
import { isRecordId, resourceInList } from "@nucleum/datafn/resource.utils";

import { uiState } from "@nucleum/stores/uiState/uiState.store";
import { UIStateScope } from "@nucleum/stores/uiState/uiState.type";
import type { HorizontalTrail, VerticalTrail } from "./tabs.type";
import type { IRecordId } from "@nucleum/schema/legacy/data.type";
import { Action } from "@nucleum/client/config/action.enum";
import { get, writable } from "svelte/store";

class TabStore {
  open(id: IRecordId, backParam?: string) {
    if (!id) return;
    tabState.addResourceToTabs(id);
    this.activate(id, backParam);
  }

  replace(id: IRecordId, replaceId: IRecordId) {
    if (!id || !replaceId) return;
    const tabs = this.get();
    if (tabs?.some(resourceInList(replaceId))) {
      this.remove(replaceId);
      tabState.addResourceToTabs(id);
    }
    this.activate(id);
  }

  addInBackground(id: IRecordId) {
    if (!id) return;
    tabState.addResourceToTabs(id);
  }

  activate(id: IRecordId, backParam?: string) {
    if (!id) return;
    const currentParams = new URLSearchParams(window.location.search);
    const tabParam = currentParams.get("tab");
    if (tabParam === id) return;

    const existingBack = currentParams.get("back");
    const resolvedBack = tabParam
      ? (existingBack ?? undefined)
      : (backParam ?? window.location.pathname);
    const returnToParam = currentParams.get("returnTo");

    navigation.closeResource({ isRestrictToModals: true });
    const queryParams: Record<string, IRecordId | string> = {};
    if (resolvedBack !== undefined && resolvedBack !== null) {
      queryParams.back = resolvedBack;
    }
    if (returnToParam) {
      queryParams.returnTo = returnToParam;
    }
    navigation.openResource(id, AccessMode.POP, {
      searchParams: { ...queryParams }
    });
  }

  remove(id: IRecordId) {
    tabState.removeResourceFromTabs(id);
  }

  get() {
    return uiState.getState(ResourceAccessPoint.TABS, {
      scope: UIStateScope.PRODUCT
    });
  }

  rearrange(ids: IRecordId[]) {
    return uiState.setState(ResourceAccessPoint.TABS, ids, {
      scope: UIStateScope.PRODUCT
    });
  }
}

function createHorizontalTrailStore() {
  const { subscribe, update, set } = writable<HorizontalTrail>({
    path: [],
    activated: undefined
  });
  return {
    subscribe,
    update,

    /**
     * Pipe is used for supporting split within a trail item
     * @param base
     * @param id
     */
    add(base: Action, id: IRecordId) {
      update((trail) => {
        if (
          trail.path.length > 0 &&
          (trail.path[0] === base || trail.path[0].startsWith(`${base}|`))
        ) {
          return {
            ...trail,
            path: [...trail.path, id],
            activated: id
          };
        } else {
          const isBaseNonRecord = !isRecordId(base);
          return {
            ...trail,
            path: [base, id],
            activated: id,
            isBaseNonRecord
          };
        }
      });
    },

    remove(id: IRecordId) {
      update((trail) => ({
        ...trail,
        path: trail.path.filter((t) => t !== id),
        activated: trail.activated === id ? undefined : trail.activated
      }));
    },

    clear() {
      set({
        path: [],
        activated: undefined
      });
    },

    activate(id: IRecordId | Action) {
      const current = get(hTrail);
      if (current.isBaseNonRecord && id === current.path[0]) {
        requireCommandHost().runAction(id);
        return;
      } else {
        navigation.toggleSearchParam([AccessMode.MAIN]);
      }
      update((state) => {
        return {
          ...state,
          activated: id
        };
      });
    }
  };
}

export const hTrail = createHorizontalTrailStore();

function createVTrailStore() {
  const { subscribe, update, set } = writable<VerticalTrail>({
    items: []
  });
  return {
    subscribe,
    update,

    /**
     * Dash (-) is used for maintaining hierarchy, Pipe (|) is used for split
     * @param origin
     * @param id
     * @returns true if navigator needs to be opened
     */
    add(
      origin: Action | IRecordId,
      id: IRecordId,
      params?: {
        isPreventActivation?: boolean;
      }
    ): boolean {
      const state = get(vTrail);
      let newState = { ...state };
      if (state.items.length < 1) {
        newState = {
          ...state,
          items: [id],
          base: origin,
          activated: params?.isPreventActivation ? undefined : id
        };
        update(() => newState);
        return true;
      }
      const existsInChain = state.items.some((x) => x.includes(id));
      if (existsInChain) {
        const item = state.items.find((x) => x.includes(id));
        newState = {
          ...state,
          activated: params?.isPreventActivation ? state.activated : item
        };
        update(() => newState);
        return false;
      }
      const newId =
        origin === state.base || !state.activated
          ? id
          : `${state.activated}-${id}`;
      const parentIndex = state.items.findIndex((x) => x === state.activated);
      const newItems = [
        ...state.items.slice(0, parentIndex + 1),
        newId,
        ...state.items.slice(parentIndex + 1)
      ];
      newState = {
        ...state,
        items: newItems,
        activated: params?.isPreventActivation ? state.activated : newId
      };
      update(() => newState);
      return false;
    },

    remove(id: IRecordId) {
      update((trail) => ({
        items: trail.items.filter((t) => t !== id),
        activated: trail.activated === id ? undefined : trail.activated
      }));
    },

    clear() {
      set({
        items: [],
        activated: undefined
      });
    },

    activate(id: IRecordId | Action) {
      const current = get(vTrail);
      if (!isRecordId(current.base) && id === current.base) {
        requireCommandHost().runAction(id);
        return;
      } else {
        if (!isRecordId(id)) return;
        const parts = id.split("-");
        const recordId = parts[parts.length - 1];
        navigation.openResource(recordId, AccessMode.POP, {
          origin: current.base
        });
      }
      update((state) => {
        return {
          ...state,
          activated: id
        };
      });
    }
  };
}

export const vTrail = createVTrailStore();

export const tabs = new TabStore();
