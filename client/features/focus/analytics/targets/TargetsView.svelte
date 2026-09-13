<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import EmptyStatusView from "@21n/elements/feedback/EmptyStatusView.svelte";
  import Text from "@21n/elements/text/Text.svelte";

  import { Size } from "@21n/elements/size.enum";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
  import TargetGuages from "@nucleum/features/focus/analytics/targets/TargetGuages.svelte";

  let { data }: { data: any } = $props();
</script>

<div class="w-full flex flex-col gap-6 pb-4">
  <div class="flex px-4">
    <Text style={TextStyle.PANEL_HEADING} content="Targets" />
  </div>
  {#if isValidArrayWithData(data)}
    <div class="flex justify-evenly w-full flex-wrap">
      <TargetGuages size={Size.md} {data} />
    </div>
  {:else}
    <EmptyStatusView
      size={Size.sm}
      mainText="No targets set"
      subText="Set targets to see them here"
      actionText="Set targets"
      onclick={() => {
        navigation.gotoPath("/cp/targets");
      }}
    />
  {/if}
</div>
