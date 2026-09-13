<script lang="ts">
  import { Resource } from "@nucleum/datafn/resource.enum";
  import Button from "@21n/elements/button/Button.svelte";
  import Divider from "@21n/elements/Divider.svelte";
  import { ColorStrength } from "@21n/theme/appearance.type";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { Size } from "@21n/elements/size.enum";
  import { onMount } from "svelte";
  import SwitchInput from "@21n/elements/toggle/SwitchInput.svelte";
  import { Orientation } from "@21n/elements/direction.enum";
  import { SearchType } from "@nucleum/schema/legacy/data.type";
  import { InputStyle } from "@21n/elements/input/input.type";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import type { IEvent } from "@21n/elements/input/event.type";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import ShortcutText from "@21n/elements/text/ShortcutText.svelte";
  let {
    resource,
    searchQuery = $bindable(""),
    searchType = SearchType.FULL_TEXT,
    selectedSubType,
    onRefresh = undefined,
    onSemanticSearch = undefined
  }: {
    resource: Resource;
    searchQuery?: string;
    searchType?: SearchType;
    selectedSubType: any;
    onRefresh?: ((event: CustomEvent<void>) => void) | undefined;
    onSemanticSearch?: ((event: CustomEvent<boolean>) => void) | undefined;
  } = $props();
  let isFiltersVisible = $state(false);
  let isSearchFocused = $state(false);
  let dev_enableSemanticSearch = $state(false);
  let searchInputRef: HTMLInputElement;
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

  function onKeydown(event: any) {}
  function onKeyup(event: any) {
    refresh();
  }
  function refresh() {
    const refreshEvent = new CustomEvent<void>("refresh");
    onRefresh?.(refreshEvent);
  }

  function emitSemanticSearch(value: boolean) {
    const semanticSearchEvent = new CustomEvent<boolean>("semanticSearch", {
      detail: value
    });
    onSemanticSearch?.(semanticSearchEvent);
  }
</script>

<div class="flex flex-col bg-bgs1 sticky top-0 z-20 shadow--sm">
  <div class="flex w-full justify-between p-5 py-4 pt-5 leading-none">
    <input
      id="librarysearchbox"
      data-testid={"search-" + resource + "s"}
      class="text-h2 w-full bg-transparent focus:outline-none focus:border-none"
      type="text"
      bind:this={searchInputRef}
      bind:value={searchQuery}
      oninput={refresh}
      onkeydown={onKeydown}
      onkeyup={onKeyup}
      onfocus={() => (isSearchFocused = true)}
      onblur={() => (isSearchFocused = false)}
      placeholder={"Search " + resource + "s"}
    />
    <div class="flex items-center gap-2">
      <span>
        <ShortcutText
          shortcut={GlobalEvent.ACTIVATE_SEARCH_BOX}
          parentBgIndex={0}
        />
      </span>
      {#if dev_enableSemanticSearch && $userPreferences.localAI.semanticSearch && (selectedSubType === "nodular_markdown" || selectedSubType === "all")}
        <SwitchInput
          label={{ label: "Semantic", orientation: Orientation.Horizontal }}
          size={Size.sm}
          style={InputStyle.PLAIN}
          onChange={(e) => emitSemanticSearch(e.detail)}
          checked={searchType === SearchType.SEMANTIC}
        />
      {/if}
      {#if isFiltersVisible}
        <Button
          icon="funnel"
          style={ButtonStyle.OUTLINED}
          size={Size.sm}
          label="Filters"
        />
        <Button
          icon="bars-center-left"
          style={ButtonStyle.OUTLINED}
          size={Size.sm}
          label="Sort"
        />
      {/if}
      <!-- {#if variant === "v1" || variant === "v3"}
        <Toggle icon="sliders" bind:on={isFiltersVisible} />
      {/if} -->
    </div>
  </div>
  <Divider
    colorStrength={isSearchFocused
      ? ColorStrength.ExtraStrong
      : ColorStrength.Normal}
  />
</div>

<style>
  input::placeholder {
    font-weight: 300;
    /* Avenir needs to be lighter */
    /* font-weight: lighter; */
    /* font-style: italic; */
    color: rgba(var(--colors-fgs2), 0.4);
  }
</style>
