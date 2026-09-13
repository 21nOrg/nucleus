<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";
  import { requireCommandHost } from "@nucleum/stores/commands/command-host";

  import Header from "@nucleum/products/pointron/onboarding/OnboardingHeader.svelte";
  import Footer from "@nucleum/products/pointron/onboarding/OnboardingFooter.svelte";
  import { appStore } from "@nucleum/stores/app.store";
  import { userPreferences } from "@nucleum/stores/preferences/user-preferences.store";
  import view from "@nucleum/stores/view.store";
  import Button from "@21n/elements/button/Button.svelte";
  import { ButtonStyle } from "@21n/elements/button/button.type";
  import { onMount } from "svelte";
  import AppLoadingView from "@21n/layout/paint/AppLoadingView.svelte";
  import { postMessageToParent } from "@nucleum/client/runtime/embed/embed.utils";
  import { EmbedMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
  import { uiState } from "@nucleum/stores/uiState/uiState.store";
  import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import context from "@nucleum/stores/context.store";

  let currentStep = 0;

  let isPortraitModeInitialRender = true;
  let stepsJson = [
    {
      title: "Pointron",
      description:
        "In a world that constantly distracts, being time-aware is vital for productivity and personal well being. Pointron simplifies this for you.",
      img: ""
    },
    {
      title: "1. Create objectives",
      description:
        "You can create objectives and infinitely nest sub-objectives, attach tags to objectives to track your progress across various objectives of your life in a more granular manner",
      img: "images/onboarding/goals.gif"
    },
    {
      title: "2. Focus using focus sessions",
      description:
        "Begin focusing by tapping on an objective in quick focus section or composing your own advanced focus session.",
      img: "images/onboarding/custom.gif"
    },
    {
      title: "3. Analyse and repeat",
      description:
        "When its time, make thoughtful decisions or track the progress of your days using the powerful analytics provided by Pointron",
      img: "images/onboarding/analytics.gif"
    }
  ];

  const steps: {
    landscape: { title: string; description: string; img: string }[];
    portrait: { title: string; description: string; img: string }[];
  } = {
    landscape: [...stepsJson],
    portrait: [...stepsJson]
  };

  async function handleStartTutorial() {
    await userPreferences.initializeTimeZoneForSignup();
    onFinish();
  }

  function onSkip() {
    $view.isPortrait
      ? (currentStep = steps.portrait.length - 1)
      : (currentStep = steps.landscape.length - 1);
  }

  function onFinish() {
    uiState.setState(UIState.isOnboardingComplete, true, {
      scope: UIStateScope.PRODUCT
    });
    navigation.gotoPath("/");
    if (!$context.isEmbed)
      requireCommandHost().runAction(PointronAction.IMPORT_ONBOARDING);
  }

  function handleStepButtonClick(action: "+" | "-") {
    return () => {
      console.log("clicked");
      if (action === "+") {
        currentStep === steps.landscape.length - 1 && onSkip();
        $view.isPortrait
          ? currentStep < steps.portrait.length - 1 && currentStep++
          : currentStep < steps.landscape.length - 1 && currentStep++;
      } else if (action === "-") {
        currentStep > 0 && currentStep--;
      }
    };
  }

  onMount(() => {
    postMessageToParent(EmbedMessage.MOUNT);
    // if (isOnboardingComplete) {
    //   windowObject.gotoPath("/");
    // }
    setTimeout(() => {
      isPortraitModeInitialRender = false;
    }, 1000);
  });
</script>

<section class="w-full h-full bg-bgs1 flex justify-center items-center">
  {#if $view.isPortrait && isPortraitModeInitialRender}
    <AppLoadingView />
  {:else}
    <div
      class={`max-w-7xl w-full flex h-full flex-col items-center ${
        $view.isPortrait
          ? `px-8 py-10 justify-start  gap-8`
          : `p-16 justify-between`
      }`}
    >
      {#if $view.isPortrait}
        {#if !isPortraitModeInitialRender}
          <Header
            totalSteps={$view.isPortrait
              ? steps.portrait.length
              : steps.landscape.length}
            {currentStep}
            onBack={handleStepButtonClick("-")}
            {onSkip}
            {onFinish}
          />
        {/if}
      {:else}
        <Header
          totalSteps={$view.isPortrait
            ? steps.portrait.length
            : steps.landscape.length}
          {currentStep}
          onBack={handleStepButtonClick("-")}
          {onSkip}
          {onFinish}
        />
      {/if}
      <div class="w-full h-full">
        {#if $view.isPortrait}
          <div
            class="flex flex-col justify-start h-full gap-4 {steps.portrait[
              currentStep
            ].img
              ? 'justify-start'
              : 'justify-center'}"
          >
            <div class="flex flex-col text-center items-center gap-3">
              <div class="text-h3 font-bold text-fgs1">
                {steps.portrait[currentStep].title}
              </div>
              <div class="text-b2 text-fgs2">
                {steps.portrait[currentStep].description}
              </div>
            </div>
            {#if steps.portrait[currentStep].img}
              <div class="bottom flex items-center justify-center">
                <img
                  class="rounded-md"
                  src={steps.portrait[currentStep].img}
                  alt={`step-${currentStep}`}
                />
                <!-- <VideoPlayer
                  src={steps.portrait[currentStep].img}
                  hideControls
                  bind:duration={videoDuration}
                  autoplay={$appStore.launchContext === LaunchContext.EMBED
                    ? false
                    : true}
                /> -->
                <!-- {#each steps.portrait as step, index}
                  {#if currentStep === index}
                    <dotlottie-player
                      bind:this={lottiePlayer}
                      id={index}
                      src={step.img}
                      background="transparent"
                      speed="1"
                      style="width: 100%;"
                      direction="1"
                      autoplay
                      mode="normal"
                    />
                  {/if}
                {/each} -->
              </div>
            {/if}
          </div>
        {:else}
          <div
            class="flex h-full items-center {currentStep === 0
              ? ` text-center justify-center`
              : ` gap-16 justify-between`}"
          >
            <div class="flex flex-col h-full justify-around">
              <div
                class="left flex flex-col justify-start gap-4 {currentStep === 0
                  ? `max-w-3xl items-center`
                  : `max-w-xl`}"
              >
                <div class="text-h1 font-bold text-fgs1 leading-[110%]">
                  {steps.landscape[currentStep].title}
                </div>
                <div
                  class="text-base text-fgs3 h-20 {currentStep === 0
                    ? `max-w-[70%]`
                    : `max-w-[100%]`}"
                >
                  {steps.landscape[currentStep].description}
                </div>
                <div class="flex flex-col buttons mt-8 h-32">
                  {#if currentStep === 0}
                    <Button onclick={handleStepButtonClick("+")} type="primary">
                      Get Started
                    </Button>
                  {:else if currentStep !== steps.landscape.length - 1}
                    <div class="flex flex-col w-fit items-center gap-4">
                      <Button
                        onclick={handleStepButtonClick("+")}
                        type="primary"
                      >
                        Next
                      </Button>
                      <Button onclick={onSkip} style={ButtonStyle.PLAIN}>
                        Skip
                      </Button>
                    </div>
                  {:else}
                    <div class="flex flex-col w-fit items-center gap-4">
                      <Button
                        onclick={handleStartTutorial}
                        width="w-[12.5rem]"
                        type="primary"
                      >
                        Let's go
                      </Button>
                    </div>
                  {/if}
                </div>
              </div>
            </div>

            {#if steps.landscape[currentStep].img}
              <div class="right w-[500px]">
                <img
                  src={steps.landscape[currentStep].img}
                  alt={`step-${currentStep}`}
                />
              </div>
            {/if}
          </div>
        {/if}
      </div>

      {#if $view.isPortrait}
        {#if !isPortraitModeInitialRender}
          <Footer
            onNext={handleStepButtonClick("+")}
            onFinal={handleStartTutorial}
            activeStep={currentStep}
            totalSteps={$view.isPortrait
              ? steps.portrait.length
              : steps.landscape.length}
          />
        {/if}
      {:else}
        <Footer
          onNext={handleStepButtonClick("+")}
          onFinal={handleStartTutorial}
          activeStep={currentStep}
          totalSteps={$view.isPortrait
            ? steps.portrait.length
            : steps.landscape.length}
        />
      {/if}
    </div>
  {/if}
</section>
