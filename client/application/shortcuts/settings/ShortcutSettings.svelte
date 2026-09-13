<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Button from "@21n/elements/button/Button.svelte";
  import InlineErrorMessage from "@21n/elements/text/InlineErrorMessage.svelte";
  import InlineInfoBanner from "@21n/elements/text/InlineInfoBanner.svelte";

  import context from "@nucleum/stores/context.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import { Embed } from "@nucleum/client/runtime/context.type";
  import { keyboardShortcuts } from "@nucleum/stores/keyboard/shortcuts.store";
  import ShortcutItem from "@nucleum/application/shortcuts/settings/ShortcutItem.svelte";
  let error: string | undefined = undefined;
  let keyMap = keyboardShortcuts.fetchConfiguratbleShortcuts();
</script>

<div class="flex flex-col gap-4 w-full">
  {#if $context.embed === Embed.HANDSET || $context.embed === Embed.TABLET}
    <InlineInfoBanner
      content="We are sorry. Configuring shortcuts is not currently available on mobile or tablet. Please use desktop or web app to configure your shortcuts."
    />
  {:else}
    {#each keyMap as shortcut}
      <ShortcutItem
        action={shortcut.action}
        {shortcut}
        onError={(e) => {
          console.log({ e });
          error = e.detail;
        }}
      />
    {/each}
    {#if error}
      <InlineErrorMessage bind:error />
    {/if}
  {/if}
  <div class="flex items-center gap-2">
    <Button
      icon="keyboard"
      label="See hot keys"
      onclick={() => {
        requireCommandHost().runAction(Action.HOT_KEYS);
      }}
    />
    <Button
      icon="markdown"
      label="See markdown shortcuts"
      onclick={() => {
        requireCommandHost().runAction(Action.MARKDOWN_SHORTCUTS);
      }}
    />
  </div>
</div>
