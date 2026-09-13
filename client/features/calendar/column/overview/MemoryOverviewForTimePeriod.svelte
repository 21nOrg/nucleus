<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { TimeScaleUnit } from "@21n/utils/time.type";
  import type { INodeThumb } from "@nucleum/features/memory/node/node.type";
  import Text from "@21n/elements/text/Text.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";

  import { AccessMode } from "@nucleum/datafn/resource.type";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import NodeThumbnail from "@nucleum/features/memory/node/thumbnail/NodeThumbnail.svelte";
  import { Arrangement } from "@21n/elements/direction.enum";
  import { ResourceAccessPoint } from "@nucleum/datafn/resource.type";
  import MetricCard from "@nucleum/features/calendar/column/overview/MetricCard.svelte";
  import { Action } from "@nucleum/client/config/action.enum";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  import { LoadingAnimationType } from "@21n/elements/feedback/feedback.type";
  import { tzStore } from "@nucleum/stores/preferences/timezone.store";
  import { datafn } from "@nucleum/datafn/datafn.store";

  let {
    date,
    scale = TimeScaleUnit.DAY,
    isRewind = false
  }: {
    date: Date;
    scale?: TimeScaleUnit;
    isRewind?: boolean;
  } = $props();

  const dev_isShowPreviousYearsData = false;

  async function fetchMemoryData(): Promise<{
    today: INodeThumb[];
    previousYears: { nodes: INodeThumb[]; year: number }[];
  }> {
    const dateFilter = tzStore.resolveTimePeriodFilter(date, {
      scale,
      isReturnAsDateObjectFilter: true
    });
    const todayNodesResult = await datafn.node.query({
      select: ["*", "file.*"],
      filters: {
        createdAt: dateFilter
      },
      sort: ["-createdAt"],
      limit: 50
    });

    const previousYearsResults: { nodes: INodeThumb[]; year: number }[] = [];
    for (let yearsAgo = 1; yearsAgo <= 3; yearsAgo++) {
      const memoryDate = new Date(
        date.getFullYear() - yearsAgo,
        date.getMonth(),
        date.getDate()
      );
      if (memoryDate > new Date()) continue;

      const dateFilterForMemoryDate = tzStore.resolveTimePeriodFilter(
        memoryDate,
        {
          scale,
          isReturnAsDateObjectFilter: true
        }
      );
      const nodesResult = await datafn.node.query({
        select: ["*", "file.*"],
        filters: {
          createdAt: dateFilterForMemoryDate
        },
        sort: ["-createdAt"],
        limit: 10
      });
      const nodes = (nodesResult.data ?? []) as INodeThumb[];

      if (nodes.length > 0) {
        previousYearsResults.push({
          nodes,
          year: memoryDate.getFullYear()
        });
      }
    }

    return {
      today: (todayNodesResult.data ?? []) as INodeThumb[],
      previousYears: previousYearsResults
    };
  }

  function handleNodeClick(node: INodeThumb) {
    navigation.openResource(node.id, AccessMode.POP);
  }
</script>

{#await fetchMemoryData()}
  <EmptyStatusView
    isLoadingState={true}
    mainText="Loading memories..."
    loadingAnimation={LoadingAnimationType.OVERVIEW_CARDS_PULSE}
  />
{:then { today, previousYears }}
  {#if today.length === 0 && previousYears.length === 0}{:else}
    <div class="flex flex-col gap-6 w-full">
      <div
        class="w-full flex flex-wrap justify-start items-start content-start dp:gap-4 gap-3"
      >
        <MetricCard
          label="Nodes"
          value={today.length}
          isAccent={true}
          callback={() => {
            navigation.openResource(Action.HISTORY, AccessMode.POP, {
              searchParams: { [AppSearchParam.DATE]: date.toISOString() }
            });
          }}
        />
      </div>
      {#if dev_isShowPreviousYearsData && previousYears.length > 0}
        <div class="flex flex-col gap-3 w-full">
          <Text content="On this day" style={TextStyle.SECTION_HEADING} />
          {#each previousYears as { nodes, year }}
            <div class="flex flex-col gap-2 w-full">
              <div class="text-fgs2 text-b2">
                {year} ({new Date().getFullYear() - year} year{new Date().getFullYear() -
                  year >
                1
                  ? "s"
                  : ""} ago)
              </div>

              {#if nodes.length > 0}
                <div class="flex flex-col gap-2 w-full">
                  {#each nodes.slice(0, 3) as node (node.id)}
                    <NodeThumbnail
                      item={node}
                      arrangement={Arrangement.LIST}
                      accessPoint={ResourceAccessPoint.CALENDAR}
                      accessPointId={`calendar-${date.toISOString().split("T")[0]}`}
                      onClick={() => handleNodeClick(node)}
                    />
                  {/each}

                  {#if nodes.length > 3}
                    <div class="text-center py-1">
                      <div class="text-fgs3 text-b3">
                        and {nodes.length - 3} more memories from {year}...
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{:catch error}
  <EmptyStatusView
    mainText="Failed to load memory data"
    subText={error?.message || "An error occurred"}
  />
{/await}
