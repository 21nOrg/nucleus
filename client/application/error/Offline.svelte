<script>
  import { navigation } from "@21n/layout/navigation/navigation";

  import { appStore } from "@nucleum/stores/app.store";
</script>

<div class="w-full h-full flex flex-col gap-12 justify-center items-center p-4">
  <div class="flex flex-col items-center gap-2">
    <div class="font-medium text-h4">Looks like you are offline</div>
    <div class="text-fgs3 text-center">
      Please check your internet connection and try again.
    </div>
  </div>
  <button
    class="bg-bgs2 rounded-full px-4 py-2"
    onclick={() => {
      navigation.gotoPath($appStore.currentPath);
    }}
  >
    Try again
  </button>
</div>
