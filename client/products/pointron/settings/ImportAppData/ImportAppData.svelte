<script lang="ts">
  import { fileUpload } from "@nucleum/stores/files/file-upload";

  import view from "@nucleum/stores/view.store";
  import modalEvent from "@nucleum/stores/overlays/modal.store";
  import Icon from "@21n/elements/Icon.svelte";
  import Button from "@21n/elements/button/Button.svelte";
  import { PointronAction } from "@nucleum/client/config/focus-action.enum";
  import { Size } from "@21n/elements/size.enum";
  import FileItem from "@nucleum/products/pointron/settings/ImportAppData/FileItem.svelte";
  import { UploadStatus } from "@nucleum/application/settings/import/uploadStatus.enum";
  import { convertFileSize } from "@21n/utils/utils";
  import { FileSizeMeasurement } from "@21n/utils/fileSizeMeasurement.enum";
  import { get } from "svelte/store";
  import account from "@nucleum/stores/account.store";
  import { detectTimeZone } from "@21n/utils/time.utils";
  import { toasts } from "@nucleum/stores/notification.store";
  import { lastImportTime } from "@nucleum/products/pointron/pointron.store";
  import CheckboxInput from "@21n/elements/toggle/CheckboxInput.svelte";
  import { performApiCall } from "@21n/utils/network.utils";
  import {
    ImportSource,
    StepType
  } from "@nucleum/products/pointron/settings/data/data.type";
  import { ButtonStyle, ButtonVariant } from "@21n/elements/button/button.type";
  import Divider from "@21n/elements/Divider.svelte";

  import { Display } from "@21n/elements/display.enum";
  import { enumToString, properCase } from "@21n/shared-utils/text.utils";
  import { renderMdAsHtml } from "@21n/elements/markdown/markdown.utils";
  import { parse } from "@21n/shared-utils/json.utils";
  import {
    datafn,
    datafnRuntime,
    refreshNucleumDatafnStatus
  } from "@nucleum/datafn/datafn.store";
  import {
    isPointronDatafnBackup,
    resolveDatafnImportErrorCount
  } from "@nucleum/products/pointron/settings/data/pointronDatafnBackup.utils";

  let { importSource = ImportSource.SELF }: { importSource?: ImportSource } =
    $props();
  let checked: boolean = false;
  let inputRef: HTMLInputElement;
  let accept = ".json";
  let note = "File format: JSON, max size: 10MB";
  if (importSource !== ImportSource.SELF) {
    accept = ".csv";
    note = "File format: CSV, max size: 10MB";
  }
  let activeStepIndex: number = 0;

  let locallyUploadedFiles: FileList | null = null;
  let tempFileList:
    | {
        label: string;
        size: number;
        file: File;
        uploadStatus: UploadStatus;
        uploadProgress: number;
      }[]
    | null = null;

  const filesLimit = 5;
  const maxFileSize = 10000000;

  let isUploading: boolean = false;

  const steps: any = {
    [ImportSource.SELF]: [
      {
        subTitle: "Note: Do not exit this modal until the import is complete",
        description: "Browse and choose a exported *Pointron json* file",
        type: StepType.UPLOAD
      }
    ],
    [ImportSource.ATRACKER]: [
      {
        subTitle: "Let us guide you through importing files from ATracker",
        description:
          "Step 1: Go to Reports from the app menu and click on share button on top right corner. Choose email option.",
        type: StepType.NON_INTERACTIVE
      },
      {
        subTitle: "Let us guide you through importing files from ATracker",
        description:
          "Step 2: Once your receive a email with a **csv file** in it, please download the csv file and proceed to the next step.",
        type: StepType.NON_INTERACTIVE
      },
      {
        subTitle:
          "Note: Each task from Atracker will become an objective in Pointron",
        description: "Upload the csv file you downloaded in the previous step.",
        type: StepType.UPLOAD
      }
    ],
    [ImportSource.SESSION]: [
      {
        subTitle: "Let us guide you through importing files from Session",
        description:
          "Step 1: Go to **Reports** from the app menu and click on **share** button.",
        type: StepType.NON_INTERACTIVE
      },
      {
        subTitle: "Let us guide you through importing files from Session",
        description:
          "Step 2: Choose **Export to CSV** option from the share menu. This will export a csv file.",
        type: StepType.NON_INTERACTIVE
      },
      {
        subTitle:
          "**Note:** Each project from Session will become an objective and each task will become a task in Pointron. Also, Session currently does not support bulk export. So, please export the data for each month and then import it individually.",
        description: "Upload the csv file you downloaded in the previous step.",
        type: StepType.UPLOAD
      }
    ],
    [ImportSource.TIMEMATOR]: [
      {
        subTitle: "Let us guide you through importing files from Timemator",
        description: "Step 1: Go to **Reports** from the app menu.",
        type: StepType.NON_INTERACTIVE
      },
      {
        subTitle: "Let us guide you through importing files from Timemator",
        description:
          "Step 2: Click on **Share** button on the top right corner.",
        type: StepType.NON_INTERACTIVE
      },
      {
        subTitle: "Let us guide you through importing files from Timemator",
        description: "Step 3: Choose Export as CSV",
        type: StepType.NON_INTERACTIVE
      },
      {
        subTitle:
          "Note: Each folder from Timemator will become an objective and each task inside a folder will become its sub-objective",
        description: "Upload",
        type: StepType.UPLOAD
      }
    ],
    [ImportSource.TOGGL_TRACK]: [
      {
        subTitle: "Let us guide you through importing files from Toggl Track",
        description:
          "Step 1: Select **Import/Export** from the app menu and click on **Data export**.",
        type: StepType.NON_INTERACTIVE
      },
      {
        subTitle: "Let us guide you through importing files from Toggl Track",
        description:
          "Step 3: Click on **Export time entries** after choosing the time period.",
        type: StepType.NON_INTERACTIVE
      },
      {
        subTitle:
          "Note: Each project from Toggl will become an objective and each task will become a task in Pointron",
        description: "Upload the csv file you downloaded in the previous step.",
        type: StepType.UPLOAD
      }
    ]
  };

  function onJumpToUpload() {
    activeStepIndex = steps[importSource]?.length - 1;
  }

  function onNext() {
    if (activeStepIndex < steps[importSource]?.length - 1) {
      activeStepIndex++;
    }
  }

  function resetFileInput() {
    locallyUploadedFiles = null;
    inputRef ? (inputRef.value = "") : "";
  }

  function onBack() {
    resetFileInput();
    if (activeStepIndex > 0) {
      activeStepIndex--;
    }
  }

  function getValidFilesFromLocallyUploadedFiles() {
    let validFiles: File[] = [];
    if (tempFileList && locallyUploadedFiles) {
      for (let i = 0; i < locallyUploadedFiles.length; i++) {
        const file = locallyUploadedFiles[i];
        const fileName = file.name;
        if (
          tempFileList.some(
            (item) => item.label === fileName && isFileValid(file)
          )
        ) {
          validFiles.push(file);
        }
      }
    }
    return validFiles;
  }
  function keepIncreasingProgress() {
    const interval = setInterval(() => {
      if (!isUploading || !tempFileList) {
        clearInterval(interval);
        return;
      }
      if (tempFileList) {
        tempFileList = tempFileList.map((item) => {
          if (item.uploadProgress < 90) {
            return {
              ...item,
              uploadProgress: item.uploadProgress + 1
            };
          }
          return item;
        });

        const isUploadComplete =
          tempFileList.every(
            (item) => item.uploadStatus === UploadStatus.UPLOADED
          ) ?? false;
        if (isUploadComplete) {
          clearInterval(interval);
        }
      }
    }, 500);
  }

  function resetCurrentUploadProgress() {
    isUploading = false;
    tempFileList = tempFileList
      ? tempFileList.map((item) => ({
          ...item,
          uploadStatus: UploadStatus.NOT_STARTED,
          uploadProgress: 0
        }))
      : null;
  }

  function isJsonFile(file: File) {
    return (
      file.type === "application/json" ||
      file.name.toLowerCase().endsWith(".json")
    );
  }

  async function onUpload() {
    if (tempFileList) {
      isUploading = true;
      tempFileList = tempFileList.map((item) => {
        return {
          ...item,
          uploadStatus: UploadStatus.UPLOADING,
          uploadProgress: 10
        };
      });
      keepIncreasingProgress();
      if (isJsonFile(tempFileList[0].file)) {
        const file = tempFileList[0].file;
        if (!get(datafnRuntime)?.storage) {
          resetCurrentUploadProgress();
          toasts.error("Pointron import is not available in cloud direct mode");
          return;
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const importedData = event.target?.result;
            if (!importedData) {
              resetCurrentUploadProgress();
              toasts.error("Please select a valid file");
              return;
            }
            const jsonData = parse(importedData as string);
            if (!isPointronDatafnBackup(jsonData)) {
              resetCurrentUploadProgress();
              toasts.error("Invalid Pointron DataFn backup file");
              return;
            }
            const result = await datafn.importData(jsonData, {
              triggerCloneUp: true
            });
            await refreshNucleumDatafnStatus();
            const errorCount = resolveDatafnImportErrorCount(result);
            tempFileList = tempFileList
              ? tempFileList.map((item) => ({
                  ...item,
                  uploadStatus: UploadStatus.UPLOADED,
                  uploadProgress: 100
                }))
              : null;
            isUploading = false;
            $lastImportTime = Date.now();
            if (errorCount > 0) {
              toasts.error(
                `Pointron data imported with ${errorCount} skipped records`
              );
            } else {
              toasts.success("Pointron data imported successfully");
            }
          } catch (error) {
            console.error("Error parsing JSON file:", error);
            resetCurrentUploadProgress();
            toasts.error("Invalid file selected");
          }
        };
        reader.readAsText(file);
      } else {
        try {
          const userId = get(account)?.userInfo?.id.split(":")[1] ?? "";
          const [url] = await fileUpload.tempUploadToS3(tempFileList[0].file);
          const timeZone = detectTimeZone();
          const region = $account.userInfo?.region;
          let body = {
            s3Url: url,
            userId: userId,
            timeZone: timeZone,
            region: region,
            isArchiveAll: checked
          };
          await performApiCall("pointron/import", "POST", body);
          tempFileList = tempFileList
            ? tempFileList.map((item) => ({
                ...item,
                uploadStatus: UploadStatus.UPLOADED,
                uploadProgress: 100
              }))
            : null;
          isUploading = false;
          setTimeout(() => {
            $lastImportTime = Date.now();
          }, 5000);
        } catch (e: any) {
          isUploading = false;
          toasts.error("Something went wrong during Import", e);
        }
      }
    } else {
      toasts.error("Please upload a file");
    }
  }

  function onClose() {
    resetFileInput();
    modalEvent.hide(PointronAction.IMPORT_APP_DATA);
  }

  function getSizeString(sizeInBytes: number) {
    if (sizeInBytes > 1000000) {
      return `${convertFileSize(sizeInBytes, FileSizeMeasurement.MEGABYTES)}MB`;
    } else if (sizeInBytes > 1000) {
      return `${convertFileSize(sizeInBytes, FileSizeMeasurement.KILOBYTES)}KB`;
    } else {
      return `${sizeInBytes}B`;
    }
  }

  function isFileCountInLimit(files: FileList | null) {
    if (files && files.length > filesLimit) {
      alert(`You can upload maximum ${filesLimit} files at a time`);
      return false;
    }
    return true;
  }

  function isFileValid(file: File) {
    if (file.size > maxFileSize) {
      alert("File size should be less than 10MB");
      return false;
    }
    return true;
  }

  function resolveTempFileList(locallyUploadedFiles?: FileList | null) {
    let nextTempFileList = tempFileList;
    if (locallyUploadedFiles) {
      if (!isFileCountInLimit(locallyUploadedFiles)) {
        nextTempFileList = null;
      } else {
        for (let i = 0; i < locallyUploadedFiles.length; i++) {
          const file = locallyUploadedFiles[i];
          if (!isFileValid(file)) {
            nextTempFileList = null;
            break;
          } else {
            nextTempFileList = Array.from(locallyUploadedFiles).map((file) => {
              return {
                label: file.name,
                size: file.size,
                file: file,
                uploadStatus: UploadStatus.NOT_STARTED,
                uploadProgress: 0
              };
            });
          }
        }
      }
    } else {
      nextTempFileList = null;
    }
    return nextTempFileList;
  }

  function handleRemove(index: number) {
    return () => {
      if (tempFileList) {
        tempFileList.splice(index, 1);
        tempFileList = [...tempFileList];
      }
    };
  }

  $effect(() => {
    tempFileList = resolveTempFileList(locallyUploadedFiles);
  });

  let isEverythingUploaded = $derived.by(() => {
    const files = tempFileList ?? [];
    return (
      files.length > 0 &&
      files.every((item) => item.uploadStatus === UploadStatus.UPLOADED)
    );
  });

  function resolveTitle(importSource: ImportSource) {
    if (importSource === ImportSource.SELF) return "Import from Pointron";
    else {
      return `Import from ${properCase(enumToString(importSource))} App`;
    }
  }

  function resolveImageSrc(importSource: ImportSource, index: number) {
    if (importSource === ImportSource.SELF) return "/images/blank.png";
    else {
      return import.meta.env?.VITE_STATIC_URL
        ? import.meta.env?.VITE_STATIC_URL +
            "/pointron/import/" +
            importSource.toLowerCase() +
            "/" +
            index +
            ".png"
        : "/images/blank.png";
    }
  }
