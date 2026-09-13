import "fake-indexeddb/auto";
import { Blob } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fileUpload } from "./file-upload";
import account from "@nucleum/stores/account.store";
import {
  datafn,
  destroyNucleumDatafn,
  initializeNucleumDatafn
} from "@nucleum/datafn/datafn.store";
import { Product } from "@nucleum/client/config/product.type";
import { UserDataMode } from "@nucleum/client/runtime/account/account.type";
import { persistenceInstance } from "@nucleum/persistence/persistence";

const initialAccount = account.get();
afterEach(async () => {
  await destroyNucleumDatafn();
  account.set(initialAccount);
  vi.restoreAllMocks();
});

describe("shared file upload", () => {
  it("stores offline bytes and metadata durably without requesting a signed URL", async () => {
    const boot = {
      product: Product.MEMOTRON,
      account: { dataMode: UserDataMode.LOCAL, userId: "file-upload-test" },
      dapId: "fixture",
      env: `test-${crypto.randomUUID()}`
    };
    await initializeNucleumDatafn(boot);
    account.set({ ...initialAccount, dataMode: UserDataMode.LOCAL });
    const signedUrl = vi.spyOn(persistenceInstance, "getSignedUrl");
    const blob = new Blob(["durable file content"], { type: "text/plain" });
    const result = await fileUpload.uploadFileV2(
      "text/plain",
      "a file.txt",
      blob as globalThis.Blob
    );
    expect(Array.isArray(result)).toBe(true);
    const file = (result as Array<{ id: string; label: string }>)[0];
    expect(file.label).toBe("a_file.txt");
    expect(signedUrl).not.toHaveBeenCalled();
    await destroyNucleumDatafn();
    await initializeNucleumDatafn(boot);
    const saved = await datafn.file.query({ filters: { id: file.id } });
    expect(saved.data?.[0]?.label).toBe("a_file.txt");
    expect(Array.from(saved.data?.[0]?.data as Uint8Array)).toEqual(
      Array.from(new TextEncoder().encode("durable file content"))
    );
  });
});
