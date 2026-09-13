<script lang="ts">
  import { fileUpload } from "@nucleum/stores/files/file-upload";
  import { toasts } from "@nucleum/stores/notification.store";

  import modalEvent from "@nucleum/stores/overlays/modal.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import {
    BarStyle,
    PanelSwitcherStyle
  } from "@21n/elements/switcher/switcher.enum";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import Button from "@21n/elements/button/Button.svelte";
  import ColorPicker from "@21n/elements/colorPicker/ColorPicker.svelte";
  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import { onMount } from "svelte";
  import GradientsSelector from "@21n/elements/colorPicker/gradients/GradientsSelector.svelte";
  import { fileDrop } from "@nucleum/actions/fileDrop.action";
  import Icon from "@21n/elements/Icon.svelte";

  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import FileView from "@nucleum/components/files/FileView.svelte";
  import { FileType } from "@nucleum/stores/files/file.type";
  import { cn } from "@21n/utils/ui.utils";
  import ComingSoonView from "@21n/elements/ComingSoonView.svelte";
  import { Orientation } from "@21n/elements/direction.enum";
  import view from "@nucleum/stores/view.store";
  import UnsplashPicker from "@21n/elements/coverPicker/UnsplashPicker.svelte";
  import CoverPickerFromLibrary from "@21n/elements/coverPicker/CoverPickerFromLibrary.svelte";
  import { isRecordId } from "@nucleum/datafn/resource.utils";
  import { appStore } from "@nucleum/stores/app.store";
  import { productHasResource } from "@nucleum/client/config/product-resources";

  enum Method {
    COLOR = "color",
    GRADIENT = "gradient",
    LIBRARY = "library",
    UNSPLASH = "unsplash",
    AI = "ai"
  }

  let {
    orientation = Orientation.Vertical,
    value = undefined,
    onClose: onCloseCallback = undefined,
    onChange = undefined,
    onSelect = undefined
  }: {
    orientation?: Orientation;
    value?: IRecordId | undefined;
    onClose?: ((event: CustomEvent<void>) => void) | undefined;
    onChange?: ((event: CustomEvent<string>) => void) | undefined;
    onSelect?: ((event: CustomEvent<string>) => void) | undefined;
  } = $props();
  const isFileUploadAvailable = $derived(
    productHasResource($appStore.product, Resource.file)
  );

  let selectedMethod = $state<Method>(Method.COLOR);
  let _value = $state<string>("#000000");
  let isUploadInProgress = $state(false);

  $effect(() => {
    _value = transformValue(value) ?? "#000000";
  });

  onMount(async () => {
    if ($view.isConstrainedWidth) {
      orientation = Orientation.Vertical;
    }
  });

  function transformValue(value: IRecordId | undefined) {
    if (!value) return;
    if (typeof value === "string") {
      if (value.includes("gradient")) {
        return value.replace("gradient_", "");
      } else if (value.includes("hex")) {
        return value.replace("hex_", "");
      }
    }
    return value;
  }

  function handleClose() {
    onCloseCallback?.(new CustomEvent("close"));
    modalEvent.hide(Action.COVER_PICKER);
  }

  function handleColorChange(value: number | string) {
    if (typeof value === "string") {
      console.log("[CoverPicker.handleColorChange]", value);
      onChange?.(
        new CustomEvent("change", {
          detail: `hex_${value}`
        })
      );
    }
  }

  function handleColorChangeDebounced(value: number | string) {
    if (typeof value === "string") {
      console.log("[CoverPicker.handleColorChangeDebounced]", value);
      onSelect?.(
        new CustomEvent("select", {
          detail: `hex_${value}`
        })
      );
    }
  }

  function handleGradientChange(value: string) {
    onSelect?.(
      new CustomEvent("select", {
        detail: `gradient_${value}`
      })
    );
  }
  async function handleDrop(
    _allFiles: File[],
    validFiles: File[],
    errors: { file: File; type: string }[]
  ) {
    if (errors.length > 0) {
      toasts.error(
        errors.some((error) => error.type === "size")
          ? "Please select a file smaller than 15 MB."
          : "Please select a JPG, JPEG, PNG, HEIC, or PDF file."
      );
      return;
    }
    const file = validFiles[0];
    if (!file) return;
    isUploadInProgress = true;

    try {
      const imageLocalURL = new Blob([file], { type: file.type });
      const response = await fileUpload.uploadFileV2(
        file.type,
        file.name,
        imageLocalURL
      );

      if (response) {
        const uploadedId = response[0]?.id;
        if (!uploadedId) {
          toasts.error("Failed to upload cover. Please try again.");
          return;
        }
        value = uploadedId;
        _value = uploadedId;
        onSelect?.(
          new CustomEvent("select", {
            detail: uploadedId
          })
        );
      } else {
        toasts.error("Failed to upload cover. Please try again.");
      }
    } catch {
      toasts.error("Failed to upload cover. Please try again.");
    } finally {
      isUploadInProgress = false;
    }
  }

  function resolvePanelSwitcherItems(isFileUploadAvailable: boolean) {
    const baseItems = [
      {
        label: "Color",
        value: Method.COLOR,
        //   icon: "mage:color-picker"
        icon: "lets-icons:color-picker"
      },
      {
        label: "Gradient",
        value: Method.GRADIENT,
        //   icon: "carbon:color-switch"
        icon: "lets-icons:color-mode-light"
      },
      {
        label: "Unsplash",
        value: Method.UNSPLASH,
        icon: "fa6-brands:unsplash"
      },
      {
        label: "AI",
        value: Method.AI,
        icon: "magic-wand",
        isDisabled: true,
        badge: "soon"
      }
    ];
    if (!isFileUploadAvailable) {
      return baseItems;
    }
    const fromLibary = {
      label: "Library",
      value: Method.LIBRARY,
      icon: "globe"
    };
    return [...baseItems.slice(0, 3), fromLibary, ...baseItems.slice(3)];
  }
