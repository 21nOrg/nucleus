<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import AutocompleteResultItem from "@21n/elements/autocomplete/AutocompleteResultItem.svelte";
  import type { AutocompleteListItemType } from "@21n/elements/autocomplete/autocompleteListItem.type";
  import { generateUID } from "@21n/utils/utils";
  import { TextInputStyle } from "@21n/elements/autocomplete/textinput.enum";
  import Chip from "@21n/elements/autocomplete/Chip.svelte";
  import { ChipVariant } from "@21n/elements/autocomplete/chipVariant.enum";
  import { Size } from "@21n/elements/size.enum";
  import FormControlLabel from "@21n/elements/text/formLabel/FormControlLabel.svelte";
  import Button from "@21n/elements/button/Button.svelte";

  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  let {
    listContainerStyle = "",
    listItemStyle = "",
    size = Size.md,
    parentBackgroundIndex = 1,
    inputStyle = TextInputStyle.OUTLINED,
    isListVisible = $bindable(false),
    options = [],
    placeholder = "",
    values = $bindable([]),
    label = "",
    chipsVariant = ChipVariant.FILLED,
    onListItemClick = undefined
  }: {
    listContainerStyle?: string;
    listItemStyle?: string;
    size?: Size;
    parentBackgroundIndex?: number;
    inputStyle?: TextInputStyle;
    isListVisible?: boolean;
    options?: AutocompleteListItemType[];
    placeholder?: string;
    values?: string[];
    label?: string;
    chipsVariant?: ChipVariant;
    onListItemClick?:
      ((event: CustomEvent<AutocompleteListItemType>) => void) | undefined;
  } = $props();
  void parentBackgroundIndex;

  const selected = $derived(options.filter((x) => values.includes(x.id)));

  let listContainerClassList = "bg-bgs2 shadow-sm shadow-fgs3";
  let isFocusing = $state(false);
  let inputValue = $state("");
  const wrapperId = generateUID(); // main wrapper, outside which if clicked then the list will be hidden
  let id = generateUID(); // this is the id of the input field
  let isActive = $state(false);
  const defaultInputClasses = $derived.by(() => {
    let classes = "text-input w-full rounded-sm";
    if (
      inputStyle === TextInputStyle.PLAIN ||
      inputStyle === TextInputStyle.OUTLINED
    ) {
      classes += " bg-transparent";
    } else if (inputStyle === TextInputStyle.WITH_BACKGROUND) {
      classes += " outline p-2";
    }
    if (inputStyle === TextInputStyle.OUTLINED) classes += " outline px-2 py-1";
    if (size == Size.xl) classes += " text-h3";
    else if (size == Size.lg || size == Size.md) classes += " text-base";
    else if (size == Size.sm) classes += " text-b2";
    else if (size == Size.xs) classes += " text-b3";
    return classes;
  });
  const filteredOptions = $derived.by(() => {
    if (!inputValue) return options;
    return options.filter((x) =>
      x.label.toLowerCase().includes(inputValue.toLowerCase())
    );
  });

  let selectedListItemIndex = $state(-1);

  function focusOnInput() {
    const input = document.getElementById(id);
    if (input) input.focus();
  }

  function toggleActiveState(value?: boolean) {
    if (value !== undefined) {
      isActive = value;
    } else {
      isActive = !isActive;
    }
    if (isActive) {
      focusOnInput();
    }
  }

  function actionsWhenClickOutside() {
    toggleActiveState(false);
    hideOptions();
    updateListVisibility(false);
  }

  function hideOptions() {
    selectedListItemIndex = -1;
    if (options === undefined || options.length === 0) return;
    isActive = false;
  }

  function performDefaultClickActions() {
    hideOptions();
    inputValue = "";
    focusOnInput();
    updateListVisibility(false);
  }

  function updateSelected({ label, id }: { label: string; id: string }) {
    if (selected.some((x) => x.id === id)) {
      values = selected.filter((x) => x.id !== id).map((x) => x.id);
    } else {
      values = [...selected, { label, id }].map((x) => x.id);
    }
  }

  function handleResultItemClick(detail: { label: string; id: string }) {
    onListItemClick?.(
      new CustomEvent("list-item-click", {
        detail
      })
    );
    updateSelected(detail);
    performDefaultClickActions();
  }

  function handleKeyDownInDropdown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      hideOptions();
    }
    if (event.key === "ArrowDown") {
      if (selectedListItemIndex < filteredOptions.length - 1) {
        selectedListItemIndex++;
      }
    }
    if (event.key === "ArrowUp") {
      if (selectedListItemIndex > 0) {
        selectedListItemIndex--;
      }
    }
    if (event.key === "Enter") {
      if (selectedListItemIndex > -1) {
        const { label, id } = filteredOptions[selectedListItemIndex];
        handleResultItemClick({ label, id });
        performDefaultClickActions();
      }
    }
  }

  function updateListVisibility(value: boolean) {
    isListVisible = value;
  }

  $effect(() => {
    selectedListItemIndex = -1;
    if (
      inputValue !== undefined &&
      inputValue !== null &&
      inputValue !== "" &&
      options.length !== 0
    ) {
      updateListVisibility(true);
    }
  });
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->

