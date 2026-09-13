<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { Resource } from "@nucleum/datafn/resource.enum";
  import type { ICollectionThumb } from "@nucleum/features/collections/collection.type";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import Switch from "@21n/elements/toggle/Switch.svelte";

  import { resourceAction } from "@nucleum/datafn/resource.utils";
  import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";
  import CollectionThumbnailLabel from "@nucleum/features/collections/thumbnail/CollectionThumbnailLabel.svelte";
  import InlineSearchBar from "@21n/elements/InlineSearchBar.svelte";
  import { InputStyle } from "@21n/elements/input/input.type";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";

  let query = $state("");
  const collectionStore = toSvelteStore<ICollectionThumb[]>(
    datafn.collection.signal({
      select: ["*", "properties.*", "views.*", "typeToExtend.*"],
      filters: {
        resource: Resource.node
      }
    }),
    { initialData: [] }
  );
  const collections = $derived($collectionStore.data);
  const filteredCollections = $derived(
    query
      ? collections.filter(
          (collection) =>
            collection.label?.toLowerCase().includes(query.toLowerCase()) ??
            false
        )
      : collections
  );

  async function toggleShortcut(collectionId: string, isEnabled: boolean) {
    try {
      await datafn.collection.mutate({
        operation: "merge",
        id: collectionId,
        record: {
          id: collectionId,
          isCaptureShortcutEnabled: isEnabled
        }
      });
    } catch (error) {
      console.error("Error updating capture shortcut:", error);
    }
  }

  function onSearch(nextQuery: string) {
    query = nextQuery;
  }
</script>

<div class="flex flex-col gap-8 w-full h-full overflow-y-auto">
  {#if $collectionStore.loading}
    <div class="w-full pt-8">
      <EmptyStatusView isLoadingState={true} />
    </div>
  {:else if $collectionStore.error}
    <EmptyStatusView mainText="Error loading collections" />
  {:else}
    <div class="text-b2 text-fgs3">
      Selected collections will show as quick capture shortcuts on the capture
      screen.
    </div>
    <div class="flex flex-col gap-2 w-full flex-grow">
      {#if collections.length === 0}
        <EmptyStatusView
          mainText="No collections found. Please create a new collection."
          actionText="Create new collection"
          onclick={() => {
            requireCommandHost().runAction(
              resourceAction(Resource.collection, ResourceActionType.CREATE)
            );
          }}
        />
      {:else}
        <InlineSearchBar
          bind:query
          {onSearch}
          style={InputStyle.FILLED}
          placeholder="Search collections"
        />
        {#each filteredCollections as collection (collection.id)}
          <div
            class="flex justify-between items-center p-3 rounded-lg bg-bgs2 border border-brs3 w-full"
          >
            <div class="flex flex-col">
              <CollectionThumbnailLabel
                item={collection}
                isShowStarStatus={false}
              />
            </div>
            <Switch
              bind:on={collection.isCaptureShortcutEnabled}
              onChange={(e) => toggleShortcut(collection.id, e.detail)}
            />
          </div>
        {/each}
        <ScrollViewBottomSpacer />
      {/if}
    </div>
  {/if}
</div>
