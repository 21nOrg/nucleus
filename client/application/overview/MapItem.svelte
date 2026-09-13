<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import { determineResourceType } from "@nucleum/datafn/resource.utils";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import NodeThumbnail from "@nucleum/features/memory/node/thumbnail/NodeThumbnail.svelte";
  import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";
  import type { INodeThumb } from "@nucleum/features/memory/node/node.type";

  interface MapItemData {
    id: string;
    label: string;
    contentType: string;
    createdAt: string;
    url?: string;
    metadata?: any;
  }

  let { data }: { data: MapItemData } = $props();
  const resourceType = $derived(determineResourceType(data.id));
  const nodeItem = $derived(data as unknown as INodeThumb);

  function handleClick(event: MouseEvent) {
    const id: IRecordId = data.id;
    navigation.resourceClickHandler(event, id);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick(event as unknown as MouseEvent);
    }
  }
</script>

{#if resourceType === Resource.node}
  <div onclick={handleClick}>
    <NodeThumbnail
      item={nodeItem}
      accessPoint={ResourceAccessPoint.MAP}
      accessPointId={data.id}
    />
  </div>
{:else}
  <div
    class="map-item-container bg-bgs1 border border-brs2 rounded-md p-3 cursor-pointer hover:bg-bgs2 transition-colors"
    onclick={handleClick}
    onkeydown={handleKeyDown}
    role="button"
    tabindex="0"
  >
    <div class="flex flex-col gap-2">
      <h3 class="text-b2 font-medium text-fgs1 truncate">
        {data.label || "Untitled"}
      </h3>
      <p class="text-b3 text-fgs3">{data.contentType || ""}</p>
      <p class="text-b4 text-fgs4">
        {data.createdAt ? new Date(data.createdAt).toLocaleDateString() : ""}
      </p>
    </div>
  </div>
{/if}

<style>
  .map-item-container {
    width: 280px;
    max-width: 280px;
  }
</style>
