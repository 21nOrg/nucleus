import { derived } from "svelte/store";
import { uiState } from "@nucleum/stores/uiState/uiState.store";
import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
import context from "@nucleum/stores/context.store";
import { Embed } from "@nucleum/client/runtime/context.type";

/** Shortcut hints follow persisted preferences and current product/device context. */
export const shortcutHints = derived(
  [
    uiState.observeState(UIState.hideShortcutHints, {
      scope: UIStateScope.DEVICE
    }),
    context
  ],
  ([disabled, ctx]) => ({
    isShowHotKeyHints: !disabled && ctx.embed !== Embed.HANDSET
  })
);
