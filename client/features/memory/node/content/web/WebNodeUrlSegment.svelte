<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { IContextMenu } from "@21n/elements/contextMenu/context-menu.type";

  let { url }: { url: string } = $props();
  let copyLabel = $state("Copy link");
  let copyTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const linkContextMenu: IContextMenu = [
    {
      group: "base",
      items: [
        {
          value: "open-link",
          label: "Open link",
          icon: "weblink",
          callback: async () => {
            navigation.openLink(url ?? "");
          }
        },
        {
          value: "copy-link",
          label: "Copy link",
          icon: "copy",
          callback: async () => {
            navigator.clipboard.writeText(url ?? "");
          }
        }
      ]
    }
  ];
</script>

<div
  class="flex items-center max-w-full w-full border-t cw:border-y border-brs2 text-fgs3 text-b2 truncate cw:mb-10"
>
  <!-- <ContextMenuAction
  id="open-link-context-menu"
  triggerMethod={PopoverTriggerMethod.RIGHT_CLICK}
  menuResolver={() => {
    return linkContextMenu;
  }}
> -->
  <button
    class="flex border-r border-brs2 px-3 py-1.5 hover:bg-aps2-striped hover:text-aps1 truncate min-w-0 flex-1"
    title="Open link"
    onclick={() => {
      if (!url) return;
      navigation.openLink(url);
    }}
  >
    <span class="truncate">
      {url?.split("?")?.[0]?.split("#")?.[0]}
    </span>
  </button>
  <!-- </ContextMenuAction> -->
  <button
    class="flex px-3 py-1.5 hover:bg-bgs2-striped"
    onclick={() => {
      if (!url) return;
      navigator.clipboard.writeText(url);
      copyLabel = "Copied!";
      if (copyTimeoutId !== null) {
        clearTimeout(copyTimeoutId);
      }
      copyTimeoutId = setTimeout(() => {
        copyLabel = "Copy link";
        copyTimeoutId = null;
      }, 1000);
    }}
  >
    {copyLabel}
  </button>
</div>