</script>

<div class="flex flex-col gap-4 justify-between w-full h-full">
  {#if $view.display === Display.MO}
    <div class="header flex justify-between">
      {#if activeStepIndex !== 0}
        <Icon size={Size.sm} onclick={onBack} icon={"chevron-left"} />
      {/if}
      <div class="ml-auto">
        <Button
          size={$view.isPortrait ? Size.sm : Size.md}
          onclick={onClose}
          icon={"cross"}
        />
      </div>
    </div>
  {/if}
  {#if steps[importSource][activeStepIndex].type === StepType.NON_INTERACTIVE}
    <div class="flex flex-col items-center gap-2">
      <div class={`font-normal ${$view.isPortrait ? `text-b1` : `text-h4 `}`}>
        {resolveTitle(importSource)}
      </div>
      <div
        class={`font-normal w-full ${$view.isPortrait ? `text-b4` : `text-b3`}`}
      >
        {#key steps[importSource][activeStepIndex].subTitle}
          {@html renderMdAsHtml(steps[importSource][activeStepIndex].subTitle)}
        {/key}
      </div>
    </div>
    <div class="flex flex-col items-center gap-2 w-full">
      <div
        class={`text-fgs2 mr-auto dp:mt-4 w-full ${
          $view.isPortrait ? `text-left text-b4` : `text-b2`
        }`}
      >
        {#key steps[importSource][activeStepIndex].description}
          {@html renderMdAsHtml(
            steps[importSource][activeStepIndex].description
          )}
        {/key}
      </div>
      <div
        class={`rounded-xl overflow-auto object-contain mt-4  flex items-center justify-center mo:w-full w-4/5`}
      >
        <img
          class="w-full"
          alt={`Step-${activeStepIndex + 1}`}
          src={resolveImageSrc(importSource, activeStepIndex)}
        />
      </div>
    </div>
  {:else if steps[importSource][activeStepIndex].type === StepType.UPLOAD}
    <div class="flex flex-col items-center gap-2 w-full">
      <div class={`font-normal ${$view.isPortrait ? `text-b1` : `text-h4 `}`}>
        {resolveTitle(importSource)}
      </div>
      <div class={`font-normal ${$view.isPortrait ? `text-b4` : `text-b3`}`}>
        {#key steps[importSource][activeStepIndex].subTitle}
          {@html renderMdAsHtml(steps[importSource][activeStepIndex].subTitle)}
        {/key}
      </div>
    </div>
    <div class="flex flex-col items-center gap-2 w-full">
      <div
        class={`text-fgs2 mr-auto ${
          $view.isPortrait
            ? `text-left text-b4`
            : `flex justify-center text-b2 w-full`
        }`}
      >
        {#key steps[importSource][activeStepIndex].description}
          {@html renderMdAsHtml(
            steps[importSource][activeStepIndex].description
          )}
        {/key}
      </div>
      <div
        class={`rounded-xl border-dashed p-4 overflow-auto mt-4 border  flex items-center justify-center ${
          $view.isPortrait ? `w-full` : `w-[530px]`
        } ${tempFileList?.length ? `border-a1` : `h-[290px] border-bgs4`}`}
      >
        <div
          class={`flex items-center ${
            tempFileList?.length && !$view.isPortrait
              ? `gap-3`
              : `flex-col gap-2 `
          }`}
        >
          <Icon icon="upload" />
          <div
            class={`flex-col ${
              tempFileList?.length && !$view.isPortrait
                ? `text-left`
                : `text-center`
            }`}
          >
            <div class={`${$view.isPortrait ? `text-b4` : `text-b2`}`}>
              Browse a file or drag and drop here
            </div>
            <div
              class={`text-fgs3 ${tempFileList?.length ? `` : `mb-4`} 
                   ${$view.isPortrait ? `text-b4` : `text-b2`}`}
            >
              {note}
            </div>
          </div>
          <input
            multiple={false}
            bind:files={locallyUploadedFiles}
            class="hidden"
            {accept}
            bind:this={inputRef}
            type="file"
          />
          <Button
            size={Size.sm}
            onclick={() => {
              inputRef.click();
            }}
          >
            Browse
          </Button>
        </div>
      </div>
    </div>
    {#if tempFileList?.length}
      <div class="flex w-full justify-center">
        <div class="w-4/5 overflow-auto h-60 border rounded-md border-brs2">
          {#each tempFileList as file, index}
            <FileItem
              label={file.label}
              size={getSizeString(file.size)}
              uploadStatus={file.uploadStatus}
              uploadProgress={file.uploadProgress}
              onRemove={handleRemove(index)}
            />
          {/each}
        </div>
      </div>
    {/if}
  {/if}
  {#if !tempFileList?.length}
    <div class="navigation-dots flex gap-3 w-full justify-center">
      {#each steps[importSource] as step, index}
        <button
          class={`navigation-dot w-2 h-2 rounded-full  ${
            activeStepIndex === index ? "bg-aps1" : "bg-fgs2"
          }`}
          onclick={() => {
            activeStepIndex = index;
          }}
        />
      {/each}
    </div>
  {/if}
  <footer>
    <Divider />
    {#if activeStepIndex === steps[importSource]?.length - 1 && isEverythingUploaded}
      <div class="p-4">
        Upload completed successfully, Importing in background, Check the import
        table after a few minutes for status
      </div>
    {/if}
    {#if importSource != ImportSource.SELF && activeStepIndex === steps[importSource]?.length - 1 && !isEverythingUploaded}
      <div class="p-4">
        <CheckboxInput bind:checked label="Archive All Imported Objectives" />
      </div>
    {/if}
    <div class="flex mo:px-3 mo:py-2 p-4">
      {#if $view.isPortrait}
        {#if activeStepIndex !== steps[importSource]?.length - 1}
          <Button size={Size.sm} onclick={onJumpToUpload}>Jump to upload</Button
          >
        {:else}
          <Button size={Size.sm} onclick={onClose}>Cancel</Button>
        {/if}
      {:else if activeStepIndex !== 0}
        <Button size={Size.sm} onclick={onBack}>Back</Button>
      {/if}
      <div class="ml-auto flex gap-3">
        {#if !$view.isPortrait}
          {#if activeStepIndex !== steps[importSource]?.length - 1}
            <Button size={Size.sm} onclick={onJumpToUpload}
              >Jump to upload</Button
            >
          {:else if activeStepIndex === steps[importSource]?.length - 1}
            <Button size={Size.sm} onclick={onClose}>Cancel</Button>
          {/if}
        {/if}

        {#if activeStepIndex !== steps[importSource]?.length - 1}
          <Button
            size={Size.sm}
            onclick={onNext}
            type={ButtonVariant.PRIMARY}
            style={ButtonStyle.OUTLINED}>Next</Button
          >
        {:else if activeStepIndex === steps[importSource]?.length - 1 && !isEverythingUploaded}
          <Button
            isLoading={isUploading}
            size={Size.sm}
            onclick={onUpload}
            type={ButtonVariant.PRIMARY}>Import</Button
          >
        {:else if activeStepIndex === steps[importSource]?.length - 1 && isEverythingUploaded}
          <Button size={Size.sm} onclick={onClose}>Done</Button>
        {/if}
      </div>
    </div>
  </footer>
</div>
