import { describe, expect, it } from "vitest";
import { resolveNavigationLinkTarget } from "./link-target";

describe("system link targets", () => {
  it.each(["mailto:person@example.com", "tel:+15551234567"])(
    "preserves the system handler for %s",
    (url) => {
      expect(
        resolveNavigationLinkTarget(url, "https://local.nucleum.app")
      ).toEqual({ kind: "system", url });
    }
  );

  it.each([
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,test"
  ])("rejects unsafe browser-normalized destinations: %s", (url) => {
    expect(
      resolveNavigationLinkTarget(url, "https://local.nucleum.app")
    ).toBeUndefined();
  });
});
