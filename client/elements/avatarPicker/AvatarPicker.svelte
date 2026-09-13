<script lang="ts">
  import { fileUpload } from "@nucleum/stores/files/file-upload";

  import PanelSwitcher from "@21n/elements/switcher/PanelSwitcher.svelte";
  import { ColorStrength } from "@21n/theme/appearance.type";
  import { deepCopy } from "@21n/shared-utils/obj.utils";
  import Divider from "@21n/elements/Divider.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import Icon from "@21n/elements/Icon.svelte";
  import { appStoreShuffleEmojis } from "@nucleum/stores/app.store";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import { Size } from "@21n/elements/size.enum";
  import { onMount, tick } from "svelte";
  import { debouncer } from "@21n/utils/utils";
  import {
    AvatarType,
    type IAvatar,
    type CustomUploadedAvatar,
    type AvatarWithCode,
    type IconAvatar,
    type EmojiAvatar,
    AvatarPickerContext
  } from "@21n/elements/avatarPicker/avatar.type";
  import { PanelSwitcherStyle } from "@21n/elements/switcher/switcher.enum";
  import Text from "@21n/elements/text/Text.svelte";
  import { TextStyle } from "@21n/elements/text/text.enum";
  import AvatarRenderer from "@21n/elements/avatarPicker/AvatarRenderer.svelte";
  import { emojis, materialSymbols } from "@21n/elements/avatarPicker/avatars";
  import SwitchInput from "@21n/elements/toggle/SwitchInput.svelte";

  import UploadButton from "@21n/elements/button/UploadButton.svelte";
  import { abg, cn } from "@21n/utils/ui.utils";
  import view from "@nucleum/stores/view.store";

  let {
    mode = AvatarType.ICON,
    context = AvatarPickerContext.DEFAULT,
    avatarClickCallback = () => {},
    deleteCallback = () => {},
    closeCallback = () => {}
  }: any = $props();
  const isExpanded = $derived(
    (context === AvatarPickerContext.DEFAULT ||
      context === AvatarPickerContext.CALLOUT_AVATAR) &&
      !$view.isConstrainedWidth
  );

  const isColorNotApplicable = context === AvatarPickerContext.CALLOUT_AVATAR;

  let activeCategory: string = "";
  type StoreAvatars = {
    "Frequently Used": IAvatar[][];
    Custom: IAvatar[][];
  } & {
    [category: string]: { name: string; code: string }[][];
  };

  let materialSymbolsWithCategories: StoreAvatars = {
    "Frequently Used": [],
    Custom: [],
    Actions: materialSymbols
  };
  let emojisWithCategories: StoreAvatars = {
    "Frequently Used": [],
    Custom: [],
    ...emojis
  };
  /**
   * A copy of the store avatars based on the mode. Whose items wont be modified except for the frequently used and custom as we add them later.
   * @summary To store the avatars based on the mode.
   */
  let storeAvatars = $state(
    mode == AvatarType.ICON
      ? materialSymbolsWithCategories
      : emojisWithCategories
  );

  let storeAvatarsKey = $state(Object.keys(storeAvatars));
  let storeAvatarsKV = $state(Object.entries(storeAvatars));

  /**
   * To add the next set of emojis based on the previously added emojis
   */
  let previousKVIndex = -1;
  let isLoadingMore = false;
  let previousIconIndex = 0;

  /**
   * To store the avatars based on the mode. And load the additional avatars when scrolls happens.
   */
  let lazyLoadedAvatars = $state<any>({});
  /**
   * Initially maintains the copy of lazyLoadedAvatars based on the mode. The primary utility of this variable is to diplay the avatars passed to it.
   * @summary Mutable Store Avatar for Search purpose.
   */
  let avatars = $state<any>({});
  let avatarsParentContainer = $state<HTMLDivElement>();
  $effect(() => {
    if (!mode || !avatarsParentContainer) return;
    avatarsParentContainer.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  });
  const avatarKeys = $derived(Object.keys(avatars));

  let checked = $state($userPreferences.avatarPicker.filled);
  $effect(() => {
    userPreferences.setAvatarPicker({ filled: checked });
  });
  let skinTones = [
    "#FFCC22",
    "#FADCBC",
    "#DEBB90",
    "#BB9167",
    "#8E562E",
    "#553319"
  ];
  let skinIndex = $state($userPreferences.avatarPicker.skinIndex);
  $effect(() => {
    userPreferences.setAvatarPicker({ skinIndex });
  });
  let colorPalate = ["bw", "#FFC107", "#FF6F61", "#00B7EB", "#63c99c"];
  let iconColor = $state($userPreferences.avatarPicker.iconColor);
  $effect(() => {
    userPreferences.setAvatarPicker({ iconColor });
  });
  let searchRef = $state<HTMLInputElement>();
  let shuffleEmojis = $appStoreShuffleEmojis;

  function resolvePreviewAvatar(emote: IAvatar[]) {
    const activeAvatar = emote.length === 1 ? emote[0] : emote[skinIndex];
    if ("file" in activeAvatar && activeAvatar.file) {
      return activeAvatar;
    }
    return {
      code: "code" in activeAvatar ? activeAvatar.code : "",
      color:
        "color" in activeAvatar && typeof activeAvatar.color === "string"
          ? activeAvatar.color
          : iconColor,
      isFilled:
        "isFilled" in activeAvatar && typeof activeAvatar.isFilled === "boolean"
          ? activeAvatar.isFilled
          : checked,
      type: mode,
      name: activeAvatar.name,
      frequency:
        typeof activeAvatar.frequency === "number" ? activeAvatar.frequency : 0
    } as IAvatar;
  }

  function updateUsedAndCustomAvatars(prefs: any) {
    storeAvatars["Frequently Used"] = (
      mode == AvatarType.ICON
        ? prefs.avatarPicker.usedIcons
        : prefs.avatarPicker.usedEmojis
    )
      ?.slice(0, 50)
      .filter((emote: any) => emote[0]?.frequency > 2);
    storeAvatars["Custom"] = (
      mode == AvatarType.ICON
        ? prefs.avatarPicker.usedIcons
        : prefs.avatarPicker.usedEmojis
    )?.filter((emote: any) => "file" in emote[0] && emote[0].file);
    lazyLoadedAvatars["Frequently Used"] = storeAvatars["Frequently Used"];
    lazyLoadedAvatars["Custom"] = storeAvatars["Custom"];
    avatars = lazyLoadedAvatars;
  }

  onMount(() => {
    lazyLoadAvatars();
    let userPrefSub: any;
    if (context === AvatarPickerContext.DEFAULT) {
      userPrefSub = userPreferences.subscribe((prefs) => {
        updateUsedAndCustomAvatars(prefs);
      });
    }
    return () => {
      if (userPrefSub) userPrefSub();
    };
  });

  async function lazyLoadAvatars() {
    if (isLoadingMore) return;
    isLoadingMore = true;

    try {
      if (mode == AvatarType.ICON) {
        if (previousIconIndex == 0) {
          lazyLoadedAvatars[storeAvatarsKV[0][0]] = storeAvatarsKV[0][1];
          lazyLoadedAvatars[storeAvatarsKV[1][0]] = storeAvatarsKV[1][1];
        }
        let i = previousIconIndex;
        if (lazyLoadedAvatars[storeAvatarsKV[2][0]] == undefined) {
          lazyLoadedAvatars[storeAvatarsKV[2][0]] = [];
        }
        for (
          ;
          i < storeAvatarsKV[2][1].length && i < previousIconIndex + 100;
          i++
        ) {
          lazyLoadedAvatars[storeAvatarsKV[2][0]].push(storeAvatarsKV[2][1][i]);
        }
        avatars = lazyLoadedAvatars;
        previousIconIndex = i;
      } else if (mode == AvatarType.EMOJI) {
        if (previousKVIndex === -1) {
          const initialCategories = storeAvatarsKV.slice(0, 3);
          for (const [category, emojis] of initialCategories) {
            lazyLoadedAvatars[category] = emojis.slice(0, 100);
          }
          avatars = { ...lazyLoadedAvatars };
          previousKVIndex = 2;
          return;
        }
        previousKVIndex++;
        if (previousKVIndex < storeAvatarsKV.length) {
          const [category, emojis] = storeAvatarsKV[previousKVIndex];
          lazyLoadedAvatars[category] = emojis.slice(0, 100);
          avatars = { ...lazyLoadedAvatars };
        }
      }
    } finally {
      isLoadingMore = false;
    }
  }

  /**
   * Invoked when the shuffle button is clicked.Depending on the mode It picks a random emoji from $appStoreShuffleEmojis or random icon from the used list and emits the avatar clicked. Finally closes the avatar picker.
   * @summary To pick a random emoji or icon.
   */
  function ShufflePick() {
    let avatar;
    if (mode == AvatarType.ICON) {
      avatar =
        materialSymbols[Math.floor(Math.random() * materialSymbols.length)][0];
    } else {
      let emojiCategories = Object.keys(emojis);
      let pickedCategory =
        emojiCategories[Math.floor(Math.random() * emojiCategories.length)];
      avatar =
        emojis[pickedCategory][
          Math.floor(Math.random() * emojis[pickedCategory].length)
        ][0];
    }
    addToUsedList(avatar);
  }

  /**
   * When scroll happens within the avatarsParentContainer this function is invoked. It checks the scroll position and highlights the corresponding panel item.
   * @summary To higlight the panel item
   * @desc avt - Avatar Category Indicators Class
   * @desc AVT - Avatar Category Containers Class
   */
  const handleScroll = debouncer(function () {
    const container = avatarsParentContainer;
    if (!container) return;
    const scrollBottom = container.scrollTop + container.clientHeight;

    if (scrollBottom + 100 >= container.scrollHeight && !isLoadingMore) {
      lazyLoadAvatars();
    }

    const scrollTop = container.scrollTop;
    const avtContainers = document.querySelectorAll(".AVT");

    requestAnimationFrame(() => {
      avtContainers.forEach((avtContainer: any) => {
        const avtContainerHeight = avtContainer.offsetHeight;
        const avtContainerTop = avtContainer.offsetTop - 10;

        if (
          scrollTop > avtContainerTop &&
          scrollTop < avtContainerTop + avtContainerHeight
        ) {
          activeCategory = avtContainer.id;
        }
      });
    });
  }, 16); // Debounce to roughly match 60fps

  /**
   * When a panel item is clicked this function is invoked. It scrolls the avatarsParentContainer to the corresponding panel item category.
   * @summary To scroll to the corresponding panel item category
   * @param event
   */
  async function panelItemClickHandler(event: any) {
    const targetId = event.target.id.toUpperCase();
    const categoryIndex = parseInt(targetId.replace("AVT", ""));

    if (isNaN(categoryIndex)) return;

    if (mode === AvatarType.EMOJI) {
      isLoadingMore = true;
      try {
        for (let i = 0; i <= categoryIndex; i++) {
          const [category, emojis] = storeAvatarsKV[i] || [];
          if (category && !lazyLoadedAvatars[category]) {
            lazyLoadedAvatars[category] = emojis.slice(0, 100);
          }
        }
        avatars = { ...lazyLoadedAvatars };
        await tick();
      } finally {
        isLoadingMore = false;
      }
    }

    const currentElement = document.getElementById("AVT" + categoryIndex);
    if (currentElement) {
      requestAnimationFrame(() => {
        avatarsParentContainer?.scrollTo({
          top: currentElement.offsetTop,
          left: 0,
          behavior: "smooth"
        });
      });
    }
  }
  /**
   * When the search input is changed this function is invoked. It filters the avatars based on the search input and displays the same.It Considers even removinng the entire string typed or resseting as trigger.
   * @summary To filter the avatars based on the search input
   */
  function onSearchInputHandler() {
    const input = searchRef;
    if (!input) return;
    let searchValue = input.value.trim();
    if (searchValue == "") {
      avatars = lazyLoadedAvatars;
      return;
    }
    let tempAvatars: any = {};
    for (let key of storeAvatarsKey) {
      for (let emote of storeAvatars[key as keyof typeof storeAvatars]) {
        let searchIndex = emote.length == 1 ? 0 : skinIndex;
        let emoteName = emote[searchIndex]?.name?.toLowerCase();
        if (emoteName.includes(searchValue.toLocaleLowerCase())) {
          if (tempAvatars[key] == undefined) tempAvatars[key] = [];
          tempAvatars[key].push(emote);
        }
      }
    }
    avatars = tempAvatars;
  }
  /**
   *Debounced version of the onSearchInputHandler function to reduce the unnecessary calls when the user as not completed typing.
   */
  let debouncedSearch = debouncer(onSearchInputHandler, 500);

  /**
   * Invoked by itemClickHandler. It checks if the item is present already in the used list,if presents just increases the frequency else adds it with frequency initialised as 1. Finally sorts the used list based on the frequency and emits the avatar Clicked.
   * @summary To add the clicked emoji or icon to the used list.
   * @param emote - The clicked emoji or icon.
   */
  function addToUsedList(emote: any) {
    let tempEmote = deepCopy(emote) as IAvatar;
    if (mode == AvatarType.ICON) {
      const usedIcons = [...($userPreferences.avatarPicker?.usedIcons ?? [])];
      let index = usedIcons.findIndex((el) => {
        return (
          el[0].name == emote.name &&
          (("file" in el[0] && el[0].file !== undefined) ||
            ("color" in el[0] &&
              el[0].color == iconColor &&
              "isFilled" in el[0] &&
              el[0].isFilled == checked))
        );
      });
      if (index == -1) {
        tempEmote = tempEmote as AvatarWithCode<IconAvatar>;
        tempEmote.type = AvatarType.ICON;
        tempEmote.frequency = 1;
        tempEmote.color = iconColor;
        tempEmote.isFilled = checked;
        usedIcons.push([tempEmote]);
      } else {
        const current = usedIcons[index]?.[0];
        if (current) {
          current.frequency = (current.frequency ?? 0) + 1;
          tempEmote = current;
        }
      }
      usedIcons.sort((a, b) => (b[0].frequency ?? 0) - (a[0].frequency ?? 0));
      userPreferences.setAvatarPicker({ usedIcons });
    } else {
      const usedEmojis = [...($userPreferences.avatarPicker?.usedEmojis ?? [])];
      let index = usedEmojis.findIndex((el) => {
        return (
          el[0].name == emote.name &&
          (("file" in el[0] && el[0].file !== undefined) ||
            ("code" in el[0] && el[0].code == emote.code))
        );
      });
      if (index == -1) {
        tempEmote = tempEmote as AvatarWithCode<EmojiAvatar>;
        tempEmote.type = AvatarType.EMOJI;
        tempEmote.frequency = 1;
        usedEmojis.push([tempEmote]);
      } else {
        const current = usedEmojis[index]?.[0];
        if (current) {
          current.frequency = (current.frequency ?? 0) + 1;
          tempEmote = current;
        }
      }

      usedEmojis.sort((a, b) => (b[0].frequency ?? 0) - (a[0].frequency ?? 0));
      userPreferences.setAvatarPicker({ usedEmojis });
    }
    avatarClickCallback(tempEmote);
  }
  /**
   * When an emoji or icon is clicked this function is invoked. if the avatar is an emoji, checks, it's a normal emoji or emoji with skins and invokes the addToFrequntlyUsed method with corresponding skin.If avatar is an icon,the color and fill is handled in addToUsedList method thus this function just invokes with the icon clicked.Finally Closes the avatar picker.
   * @summary To handle the click event of the emoji or icon.
   * @param emote - The clicked emoji or icon.
   * */
  function itemClickHandler(emote: any) {
    const input = searchRef;
    if (input?.value) {
      input.value = "";
      avatars = storeAvatars;
    }
    if (emote.length == 1) addToUsedList(emote[0]);
    else addToUsedList(emote[skinIndex]);
    closeCallback();
  }
  /**
   * Invoked when the custom upload button is clicked. It triggers the file input element to open the file picker.
   * @summary To programatically trigger click on the the file input element.
   */
  function triggerFileInput() {
    const inputElement = document.getElementById("myFile");
    inputElement?.click();
  }

  async function uploadedImageToEmote(input: any) {
    let imageLocalURL = new Blob([input], { type: input.type });
    let customName = input.name.split(".")[0].trim();
    let fileSaveResponse = await fileUpload.uploadFileV2(
      input.type,
      customName,
      imageLocalURL
    );
    return {
      name: customName,
      file: fileSaveResponse?.[0]?.id,
      frequency: 0,
      type: AvatarType.CUSTOM_UPLOAD
    } as CustomUploadedAvatar;
  }
  /**
   * Invoked when the click event happens on file input element. It first checks the filename already exists if not then uploads the custom avatar to the s3 and adds the avatar returned URL to the used list.
   * @summary To add custom avatar to the used list.
   */
  async function customUploadHandler(event: any) {
    let input = event.target.files[0];
    let customName = input.name.split(".")[0].trim();
    if (mode == AvatarType.ICON) {
      for (let icon of $userPreferences.avatarPicker.usedIcons ?? []) {
        if (icon[0]?.name?.toLowerCase() == customName.toLowerCase()) {
          alert("The icon name already exists. Please rename and upload");
          return;
        }
      }
      let emote = await uploadedImageToEmote(input);
      userPreferences.setAvatarPicker({
        usedIcons: [...$userPreferences.avatarPicker.usedIcons, [emote]]
      });
    } else {
      for (let emoji of $userPreferences.avatarPicker.usedEmojis ?? []) {
        if (emoji[0]?.name?.toLowerCase() == customName.toLowerCase()) {
          alert("The emoji name already exists. Please rename and upload");
          return;
        }
      }
      let emote = await uploadedImageToEmote(input);
      userPreferences.setAvatarPicker({
        usedEmojis: [...$userPreferences.avatarPicker.usedEmojis, [emote]]
      });
    }
  }

  async function handleModeSwitch(e: any) {
    mode = e.detail.toUpperCase();
    lazyLoadedAvatars = {};
    avatars = {};
    previousKVIndex = -1;
    previousIconIndex = 0;
    isLoadingMore = false;

    if (avatarsParentContainer) {
      avatarsParentContainer.scrollTop = 0;
    }

    if (mode === AvatarType.ICON) {
      storeAvatars = materialSymbolsWithCategories;
    } else {
      storeAvatars = emojisWithCategories;
    }

    updateUsedAndCustomAvatars($userPreferences);
    storeAvatarsKV = Object.entries(storeAvatars);
    storeAvatarsKey = Object.keys(storeAvatars);
    await lazyLoadAvatars();
  }
