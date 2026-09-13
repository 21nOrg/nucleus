<svelte:options runes={true} />

<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Icon from "@21n/elements/Icon.svelte";
  import ShortcutText from "@21n/elements/text/ShortcutText.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { Action } from "@nucleum/client/config/action.enum";
  import { Size } from "@21n/elements/size.enum";
  let {
    isInThinMode = false,
    size = Size.md
  }: {
    isInThinMode?: boolean;
    size?: Size.sm | Size.md | Size.lg;
  } = $props();
</script>

{#if $appStore?.appData?.isCmdBarEnabled === true}
  {#if isInThinMode}
    <Icon
      icon="terminal-window"
      {size}
      class="text-fgs2 hover:text-aps1"
      onclick={() => requireCommandHost().runAction(Action.CMD)}
    />
  {:else}
    <div class="text-b3 text-fgs3 mb-4">
      Press <button
        class="text-fgs2 px-1 py-[1px] rounded-md border border-brs3 hover:bg-bgs3"
        onclick={() => requireCommandHost().runAction(Action.CMD)}
      >
        <ShortcutText
          shortcut={Action.CMD}
          isPlainText={true}
          isAlwaysShown={true}
        />
      </button> for cmd bar
    </div>
  {/if}
{/if}
