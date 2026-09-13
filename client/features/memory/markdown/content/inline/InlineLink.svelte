<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  let {
    href,
    label
  }: {
    href: string;
    label: string;
  } = $props();
</script>

<a
  class="inline-link text-aps1 underline hover:bg-aps3 px-0.5 rounded-md cursor-pointer"
  data-label={label}
  {href}
  onclick={(event) => {
    event.preventDefault();
    navigation.openLink(href);
  }}
>
  {label ?? href}
</a>
