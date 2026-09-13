import { describe, expect, it } from "vitest";

import { resolveNavigationLinkTarget } from "@21n/layout/navigation/link-target";

describe("resolveNavigationLinkTarget", () => {
  const origin = "https://local.nucleum.app";

  it("keeps relative application paths inside the current app", () => {
    expect(resolveNavigationLinkTarget("/library?node=1", origin)).toEqual({
      kind: "internal",
      url: "/library?node=1"
    });
  });

  it("normalizes HTTP and HTTPS destinations", () => {
    expect(
      resolveNavigationLinkTarget("https://example.com/path", origin)
    ).toEqual({
      kind: "external",
      url: "https://example.com/path"
    });
    expect(resolveNavigationLinkTarget("//example.com/path", origin)).toEqual({
      kind: "external",
      url: "https://example.com/path"
    });
  });

  it("rejects non-web schemes even when their payload contains http", () => {
    expect(
      resolveNavigationLinkTarget(
        "javascript:window.location='https://example.com'",
        origin
      )
    ).toBeUndefined();
    expect(
      resolveNavigationLinkTarget("data:text/html,https://example.com", origin)
    ).toBeUndefined();
  });
});
