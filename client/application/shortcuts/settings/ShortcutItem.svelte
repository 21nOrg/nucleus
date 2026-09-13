<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Button from "@21n/elements/button/Button.svelte";

  import { Size } from "@21n/elements/size.enum";
  import { keyboardShortcuts } from "@nucleum/stores/keyboard/shortcuts.store";
  import type { IKeyboardShortcut } from "@21n/elements/keyboard/shortcut.type";
  import {
    KeyboardKey,
    ModifierKey
  } from "@21n/elements/keyboard/keyboard.type";
  import { OperatingSystem } from "@nucleum/client/runtime/context.type";
  import context from "@nucleum/stores/context.store";
  import {
    resolveShortcutText,
    resolveModifiers
  } from "@21n/elements/keyboard/shortcut.utils";
  import { tooltip } from "@nucleum/actions/popover.action";
  let {
    action,
    shortcut,
    onError = undefined
  }: {
    action: string;
    shortcut: IKeyboardShortcut;
    onError?: ((event: CustomEvent<string>) => void) | undefined;
  } = $props();
  let isConfigurationInProgress = $state(false);
  let value = $state("");
  let key = $state("");
  let modifiers = $state<ModifierKey[]>([]);
  let inputRef: HTMLInputElement | undefined = undefined;
  let savedKey = shortcut.key;
  let savedModifiers: ModifierKey[] = [...shortcut.modifiers];
  const actionDetails = $derived(requireCommandHost().resolveAction(action));
  const systemShortcuts = $derived.by(() => resolveSystemShortcuts());

  $effect(() => {
    if (isConfigurationInProgress) return;
    savedKey = shortcut.key;
    savedModifiers = [...shortcut.modifiers];
    value = resolveShortcutText({
      key: shortcut.key,
      modifiers: shortcut.modifiers,
      os: $context.os
    });
  });

  function resolveSystemShortcuts() {
    let primaryModifier = ModifierKey.CTRL;
    if ($context.os === OperatingSystem.MACOS)
      primaryModifier = ModifierKey.META;

    return [
      {
        key: "p",
        modifiers: [primaryModifier]
      },
      {
        key: "c",
        modifiers: [primaryModifier]
      },
      {
        key: "v",
        modifiers: [primaryModifier]
      },
      {
        key: "s",
        modifiers: [primaryModifier]
      },
      {
        key: "z",
        modifiers: [primaryModifier]
      },
      {
        key: "t",
        modifiers: [primaryModifier]
      },
      {
        key: "z",
        modifiers: [primaryModifier, ModifierKey.SHIFT]
      }
    ];
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.key === KeyboardKey.ESCAPE) {
      isConfigurationInProgress = false;
      resetToOldValue(event);
      return;
    } else if (event.key === KeyboardKey.ENTER) {
      accept(event);
      event.stopPropagation();
      event.preventDefault();
      return;
    } else {
      modifiers = [];
      modifiers = resolveModifiers(event);
    }
    if (Object.values(ModifierKey).every((key) => key !== event.key)) {
      key = event.key;
      value = resolveShortcutText({
        key,
        modifiers,
        os: $context.os
      });
      isValidConfiguration();
    }
    event.stopPropagation();
    event.preventDefault();
  }
  function isValidConfiguration() {
    if (!key || !modifiers) {
      const errorEvent = new CustomEvent<string>("error", {
        detail: "Invalid shortcut"
      });
      onError?.(errorEvent);
      return false;
    }
    if (
      systemShortcuts.some(
        (x) =>
          x.key === key &&
          x.modifiers.length === modifiers.length &&
          x.modifiers.every((y) => modifiers.includes(y))
      )
    ) {
      const errorEvent = new CustomEvent<string>("error", {
        detail: "This is a system shortcut. Please use some other shortcut."
      });
      onError?.(errorEvent);
      return false;
    }
    return true;
  }
  async function saveShortcut() {
    await keyboardShortcuts.saveShortcut(action, {
      key,
      modifiers
    });
    savedKey = key;
    savedModifiers = [...modifiers];
  }
  function reset() {
    value = "";
    key = "";
    modifiers = [];
  }
  function resetToOldValue(event: MouseEvent | KeyboardEvent) {
    isConfigurationInProgress = false;
    value = resolveShortcutText({
      key: savedKey,
      modifiers: savedModifiers,
      os: $context.os
    });
    if (event instanceof MouseEvent) event.stopPropagation();
  }
  function accept(event: CustomEvent | KeyboardEvent | MouseEvent) {
    if (isValidConfiguration()) {
      isConfigurationInProgress = false;
      saveShortcut();
    }
    if (event instanceof MouseEvent) event.stopPropagation();
  }
</script>

{#if actionDetails}
  <div class="flex items-center justify-between gap-8 w-full">
    <span class="text-b2 whitespace-nowrap">
      {actionDetails?.label}
    </span>
    <button
      class="flex justify-center items-center bg-bgs2 rounded-md p-2 hover:text-aps1 w-60 h-10"
      onclick={() => {
        if (!isConfigurationInProgress) {
          isConfigurationInProgress = true;
          reset();
          inputRef?.focus();
        }
      }}
      use:tooltip={{
        disabled: isConfigurationInProgress,
        text: "Record shortcut"
      }}
    >
      <input
        bind:this={inputRef}
        bind:value
        tabindex="-1"
        id="shortcutInput"
        class="bg-transparent cursor-pointer focus:outline-none w-32 text-fgs2 text-center"
        placeholder="record shortcut"
        type="text"
        onkeydown={(event) => {
          event.stopPropagation();
          onKeydown(event);
        }}
        onpaste={(event) => event.preventDefault()}
      />
      {#if isConfigurationInProgress}
        {@const parentBgIndex = 2}
        <div class="flex gap-1">
          <Button
            tooltip="Clear"
            size={Size.sm}
            {parentBgIndex}
            icon="cross"
            onclick={(event) => {
              if (!key) {
                resetToOldValue(event);
                return;
              }
              reset();
              inputRef?.focus();
              event.stopPropagation();
            }}
          />
          <span data-testid="shortcut-accept">
            <Button
              tooltip="Accept"
              icon="check-circle"
              size={Size.sm}
              {parentBgIndex}
              onclick={accept}
            />
          </span>
          <Button
            tooltip="Reset to old value"
            icon="reload"
            size={Size.sm}
            {parentBgIndex}
            onclick={resetToOldValue}
          />
        </div>
      {/if}
    </button>
  </div>
{/if}

<style>
  #shortcutInput {
    caret-color: transparent;
  }
</style>
