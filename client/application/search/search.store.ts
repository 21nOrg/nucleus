import { navigation } from "@21n/layout/navigation/navigation";
import { writable } from "svelte/store";
import { Resource } from "@nucleum/datafn/resource.enum";

import { AccessMode } from "@nucleum/datafn/resource.type";

export interface SearchState {
  /**
   * @deprecated
   */
  on?: boolean;
  query: string;
  resourceType: Resource;
}

type KeyboardEventHandler = (event: KeyboardEvent) => void;

function createSearchStore() {
  const { subscribe, set, update } = writable<SearchState>({
    query: "",
    resourceType: Resource.everything
  });

  let keyupHandler: KeyboardEventHandler | null = null;
  let keydownHandler: KeyboardEventHandler | null = null;

  return {
    subscribe,
    set,
    update,
    setQuery: (query: string) => {
      update((state) => ({ ...state, query }));
    },

    setResourceType: (resourceType: Resource) => {
      update((state) => ({ ...state, resourceType }));
    },

    reset: () => {
      set({ query: "", resourceType: Resource.everything });
      navigation.toggleSearchParam([AccessMode.MAIN]);
    },

    clear: () => {
      update((state) => ({ ...state, query: "" }));
    },

    setKeyboardHandlers: (handlers: {
      keyup?: KeyboardEventHandler;
      keydown?: KeyboardEventHandler;
    }) => {
      keyupHandler = handlers.keyup || null;
      keydownHandler = handlers.keydown || null;
    },

    clearKeyboardHandlers: () => {
      keyupHandler = null;
      keydownHandler = null;
    },

    keyup: (event: KeyboardEvent) => {
      keyupHandler?.(event);
    },

    keydown: (event: KeyboardEvent) => {
      keydownHandler?.(event);
    }
  };
}

export const searchStore = createSearchStore();
