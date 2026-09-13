<script lang="ts">
  import { navigation } from "@21n/layout/navigation/navigation";

  import Button from "@21n/elements/button/Button.svelte";
  import TextInput from "@21n/elements/input/TextInput.svelte";
  import InlineFeedbackText from "@nucleum/extensions/clipper/InlineFeedbackText.svelte";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import { Orientation } from "@21n/elements/direction.enum";
  import { AlertType } from "@nucleum/stores/notifications/notification.type";
  import { Size } from "@21n/elements/size.enum";
  import { isValidEmail } from "@21n/shared-utils/text.utils";

  import view from "@nucleum/stores/view.store";
  import { authClient } from "@nucleum/client/runtime/account/auth";
  import Icon from "@21n/elements/Icon.svelte";
  import { page } from "$app/stores";

  let email = $state($page.url.searchParams.get("email") ?? "");
  let otp = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let error = $state<string | null>(null);
  let info = $state<string | null>(null);
  let actionInProgress = $state(false);
  let isPasswordUpdated = $state(false);
  let step = $state<"email" | "otp" | "password">("email");
  let showNewPassword = $state(false);
  let showConfirmPassword = $state(false);
  const flowMode = $derived(
    $page.url.searchParams.get("mode") === "set" ? "set" : "reset"
  );

  function resolveInlineFeedback() {
    return info
      ? { type: AlertType.SUCCESS, message: info }
      : error
        ? { type: AlertType.ERROR, message: error }
        : undefined;
  }

  function resolveTrimmedEmail() {
    return email.trim();
  }

  function clearFeedback() {
    error = null;
    info = null;
  }

  async function handleSendOTP(event?: Event) {
    event?.preventDefault();
    if (actionInProgress) return;

    clearFeedback();

    if (!resolveTrimmedEmail()) {
      error = "Please enter your email address.";
      return;
    }

    if (!isValidEmail(resolveTrimmedEmail())) {
      error = "Please enter a valid email address.";
      return;
    }

    actionInProgress = true;
    try {
      const response = await (
        await authClient()
      ).startPasswordReset({
        email: resolveTrimmedEmail()
      });

      if (!response.ok) {
        error =
          response.error.message ?? "Failed to send OTP. Please try again.";
        return;
      }

      if (response.data.sent) {
        info = "OTP sent to your email address. Please check your inbox.";
        step = "otp";
      }
    } catch (err) {
      console.error("Error sending OTP:", err);
      error = "Something went wrong. Please try again.";
    } finally {
      actionInProgress = false;
    }
  }

  async function handleVerifyOTP(event?: Event) {
    event?.preventDefault();
    if (actionInProgress) return;

    clearFeedback();

    if (!otp) {
      error = "Please enter the OTP.";
      return;
    }

    try {
      info = "OTP entered. Please set your new password.";
      step = "password";
    } catch (err) {
      console.error("Error verifying OTP:", err);
      error = "Failed to verify OTP. Please try again.";
    } finally {
      actionInProgress = false;
    }
  }

  async function handleResetPassword(event?: Event) {
    event?.preventDefault();
    if (actionInProgress || isPasswordUpdated) return;

    clearFeedback();

    if (!newPassword || !confirmPassword) {
      error = "Please fill all the fields.";
      return;
    }

    if (newPassword !== confirmPassword) {
      error = "Passwords do not match.";
      return;
    }

    if (!isValidPassword(newPassword)) {
      return;
    }

    actionInProgress = true;
    try {
      const response = await (
        await authClient()
      ).completePasswordReset({
        email: resolveTrimmedEmail(),
        code: otp,
        newPassword
      });

      if (!response.ok) {
        error =
          response.error.message ??
          "Failed to reset password. Please try again.";
        return;
      }

      if (response.data.passwordUpdated) {
        isPasswordUpdated = true;
        info =
          flowMode === "set"
            ? "Password set successfully. Redirecting to login..."
            : "Password reset successful. Redirecting to login...";
        setTimeout(() => {
          navigation.gotoPath("/account/login");
        }, 2000);
      }
    } catch (err) {
      console.error("Error resetting password:", err);
      error = "Failed to reset password. Please try again.";
    } finally {
      actionInProgress = false;
    }
  }

  function isValidPassword(password: string): boolean {
    if (password.length < 12) {
      error = "Password must be at least 12 characters long.";
      return false;
    }
    if (!password.match(/[a-z]/)) {
      error = "Password must contain at least one lowercase letter.";
      return false;
    }
    if (!password.match(/[A-Z]/)) {
      error = "Password must contain at least one uppercase letter.";
      return false;
    }
    if (!password.match(/[0-9]/)) {
      error = "Password must contain at least one number.";
      return false;
    }
    if (!password.match(/[^a-zA-Z0-9]/)) {
      error = "Password must contain at least one special character.";
      return false;
    }
    return true;
  }

  function handleBackToLogin() {
    navigation.gotoPath("/account/login");
  }

  async function handleResendOTP() {
    clearFeedback();
    otp = "";
    await handleSendOTP();
  }