</script>

<div class="flex flex-col gap-6 w-full h-full p-6">
  <div class="flex flex-row items-center justify-between">
    <Text content="Pick a cover" style={TextStyle.PANEL_HEADING} />
    <Button icon="cross" onclick={handleClose} />
  </div>
  <div
    class={cn("flex flex-1 gap-6 w-full overflow-auto", {
      "flex-col": orientation === Orientation.Vertical
    })}
  >
    {#if isFileUploadAvailable}
      <div
        class={cn({
          "h-full w-80": orientation === Orientation.Horizontal,
          "w-full py-8 h-40": orientation === Orientation.Vertical
        })}
      >
        <div
          class="flex flex-col gap-3 items-center justify-center h-full w-full bg-bgs2 rounded-md border border-brs3 border-dashed"
          use:fileDrop={{
            accept: ".jpg,.jpeg,.png,.heic,.pdf",
            multiple: false,
            maxSize: 15 * 1024 * 1024,
            onDrop: handleDrop
          }}
        >
          {#if isUploadInProgress}
            <span class="flex items-center gap-2 text-fgs1">
              <Icon icon="svg-spinners:90-ring-with-bg" class="stroke-fgs1" />
              <span>Uploading...</span>
            </span>
          {:else if isRecordId(_value, Resource.file)}
            <div class="flex w-full h-full items-center gap-2">
              <div class="flex w-40 h-full">
                {#key _value}
                  <FileView
                    id={_value}
                    isLazyLoad={false}
                    type={FileType.IMAGE}
                    class={cn("h-full w-full rounded-l-md object-cover", {})}
                  />
                {/key}
              </div>
              <span class="text-fgs1">Click to replace</span>
            </div>
          {:else}
            <span class="text-fgs1">Drag and drop / click to upload</span>
            <span class="text-fgs3 text-b3">or choose from below</span>
          {/if}
        </div>
      </div>
    {/if}
    <div
      class={cn("flex flex-col gap-4 flex-1 overflow-auto", {
        "w-full": orientation === Orientation.Vertical,
        "h-full": orientation === Orientation.Horizontal
      })}
    >
      <PanelSwitcher
        barStyle={BarStyle.EXACT}
        bind:value={selectedMethod}
        items={resolvePanelSwitcherItems(isFileUploadAvailable)}
        style={PanelSwitcherStyle.BAR}
        isExpandToFullWidth={true}
        onSwitch={() => {}}
      ></PanelSwitcher>
      {#if selectedMethod === Method.COLOR}
        <div class="flex-1 flex items-center justify-center">
          <ColorPicker
            isHueMode={false}
            isShowPreview={false}
            onChangeCallback={handleColorChange}
            onDebouncedChangeCallback={handleColorChangeDebounced}
            bind:hex={_value}
          />
        </div>
      {:else if selectedMethod === Method.GRADIENT}
        <GradientsSelector
          onChange={handleGradientChange}
          value={_value ?? ""}
        />
      {:else if selectedMethod === Method.LIBRARY}
        <CoverPickerFromLibrary
          onSelect={(e) => {
            if (e.detail.file) {
              const _id = isRecordId(e.detail.file)
                ? e.detail.file
                : e.detail.file.id;
              if (!_id) return;
              value = _id;
              _value = _id;
              onSelect?.(
                new CustomEvent("select", {
                  detail: _id
                })
              );
            }
          }}
        />
      {:else if selectedMethod === Method.UNSPLASH}
        <UnsplashPicker {onSelect} />
      {:else}
        <div class="flex flex-1 w-full items-center justify-center">
          <ComingSoonView />
        </div>
      {/if}
    </div>
  </div>
</div>
