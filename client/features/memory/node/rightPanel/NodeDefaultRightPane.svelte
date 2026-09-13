<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import InlineMarkdownTextInput from "@nucleum/features/memory/markdown/content/InlineMarkdownTextInput.svelte";
  import Button from "@21n/elements/button/Button.svelte";

  import { Size } from "@21n/elements/size.enum";

  import { type IActiveNodeStore } from "@nucleum/features/memory/node/node.store";
  import {
    canHaveTraces,
    socialPostNodeTypeList
  } from "@nucleum/features/memory/node/node.type";
  import { ResourcePanelType } from "@nucleum/stores/resources/resource-panel.type";

  import { focusById } from "@nucleum/actions/focusById.action";
  import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
  import InfoCard from "@nucleum/features/memory/node/metadata/InfoCard.svelte";
  import { resolveNodeLabel } from "../node.utils";
  import NodeTitle from "../title/NodeTitle.svelte";
  import CollectionsLane from "../floatingBar/CollectionsLane.svelte";
  import PropertiesPane from "@nucleum/features/collections/properties/PropertiesPane.svelte";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import WebNodeUrlSegment from "../content/web/WebNodeUrlSegment.svelte";
  import SocialPostActions from "../content/web/SocialPostActions.svelte";
  let { node }: { node: IActiveNodeStore } = $props();
  let _notes = $state($node.notes ?? "");
  const notesInputId = generateSimpleRandomId();

  function onNotesChange(e: CustomEvent<string | undefined>) {
    _notes = e.detail ?? "";
    node.modify({ notes: _notes });
  }

  let _label = $derived(resolveNodeLabel($node));
</script>

<div class="flex flex-col w-full h-full bg-bgs2">
  <section class="flex flex-col cw:px-2 px-3 pb-6">
    <div class="flex w-full justify-between py-2">
      <NodeTitle
        node={$node}
        onLabelChange={() => {
          if ($node.label !== undefined) node.modify({ label: $node.label });
        }}
        onEditModeChange={(value) => {
          node.toggleEditMode(value);
        }}
      />
    </div>
    <div class="flex w-full justify-between">
      <CollectionsLane {node} />
    </div>
  </section>
  <section class="overflow-y-auto w-full flex flex-col">
    <div class="w-full grid grid-cols-3 gap-3 cw:px-2 px-3 pb-6">
      {#if _label && typeof _label === "object" && "parent" in _label}
        <InfoCard
          label="Parent"
          value={_label.parent.label}
          parentBgIndex={0}
          span="col-span-2"
          onclick={(e) => {
            if (!_label?.parent.id) return;
            navigation.resourceClickHandler(e, _label?.parent.id, {
              origin: $node.id
            });
          }}
        />
      {/if}
      <InfoCard
        label="Saved at"
        value={new Date($node.createdAt).toISOString()}
        parentBgIndex={0}
        onclick={() => node.switchPanel(ResourcePanelType.METADATA)}
      />
      <InfoCard
        label="Links"
        value={$node.links?.length || 0}
        parentBgIndex={0}
        onclick={() => node.switchPanel(ResourcePanelType.LINKS)}
      />
      <InfoCard
        label="Properties"
        value={$node.propertyValues?.length || 0}
        parentBgIndex={0}
        onclick={() => node.switchPanel(ResourcePanelType.PROPERTIES)}
      />
      {#if canHaveTraces.includes($node.contentType)}
        <InfoCard
          label="Bookmarks"
          value={$node.clips?.length || 0}
          parentBgIndex={0}
          onclick={() => node.switchPanel(ResourcePanelType.BOOKMARKS)}
        />
      {/if}
    </div>
    <div class="w-full cw:px-2 px-3 pb-6">
      <PropertiesPane
        item={node}
        resource={Resource.node}
        isVisibleProps={true}
      />
    </div>
    {#if "url" in $node && $node.url}
      <div class="w-full">
        {#if socialPostNodeTypeList.has($node.contentType)}
          <SocialPostActions node={$node} />
        {:else}
          <WebNodeUrlSegment url={$node.url} />
        {/if}
      </div>
    {/if}
    <div
      class="relative flex flex-col gap-1 items-start w-full flex-1 min-h-0 max-h-1/2 border-t border-brs2 pt-1"
    >
      <span
        class="absolute top-0 right-0 z-10 mt-1 mr-1 bg-bgs2 bg-opacity-50 hover:bg-opacity-100"
      >
        <Button
          icon="expand"
          tooltip="Expand side notes"
          size={Size.sm}
          parentBgIndex={2}
          onclick={() => node.switchPanel(ResourcePanelType.SIDENOTES)}
        />
      </span>
      <button class="flex w-full flex-1 px-4 py-2" use:focusById={notesInputId}>
        <InlineMarkdownTextInput
          id={notesInputId}
          placeholder="Start writing side notes here..."
          bind:content={_notes}
          onDebouncedChange={onNotesChange}
        />
      </button>
    </div>
  </section>
</div>
