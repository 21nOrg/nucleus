<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import TimeComposition from "@nucleum/features/focus/advanced/composition/TimeComposition.svelte";
  import IntervalBar from "@nucleum/features/focus/elements/intervalbar/IntervalBar.svelte";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import { focusItemsStore } from "@nucleum/features/focus/session.store";

  import { advancedCompositionDraft } from "@nucleum/features/focus/advanced/composition/advancedCompositionDraft.store";
  let { parentBgIndex = 1 }: { parentBgIndex?: number } = $props();

  let focusItemsCount = $derived(
    focusItemsStore.resolveCount($focusItemsStore.items)
  );
</script>

<div
  class="relative flex flex-col items-center gap-4 dp:gap-12 flex-grow w-full"
>
  <div class="flex flex-col gap-4 dp:gap-8 w-full flex-grow">
    <IntervalBar composition={$advancedCompositionDraft} />
    <TimeComposition {parentBgIndex} />
  </div>
  <button
    class="flex flex-col items-center gap-1 cw:pb-40 pb-16"
    onclick={() =>
      requireCommandHost().runAction(PointronAction.SHOW_FOCUSITEMS_MODAL)}
  >
    <span class="underline-dotted">
      {focusItemsCount > 0
        ? `${focusItemsCount} focus ${focusItemsCount === 1 ? "item" : "items"} added`
        : "+ add focus items"}
    </span>
    {#if focusItemsCount > 0}
      <span class="text-b4 text-fgs3"> tap to edit </span>
    {/if}
  </button>
</div>
