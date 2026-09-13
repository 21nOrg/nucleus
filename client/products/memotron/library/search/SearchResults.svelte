<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import LinkSearchResultItem from "@nucleum/features/memory/common/linkbox/LinkSearchResultItem.svelte";
  let { items = [] }: { items?: any[] } = $props();
  function onClick(e: MouseEvent, item: any) {
    navigation.resourceClickHandler(e, item.id);
  }
</script>

<div class="flex flex-col w-full px-3">
  {#each items as item}
    <LinkSearchResultItem {item} onClick={(e) => onClick(e, item)} />
  {/each}
</div>
