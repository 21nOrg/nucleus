<script lang="ts">
  import type { Snippet } from "svelte";
  import { InputStyle } from "@21n/elements/input/input.type";
  import TextInput from "@21n/elements/input/TextInput.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { onMount, tick } from "svelte";
  import ShortcutText from "@21n/elements/text/ShortcutText.svelte";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import type { IEvent } from "@21n/elements/input/event.type";
  import { cn } from "@21n/utils/ui.utils";
  import { debouncer } from "@21n/utils/utils";
  let {
    query = $bindable(""),
    size = Size.md,
    placeholder = "Search",
    parentBgIndex = 1,
    style = InputStyle.PLAIN,
    isPadded = false,
    padding = "",
    testId = undefined,
    children = undefined,
    onEnter = undefined,
    onFocus = undefined,
    onSearch = undefined
  }: {
    query?: string;
    size?: Size;
    placeholder?: string;
    parentBgIndex?: number;
    style?: InputStyle;
    isPadded?: boolean;
    padding?: string;
    testId?: string | undefined;
    children?: Snippet | undefined;
    onEnter?: ((query: string) => void) | undefined;
    onFocus?: (() => void) | undefined;
    onSearch?: ((query: string) => void) | undefined;
  } = $props();
  let searchInputRef: any;
  let isSearchFocused = $state(false);

  onMount(() => {
    const appEventSub = appEvents.subscribe((x: IEvent) => {
      if (x.event === GlobalEvent.ACTIVATE_SEARCH_BOX) {
        requestAnimationFrame(() => {
          searchInputRef?.focus();
        });
      }
    });
    return () => {
      appEventSub();
    };
  });

  export async function focus() {
    await tick();
    searchInputRef?.focus();
  }

  export function blur() {
    searchInputRef?.blur();
  }

  function propagate() {
    onSearch?.(query);
  }

  const debouncedSearch = debouncer(propagate, 500);
</script>

<div
  class={cn("flex items-center w-full gap-2", padding, {
    "border-b": style === InputStyle.PLAIN,
    "h-10": size === Size.sm,
    "min-h-12": size === Size.md,
    "min-h-14": size === Size.lg,
    "px-4": isPadded && !padding,
    "border-fgs3 border-opacity-80": isSearchFocused,
    "border-brs2": !isSearchFocused
  })}
>
  <TextInput
    bind:this={searchInputRef}
    bind:value={query}
    {size}
    {placeholder}
    {style}
    {testId}
    parentBackgroundIndex={parentBgIndex}
    isRounded={true}
    height="h-10"
    icon={style === InputStyle.PLAIN ? undefined : "search"}
    isShowClearControl={query !== ""}
    onFocus={() => {
      isSearchFocused = true;
      onFocus?.();
    }}
    onBlur={() => (isSearchFocused = false)}
    onCancel={() => {
      query = "";
      onSearch?.(query);
    }}
    onChange={debouncedSearch}
    onEnter={() => onEnter?.(query)}
  >
    {#if children}
      {@render children()}
    {:else}
      <span>
        <ShortcutText
          shortcut={GlobalEvent.ACTIVATE_SEARCH_BOX}
          {parentBgIndex}
        />
      </span>
    {/if}
  </TextInput>
</div>