</script>

<div class="flex w-full h-full items-center justify-center px-6">
  <div class="flex flex-col w-80 {$view.scale > 0.6 ? 'gap-10' : 'gap-6'}">
    <div class="flex flex-col gap-2 text-center">
      <h2 class="text-h4 font-medium">
        {flowMode === "set" ? "Set password" : "Forgot password?"}
      </h2>
      <p class="text-fgs3 text-b2">
        {#if step === "email"}
          Enter the email linked to your account and we'll send you an OTP to
          {flowMode === "set" ? "set your password." : "reset your password."}
        {:else if step === "otp"}
          Enter the OTP sent to your email address.
        {:else}
          Create a new password for your account.
        {/if}
      </p>
    </div>

    <form
      class="flex flex-col gap-4"
      onsubmit={(event) => {
        event.preventDefault();
        return step === "email"
          ? handleSendOTP()
          : step === "otp"
            ? handleVerifyOTP()
            : handleResetPassword();
      }}
    >
      {#if step === "email"}
        <TextInput
          bind:value={email}
          type="email"
          label={{
            label: "Email",
            orientation: Orientation.Vertical
          }}
          placeholder="name@email.com"
          onInput={clearFeedback}
          onEnter={handleSendOTP}
        />
      {:else if step === "otp"}
        <TextInput
          bind:value={email}
          type="email"
          label={{
            label: "Email",
            orientation: Orientation.Vertical
          }}
          placeholder="name@email.com"
          isDisabled={true}
        />
        <TextInput
          bind:value={otp}
          type="text"
          label={{
            label: "OTP",
            orientation: Orientation.Vertical
          }}
          placeholder="123456"
          onInput={clearFeedback}
          onEnter={handleVerifyOTP}
        />
      {:else}
        <TextInput
          bind:value={newPassword}
          type={showNewPassword ? "text" : "password"}
          label={{
            label: "New Password",
            orientation: Orientation.Vertical,
            tooltip: {
              body: "Password must be at least 12 characters long and contain at least one lowercase letter, one uppercase letter, one number and one special character."
            }
          }}
          placeholder="********"
          onInput={clearFeedback}
        >
          <button
            type="button"
            onclick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              showNewPassword = !showNewPassword;
            }}
            onmousedown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            class="flex items-center justify-center"
          >
            <Icon
              icon={showNewPassword ? "hide" : "show"}
              size={Size.sm}
              class="stroke-fgs3 hover:stroke-fgs2"
            />
          </button>
        </TextInput>
        <TextInput
          bind:value={confirmPassword}
          type={showConfirmPassword ? "text" : "password"}
          label={{
            label: "Confirm Password",
            orientation: Orientation.Vertical
          }}
          placeholder="********"
          onInput={clearFeedback}
          onEnter={handleResetPassword}
        >
          <button
            type="button"
            onclick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              showConfirmPassword = !showConfirmPassword;
            }}
            onmousedown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            class="flex items-center justify-center"
          >
            <Icon
              icon={showConfirmPassword ? "hide" : "show"}
              size={Size.sm}
              class="stroke-fgs3 hover:stroke-fgs2"
            />
          </button>
        </TextInput>
      {/if}

      <InlineFeedbackText
        isRenderEmptyHeight={true}
        feedback={resolveInlineFeedback()}
        isAutoDissappear={false}
        size={Size.sm}
      />

      <Button
        label={step === "email"
          ? actionInProgress
            ? "Sending OTP..."
            : "Send OTP"
          : step === "otp"
            ? actionInProgress
              ? "Continuing..."
              : "Continue"
            : actionInProgress
              ? flowMode === "set"
                ? "Setting password..."
                : "Resetting password..."
              : flowMode === "set"
                ? "Set password"
                : "Reset password"}
        type={ButtonVariant.PRIMARY}
        style={ButtonStyle.OUTLINED}
        isLoading={actionInProgress}
        isDisabled={actionInProgress || isPasswordUpdated}
        onclick={step === "email"
          ? handleSendOTP
          : step === "otp"
            ? handleVerifyOTP
            : handleResetPassword}
      />

      {#if step === "otp"}
        <Button
          label="Resend OTP"
          style={ButtonStyle.PLAIN}
          size={Size.sm}
          onclick={handleResendOTP}
        />
      {/if}
    </form>

    <div class="flex justify-center">
      <Button
        label="Back to log in"
        style={ButtonStyle.PLAIN}
        size={Size.sm}
        onclick={handleBackToLogin}
        isUnderlined={true}
      />
    </div>
  </div>
</div>
