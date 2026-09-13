<svelte:options runes={true} />

<script lang="ts">
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import { onMount } from "svelte";
  import { CacheKey } from "@21n/layout/layers/cache/cache.type";
  let components = $state<any[]>([]);
  const globalCacheKeys: string[] = [CacheKey.CALENDAR_CACHE];

  onMount(() => {
    globalCacheKeys.forEach((key) => {
      const action = requireCommandHost().resolveAction(key);
      if (action) components = [...components, action];
    });
  });
</script>

<div>
  {#each components as item (item.action)}
    {@const Component = item.component}
    <Component {...item.componentParams} />
  {/each}
</div>
