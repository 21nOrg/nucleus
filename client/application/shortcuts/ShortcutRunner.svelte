<svelte:options runes={true} />

<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { isTextElement } from "@21n/utils/browser.utils";
  import { keyboardShortcuts } from "@nucleum/stores/keyboard/shortcuts.store";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import { KeyboardKey } from "@21n/elements/keyboard/keyboard.type";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import { InteractionMode } from "@21n/elements/keyboard/interaction-mode.type";
  import { AccessMode } from "@nucleum/datafn/resource.type";
  import { UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import context from "@nucleum/stores/context.store";
  import { Embed } from "@nucleum/client/runtime/context.type";

  function checkIfSystemShortcut(event: KeyboardEvent) {
    return (
      (event.key === KeyboardKey.ESCAPE && event.metaKey === true) ||
      (event.key === KeyboardKey.ENTER && event.metaKey === true)
    );
  }

  /**
   * Listens to keyboard events and runs the shortcut if the event is a shortcut.
   *
   * Avoids running the shortcut if the event is a text input element and the key is `Enter`. This is to avoid running the shortcut when the user is typing in a text field with suggestions.
   *
   * Pressing `Escape` when text element is required in cases like command bar modal, search modal etc. If this is causing issue, kindly stop propagation on keyDown event from the source if its Esc key.
   *
   * @param event
   */
  const shortcutListener = (event: KeyboardEvent) => {
    if ($context.embed === Embed.HANDSET) return;
    const target = event.target || event.srcElement;
    const isTextInputSource = isTextElement(target);
    const isSystemShortcut = checkIfSystemShortcut(event);
    if (isSystemShortcut) {
      appEvents.publish(event.key.toString() as GlobalEvent, event);
      return;
    }
    if (isTextInputSource && event.metaKey === false) return;
    const { shortcut, modifiers } = keyboardShortcuts.resolveShortcut(event);
    logger.log({
      at: "shortcutListener",
      isTextInputSource,
      isSystemShortcut,
      shortcut,
      modifiers,
      target,
      event
    });
    if (!shortcut) return;
    const interactionMode = uiState.getState(Action.MODE_OF_INTERACTION, {
      scope: UIStateScope.PRODUCT
    });
    if (
      interactionMode === InteractionMode.AGENT &&
      shortcut.action === Action.CMD
    ) {
      navigation.toggleSearchParam([AccessMode.TAB]);
      event.preventDefault();
      return;
    }
    requireCommandHost().runAction(shortcut.action);
    event.stopPropagation();
    event.preventDefault();
  };
</script>

<svelte:window onkeydown={shortcutListener} />
