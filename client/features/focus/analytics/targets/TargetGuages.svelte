<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { getCorrespoingHorizonFrequencyLabel } from "@21n/utils/time.utils";
  import Guage from "@nucleum/features/focus/analytics/charts/Guage.svelte";
  import { Size } from "@21n/elements/size.enum";
  import { TimeScale } from "@21n/utils/time.type";
  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  import Icon from "@21n/elements/Icon.svelte";
  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";

  import { PointronAction } from "@nucleum/client/config/focus-action.enum";

  let {
    size = Size.sm,
    type = "semi",
    parentBgIndex = 1,
    data = []
  }: {
    size?: Size;
    type?: "semi" | "full";
    parentBgIndex?: number;
    data?:
      | {
          scale: TimeScale;
          actual: number;
          target: number;
          streak: { value: number; lastWhenStreakBroke: string };
          isCurrentAchieved: boolean;
        }[]
      | [];
  } = $props();

  let guages = $derived.by(() => {
    let items: {
      label: string;
      total: number;
      actual: number;
      streak: number;
    }[] = [];
    if (!isValidArrayWithData(data)) {
      return undefined;
    }
    Object.keys(TimeScale).forEach((key) => {
      if (data.some((x) => x.scale === key)) {
        let item = data.find((x) => x.scale === key);
        if (!item) return;
        try {
          if (item.target != undefined) {
            if (!item.actual) item.actual = 0;
            const actual = +item.actual.toFixed(2);
            const label =
              getCorrespoingHorizonFrequencyLabel(item.scale) +
              (size != Size.sm ? " target" : "");
            items.push({
              total: item.target,
              actual,
              label,
              streak: item.streak?.value
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
    return items;
  });
</script>

<div class="flex justify-evenly w-full flex-wrap gap-8">
  {#if guages && guages.length > 0}
    {#each guages as guage}
      <div class="flex flex-col gap-1">
        <Guage
          total={guage.total}
          actual={guage.actual}
          label={guage.label}
          {size}
          guageType={type}
        />
        {#if guage.streak && guage.streak > 0}
          <div
            class="flex gap-1 items-center justify-center bg-bgs2 rounded-md py-1"
          >
            <Icon icon="fire" size={Size.sm} />
            <p class="text-b4">
              Streak: {guage.streak}
            </p>
          </div>
        {/if}
      </div>
    {/each}
  {:else}
    <EmptyStatusView
      mainText="No targets set."
      subText="Please set targets to see them here."
      actionText="Set targets"
      {parentBgIndex}
      onclick={() => {
        requireCommandHost().runAction(PointronAction.SET_TARGETS);
      }}
    />
  {/if}
</div>
