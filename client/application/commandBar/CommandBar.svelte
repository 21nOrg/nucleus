<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { onMount } from "svelte";
  import { ActionType, type IAction } from "@nucleum/client/config/action.type";
  import SearchActionResults from "@nucleum/application/commandBar/SearchActionResults.svelte";
  import CmdResults from "@nucleum/application/commandBar/CmdResults.svelte";
  import { Size } from "@21n/elements/size.enum";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import modalEvent from "@nucleum/stores/overlays/modal.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import { cn } from "@21n/utils/ui.utils";

  import view from "@nucleum/stores/view.store";
  import { Display } from "@21n/elements/display.enum";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import ShortcutText from "@21n/elements/text/ShortcutText.svelte";
  import context from "@nucleum/stores/context.store";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import { keyboardShortcuts } from "@nucleum/stores/keyboard/shortcuts.store";
  import { renderMdAsHtml } from "@21n/elements/markdown/markdown.utils";
  import { resolveShortcutText } from "@21n/elements/keyboard/shortcut.utils";
  import { KeyboardKey } from "@21n/elements/keyboard/keyboard.type";
  import KeyboardToolbar from "@21n/elements/keyboardToolbar/KeyboardToolbar.svelte";
  import { fly } from "svelte/transition";
  import { quadInOut } from "svelte/easing";

  let {
    command = undefined,
    commandType = undefined,
    componentParams = undefined,
    isFullPageContext = false
  }: {
    command?: string | undefined;
    commandType?: ActionType | undefined;
    componentParams?: any;
    isFullPageContext?: boolean;
  } = $props();
  let value = $state("");
  let inputRef = $state<HTMLInputElement | undefined>();
  let resultsRef = $state<any>();
  let isPerformingSearchAction = $state(false);
  let searchAction = $state<IAction | null>(null);
  let isFocusing = $state(false);
  const defaultPlaceholder = $derived(
    isFullPageContext
      ? "Search for a command"
      : "Search anything, run a command or ask Rhombus"
  );
  let placeholder = $state("");
  $effect(() => {
    if (!isPerformingSearchAction) {
      placeholder = defaultPlaceholder;
    }
  });
  onMount(() => {
    inputRef?.focus();
  });
  $effect(() => {
    if (
      !command ||
      commandType !== ActionType.SEARCH_CMD ||
      (isPerformingSearchAction && searchAction?.action === command)
    ) {
      return;
    }
    const action = requireCommandHost().resolveAction(command);
    if (!action) return;
    onSearchAction({ detail: action });
  });
  function handleKeyUp(event: any) {
    if (event.key === "ArrowDown") {
      resultsRef.moveSelection("down");
    } else if (event.key === "ArrowUp") {
      resultsRef.moveSelection("up");
    } else if (event.key === "Enter") {
      resultsRef.select();
    }
  }

  function handleKeyDown(event: any) {
    if (event.key === "Backspace" && !$view.isConstrainedWidth) {
      if (value == "" && isPerformingSearchAction) {
        resetContext();
      } else if (value == "") close();
    }
  }

  function resetContext() {
    isPerformingSearchAction = false;
    placeholder = defaultPlaceholder;
  }

  function isSearchActionEvent(
    actionOrEvent: IAction | { detail?: IAction }
  ): actionOrEvent is { detail?: IAction } {
    return "detail" in actionOrEvent;
  }

  function resolveSearchActionPayload(
    actionOrEvent: IAction | { detail?: IAction }
  ): IAction | null {
    if (isSearchActionEvent(actionOrEvent)) {
      return actionOrEvent.detail ?? null;
    }
    return actionOrEvent;
  }

  function onSearchAction(actionOrEvent: IAction | { detail?: IAction }) {
    const nextSearchAction = resolveSearchActionPayload(actionOrEvent);
    if (!nextSearchAction) return;
    value = "";
    searchAction = nextSearchAction;
    isPerformingSearchAction = true;
    placeholder =
      typeof nextSearchAction.searchActionParams?.placeholder === "function"
        ? nextSearchAction.searchActionParams.placeholder(componentParams)
        : (nextSearchAction.searchActionParams?.placeholder ??
          "select an item");
  }
  function close() {
    value = "";
    modalEvent.hide(Action.CMD);
  }

  function resolveSearchAction() {
    return searchAction as IAction;
  }

  function resolveSearchActionLabel() {
    return (
      componentParams?.label ??
      searchAction?.cmdLabel ??
      searchAction?.label ??
      ""
    );
  }
  /**
   * Used in command-only mode.
   * @param event
   */
  const shortcutListener = (event: KeyboardEvent) => {
    const { shortcut, modifiers } = keyboardShortcuts.resolveShortcut(event);
    if (!shortcut && event?.key === KeyboardKey.ESCAPE && isFocusing) {
      inputRef?.blur();
      isFocusing = false;
      return;
    }
    if (
      (shortcut && shortcut.action === Action.CMD) ||
      (!shortcut && modifiers.length === 0 && event.code === KeyboardKey.SPACE)
    ) {
      event.preventDefault();
      if (!isFocusing) inputRef?.focus();
      else {
        inputRef?.blur();
        isFocusing = false;
      }
    }
  };
</script>