</script>

<div
  class={cn(
    "bg-bgs1 mo:h-96 h-[30.5rem] mo:border mo:border-brs2 rounded-md max-w-full",
    {
      "w-[35rem]": isExpanded,
      "cw:w-full w-[24rem]": !isExpanded
    }
  )}
>
  <div class="flex h-12 border-b border-b-brs2 p-2">
    <div
      class={cn("flex items-center h-full px-2", {
        "flex-1": !isExpanded,
        "w-3/10": isExpanded
      })}
    >
      {#if context === AvatarPickerContext.RATING_AVATAR}
        Pick an icon
      {:else}
        <PanelSwitcher
          items={["Icon", "Emoji"]}
          size={Size.sm}
          style={PanelSwitcherStyle.TRAIN}
          value={mode == AvatarType.ICON ? "Icon" : "Emoji"}
          onSwitch={handleModeSwitch}
        />
      {/if}
    </div>
    <div
      class={cn("flex h-full", {
        "justify-end flex-none": !isExpanded,
        "justify-around grow": isExpanded
      })}
    >
      {#if isExpanded}
        <div class="flex rounded-md w-8/10 px-1 border border-brs2">
          <Icon size={Size.xs} />
          <input
            type="search"
            placeholder="Search"
            bind:this={searchRef}
            oninput={debouncedSearch}
            id="iconPickerSearch"
            class="w-full h-full p-0.5 pl-2 bg-transparent text-fgs1 text-b2 truncate outline-none rounded-md"
          />
        </div>
      {/if}
      <Button icon="randomize" tooltip="Randomize" onclick={ShufflePick} />
      <Button
        icon="trash"
        tooltip="Delete"
        onclick={() => {
          deleteCallback();
        }}
      />
      {#if $view.isConstrainedWidth}
        <Button
          icon="cross"
          onclick={() => {
            closeCallback();
          }}
        />
      {/if}
    </div>
  </div>
  {#if !isExpanded}
    <input
      type="search"
      placeholder="Search"
      bind:this={searchRef}
      oninput={debouncedSearch}
      id="iconPickerSearch"
      class="w-full h-10 p-0.5 pl-2 bg-transparent text-fgs1 text-b2 truncate outline-none rounded-md"
    />
  {/if}
  <div class="flex h-9/10">
    {#if isExpanded}
      <div
        class="relative w-3/10 min-w-[30%] h-full flex flex-col gap-2 px-2 py-2 border-r border-r-brs2"
      >
        <div class="px-2 text-left">
          <Text content="Category" style={TextStyle.SECTION_HEADING_SMALL} />
        </div>
        <div class="flex flex-col gap-1">
          {#each storeAvatarsKey as key, index (index)}
            {#if storeAvatars[key] !== undefined && storeAvatars[key].length > 0}
              <button
                id={"avt" + index}
                class={cn(
                  "block w-full px-2 py-0.5 text-b2 text-left rounded-md",
                  {
                    [abg()]: activeCategory == "AVT" + index,
                    "hover:bg-bgs2": activeCategory != "AVT" + index
                  }
                )}
                onclick={panelItemClickHandler}
              >
                {key}
              </button>
            {/if}
          {/each}
        </div>
        {#if mode == AvatarType.ICON}
          <Divider colorStrength={ColorStrength.Strong} thickness={2} />
          <SwitchInput label={{ label: "Fill" }} bind:checked size={Size.sm} />
        {/if}
        <div class="absolute bottom-3 -right-2 w-9/10">
          <UploadButton size={Size.sm} oninput={customUploadHandler} />
        </div>
      </div>
    {/if}
    <div class="flex flex-col grow h-full">
      {#if (!isColorNotApplicable && mode === AvatarType.ICON) || mode === AvatarType.EMOJI}
        <div
          class="w-full h-1/10 flex items-center gap-3 px-4 border-b border-b-brs2 bg-bgs2"
        >
          {#if mode === AvatarType.ICON}
            {#each colorPalate as color}
              <span
                id={"colPalate" + color}
                class={cn(
                  "inline-flex justify-center items-center rounded-full w-7 h-7",
                  {
                    border: iconColor == color,
                    "border-fgs2": color === "bw"
                  }
                )}
                style={`padding: 0rem; border-color: ${color !== "bw" ? color : ""}`}
              >
                <button
                  id={"colPalateButton" + color}
                  onclick={() => (iconColor = color)}
                  class={cn("rounded-full w-5 h-5", {
                    "bg-fgs2": color === "bw"
                  })}
                  style="background-color:{color !== 'bw' ? color : ''}"
                >
                  {#if color === "bw"}
                    <svg viewBox="0 0 100 100" class="w-full h-full">
                      <circle cx="50" cy="50" r="50" class="fill-bgs1" />
                      <path d="M50 0A50 50 0 0 1 50 100V0Z" class="fill-fgs1" />
                    </svg>
                  {/if}
                </button></span
              >
            {/each}
          {:else if mode === AvatarType.EMOJI}
            {#each skinTones as skin, index}
              <span
                class="inline-flex justify-center items-center rounded-full w-7 h-7"
                style="padding: 0rem;{skinIndex == index
                  ? `border:1px solid ${skin}`
                  : ''}"
              >
                <button
                  onclick={() => (skinIndex = index)}
                  aria-label={`Emoji skin tone ${index + 1}`}
                  class="rounded-full w-5 h-5"
                  style="background-color:{skin}"
                ></button></span
              >
            {/each}
          {/if}
        </div>
      {/if}
      <div
        bind:this={avatarsParentContainer}
        onscroll={handleScroll}
        class="relative w-full h-8/10 overflow-auto mt-3"
      >
        {#each avatarKeys as key, index}
          {#if avatars[key] !== undefined && avatars[key].length > 0}
            <div id={"AVT" + index} class="AVT flex flex-col p-2">
              <p class="text-b4 text-fgs3 px-2 text-left">{key}</p>
              <div class="flex flex-wrap">
                {#each avatars[key] as emote, index (index)}
                  <button
                    onclick={() => itemClickHandler(emote)}
                    onmouseenter={() => {
                      if (searchRef) searchRef.placeholder = emote[0].name;
                    }}
                    onmouseleave={() => {
                      if (searchRef) searchRef.placeholder = "Search";
                    }}
                    class="flex justify-center items-center h-8 w-8 p-1 hover:bg-bgs2"
                  >
                    <AvatarRenderer
                      isHoverEnabled={true}
                      avatar={resolvePreviewAvatar(emote)}
                      size={Size.lg}
                    />
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
</div>
