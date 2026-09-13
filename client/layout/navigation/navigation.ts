import { get } from "svelte/store";

import { AppSearchParam, type IAppStore } from "@nucleum/stores/appStore.type";

import { Resource } from "@nucleum/datafn/resource.enum";

import { goto } from "@21n/utils/browser.utils";

import { postDataToParent } from "@nucleum/client/runtime/embed/embed.utils";

import view from "@nucleum/stores/view.store";
import context from "@nucleum/stores/context.store";
import { appEvents } from "@nucleum/stores/events/app-events.store";

import { AccessMode } from "@nucleum/datafn/resource.type";
import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";

import { Action } from "@nucleum/client/config/action.enum";

import { logger } from "@nucleum/client/runtime/logging/logger";

import type { IRecordId } from "@nucleum/schema/legacy/data.type";

import { tabs, vTrail } from "@21n/layout/topNav/tabs/tabs.store";
import { determineResourceAccessMode } from "@nucleum/datafn/resource.utils";

import { EmbedDataMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
import { datafn, datafnRuntime } from "@nucleum/datafn/datafn.store";
import { generateResourceId } from "@nucleum/datafn/id.utils";
import { resolveNavigationLinkTarget } from "@21n/layout/navigation/link-target";
import { appStore } from "@nucleum/stores/app.store";
const recordSpecificSearchParams = [
  /-type$/,
  /-tab$/,
  /-task$/,
  /-nodeView$/,
  AppSearchParam.EDIT,
  AppSearchParam.VIEW,
  AppSearchParam.POP_AT,
  AppSearchParam.SPLIT_AT,
  AppSearchParam.FSPLIT_AT,
  AppSearchParam.FULL_AT,
  AppSearchParam.LINK,
  AppSearchParam.DATE,
  AppSearchParam.SETTING,
  AccessMode.FSPLIT
];

/** URL, history, and resource navigation owned by the application layout. */
export const navigation = {
  /**
   * Determines whether the app menu should be hidden for a path
   * @param newPath path which needs to checked
   * @param n view
   * @returns a boolean whether app menu should be hidden or not
   */
  checkIfNeedToHideMenu: (newPath: string) => {
    const n = get(view);
    const path = newPath.split("?")[0];
    if (path.split("/")[1]) {
      let component = appStore.resolveComponentFromPath(path.split("/")[1]);
      if (component?.isMenuHidden) return true;
    }
    const listOfPathsToHideMenu = {
      portrait: ["/objective/*", "/goal/*", "/cp/*"],
      landscape: []
    };
    if (!path) return false;
    let pathParts = path.split("/").filter((p) => p);
    if (n.isPortrait) {
      if (listOfPathsToHideMenu.portrait.includes(path)) return true;
      else if (
        pathParts.length > 1 &&
        listOfPathsToHideMenu.portrait.includes(`/${pathParts[0]}/*`)
      )
        return true;
    } else {
    }
    return false;
  },
  gotoPath: async (
    path: string,
    props?: {
      queryParams?: any;
      replaceState?: boolean;
    }
  ) => {
    logger.log({ method: "gotoPath", path });
    logger.info({
      at: "navigation.gotoPath",
      path,
      replaceState: props?.replaceState,
      currentPath:
        typeof window !== "undefined" ? window.location.pathname : undefined
    });
    if (props?.queryParams) {
      const queryString = new URLSearchParams(props.queryParams).toString();
      path += "?" + queryString;
    }
    appStore.update((n: IAppStore) => {
      n = {
        ...n,
        currentPath: path,
        isMenuHidden: navigation.checkIfNeedToHideMenu(path)
      };
      return n;
    });
    goto(path, false, props?.replaceState ?? false);
  },
  gotoErrorPage: (err: any) => {
    logger.log({ at: "gotoErrorPage", err });
    navigation.gotoPath("/error");
  },
  /**
   * @deprecated - use openResource instead
   * @param item
   * @param id
   * @param params
   */
  gotoResource: async (item: Resource, id: string, params: any = null) => {
    const path = `/${item}/${id}`;
    appStore.update((n: IAppStore) => {
      n = {
        ...n,
        currentPath: path,
        isMenuHidden: navigation.checkIfNeedToHideMenu(path)
      };
      return n;
    });
    goto(path);
  },
  openLink: (url: string, isOauthFlow: boolean = false) => {
    logger.log({ at: "opening link", url });
    const ctx = get(context);
    if (!url) return;
    const target = resolveNavigationLinkTarget(url, window.location.origin);
    if (!target) {
      logger.warn({ at: "navigation.openLink.unsupportedUrl" });
      return;
    }
    if (target.kind === "internal") {
      navigation.gotoPath(target.url);
      return;
    }
    if (ctx.isEmbed) {
      if (isOauthFlow) {
        postDataToParent(EmbedDataMessage.OAUTH, target.url);
      } else {
        postDataToParent(EmbedDataMessage.LINK, target.url);
      }
    } else if (target.kind === "system") {
      window.location.assign(target.url);
    } else {
      let win = window?.open(target.url, "_blank", "noopener,noreferrer");
      if (win) {
        win.focus();
      }
    }
  },
  runClientUpdate: () => {
    logger.log("running client update");
    window?.location?.reload();
  },
  resolveRecordSpecificSearchParamPrefix: (id: IRecordId) => {
    return id.toString().slice(-5);
  },
  resolveRecordSpecificSearchParam: (id: IRecordId, param: string) => {
    const prefix = navigation.resolveRecordSpecificSearchParamPrefix(id);
    return `${prefix}-${param}`;
  },
  toggleSearchParamRecordSpecific: (
    id: IRecordId,
    params:
      Record<string, string | boolean | number | null> | (string | RegExp)[],
    additional?: {
      isPreventRefresh?: boolean;
      url?: URL;
    }
  ) => {
    const prefix = navigation.resolveRecordSpecificSearchParamPrefix(id);
    let modified: Record<string, string | boolean | number | null> | string[] =
      {};
    if (Array.isArray(params)) {
      modified = params.map((p) => `${prefix}-${p}`);
    } else {
      const recordSpecificParams: Record<
        string,
        string | boolean | number | null
      > = {};
      Object.entries(params).forEach(([key, value]) => {
        recordSpecificParams[`${prefix}-${key}`] = value;
      });
      modified = recordSpecificParams;
    }
    return navigation.toggleSearchParam(modified, additional);
  },
  /**
   * Sets or deletes search params
   * @param params Send an object to set params, array of strings to delete
   * @returns
   */
  toggleSearchParam: (
    params:
      Record<string, string | boolean | number | null> | (string | RegExp)[],
    additional?: {
      isPreventRefresh?: boolean;
      url?: URL;
      replaceState?: boolean;
    }
  ) => {
    if (!params) return;
    logger.log({ at: "toggleSearchParam", params, additional });
    const url = additional?.url ?? new URL(window.location.href);
    if (Array.isArray(params)) {
      params.forEach((p) => {
        if (typeof p === "string" && !url.searchParams.get(p)) return;
        if (typeof p === "string") url.searchParams.delete(p);
        else if (p instanceof RegExp) {
          url.searchParams.forEach((value, key) => {
            if (p.test(key)) url.searchParams.delete(key);
          });
        }
      });
      if (!additional?.isPreventRefresh) {
        navigation.gotoPath(url.href, {
          replaceState: additional?.replaceState ?? true
        });
      }
      return url;
    }
    if (typeof params !== "object") return;
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value.toString());
    });
    if (!additional?.isPreventRefresh) {
      navigation.gotoPath(url.href, {
        replaceState: additional?.replaceState ?? true
      });
    }
    return url;
  },
  /**
   * Determines if the current view is a full view or a pop view
   * @returns
   */
  isOverlay: (recordId?: IRecordId) => {
    if (recordId) {
      const accessMode = determineResourceAccessMode(recordId);
      return accessMode === AccessMode.POP || accessMode === AccessMode.FULL;
    }
    return (
      new URLSearchParams(window.location.search).get(AccessMode.FULL) ||
      new URLSearchParams(window.location.search).get(AccessMode.POP)
    );
  },
  determineCurrentResourceAccessMode1: (id: string) => {
    if (new URLSearchParams(window.location.search).get(AccessMode.POP) === id)
      return AccessMode.POP;
    else if (
      new URLSearchParams(window.location.search).get(AccessMode.FULL) === id
    )
      return AccessMode.FULL;
    else if (
      new URLSearchParams(window.location.search).get(AccessMode.SPLIT) === id
    )
      return AccessMode.SPLIT;
    else if (
      new URLSearchParams(window.location.search).get(AccessMode.FSPLIT) === id
    )
      return AccessMode.FSPLIT;
    else return AccessMode.INLINE;
  },
  /**
   *
   * TODO - shortcuts from user settings
   *
   * @param event
   * @returns
   */
  determineClickAccessMode: (event: MouseEvent) => {
    if (event.altKey && event.metaKey) {
      return AccessMode.TAB;
    } else if (event.shiftKey) return AccessMode.FULL;
    else if (event.altKey) {
      return AccessMode.SPLIT;
    } else if (event.metaKey) {
      return AccessMode.OPEN_IN_BACKGROUND;
    }
  },
  openResource: (
    id: IRecordId,
    accessMode: AccessMode = AccessMode.INLINE,
    params?: {
      origin?: Action | IRecordId;
      replaceId?: IRecordId;
      searchParams?: Record<string, string | boolean | number | null>;
    }
  ) => {
    logger.log({ at: "openResource", id, accessMode, params });
    if (!id) return;
    let url = new URL(window.location.href);
    if (accessMode === AccessMode.FULL) {
      url =
        navigation.toggleSearchParam([AccessMode.POP, AccessMode.FSPLIT], {
          isPreventRefresh: true
        }) ?? url;
    }
    const timestamp = new Date();
    const runtime = get(datafnRuntime);
    if (runtime?.remoteUrl)
      void datafn.accessLog
        .mutate({
          operation: "insert",
          record: {
            id: generateResourceId(Resource.accessLog),
            resource: id.toString()?.split(":")[0],
            action: ResourceActionType.OPEN,
            resourceId: id,
            timestamp
          }
        })
        .catch((error) =>
          logger.error({ at: "openResource.accessLog", error })
        );
    if (accessMode === AccessMode.TAB) {
      if (params?.replaceId) tabs.replace(id, params.replaceId);
      else tabs.open(id);
      return;
    } else if (accessMode === AccessMode.OPEN_IN_BACKGROUND && params?.origin) {
      vTrail.add(params.origin, id, {
        isPreventActivation: true
      });
      navigation.toggleSearchParam(
        { [AccessMode.RIGHT]: Action.NAVIGATOR },
        { url }
      );
      return;
    } else if (accessMode === AccessMode.SPLIT) {
      const isFullOrPop = navigation.isOverlay(params?.replaceId);
      if (isFullOrPop) accessMode = AccessMode.FSPLIT;
      else accessMode = AccessMode.SPLIT;
    }
    logger.log({ at: "openResource", accessMode });
    let isOpenNavigator = false;
    let isCloseNavigator = false;
    if (accessMode === AccessMode.POP && params?.origin) {
      isOpenNavigator = vTrail.add(params.origin, id);
    } else if (accessMode === AccessMode.POP) {
      vTrail.clear();
      isCloseNavigator =
        new URL(window.location.href).searchParams.get(AccessMode.RIGHT) ===
        Action.NAVIGATOR;
    }
    url =
      navigation.toggleSearchParam(recordSpecificSearchParams, {
        isPreventRefresh: true,
        url
      }) ?? url;
    navigation.toggleSearchParam(
      {
        [accessMode]: id.toString(),
        [accessMode + "At"]: timestamp.getTime(),
        ...(params?.searchParams ?? {}),
        ...(isOpenNavigator ? { [AccessMode.RIGHT]: Action.NAVIGATOR } : {}),
        ...(isCloseNavigator ? { [AccessMode.RIGHT]: null } : {})
      },
      {
        url: url
      }
    );
  },
  /**
   * Clears all tooltips from the DOM. This is to avoid an issue where clicking on a mention in markdown when the tooltip is activated is not removing the tooltip properly on navigation to that mention node page.
   */
  clearAllTooltips: () => {
    const tooltipsContainer = document.getElementById("tooltips");
    if (tooltipsContainer) {
      tooltipsContainer.innerHTML = "";
    }
  },
  resourceClickHandlerForGraph: (
    id: IRecordId,
    event: MouseEvent,
    params?: {
      replaceId?: IRecordId;
    }
  ) => {
    const clickAccessMode = navigation.determineClickAccessMode(event);
    let accessMode = AccessMode.SPLIT;
    if (clickAccessMode === AccessMode.SPLIT) {
      accessMode = AccessMode.POP;
    } else if (clickAccessMode) {
      accessMode = clickAccessMode;
    }
    navigation.openResource(id, accessMode, {
      replaceId: params?.replaceId
    });
  },
  goBack: (resource?: IRecordId) => {
    appEvents.nav(resource?.toString() ?? "");
    const existingParams = new URLSearchParams(window.location.search);
    const backQueryParam = existingParams.get("back");
    const returnToQueryParam = existingParams.get("returnTo");
    if (backQueryParam) {
      navigation.gotoPath(backQueryParam, {
        queryParams: returnToQueryParam
          ? {
              returnTo: returnToQueryParam
            }
          : {}
      });
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    }
  },
  goForward: () => {
    if (window.history.length > 1) {
      window.history.forward();
    }
  },
  /**
   * Handles resource click.
   *
   * Sending replaceId will use current access mode of the replaceId resource as defaultTo.
   *
   * @param event - mouse event
   * @param id - resource id to be opened
   * @param defaultTo - default access mode
   * @param params - additional params
   * @returns
   */
  resourceClickHandler: (
    event: MouseEvent | undefined,
    id: IRecordId,
    params?: {
      origin?: Action | IRecordId;
      defaultTo?: AccessMode;
      replaceId?: IRecordId;
      searchParams?: Record<string, string | boolean | number | null>;
    }
  ) => {
    if (!id) return;
    navigation.toggleSearchParam([AppSearchParam.VIEW]);
    let accessMode;
    const defaultTo =
      params?.defaultTo ??
      (params?.replaceId
        ? determineResourceAccessMode(params.replaceId)
        : AccessMode.POP);
    if (event) accessMode = navigation.determineClickAccessMode(event);
    if (!accessMode) accessMode = defaultTo;
    logger.log({ at: "resourceClickHandler", accessMode, defaultTo });
    navigation.openResource(id, accessMode, {
      replaceId: params?.replaceId,
      searchParams: params?.searchParams,
      origin: params?.origin
    });
    logger.log({
      at: "resourceClickHandler",
      id,
      defaultTo,
      accessMode,
      event
    });
  },
  closeResource: (props?: {
    id?: IRecordId;
    accessMode?: AccessMode;
    isRestrictToModals?: boolean;
  }) => {
    const restoreInlineResourceIfPrev = () => {
      const prevMode = url.searchParams.get("prev");
      if (prevMode === AccessMode.INLINE && props?.id)
        url.searchParams.set(prevMode, props?.id.toString());
    };
    appEvents.nav(props?.id?.toString() ?? "");
    const url =
      navigation.toggleSearchParam(recordSpecificSearchParams, {
        isPreventRefresh: true
      }) ?? new URL(window.location.href);
    if (props?.accessMode) {
      navigation.toggleSearchParam([props.accessMode], { url });
      restoreInlineResourceIfPrev();
      return;
    } else if (props?.id) {
      const accessMode = determineResourceAccessMode(props.id);
      if (accessMode) {
        navigation.toggleSearchParam([accessMode], { url });
        restoreInlineResourceIfPrev();
      }
      return;
    }
    if (props?.isRestrictToModals) {
      navigation.toggleSearchParam([AccessMode.FSPLIT, AccessMode.POP], {
        url
      });
      return;
    }
    restoreInlineResourceIfPrev();
    removeSearchParam("prev");
    removeSearchParam(AccessMode.SPLIT);
    removeSearchParam(AccessMode.FULL);
    removeSearchParam(AccessMode.POP);
    removeSearchParam(AccessMode.FSPLIT);
    removeSearchParam(AccessMode.MAIN);
    navigation.gotoPath(url.href);

    function removeSearchParam(param: string) {
      if (!url.searchParams.get(param)) return;
      url.searchParams.delete(param);
    }
  },
  toggleFullScreen: (currentMode: AccessMode, resourceId: IRecordId) => {
    logger.log({ at: "toggleFullAccessMode", currentMode, resourceId });
    const hasMaxParam = new URLSearchParams(window.location.search).get(
      AppSearchParam.MAX
    );
    if (hasMaxParam) {
      navigation.toggleSearchParam({ [AppSearchParam.MAX]: null });
    } else {
      navigation.toggleSearchParam({ [AppSearchParam.MAX]: true });
    }
  },
  setCurrentPath: (path: string) => {
    appStore.update((n: IAppStore) => {
      n = {
        ...n,
        currentPath: path,
        isMenuHidden: navigation.checkIfNeedToHideMenu(path)
      };
      return n;
    });
  }
};
