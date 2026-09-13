<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import type { IObjectiveThumb } from "@nucleum/features/focus/goals/goal.type";
  import CustomColorPropagator from "@21n/elements/style/CustomColorPropagator.svelte";
  import { resolveResourceIcon } from "@nucleum/datafn/resource.utils";
  import { Size } from "@21n/elements/size.enum";
  import Icon from "@21n/elements/Icon.svelte";
  import { Resource } from "@nucleum/datafn/resource.enum";
  import { cn } from "@21n/utils/ui.utils";
  import context from "@nucleum/stores/context.store";

  import {
    AccessMode,
    ResourceAccessPoint
  } from "@nucleum/datafn/resource.type";
  import Button from "@21n/elements/button/Button.svelte";
  import { resolveObjectiveColor } from "@nucleum/features/focus/goals/goal.utils";
  import { Embed } from "@nucleum/client/runtime/context.type";

  let {
    objective: initialObjective,
    accessPoint = ResourceAccessPoint.SELF,
    onClearObjective = undefined
  }: {
    objective: IObjectiveThumb;
    accessPoint?: ResourceAccessPoint;
    onClearObjective?: (() => void) | undefined;
  } = $props();

  let objective = $state(initialObjective);
  const color = $derived(resolveObjectiveColor(objective));

  $effect(() => {
    objective = initialObjective;
  });

  function onObjectiveClick(e: MouseEvent) {
    if (
      !($context.isEmbed && $context.embed === Embed.HANDSET) &&
      accessPoint !== ResourceAccessPoint.OBJECTIVE
    ) {
      navigation.openResource(objective.id, AccessMode.POP);
      e.stopPropagation();
    }
  }
</script>

<div class="flex items-center gap-2 w-full">
  <CustomColorPropagator
    {color}
    type={accessPoint !== ResourceAccessPoint.OBJECTIVE ? "button" : "div"}
    class={cn("flex items-center gap-1 text-ccs1 flex-grow min-w-0", {
      "text-b4 ": accessPoint !== ResourceAccessPoint.SELF,
      "notouch:hover:underline focus:underline":
        accessPoint !== ResourceAccessPoint.OBJECTIVE
    })}
    onclick={onObjectiveClick}
  >
    {#if accessPoint === ResourceAccessPoint.CAPTURE}
      <Icon
        icon={resolveResourceIcon(Resource.objective)}
        size={Size.sm}
        class="text-ccs1"
      />
    {/if}
    <div class="flex items-center gap-1 text-left truncate flex-grow min-w-0">
      <div class="truncate">
        {objective.label || "Untitled"}
      </div>
    </div>
  </CustomColorPropagator>
  {#if accessPoint === ResourceAccessPoint.SELF || accessPoint === ResourceAccessPoint.CAPTURE}
    <Button
      icon="unlink"
      tooltip="Clear objective"
      size={Size.sm}
      parentBgIndex={2}
      onclick={(e) => {
        e.stopPropagation();
        onClearObjective?.();
      }}
    />
  {/if}
</div>
