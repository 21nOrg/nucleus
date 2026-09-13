import { render, fireEvent, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), error: vi.fn() }));
vi.mock("@nucleum/components/files/FileView.svelte", () => ({
  default: () => {}
}));
vi.mock("@21n/elements/colorPicker/ColorPicker.svelte", () => ({
  default: () => {}
}));
vi.mock("@21n/elements/colorPicker/gradients/GradientsSelector.svelte", () => ({
  default: () => {}
}));
vi.mock("@21n/elements/coverPicker/UnsplashPicker.svelte", () => ({
  default: () => {}
}));
vi.mock("@21n/elements/coverPicker/CoverPickerFromLibrary.svelte", () => ({
  default: () => {}
}));
vi.mock("@nucleum/stores/files/file-upload", () => ({
  fileUpload: { uploadFileV2: mocks.upload }
}));
vi.mock("@nucleum/stores/notification.store", async (original) => ({
  ...(await original<object>()),
  toasts: { error: mocks.error }
}));
vi.mock("@nucleum/client/config/product-resources", async (original) => ({
  ...(await original<object>()),
  productHasResource: () => true
}));

import CoverPicker from "./CoverPicker.svelte";

describe("cover upload feedback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["photo.jpeg", "photo.heic"])("accepts %s", async (name) => {
    mocks.upload.mockResolvedValue([{ id: "file:cover" }]);
    const onSelect = vi.fn();
    const { container, getByText } = render(CoverPicker, { onSelect });
    const file = new File(["image"], name, { type: "image/jpeg" });
    await fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] }
    });
    await waitFor(() => expect(mocks.upload).toHaveBeenCalled());
    expect(mocks.upload.mock.calls[0][1]).toBe(name);
    await waitFor(() => expect(getByText("Click to replace")).toBeVisible());
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0][0].detail).toBe("file:cover");
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("reports rejected formats without uploading", async () => {
    const { container } = render(CoverPicker);
    await fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["text"], "cover.txt")] }
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(
      "Please select a JPG, JPEG, PNG, HEIC, or PDF file."
    );
  });

  it("reports upload rejection and clears the progress indicator", async () => {
    mocks.upload.mockRejectedValue(new Error("transport failed"));
    const { container, queryByText } = render(CoverPicker);
    await fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["image"], "cover.png")] }
    });
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "Failed to upload cover. Please try again."
      )
    );
    expect(queryByText("Uploading...")).toBeNull();
  });

  it("reports oversized files without uploading", async () => {
    const { container } = render(CoverPicker);
    const file = new File(["image"], "cover.png");
    Object.defineProperty(file, "size", { value: 16 * 1024 * 1024 });
    await fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] }
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(
      "Please select a file smaller than 15 MB."
    );
  });
});
