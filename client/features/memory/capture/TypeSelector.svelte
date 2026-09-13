<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { CaptureMethod } from "@nucleum/features/memory/capture/capture.type";
  import { MemotronAction } from "@nucleum/features/memory/memory-action.enum";
  import Button from "@21n/elements/button/Button.svelte";
  import type { ISelectItem } from "@21n/elements/select/select.type";
  import { Size } from "@21n/elements/size.enum";

  import TypeSelectorItem from "@nucleum/features/memory/capture/typeSelector/TypeSelectorItem.svelte";
  import Text from "@21n/elements/text/Text.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import Icon from "@21n/elements/Icon.svelte";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import {
    CollectionObjectKey,
    type ICollectionThumb
  } from "@nucleum/features/collections/collection.type";
  import context from "@nucleum/stores/context.store";
  import { cn } from "@21n/utils/ui.utils";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState } from "@nucleum/stores/uiState/uiState.type";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";

  let {
    selected,
    isHideTypeShortcuts = false,
    onSelect = undefined,
    onCapture = undefined
  }: {
    selected: string;
    isHideTypeShortcuts?: boolean;
    onSelect?: ((value: string) => void) | undefined;
    onCapture?: ((event: Event) => void) | undefined;
  } = $props();
  let dev_isEnableEditShortcuts: boolean = true;
  const isDev = import.meta.env.DEV;
  const dev_isBoxed: boolean = true;
  const shortcutStore = $derived.by(() => {
    if (isHideTypeShortcuts) return undefined;
    return toSvelteStore<ICollectionThumb[]>(
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
  });
  const shortcutRecords = $derived(shortcutStore ? $shortcutStore!.data : []);
  const types = $derived(resolveTypes(shortcutRecords));
  const isLoading = $derived(Boolean(shortcutStore && $shortcutStore!.loading));

  const contentTypes: (ISelectItem & { value: string })[] = [
    {
      value: CaptureMethod.MARKDOWN,
      label: "Page",
      icon: "markdown"
    },
    {
      value: CaptureMethod.NOTE,
      label: "Note",
      icon: "note-blank"
    },
    {
      icon: "microphone",
      value: CaptureMethod.AUDIO
    },
    {
      icon: "camera",
      value: CaptureMethod.CAMERA
    },
    ...(isDev
      ? [
          {
            icon: "canvas",
            value: CaptureMethod.CANVAS,
            label: "Canvas"
          },
          {
            icon: "ri:sketching",
            value: CaptureMethod.SKETCH,
            label: "Freehand"
          },
          {
            icon: "globe",
            value: CaptureMethod.WEB,
            label: "Web artifact"
          }
        ]
      : []),
    {
      icon: "upload",
      value: CaptureMethod.UPLOAD
    },
    ...(!$context.isEmbed
      ? [
          {
            icon: "clipboard",
            value: CaptureMethod.PASTE
          }
        ]
      : [])
  ];

  function resolveTypes(shortcuts: ICollectionThumb[]) {
    const recents =
      uiState
        .getState(UIState.captureShortcutRecents)
        ?.map((x: IRecordId) => x.toString()) ?? [];
    const types = shortcuts
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
    return [...contentTypes, ...(isHideTypeShortcuts ? [] : types)];
  }
</script>

<div class="w-full flex flex-col items-center gap-3 dp:gap-4">
  {#if !dev_isBoxed}
    <div class="self-start">
      <Text content="Select a type" style={TextStyle.SECTION_HEADING} />
    </div>
  {/if}
  {#if isLoading}
    <div class="flex justify-center bg-bgs1" role="status" aria-label="Loading">
      <Icon icon="svg-spinners:3-dots-fade" />
    </div>
  {:else}
    <div
      class={cn(
        "grid mo:grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] w-full",
        {
          "gap-2 dp:gap-4 grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]":
            !dev_isBoxed,
          "gap-0.5 bg-bgs2 rounded-md border-2 border-bgs2 overflow-hidden grid-cols-4":
            dev_isBoxed
        }
      )}
    >
      {#each types as item, index}
        <div
          class={cn({
            "col-span-3": types.length % 4 === 1 && index === types.length - 1
          })}
        >
          <TypeSelectorItem
            {item}
            isActive={selected === item.value}
            isBoxed={true}
            {onSelect}
            {onCapture}
          />
        </div>
      {/each}
      {#if dev_isEnableEditShortcuts && dev_isBoxed}
        <button
          class={cn(
            "flex justify-center items-center bg-bgs1 min-h-12 notouch:hover:bg-bgs1-striped active:bg-bgs2",
            {
              "col-span-4": types.length % 4 === 0,
              "col-span-2": types.length % 4 === 2,
              "w-full h-full col-span-1": types.length % 4 !== 0
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
  {/if}
  {#if !dev_isBoxed && dev_isEnableEditShortcuts}
    <Button
      label="Edit shortcuts"
      style={ButtonStyle.PLAIN}
      isUnderlined={true}
      size={Size.sm}
      onclick={() => {
        requireCommandHost().runAction(MemotronAction.CAPTURE_SETTINGS);
      }}
    />
  {/if}
</div>
