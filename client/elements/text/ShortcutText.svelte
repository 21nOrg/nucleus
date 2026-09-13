<script lang="ts">
  import { resolveShortcutText } from "@21n/elements/keyboard/shortcut.utils";
  import { keyboardShortcuts } from "@nucleum/stores/keyboard/shortcuts.store";
  import context from "@nucleum/stores/context.store";
  import { GlobalEvent } from "@nucleum/stores/notifications/event.enum";
  import { Size } from "@21n/elements/size.enum";
  import { bg, cn } from "@21n/utils/ui.utils";
  import Icon from "@21n/elements/Icon.svelte";
  import type { IKeyboardShortcut } from "@21n/elements/keyboard/shortcut.type";
  import { KeyboardKey } from "@21n/elements/keyboard/keyboard.type";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import { shortcutHints } from "@nucleum/stores/keyboard/shortcut-hints.store";

  let {
    shortcut,
    parentBgIndex = undefined,
    isPlainText = false,
    isAccentOutlined = false,
    size = Size.md,
    isAlwaysShown = false
  }: {
    shortcut: string | IKeyboardShortcut | undefined;
    parentBgIndex?: number | undefined;
    isPlainText?: boolean;
    isAccentOutlined?: boolean;
    size?: Size.sm | Size.md;
    isAlwaysShown?: boolean;
  } = $props();

  const iconKeys = new Map<KeyboardKey, string>([
    // [KeyboardKey.ENTER, "arrow-turn-down-left"],
    // [KeyboardKey.ARROW_LEFT, "arrow-left"],
    // [KeyboardKey.ARROW_RIGHT, "proceed"],
    // [KeyboardKey.ARROW_UP, "arrow-up"],
    // [KeyboardKey.ARROW_DOWN, "arrow-down"]
  ]);
  const textReplacements = [
    { key: KeyboardKey.ESCAPE, text: "Esc" },
    { key: KeyboardKey.ENTER, text: "Enter" },
    { key: KeyboardKey.ARROW_RIGHT, text: "→" },
    { key: KeyboardKey.ARROW_LEFT, text: "←" },
    { key: KeyboardKey.ARROW_UP, text: "↑" },
    { key: KeyboardKey.ARROW_DOWN, text: "↓" }
  ];

  const detail = $derived.by((): IKeyboardShortcut | undefined => {
    $keyboardShortcuts;
    if (!shortcut) {
      return;
    }
    if (typeof shortcut !== "string") {
      return shortcut;
    }
    if (shortcut === GlobalEvent.ESCAPE) {
      return;
    }
    return keyboardShortcuts.resolveShortcutForAction(shortcut);
  });
  const text = $derived.by(() => {
    if (!shortcut) return;
    if (typeof shortcut === "string" && shortcut === GlobalEvent.ESCAPE) {
      return "Esc";
    }
    if (!detail) return;
    return resolveShortcutText({
      key: detail.key,
      modifiers: detail.modifiers,
      os: $context.os
    });
  });
  const trimmedText = $derived(text?.trim());
  const shortcutKey = $derived(detail?.key as KeyboardKey | undefined);
  const isSingleLetterShortcut = $derived(
    !!trimmedText &&
      Array.from(trimmedText).length === 1 &&
      (!detail?.modifiers || detail?.modifiers.length === 0)
  );
</script>

{#if ($shortcutHints?.isShowHotKeyHints || isAlwaysShown) && shortcut && $context.embed !== Embed.HANDSET && $context.embed !== Embed.TABLET}
  <span
    class={cn(
      "flex justify-center items-center whitespace-nowrap font--mono rounded-md",
      {
        "text-b4  min-h-[1.125rem] h-[1.125rem]": size === Size.md,
        "text-b5": size === Size.sm,
        "border-ccs2": isAccentOutlined
      },
      isSingleLetterShortcut && {
        "px-0 py-0": true,
        "min-w-[1.125rem] w-[1.125rem] ": size === Size.md,
        "min-w-3.5 w-3.5 min-h-3.5 h-3.5": size === Size.sm
      },
      !isSingleLetterShortcut && {
        "px-1 min-h-4 h-4": size === Size.sm,
        "px-1.5": size === Size.md
      },
      !isPlainText && {
        "border-[0.5px]":
          (isSingleLetterShortcut && size === Size.sm && !isAccentOutlined) ||
          !isSingleLetterShortcut,
        border: (size !== Size.sm || isAccentOutlined) && isSingleLetterShortcut
      },
      !isPlainText &&
        !isAccentOutlined && {
          [bg(parentBgIndex)]: parentBgIndex !== undefined,
          "text-fgs3 border-brs3": parentBgIndex !== undefined,
          "border-abg opacity-80": parentBgIndex === undefined
        }
    )}
  >
    {#if shortcutKey && iconKeys.has(shortcutKey)}
      {text?.replace(shortcutKey.toUpperCase(), "") ?? ""}
      <Icon
        icon={iconKeys.get(shortcutKey)}
        size={Size.xs}
        class={cn({
          "text-fgs3": parentBgIndex !== undefined,
          "text-abg": parentBgIndex === undefined && !isAccentOutlined,
          "text-aps1": parentBgIndex === undefined && isAccentOutlined
        })}
      />
    {:else if text && textReplacements.some( (x) => text?.includes(x.key.toUpperCase()) )}
      {@const replacement = textReplacements.find((x) =>
        text?.includes(x.key.toUpperCase())
      )}
      {text.replace(
        replacement?.key?.toUpperCase() ?? "",
        replacement?.text ?? ""
      ) ?? ""}
    {:else}
      {text ?? ""}
    {/if}
  </span>
{/if}
