<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { onMount } from "svelte";
  import ResourceSearchBase from "@nucleum/products/memotron/library/search/ResourceSearchBase.svelte";

  import { Action } from "@nucleum/client/config/action.enum";
  import SearchInput from "@nucleum/application/search/SearchInput.svelte";

  let { isInline = false }: { isInline?: boolean } = $props();
  let searchInputRef: SearchInput;
  let searchBaseRef: ResourceSearchBase;

  onMount(async () => {
    if (!isInline) {
      setTimeout(() => {
        searchInputRef?.focus();
      }, 100);
    }
  });
</script>

<ResourceSearchBase
  bind:this={searchBaseRef}
  isGlobalSearchModal={true}
  {isInline}
  onClose={() => {
    if (isInline) return;
    navigation.closeResource({
      id: Action.SEARCH
    });
  }}
>
  {#if !isInline}
    <div class="pl-4 w-full">
      <SearchInput bind:this={searchInputRef} />
    </div>
  {/if}
</ResourceSearchBase>
