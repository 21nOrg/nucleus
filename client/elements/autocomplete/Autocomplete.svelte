<script lang="ts">
  import { onMount } from "svelte";
  import AutocompleteResultItem from "@21n/elements/autocomplete/AutocompleteResultItem.svelte";
  import type { AutocompleteListItemType } from "@21n/elements/autocomplete/autocompleteListItem.type";
  import { generateUID } from "@21n/utils/utils";
  import Icon from "@21n/elements/Icon.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { cn } from "@21n/utils/ui.utils";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import type { IEvent } from "@21n/elements/input/event.type";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  let {
    wrapperClassList = "w-full",
    wrapperStyle = "",
    inputClassList = "text-bgs2",
    inputStyle = "",
    listContainerClassList = "bg-bgs2",
    listContainerStyle = "",
    listItemClassList = "hover:bg-bgs3",
    listItemStyle = "",
    activeListItemClassList = "bg-bgs3",
    areOptionsVisible = $bindable(false),
    escapeDefaultClickBehaviour = false,
    hideSearchIcon = false,
    hideResetIcon = false,
    icon = "",
    options = [],
    placeholder = "",
    inputValue = $bindable(""),
    value = $bindable(null),
    onListItemClick = undefined,
    onReset: onResetCallback = undefined,
    onSearch: onSearchCallback = undefined
  }: {
    wrapperClassList?: string;
    wrapperStyle?: string;
    inputClassList?: string;
    inputStyle?: string;
    listContainerClassList?: string;
    listContainerStyle?: string;
    listItemClassList?: string;
    listItemStyle?: string;
    activeListItemClassList?: string;
    areOptionsVisible?: boolean;
    escapeDefaultClickBehaviour?: boolean;
    hideSearchIcon?: boolean;
    hideResetIcon?: boolean;
    icon?: string;
    options?: AutocompleteListItemType[];
    placeholder?: string;
    inputValue?: string;
    value?: AutocompleteListItemType | null;
    onListItemClick?:
      ((event: CustomEvent<AutocompleteListItemType>) => void) | undefined;
    onReset?: ((event: CustomEvent<void>) => void) | undefined;
    onSearch?: ((event: CustomEvent<void>) => void) | undefined;
  } = $props();
  const containerId = generateUID();

  let inputRef = $state<HTMLInputElement | undefined>();
  let selectedListItemIndex = $state(-1);
  let tempOptions = $state<AutocompleteListItemType[]>([]);

  onMount(() => {
    const appEventSub = appEvents.subscribe((x: IEvent) => {
      if (x.event === GlobalEvent.ACTIVATE_SEARCH_BOX) {
        focus();
      }
    });
    return () => {
      if (appEventSub) appEventSub();
    };
  });

  function hideOptions() {
    selectedListItemIndex = -1;
    if (options === undefined || options.length === 0) return;
    areOptionsVisible = false;
  }

  function performDefaultClickActions() {
    hideOptions();
  }

  function updateValue(detail: { label: string; id: string }) {
    inputValue = detail.label;
    value = detail;
  }

  function handleResultItemClick(detail: { label: string; id: string }) {
    onListItemClick?.(
      new CustomEvent("list-item-click", {
        detail
      })
    );
    updateValue(detail);
    if (!escapeDefaultClickBehaviour) {
      performDefaultClickActions();
    }
  }

  export function focus() {
    if (inputRef) inputRef.focus();
  }

  function onFocus() {
    updateListVisibility(true);
    tempOptions = options;
  }

  function handleReset() {
    inputValue = "";
    value = null;
    onResetCallback?.(new CustomEvent("reset"));
  }

  function updateListVisibility(value: boolean) {
    areOptionsVisible = value;
  }

  function onInputChange() {
    value = options.find((x) => x.label === inputValue) ?? null;
  }

  function handleKeyDownInDropdown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      hideOptions();
    }
    if (event.key === "ArrowDown") {
      if (selectedListItemIndex < tempOptions.length - 1) {
        selectedListItemIndex++;
      }
    }
    if (event.key === "ArrowUp") {
      if (selectedListItemIndex > -1) {
        selectedListItemIndex--;
      }
    }
    if (event.key === "Enter") {
      if (selectedListItemIndex > -1) {
        const { label, id } = tempOptions[selectedListItemIndex];
        onListItemClick?.(
          new CustomEvent("list-item-click", {
            detail: { label, id }
          })
        );
        updateValue({ label, id });
        if (!escapeDefaultClickBehaviour) {
          performDefaultClickActions();
        }
      }
    }
  }

  $effect(() => {
    selectedListItemIndex = -1;
    if (!inputValue) {
      tempOptions = options;
      return;
    }
    if (value) {
      updateListVisibility(false);
    } else if (
      inputValue !== undefined &&
      inputValue !== null &&
      inputValue !== "" &&
      options.length !== 0
    ) {
      updateListVisibility(true);
      tempOptions = options.filter((x) =>
        x.label.toLowerCase().includes(inputValue.toLowerCase())
      );
    }
  });
</script>

<div
  id={containerId}
  style={wrapperStyle}
  class={`relative ${wrapperClassList}`}
>
  <div class="realtive flex items-center w-full">
    {#if icon || !hideSearchIcon}
      <div
        class="absolute ml-2.5 min-w-[1rem] flex justify-center items-center w-4 h-4"
      >
        {#if icon}
          <Icon {icon} size={Size.sm} />
        {:else if !hideSearchIcon}
          <Icon size={Size.sm} icon="search" />
        {/if}
      </div>
    {/if}
    {#if !hideResetIcon}
      <div
        class="absolute right-0 mr-2.5 min-w-[1rem] flex justify-center items-center w-4 h-4"
      >
        <Icon onclick={handleReset} size={Size.sm} icon="cross" />
      </div>
    {/if}

    <input
      style={inputStyle}
      type="text"
      bind:this={inputRef}
      bind:value={inputValue}
      oninput={(event) => {
        event.stopPropagation();
        onInputChange();
      }}
      onfocus={onFocus}
      onkeydown={(event) => {
        event.stopPropagation();
        handleKeyDownInDropdown(event);
      }}
      onkeyup={(event) => {
        event.stopPropagation();
        onSearchCallback?.(new CustomEvent("search"));
      }}
      class={cn(
        "outline-none w-full py-2 px-2.5 text-b2 bg-bgs2",
        inputClassList,
        {
          "pl-8": !(hideSearchIcon && !icon)
        }
      )}
      {placeholder}
      aria-label="Search"
      aria-describedby="search-addon"
    />
  </div>
  {#if tempOptions && tempOptions.length > 0 && areOptionsVisible}
    <div
      style={listContainerStyle}
      class={`absolute w-full z-[10] max-h-[10rem] overflow-auto ${listContainerClassList}`}
    >
      {#each tempOptions as listItem, index}
        <AutocompleteResultItem
          {...listItem}
          classList={{
            common: listItemClassList,
            active: activeListItemClassList
          }}
          isActive={selectedListItemIndex === index}
          style={listItemStyle}
          onClick={handleResultItemClick}
        />
      {/each}
    </div>
  {/if}
</div>
