<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import { clientStorage } from "@nucleum/persistence/persistence.utils";
  import { ClientStorageKey } from "@nucleum/persistence/persistence.type";
  import { parse } from "@21n/shared-utils/json.utils";
  import { authClient } from "@nucleum/client/runtime/account/auth";
  import Button from "@21n/elements/button/Button.svelte";

  import NewAccountDebugInfo from "@nucleum/application/settings/account/NewAccountDebugInfo.svelte";
  async function refresh() {
    const val = await clientStorage.get(ClientStorageKey.USER);
    return parse(val ?? "{}");
  }

  async function signOut() {
    (await authClient()).signOut();
    navigation.gotoPath("/account/login");
  }
</script>

{#await refresh()}
  Loading...
{:then user}
  <div class="flex flex-col gap-1 w-full h-full justify-center items-center">
    <NewAccountDebugInfo {user} />
    <Button onclick={signOut} label="Sign out" />
  </div>
{:catch error}
  <div class="flex flex-col gap-1 w-full h-full justify-center items-center">
    <p class="text-red-500">Error loading account data: {error.message}</p>
    <Button onclick={signOut} label="Sign out" />
  </div>
{/await}