<div
  class={cn(
    "flex flex-col cw:w-full cw:min-w-full w-[50rem] max-w-full overflow-auto",
    {
      "border border-brs2 rounded-md": isFullPageContext,
      "cw:h-full h-[30rem]":
        !isFullPageContext || (isFullPageContext && isFocusing)
    }
  )}
>
  {#if isPerformingSearchAction && searchAction}
    <div
      class="h-fit min-h-fit flex gap-2 justify-between items-center cw:w-full cw:max-w-full w-fit max-w-60 cw:ml-0 ml-2 mt-2 bg-bgs2 cw:px-3 cw:py-2 pr-1 pl-3 cw:rounded-none rounded-md truncate"
      in:fly={{ y: -10, easing: quadInOut, duration: 250 }}
    >
      <span class="truncate">
        {@html renderMdAsHtml(resolveSearchActionLabel())}
      </span>
      {#if $view.isConstrainedWidth}
        <Button icon="cross" tooltip="Close" onclick={close} />
      {:else}
        <Button
          icon="backspace"
          tooltip="Clear"
          onclick={() => {
            value = "";
            resetContext();
          }}
        />
      {/if}
    </div>
  {/if}
  <div
    class={cn(
      "flex mo:flex-col w-full bg-bgs1 justify-between items-center mo:rounded-none rounded-t-md"
    )}
  >
    <input
      data-testid="command-bar-input"
      bind:this={inputRef}
      type="text"
      bind:value
      onkeyup={handleKeyUp}
      onkeydown={handleKeyDown}
      onfocus={() => {
        isFocusing = true;
      }}
      class="h-[3.6rem] mo:h-20 mo:w-full bg-transparent px-4 grow focus:border-none focus:outline-none text-h5 transition-all duration-300"
      {placeholder}
    />
    {#if !$view.isConstrainedWidth && $context.embed !== Embed.HANDSET}
      <div class="mr-4">
        <div
          class={cn(
            "px-2 flex justify-center items-center gap-2 rounded-md py-1 text-b3 text-fgs3 min-w-fit w-fit",
            {
              "bg-bgs2": !(isFullPageContext && !isFocusing)
            }
          )}
        >
          {#if value}
            Press <b>Enter</b> to run
          {:else if isFullPageContext && !isFocusing}
            <!-- {resolveShortcutText({
              key: "Space",
              os: $context.os
            })} -->
            <ShortcutText
              shortcut={Action.CMD}
              parentBgIndex={1}
              isAlwaysShown={true}
            />
          {:else if isFullPageContext && isFocusing}
            Press <b>Esc</b> to close
          {:else}
            Super bar
          {/if}
        </div>
      </div>
    {/if}
  </div>
  <div class="flex-grow">
    {#if isPerformingSearchAction}
      <!-- {#if value && value !== ""} -->
      <SearchActionResults
        search={value}
        {componentParams}
        bind:this={resultsRef}
        action={resolveSearchAction()}
        onClose={close}
      />
      <!-- {:else}
        <EmptyStatusView size={Size.sm} subText="start typing to search..." />
      {/if} -->
    {:else if !isFullPageContext || (isFullPageContext && isFocusing)}
      <CmdResults
        search={value}
        bind:this={resultsRef}
        {onSearchAction}
        onClose={close}
      />
    {/if}
  </div>
  {#if $view.display === Display.MO || $context.embed === Embed.HANDSET}
    <div class="flex w-full justify-center py-2 pb-8">
      <Button label="Close" style={ButtonStyle.PLAIN} onclick={close} />
    </div>
  {:else if !isFullPageContext}
    <div
      class={cn(
        "flex w-full h-8 min-h-[2rem] bg-bgs2 justify-between items-center text-b3 text-fgs3 px-4 rounded-b-md"
      )}
    >
      <span class="inline-flex items-center gap-1">
        Use <ShortcutText
          shortcut={{
            key: ">"
          }}
          parentBgIndex={2}
          isAlwaysShown={true}
        /> for commands, <ShortcutText
          shortcut={{
            key: "`"
          }}
          parentBgIndex={2}
          isAlwaysShown={true}
        /> for quick note
      </span>
      <span class="inline-flex items-center gap-1">
        Press
        <ShortcutText
          shortcut={Action.CLOSE}
          parentBgIndex={2}
          isAlwaysShown={true}
        />
        to close
      </span>
      <!-- <ShortcutText
        shortcut={Action.CMD}
        parentBgIndex={2}
        isAlwaysShown={true}
      /> -->
    </div>
  {/if}
</div>

<KeyboardToolbar class="bg-bgs2 h-14 px-4 flex items-center justify-between">
  <div class="flex items-center justify-center gap-2">
    <!-- left actions -->
  </div>
  <div class="flex items-center justify-center gap-2">
    <Button
      icon="cross"
      label="clear"
      parentBgIndex={2}
      size={Size.sm}
      style={ButtonStyle.DEFAULT}
      isPreventMinWidth={true}
      onclick={() => {
        value = "";
      }}
      onmousedown={(e) => e.preventDefault()}
    />
    <Button
      icon="ph:caret-line-down-light"
      label="cancel"
      parentBgIndex={2}
      size={Size.sm}
      style={ButtonStyle.DEFAULT}
      isPreventMinWidth={true}
      onclick={close}
    />
  </div>
</KeyboardToolbar>

<svelte:window onkeydown={shortcutListener} />
