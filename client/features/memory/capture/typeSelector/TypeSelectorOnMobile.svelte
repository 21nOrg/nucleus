<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { Size } from "@21n/elements/size.enum";
  import CaptureDraftsAction from "@nucleum/features/memory/capture/draftSelector/CaptureDraftsAction.svelte";
  import { CaptureMethod } from "@nucleum/features/memory/capture/capture.type";
  import { cn } from "@21n/utils/ui.utils";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import TypeSelectorItem from "@nucleum/features/memory/capture/typeSelector/TypeSelectorItem.svelte";
  import InlineErrorMessage from "@21n/elements/text/InlineErrorMessage.svelte";
  import Icon from "@21n/elements/Icon.svelte";

  import { Resource } from "@nucleum/datafn/resource.enum";
  import { MemotronAction } from "@nucleum/features/memory/memory-action.enum";
  import {
    CollectionObjectKey,
    type ICollectionThumb
  } from "@nucleum/features/collections/collection.type";
  import context from "@nucleum/stores/context.store";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState } from "@nucleum/stores/uiState/uiState.type";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  type IBaseType = {
    icon: string;
    label: string;
    value: CaptureMethod;
  };
  let {
    selected = undefined,
    isBoxedLayout = true,
    onSelect = undefined,
    onCapture = undefined,
    onCancel = undefined,
    onDraftSelect = undefined
  }: {
    selected?: CaptureMethod | undefined;
    isBoxedLayout?: boolean;
    onSelect?: ((value: string) => void) | undefined;
    onCapture?: ((event: Event) => void) | undefined;
    onCancel?: (() => void) | undefined;
    onDraftSelect?: ((draft: any) => void) | undefined;
  } = $props();
  const isDev = import.meta.env.DEV;
  const shortcutStore = toSvelteStore<ICollectionThumb[]>(
    datafn.collection.signal({
      select: [
        "id",
        "label",
        "avatar",
        "resource",
        "updatedAt",
        CollectionObjectKey.isCaptureShortcutEnabled
      ],
      filters: {
        [CollectionObjectKey.isCaptureShortcutEnabled]: true
      }
    }),
    { initialData: [] }
  );
  const baseTypes = [
    { icon: "microphone", label: "Record", value: CaptureMethod.AUDIO },
    { icon: "camera", label: "Camera", value: CaptureMethod.CAMERA },
    ...(isDev
      ? [
          {
            icon: "ri:sketching",
            label: "Sketch",
            value: CaptureMethod.SKETCH
          },
          {
            icon: "scan",
            label: "Scan",
            value: CaptureMethod.SCAN
          },
          {
            icon: "globe",
            label: "From web",
            value: CaptureMethod.WEB
          }
        ]
      : []),
    { icon: "upload", label: "File", value: CaptureMethod.UPLOAD },
    !$context.isEmbed && {
      icon: "clipboard",
      label: "Paste",
      value: CaptureMethod.PASTE
    }
  ].filter((item): item is IBaseType => Boolean(item));
  const types = $derived(resolveTypes($shortcutStore.data));

  function resolveTypes(shortcuts: ICollectionThumb[]) {
    const recents =
      uiState
        .getState(UIState.captureShortcutRecents)
        ?.map((x: IRecordId) => x.toString()) ?? [];
    const typesResult = shortcuts
      .filter((type: any) => !type.resource || type.resource === Resource.node)
      .map((type: any) => ({
        value: type.id,
        label: type.label,
        icon: type.avatar,
        isShortcut: true
      }))
      .sort((a: any, b: any) => {
        const aIndex = recents.indexOf(a.value.toString());
        const bIndex = recents.indexOf(b.value.toString());
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return 0;
      });
    return [
      ...baseTypes,
      ...(typesResult && Array.isArray(typesResult) ? typesResult : [])
    ];
  }

  function handleDraftSelect(draft: any) {
    onDraftSelect?.(draft);
  }
</script>

<div class="flex--1">
  <div
    class={cn("grid grid-cols-3", {
      "bg-bgs3 gap-[1px] py-[1px]": isBoxedLayout,
      "gap-3": !isBoxedLayout
    })}
  >
    {#if $shortcutStore.loading}
      <div class="col-span-3 flex justify-center bg-bgs1">
        <Icon icon="svg-spinners:3-dots-fade" />
      </div>
    {:else if $shortcutStore.error}
      {#each baseTypes as item}
        <TypeSelectorItem
          {item}
          isActive={selected === item.value}
          {onSelect}
          {onCapture}
          {onCancel}
          isBoxed={isBoxedLayout}
        />
      {/each}
      <div class="col-span-3 bg-bgs1 py-2">
        <InlineErrorMessage error="Error loading types." isDissappear={false} />
      </div>
    {:else}
      {#each types as item, index (item.value)}
        <div
          class={cn({
            "col-span-2": types.length % 3 === 1 && index === types.length - 1
          })}
        >
          <TypeSelectorItem
            {item}
            isActive={selected === item.value}
            {onSelect}
            {onCapture}
            {onCancel}
            isBoxed={isBoxedLayout}
          />
        </div>
      {/each}

      <button
        class={cn(
          "flex justify-center items-center bg-bgs1 min-h-12 notouch:hover:bg-bgs2 active:bg-bgs2",
          {
            "col-span-3": types.length % 3 === 0,
            "w-full h-full col-span-1": types.length % 3 !== 0
          }
        )}
        onclick={() => {
          requireCommandHost().runAction(MemotronAction.CAPTURE_SETTINGS);
        }}
      >
        <Icon icon="more-outline-horizontal" />
      </button>
    {/if}
  </div>
  <div class="mt-6">
    <CaptureDraftsAction onSelect={handleDraftSelect} size={Size.sm} />
  </div>
  <ScrollViewBottomSpacer />
</div>
