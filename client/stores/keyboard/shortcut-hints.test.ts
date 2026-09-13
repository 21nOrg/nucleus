import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { shortcutHints } from "./shortcut-hints.store";
import { uiState } from "@nucleum/stores/uiState/uiState.store";
import { appStore } from "@nucleum/stores/app.store";
import context from "@nucleum/stores/context.store";
import { Embed } from "@nucleum/client/runtime/context.type";
import { Product } from "@nucleum/client/config/product.type";
import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";

const originalApp = get(appStore);
const originalContext = get(context);
afterEach(() => {
  appStore.set(originalApp);
  context.set(originalContext);
  vi.restoreAllMocks();
});

describe("shortcut hint ownership", () => {
  it("updates when the product changes without requiring a menu component refresh", () => {
    vi.spyOn(uiState, "getState").mockImplementation((key, params) => {
      expect(key).toBe(UIState.hideShortcutHints);
      expect(params?.scope).toBe(UIStateScope.DEVICE);
      return get(appStore).product === Product.POINTRON;
    });
    context.set({ ...originalContext, embed: Embed.NONE });
    const states: boolean[] = [];
    const unsubscribe = shortcutHints.subscribe((value) =>
      states.push(value.isShowHotKeyHints)
    );
    try {
      appStore.initializeProductInformation({
        product: Product.POINTRON,
        env: "test"
      });
      expect(states.at(-1)).toBe(false);
      appStore.initializeProductInformation({
        product: Product.MEMOTRON,
        env: "test"
      });
      expect(states.at(-1)).toBe(true);
      context.set({ ...originalContext, embed: Embed.HANDSET });
      expect(states.at(-1)).toBe(false);
    } finally {
      unsubscribe();
    }
  });
});