<div id={wrapperId} class="relative w-full">
  <div class="relative flex flex-col gap-1 w-full items-start">
    <FormControlLabel props={{ label }} forId={id} />
    <span class="flex w-full items-center gap-2">
      <span class="relative w-full">
        <span
          tabindex="0"
          onclick={() => {
            toggleActiveState(true);
            updateListVisibility(true);
          }}
          onkeydown={(e) => {
            if (e.key === "Enter") {
              toggleActiveState(true);
            }
          }}
          class="{'w-full flex flex-wrap p-2 gap-1'} {defaultInputClasses} outline-none border {isFocusing
            ? 'border-aps1'
            : 'border-brs3'}"
        >
          {#each selected as value}
            <Chip hideCloseIcon variant={chipsVariant}>{value.label}</Chip>
          {/each}
          <input
            {id}
            onfocusin={() => {
              toggleActiveState(true);
              updateListVisibility(true);
            }}
            type="text"
            {placeholder}
            bind:value={inputValue}
            oninput={(event) => {
              event.stopPropagation();
            }}
            onfocus={() => {
              isFocusing = true;
            }}
            onfocusout={() => {
              isFocusing = false;
            }}
            onkeydown={(event) => {
              event.stopPropagation();
              handleKeyDownInDropdown(event);
            }}
            class="bg-transparent pl-1 py-1 text-base min-w-[100px] flex-1 outline-none"
            aria-label="Search"
            aria-describedby="search-addon"
          />
        </span>
        {#if filteredOptions && filteredOptions.length > 0 && isListVisible}
          <!-- mt-1 is given because of the outline, since the outline is not the part of box model, it takes up extra space causing the overlap between outline, and the below list-->
          <div
            style={listContainerStyle}
            class={`absolute w-full z-[10] mt-1 max-h-[10rem] overflow-auto ${listContainerClassList}`}
          >
            {#each filteredOptions as listItem, index}
              <AutocompleteResultItem
                {...listItem}
                isSelected={selected.some((x) => x.id === listItem.id)}
                isActive={selectedListItemIndex === index}
                style={listItemStyle}
                onClick={handleResultItemClick}
              />
            {/each}

            <span class="w-full flex p-2 justify-center mb-1">
              <Button
                label="edit tags"
                size={Size.xs}
                parentBgIndex={2}
                onclick={() => {
                  requireCommandHost().runAction(PointronAction.TAGS);
                }}
              />
            </span>
          </div>
        {/if}
      </span>
      <Button
        icon="pencil-square"
        tooltip="Edit tags"
        parentBgIndex={2}
        onclick={() => {
          requireCommandHost().runAction(PointronAction.TAGS);
        }}
      />
    </span>
  </div>
</div>
