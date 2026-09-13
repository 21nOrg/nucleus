<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { onDestroy } from "svelte";
  import LinkThumbnailItems from "@nucleum/features/memory/node/links/LinkThumbnailItems.svelte";
  import { Size } from "@21n/elements/size.enum";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";
  import InlineTimeoutMessage from "@21n/elements/text/InlineTimeoutMessage.svelte";
  import { AlertType } from "@nucleum/stores/notifications/notification.type";
  import { type IActiveNodeStore } from "@nucleum/features/memory/node/node.store";
  import {
    type INode,
    type INodeLinkThumb
  } from "@nucleum/features/memory/node/node.type";
  import { LinkType } from "@nucleum/datafn/link.type";
  import LinkSearch from "@nucleum/features/memory/common/linkbox/LinkSearch.svelte";
  import ScrollViewBottomSpacer from "@21n/layout/scrollView/ScrollViewBottomSpacer.svelte";

  import { Resource } from "@nucleum/datafn/resource.enum";
  import { logger } from "@nucleum/client/runtime/logging/logger";
  import type { IRecordId } from "@nucleum/schema/legacy/data.type";
  import LinkTagFilter from "@nucleum/features/memory/node/links/LinkTagFilter.svelte";
  import {
    determineResourceType,
    resourceInList,
    isSameResource
  } from "@nucleum/datafn/resource.utils";
  import { BulkEditor } from "@nucleum/stores/resources/bulk-editor";
  import { resolveResource } from "@nucleum/datafn/resource-query.utils";
  import { bulkEditStore } from "@nucleum/stores/resources/bulkedit.store";
  import { toasts } from "@nucleum/stores/notification.store";
  import { ErrorMessage } from "@nucleum/stores/notifications/error.enum";
  import { ResourceErrorCode } from "@nucleum/schema/resource-error.enum";
  import { ResourceError } from "@nucleum/datafn/resource-error";
  import { LoadingAnimationType } from "@21n/elements/feedback/feedback.type";
  import Tag from "@21n/elements/text/Tag.svelte";
  import { resolveLinkTypeConfig } from "@nucleum/features/memory/linking/link.utils";
  import { datafn } from "@nucleum/datafn/datafn.store";
  import { toSvelteStore } from "@datafn/svelte";

  let { node }: { node: IActiveNodeStore } = $props();
  let multiSelectContext = $derived({
    resource: Resource.node,
    accessPoint: ResourceAccessPoint.NODE_LINKS,
    accessPointId: node.id
  });
  let bulkEditUnsub: (() => void) | undefined;
  let bulkSelection = $state<IRecordId[]>([]);

  function resolveBulkEditorInstance() {
    bulkEditStore.activate(multiSelectContext, {
      onAction: handleBulkAction,
      onSelectAll: selectAll,
      subContext: node.id.toString()
    });
    if (!bulkEditUnsub) {
      bulkEditUnsub = bulkEditStore.subscribe((value = []) => {
        bulkSelection = value;
      });
    }
  }

  function selectAll() {
    return filtered?.map((x) => x.node.id.toString()) ?? [];
  }

  async function handleBulkAction(
    ids: IRecordId[],
    action: string,
    data?: unknown
  ) {
    try {
      const editor = new BulkEditor(Resource.node, bulkEditStore);
      const result = await editor.run(action, data);
      if (result) {
        if (action === "unlink") {
          $node.links = $node.links?.filter(
            (x) => !ids.some(resourceInList(x.linkedTo))
          );
        }
      }
    } catch (e) {
      toasts.error("Failed to perform bulk action");
    }
  }

  $effect(() => {
    multiSelectContext;
    filtered;
    resolveBulkEditorInstance();
  });
  let _links = $state<INodeLinkThumb[]>([]);
  let optimisticItems = $state<{ link: INodeLinkThumb; node: INode }[]>([]);
  let selectedLinkType = $state<
    { linkType: LinkType; direction?: "incoming" | "outgoing" } | undefined
  >(undefined);
  let selectedLinkTags = $state<IRecordId[]>([]);
  let linkStatus = $state<{ message: string; type: AlertType }>({
    message: "",
    type: AlertType.INFO
  });
  let searchQuery = $state("");
  let dev_linkTagFilter = $state<"and" | "or">("and");
  const linkedIds = $derived.by(() => [
    ...new Set(
      _links
        .map((link) => link.linkedTo?.toString())
        .filter((id): id is string => Boolean(id))
    )
  ]);
  const linkedNodeStore = $derived.by(() =>
    toSvelteStore<INode[]>(
      datafn.node.signal({
        select: ["*", "parent.*", "file.*"],
        filters: {
          id: { $in: linkedIds }
        }
      }),
      { initialData: [] }
    )
  );
  const all = $derived.by(() => [
    ...($linkedNodeStore.data as INode[])
      .map((x: INode) => ({
        link: _links.find((y) => y.linkedTo.toString() == x.id.toString()),
        node: x
      }))
      .filter((item) => !!item.link)
      .map((item) => item as { link: INodeLinkThumb; node: INode }),
    ...optimisticItems.filter(
      (item) =>
        !($linkedNodeStore.data as INode[]).some((node) =>
          isSameResource(node.id, item.node.id)
        )
    )
  ]);
  const activeNodeRelationStore = $derived.by(() =>
    toSvelteStore<Array<{ links?: Record<string, any>[] }>>(
      $node.id
        ? datafn.node.signal({
            select: ["id", "links.#"],
            filters: {
              id: $node.id.toString()
            },
            metadata: {
              includeTrashed: true,
              includeArchived: true
            }
          })
        : datafn.emptySignal([]),
      { initialData: [] }
    )
  );
  const outgoingMentionLinks = $derived.by(() => {
    const locations = new Set($node.blocks?.map((x) => x.id.toString()) ?? []);
    return ($activeNodeRelationStore.data[0]?.links ?? [])
      .filter(
        (row: any) =>
          row.linkType === LinkType.MENTION &&
          locations.has(row.location?.toString())
      )
      .map((row: any) => ({
        id: `${row.from}|${row.to}`,
        in: row.from,
        out: row.to,
        linkType: row.linkType,
        tags: row.tags ?? []
      }));
  });
  const outgoingMentionIds = $derived.by(() => [
    ...new Set(
      outgoingMentionLinks
        .map((link) => link.out?.toString())
        .filter((id): id is string => Boolean(id))
    )
  ]);
  const outgoingMentionNodeStore = $derived.by(() =>
    toSvelteStore<INode[]>(
      datafn.node.signal({
        select: ["*", "parent.*", "file.*"],
        filters: {
          id: {
            $in: outgoingMentionIds
          }
        }
      }),
      { initialData: [] }
    )
  );
  const outgoingMentions = $derived.by(() =>
    outgoingMentionLinks
      .map((x: any) => ({
        link: {
          linkedTo: x.out,
          links: [
            {
              linkType: LinkType.MENTION,
              id: x.id,
              direction: "outgoing"
            }
          ],
          tags: x.tags as IRecordId[] | undefined
        },
        node: ($outgoingMentionNodeStore.data as INode[]).find((y: INode) =>
          isSameResource(y.id, x.out)
        )
      }))
      .filter((item) => !!item.node)
      .map((item) => item as { link: INodeLinkThumb; node: INode })
  );
  const combined = $derived.by(() =>
    [...all, ...outgoingMentions].filter(
      (item, index, self) =>
        index ===
        self.findIndex(
          (t) => t.link.linkedTo.toString() === item.link.linkedTo.toString()
        )
    )
  );
  const availableLinkTags = $derived.by(() => {
    const allTags = new Set<IRecordId>();
    combined.forEach((item) => {
      item.link.tags?.forEach((tag) => {
        allTags.add(tag);
      });
    });
    return Array.from(allTags);
  });
  const filtered = $derived.by(() => {
    let items = combined;
    if (selectedLinkTags.length > 0) {
      if (dev_linkTagFilter === "or") {
        items = items.filter((x) =>
          x.link.tags?.some((y) => selectedLinkTags.some(resourceInList(y)))
        );
      } else {
        items = items.filter((x) =>
          selectedLinkTags.every((y) => x.link.tags?.some(resourceInList(y)))
        );
      }
    }
    const currentSelectedLinkType = selectedLinkType;
    if (currentSelectedLinkType) {
      items = items.filter((x) =>
        x.link.links?.some(
          (y) =>
            y.linkType === currentSelectedLinkType.linkType &&
            (!currentSelectedLinkType.direction ||
              y.direction === currentSelectedLinkType.direction)
        )
      );
    }
    return items;
  });
  const isRefreshing = $derived(
    $linkedNodeStore.loading ||
      $linkedNodeStore.refreshing ||
      $activeNodeRelationStore.loading ||
      $activeNodeRelationStore.refreshing ||
      $outgoingMentionNodeStore.loading ||
      $outgoingMentionNodeStore.refreshing
  );

  $effect(() => {
    _links = $node.links ?? [];
  });

  onDestroy(() => {
    bulkEditUnsub?.();
    if (bulkEditStore.matchesContext(multiSelectContext)) {
      bulkEditStore.clear();
    }
  });

  async function onSelect(e: CustomEvent<any>) {
    try {
      const linkSource = $node.focusedBlock ?? node.id;
      linkStatus = {
        message: "Linking...",
        type: AlertType.INFO
      };
      if (!e.detail?.item?.id) {
        linkStatus.message = ErrorMessage.DEFAULT;
        linkStatus.type = AlertType.ERROR;
        return;
      }
      const isDuplicate = _links.some((x) =>
        isSameResource(x.linkedTo, e.detail.item.id)
      );
      if (isDuplicate) {
        linkStatus.message = "Link already exists.";
        linkStatus.type = AlertType.ERROR;
        return;
      }
      const fromResource = determineResourceType(linkSource);
      const toResource = determineResourceType(e.detail.item.id);
      const result = await datafn.table(fromResource).mutate({
        operation: "relate",
        id: linkSource.toString(),
        relations: {
          links: [
            {
              $ref: e.detail.item.id.toString(),
              fromResource: fromResource.toString(),
              toResource: toResource.toString(),
              linkType: LinkType.DIRECT
            }
          ]
        }
      } as any);

      let addedLink = await resolveResource(e.detail.item.id);
      if (!addedLink && e.detail?.item?.id) {
        addedLink = e.detail.item;
      }
      if (!result || !addedLink) {
        linkStatus.message = ErrorMessage.DEFAULT;
        linkStatus.type = AlertType.ERROR;
        return;
      }
      linkStatus.message = "Link added successfully.";
      linkStatus.type = AlertType.SUCCESS;
      const link: INodeLinkThumb = {
        linkedTo: e.detail.item.id,
        links: [
          {
            linkType: LinkType.DIRECT,
            id: result
              ? `${linkSource}|${e.detail.item.id}|${LinkType.DIRECT}`
              : ""
          }
        ]
      };
      _links = [...(_links ?? []), link];
      $node.links = [...($node.links ?? []), link];
      optimisticItems = [
        ...optimisticItems,
        {
          node: addedLink,
          link
        } as { link: INodeLinkThumb; node: INode }
      ];
      searchQuery = "";
    } catch (e) {
      logger.error({ at: "NodeLinksPane.onSelect", error: e });
      if (e instanceof ResourceError) {
        if (e.code === ResourceErrorCode.ALREADY_EXISTS) {
          toasts.error("Link already exists");
        } else {
          toasts.error();
        }
      } else {
        toasts.error();
      }
    }
  }

  /**
   * TODO - click handler - check for new bulk edit store changes
   * @param e
   */
  function onClick(e: CustomEvent) {
    resolveBulkEditorInstance();
    const result = bulkEditStore.clickHandler(e.detail.id);
    if (!result) {
      navigation.resourceClickHandler(e.detail.event, e.detail.id, {
        origin: $node.id
      });
    }
  }

  function onAction(e: CustomEvent) {
    if (e.detail.action === "unlink") {
      optimisticItems = optimisticItems.filter(
        (x) => !isSameResource(x.node.id, e.detail.id)
      );
      $node.links = $node.links?.filter(
        (x) => !isSameResource(x.linkedTo, e.detail.id)
      );
      _links = _links.filter((x) => !isSameResource(x.linkedTo, e.detail.id));
    }
  }

  function onTagClick(e: CustomEvent) {
    if (!e.detail) return;
    if (selectedLinkTags.some(resourceInList(e.detail))) return;
    selectedLinkTags = [...selectedLinkTags, e.detail];
  }

  function onLinkTypeSelect(e: CustomEvent) {
    if (!e.detail) return;
    selectedLinkType = e.detail;
  }
