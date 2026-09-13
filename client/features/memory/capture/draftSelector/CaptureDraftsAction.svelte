<script lang="ts">
  import { popover } from "@nucleum/actions/popover.action";
  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  import type { ICapture } from "@nucleum/features/memory/capture/capture.type";
  import { onMount } from "svelte";
  import DraftsPopover from "@nucleum/features/memory/capture/draftSelector/DraftsPopover.svelte";
  import { Placement } from "@21n/elements/direction.enum";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { isSameResource } from "@nucleum/datafn/resource.utils";
  import Icon from "@21n/elements/Icon.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { cn } from "@21n/utils/ui.utils";
  import { appEvents } from "@nucleum/stores/events/app-events.store";
  import { datafn } from "@nucleum/datafn/datafn.store";

  let {
    size = Size.md,
    onSelect = undefined
  }: {
    size?: Size;
    onSelect?: ((draft: ICapture) => void) | undefined;
  } = $props();
  let drafts = $state<ICapture[]>([]);
  let ref: HTMLButtonElement;
  onMount(() => {
    refresh();
  });
  async function refresh() {
    const response = await datafn.capture.query({
      sort: [{ field: "updatedAt", direction: "desc" }]
    } as any);
    const result = response.data as ICapture[];
    if (isValidArrayWithData(result)) {
      result.sort((a: ICapture, b: ICapture) => {
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
      drafts = result;
    }
  }

  async function onDelete(id: IRecordId) {
    await datafn.capture.mutate({
      operation: "delete",
      id
    });
    const filteredDrafts = drafts.filter((draft) => !isSameResource(draft, id));
    if (filteredDrafts.length === 0) {
      hidePopover();
    }
    drafts = [...filteredDrafts];
  }
  function hidePopover() {
    ref.dispatchEvent(new Event("hide"));
    appEvents.nav("capture-drafts-popover");
  }

  function onSelectDraft(draft: ICapture) {
    onSelect?.(draft);
    hidePopover();
  }
</script>

{#if drafts.length > 0}
  <div class="flex justify-center items-center">
    <button
      class={cn(
        "flex items-center gap-1 notouch:hover:bg-ass2/10 active:bg-ass2/10 rounded-md border border-dashed border-ass1 text-ass1",
        {
          "text-b3 px-2 py-1": size === Size.sm,
          "text-b2 px-3 py-1.5": size === Size.md
        }
      )}
      bind:this={ref}
      use:popover={{
        content: DraftsPopover,
        placement: Placement.TopCenter,
        isRenderAsModalForCW: true,
        id: "capture-drafts-popover",
        componentProps: {
          drafts,
          onClose: hidePopover,
          onSelect: onSelectDraft,
          onDelete
        }
      }}
    >
      <Icon icon="file" size={Size.sm} class="text-ass1" />
      {drafts.length}
      {drafts.length === 1 ? "draft" : "drafts"} available
    </button>
  </div>
{/if}
