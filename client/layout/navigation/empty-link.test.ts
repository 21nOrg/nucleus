import { describe, expect, it } from "vitest";
import { resolveNavigationLinkTarget } from "./link-target";

describe("empty navigation targets", () => {
  it.each(["", " ", "\t\n"])("rejects empty input %j", (input) => {
    expect(
      resolveNavigationLinkTarget(input, "https://local.nucleum.app")
    ).toBeUndefined();
  });
});
