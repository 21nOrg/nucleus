<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Text from "@21n/elements/text/Text.svelte";
  import { Orientation } from "@21n/elements/direction.enum";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import SettingThumbnail from "@nucleum/application/settings/SettingThumbnail.svelte";

  import { ActionType } from "@nucleum/client/config/action.type";
  import { AppSearchParam } from "@nucleum/stores/appStore.type";
  let {
    items = [],
    sectionName,
    orientation = Orientation.Horizontal
  }: {
    items?: string[];
    sectionName: string;
    orientation?: Orientation;
  } = $props();
  function onClick(item: string) {
    const component = requireCommandHost().resolveAction(item);
    if (
      component?.type === ActionType.LINK ||
      component?.type === ActionType.FUNCTION
    )
      requireCommandHost().runAction(item, { isReturnIfComponent: true });
    else if (component?.path) navigation.gotoPath(component.path);
    else
      navigation.toggleSearchParam({
        [AppSearchParam.SETTING]: item
      });
  }
</script>

<div class="flex flex-col gap-2 bg-bgs1 rounded-lg mx-4">
  {#if sectionName}
    <div class="pl-4 pt-4">
      <Text style={TextStyle.SECTION_HEADING} content={sectionName} />
    </div>
  {/if}
  <div
    class={orientation === Orientation.Horizontal
      ? "flex flex-col "
      : "flex flex-wrap gap-2 pl-4"}
  >
    {#if items}
      {#each items as item, index}
        <SettingThumbnail
          {orientation}
          action={item}
          setActiveByPath={true}
          parentBackgroundIndex={1}
          isShowDivider={true}
          isRoundedTop={!sectionName}
          isRoundedBottom={index === items.length - 1}
          onclick={() => {
            onClick(item);
          }}
        />
      {/each}
    {/if}
  </div>
</div>
