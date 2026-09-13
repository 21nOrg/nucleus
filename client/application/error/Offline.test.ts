import Offline from "@nucleum/application/error/Offline.svelte";
import { render, fireEvent } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import { expectAccessible } from "@tests/utils/accessibility";

const mockGotoPath = vi.hoisted(() => vi.fn());
const mockAppStore = vi.hoisted(() => {
  const { writable } = require("svelte/store");
  return writable({ currentPath: "/focus" });
});

vi.mock("@nucleum/stores/app.store", () => ({
  appStore: {
    subscribe: mockAppStore.subscribe
  }
}));

vi.mock("@21n/layout/navigation/navigation", () => ({
  navigation: { gotoPath: mockGotoPath }
}));

describe("Offline component", () => {
  it("prompts the app store to retry the current path", async () => {
    const { getByRole, container } = render(Offline);

    const button = getByRole("button", { name: /try again/i });
    await fireEvent.click(button);

    expect(mockGotoPath).toHaveBeenCalledWith("/focus");
    await expectAccessible(container);
  });
});
