import { navigation } from "@21n/layout/navigation/navigation";
import { requireCommandHost } from "@nucleum/stores/commands/command-host";
import { actionRunner } from "../commands/action-runner";
import { configureCommandHost } from "@nucleum/stores/commands/command-host";
import { configureProductResourceTables } from "@nucleum/client/config/product-resources";
import { configureActionRenderer } from "@nucleum/stores/resources/action-renderer";
import ComponentResolver from "@21n/layout/paint/ComponentResolver.svelte";
import { get } from "svelte/store";
import { appStore } from "@nucleum/stores/app.store";
import { AppSearchParam } from "@nucleum/stores/appStore.type";
import { appEvents } from "@nucleum/stores/events/app-events.store";
import { tabs } from "@21n/layout/topNav/tabs/tabs.store";
import { AccessMode } from "@nucleum/datafn/resource.type";
import { resolveProductResources } from "@nucleum/datafn/resource.utils";
import { Action } from "@nucleum/client/config/action.enum";
import { configureOverlayHost } from "@nucleum/stores/overlays/modal.store";
import { configureRecordRenderer } from "@nucleum/stores/resources/record-renderer";
import { configureShortcutHost } from "@nucleum/stores/keyboard/shortcut-host";
import { configureRecentsHost } from "@nucleum/stores/resources/recent-host";
import { configureResourcePanelHost } from "@nucleum/stores/resources/resource-panel-host";
import { configureResourceActionHost } from "@nucleum/stores/resources/resource-action-host";
import { resolveProductConfig } from "@nucleum/products/product.config";
import { shortcutsConfig } from "../shortcuts/shortcuts.config";
import { copyResourceLinkToClipboard } from "../record/resource-link.utils";
import Records from "../record/Records.svelte";

configureOverlayHost({
  onDismiss: (action) => appEvents.nav(action),
  openFullscreen: (path) =>
    navigation.toggleSearchParam({
      [AccessMode.FULL]: path,
      [AccessMode.POP]: null
    }),
  closeFullscreen: () => navigation.toggleSearchParam([AccessMode.FULL]),
  resolvePlayer: (path) =>
    appStore.resolveComponentFromPath(path)?.associatedPlayer
});

configureShortcutHost({
  defaults: shortcutsConfig,
  configurableActions: () => resolveProductConfig().configurableShortcuts
});

configureRecordRenderer(Records);

configureRecentsHost({
  resources: () => resolveProductResources(get(appStore).product)
});

configureResourcePanelHost({
  readPanel: (id, url) => {
    return url.searchParams.get(
      navigation.resolveRecordSpecificSearchParam(id, AppSearchParam.PANEL)
    );
  },
  writePanel: (id, panel) =>
    navigation.toggleSearchParamRecordSpecific(id, {
      [AppSearchParam.PANEL]: panel
    }),
  close: (id) => navigation.closeResource({ id }),
  goBack: () => navigation.goBack(),
  maximize: (mode, id) => navigation.toggleFullScreen(mode, id)
});

configureResourceActionHost({
  copyLink: copyResourceLinkToClipboard,
  open: (id, mode, options) => navigation.openResource(id, mode, options),
  close: (options) => navigation.closeResource(options),
  maximize: (mode, id) => navigation.toggleFullScreen(mode, id),
  openTab: (id) => tabs.open(id),
  removeTab: (id) => tabs.remove(id),
  requestLink: (options) =>
    requireCommandHost().runAction(Action.BULK_LINK, {
      componentParams: options
    }),
  afterNodeMutation: async (action, ids) => {
    const lifecycle = await import("@nucleum/features/memory/node/node.store");
    if (action === "archive") return lifecycle.onNodeArchive(ids);
    if (action === "unarchive") return lifecycle.onNodeUnarchive(ids);
    return lifecycle.onNodeTrash(ids);
  }
});

configureActionRenderer(ComponentResolver);
configureProductResourceTables(
  (product) => resolveProductConfig(product).resources.table
);

configureCommandHost(actionRunner);
