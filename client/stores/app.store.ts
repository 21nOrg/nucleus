import { get, writable } from "svelte/store";
import { AppSkin } from "@21n/theme/appearance.type";
import { type IAppStore } from "@nucleum/stores/appStore.type";
import type { DragAndDrop } from "@nucleum/actions/draganddrop.type";
import { DragStatus } from "@nucleum/actions/dragstatus.enum";
import blankJson from "@nucleum/client/config/blank.json";
import colorSchemes from "@21n/theme/colorschemes.json";
import { Resource } from "@nucleum/datafn/resource.enum";
import { shuffleEmojis } from "@21n/elements/avatarPicker/avatars";
import { type IAction } from "@nucleum/client/config/action.type";

import { dispatchCustomEvent } from "@21n/utils/browser.utils";
import { persistLocally } from "@nucleum/persistence/persistence.utils";

import { InteractionMode } from "@21n/elements/keyboard/interaction-mode.type";
import { Action } from "@nucleum/client/config/action.enum";
import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";

import { Product } from "@nucleum/client/config/product.type";

export const currentTime = writable<Date>(new Date());
export const appLoadingState = writable<{
  isBaseLoaded: boolean;
  isLocalLoaded: boolean;
}>({ isBaseLoaded: false, isLocalLoaded: false });
export const leftThresholdCrossedStore = writable("");
export const isTouchDevice = writable(false);

export const appStoreShuffleEmojis = writable(shuffleEmojis);
export const intercomId = import.meta.env?.VITE_INTERCOM_ID ?? "t4qp4qlr";
export const selectedTimePeriod = writable<Date>(new Date());

/**
 * Paths that are excluded to redirection checks like login
 */
export const excludedPathsForRedirectionCheck = [
  "expired",
  "signup",
  "login",
  "404",
  "onboarding",
  "error",
  "welcome",
  "play",
  Action.EXTENSTION_LOGIN,
  "oauth"
];

let blankDetails: any = blankJson.find(
  (subatom: any) => subatom.url == "blank.coop"
);
export const blank = writable(blankDetails);

export const dragAndDropStore = createDragAndDropStore();
const dndPageOwners = new Set<symbol>();

/**
 * Keeps global drag and paste handlers suspended while an owning surface is mounted.
 */
export function acquireDnDPage() {
  const owner = Symbol("dnd-page-owner");
  dndPageOwners.add(owner);
  syncDnDPageState();
  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    dndPageOwners.delete(owner);
    syncDnDPageState();
  };
}

function syncDnDPageState() {
  appStore.update((state) => ({
    ...state,
    isDnDPageActive: dndPageOwners.size > 0
  }));
}

function createDragAndDropStore() {
  const { subscribe, set, update } = writable<DragAndDrop>({
    dragItem: {},
    dropItem: {},
    dragEnterItem: {},
    dragLeaveItem: {},
    dragStatus: DragStatus.NONE,
    dragId: "",
    dragEnterId: "",
    dropId: "",
    forwardDrop: false
  });

  return {
    subscribe,
    set,
    update,
    reset: () => {
      set({
        dragItem: {},
        dropItem: {},
        dragEnterItem: {},
        dragLeaveItem: {},
        dragStatus: DragStatus.NONE,
        dragId: "",
        dragEnterId: "",
        dropId: "",
        forwardDrop: false
      });
    }
  };
}

const tempColorSchemes = [
  "scheme1",
  "scheme2",
  "scheme3",
  "scheme4",
  "scheme5",
  "scheme6",
  "scheme7",
  "scheme8",
  "scheme9",
  "scheme10",
  "scheme11"
];

const isDebugMode =
  import.meta.env?.DEV && import.meta.env?.VITE_ISDEBUG === "true";
const isExperimentalMode =
  import.meta.env?.DEV && import.meta.env?.VITE_ISEXPERIMENTAL === "true";

let themes = [AppSkin.Clean, AppSkin.Glassy];
if (isDebugMode) themes = themes.concat([AppSkin.Vibrant, AppSkin.Futuristic]);
export const appConstants = {
  themes,
  colorSchemes,
  tempColorSchemes
};

const { subscribe, set, update } = writable<IAppStore>({
  product: Product.NUCLEUM,
  env: "dev",
  isDebugMode,
  isExperimentalMode,
  appData: {},
  currentPath: "",
  isMenuHidden: false,
  actions: [],
  interactionMode: InteractionMode.DEFAULT
});

export const appStore = {
  subscribe,
  set,
  update,
  resolveComponentFromPath: (path: string) => {
    const actions = get(appStore).actions;
    let component = actions.find((x) => x.path === path);
    if (component) return component;
    component = actions.find((x) => x.action === path);
    if (component) return component;
    return null;
  },
  initializeProductInformation: (details: { product: string; env: string }) => {
    update((n: IAppStore) => {
      n.product = details.product as Product;
      n.env = details.env;
      return n;
    });
  },
  setVersion: (version: string, build: number) => {
    update((n: IAppStore) => {
      n.version = version;
      n.build = build;
      return n;
    });
  },
  loadAppData: (data: any, params?: { isDefaultData: boolean }) => {
    update((n: IAppStore) => {
      const env = n.env;
      if (data.env && data.env[env]) {
        n.appData = { ...data, ...data.env[env] };
      } else {
        n.appData = data;
      }
      if (!params?.isDefaultData) {
        persistLocally(Resource.appData, data);
      }
      return n;
    });
  },
  turnDebugMode: (isDebugMode: boolean) => {
    update((n: IAppStore) => {
      n.isDebugMode = isDebugMode;
      return n;
    });
  },
  toggleMenuVisibility: (isHidden?: boolean) => {
    update((n: IAppStore) => {
      if (isHidden !== undefined && isHidden !== null) {
        n = { ...n, isMenuHidden: isHidden };
      } else {
        n = { ...n, isMenuHidden: !n.isMenuHidden };
      }
      return n;
    });
  },
  toggleTopBar: (isMinimal: boolean) => {
    update((n: IAppStore) => {
      n = { ...n, isMinimalTopBar: isMinimal };
      return n;
    });
  },
  initActions: (actions: IAction[], settings: IAction[]) => {
    update((n: IAppStore) => {
      if (!n.actions) n.actions = [];
      n.actions = [...actions, ...settings];
      return n;
    });
  },
  initActionsForSheet: (actions: IAction[]) => {
    update((n: IAppStore) => {
      n.actions = [...actions];
      return n;
    });
  },
  addToRecents: (data: { record: any; type: Resource; timestamp: Date }) => {
    dispatchCustomEvent(GlobalEvent.ADD_TO_RECENTS, data);
  }
};

export const isInEditMode = initEditModeStore();

function initEditModeStore() {
  const { subscribe, set, update } = writable<boolean>(false);
  return {
    subscribe,
    set,
    toggle: (val?: boolean) => {
      update((n: boolean) => {
        if (val !== undefined) return val;
        return !n;
      });
    }
  };
}