</script>

<div class="relative flex flex-col gap-3 pt-1 flex-grow w-full">
  <div class="flex flex-col w-full">
    <LinkSearch
      accessPoint={ResourceAccessPoint.NODE_LINKS}
      {onSelect}
      bind:searchQuery
      excludeFromSearch={_links.map((x) => x.linkedTo).concat(node.id)}
    />
    {#if linkStatus.message}
      <div>
        <InlineTimeoutMessage
          bind:message={linkStatus.message}
          type={linkStatus.type}
          size={Size.sm}
        />
      </div>
    {/if}
    <!-- <div class="flex gap-3 w-full">
      <MultiselectDropdown
        options={[]}
        style={InputStyle.FILLED}
        bind:selected={selectedLinkTags}
        placeholder="Link tags"
      />
    </div> -->
  </div>
  <div class="flex flex-col gap-4 w-full flex-grow">
    {#if selectedLinkType}
      {@const config = resolveLinkTypeConfig(
        selectedLinkType.linkType,
        selectedLinkType.direction
      )}
      <div>
        <Tag
          label={config.label}
          icon={config.icon}
          size={Size.md}
          isActive={true}
          isRemovable={true}
          onRemove={() => {
            selectedLinkType = undefined;
          }}
          onclick={() => {
            selectedLinkType = undefined;
          }}
        />
      </div>
    {/if}
    {#if availableLinkTags.length > 0}
      <div class="flex flex-col gap-3">
        <LinkTagFilter
          links={filtered.map((x) => x.link)}
          bind:selected={selectedLinkTags}
        />
      </div>
    {/if}
    {#if filtered.length > 0 && !isRefreshing}
      <div class="flex flex-col flex-grow w-full">
        <LinkThumbnailItems
          links={filtered}
          accessPointId={node.id}
          {onClick}
          {onAction}
          {onTagClick}
          {onLinkTypeSelect}
        />
        <ScrollViewBottomSpacer />
      </div>
    {:else}
      <EmptyStatusView
        isSearchContext={true}
        isLoadingState={isRefreshing}
        loadingAnimation={LoadingAnimationType.FOCUS_ITEMS_PULSE}
        mainText="No links found."
        subText="Try different filters or add links."
      />
    {/if}
  </div>
</div>
