import { navigation } from "@21n/layout/navigation/navigation";
import { get } from "svelte/store";

import { Resource } from "@nucleum/datafn/resource.enum";

import { ActionType } from "@nucleum/client/config/action.type";

import modalEvent from "@nucleum/stores/overlays/modal.store";
import view from "@nucleum/stores/view.store";
import context from "@nucleum/stores/context.store";
import { confirmationNotification } from "@nucleum/stores/notification.store";
import { appEvents } from "@nucleum/stores/events/app-events.store";
import { Embed } from "@nucleum/client/runtime/context.type";
import { AccessMode } from "@nucleum/datafn/resource.type";
import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
import { InteractionMode } from "@21n/elements/keyboard/interaction-mode.type";
import { Action } from "@nucleum/client/config/action.enum";
import { type Event } from "@nucleum/stores/notifications/event.enum";
import { logger } from "@nucleum/client/runtime/logging/logger";

import account from "@nucleum/stores/account.store";

import { resourceAction } from "@nucleum/datafn/resource.utils";

import { appStore } from "@nucleum/stores/app.store";

/** Executes the product command registry supplied by application composition. */
export const actionRunner = {
  resolveAction: (slug: string) => {
    const actions = get(appStore).actions;
    let action = actions.find(
      (x) => x.action?.toLowerCase() == slug.toLowerCase()
    );
    const contextData = get(context);
    const accountData = get(account);
    if (action && action.hideContext?.includes(contextData.embed)) return null;
    if (action && action.hideContext?.includes(contextData.os)) return null;
    if (action && action.hideContext?.includes(accountData.dataMode))
      return null;
    if (action) return action;
    return null;
  },
  runAction: (
    slug: string,
    params: {
      componentParams?: any;
      isReturnIfComponent?: boolean;
      searchParams?: Record<string, string | boolean | number>;
    } = {
      componentParams: undefined,
      isReturnIfComponent: false,
      searchParams: undefined
    }
  ) => {
    let action = actionRunner.resolveAction(slug);
    logger.log({ at: "runAction", action, slug, params });
    if (!action) {
      navigation.gotoPath("404");
      return;
    }
    const store = get(appStore);
    const ctx = get(context);
    const viewData = get(view);
    const isRenderAsPage =
      action.isRenderAsPageInPortrait && viewData.isPortrait;
    if (ctx.embed === Embed.HANDSET) {
      action.type = action.handsetBehaviorType ?? action.type;
    }
    if (action.type === ActionType.LINK) {
      const url = store.appData.urls?.[action.action];
      if (!url) return;
      if (url) return navigation.openLink(url);
    } else if (action.type === ActionType.FUNCTION) {
      if (!action.fn) return;
      return action.fn({
        componentParams: params?.componentParams,
        searchParams: params?.searchParams,
        view: viewData,
        context: ctx
      });
    } else if (action.type === ActionType.SEARCH_CMD) {
      actionRunner.runAction(Action.CMD, {
        componentParams: {
          command: action.action,
          commandType: action.type,
          componentParams: params?.componentParams
        }
      });
    } else if (action.type === ActionType.EVENT) {
      appEvents.publish(action.action as Event, params?.componentParams);
    } else if (action.type === ActionType.CONFIRMATION && action.confirmation) {
      confirmationNotification.notify(action.confirmation);
    } else if (params.isReturnIfComponent) {
      return action;
    } else if (action.type === ActionType.RESOURCE && !isRenderAsPage) {
      navigation.openResource(
        action.action,
        action.accessMode ?? AccessMode.POP,
        {
          searchParams: params?.searchParams
        }
      );
    } else if (action.type === ActionType.MODAL && !isRenderAsPage) {
      modalEvent.notify({
        path: action.action,
        isShow: true,
        componentParams: {
          ...(action?.componentParams ?? {}),
          ...(params?.componentParams ?? {})
        },
        ...action.modalParams
      });
      if (params?.searchParams) {
        navigation.toggleSearchParam(params.searchParams);
      }
    } else if (action.type === ActionType.LIVE) {
      if (action.liveActionParams?.isOpeningBehaviorConfigurable) {
      }
      const mode = action.accessMode ?? AccessMode.RIGHT;
      const paramPresent = new URLSearchParams(window.location.search).get(
        mode
      );
      if (paramPresent && paramPresent === slug) {
        navigation.toggleSearchParam([mode]);
      } else {
        navigation.toggleSearchParam({
          ...(mode === AccessMode.MAIN
            ? {
                [AccessMode.POP]: null,
                [AccessMode.FSPLIT]: null
              }
            : {}),
          [mode]: slug
        });
      }
    } else if (action.component) {
      logger.log({
        at: "running action",
        action,
        searchParams: params?.searchParams
      });
      if (
        store.interactionMode === InteractionMode.AGENT &&
        ctx.embed !== Embed.HANDSET
      ) {
        navigation.toggleSearchParam({ tab: "page:" + action.action });
      } else {
        navigation.gotoPath("/" + (action.path ?? action.action), {
          queryParams: params?.searchParams
        });
      }
      return;
    }
  },
  runResourceAction: (
    resource: Resource,
    action: ResourceActionType,
    params?: any
  ) => {
    return actionRunner.runAction(resourceAction(resource, action), params);
  }
};
