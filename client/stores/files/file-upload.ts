import { UserDataMode } from "@nucleum/client/runtime/account/account.type";

import { getBucketNameandKey } from "@21n/utils/account.utils";

import { type IRecordId } from "@nucleum/schema/legacy/data.type";

import { logger } from "@nucleum/client/runtime/logging/logger";
import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
import { datafn } from "@nucleum/datafn/datafn.store";
import { generateResourceId } from "@nucleum/datafn/id.utils";
import { Resource } from "@nucleum/datafn/resource.enum";

import { compressImageToTargetSize } from "@21n/utils/ui.utils";
import { convertHeicToPng } from "@21n/utils/ui.utils";
import { generateImagePreviewFromPdf } from "@21n/utils/pdf.utils";

import account from "@nucleum/stores/account.store";
import { persistenceInstance } from "@nucleum/persistence/persistence";
/** Uploads and stores file content independently of account lifecycle. */
export const fileUpload = {
  getSignedUrl(contentType: string, fileName: string, isTemp: boolean) {
    const acc = account.get();
    const userId = acc.userInfo?.id.split(":")[1] ?? "";
    return persistenceInstance.getSignedUrl(
      userId,
      contentType,
      fileName,
      isTemp
    );
  },
  /**
   * @deprecated - use uploadFileV2 instead
   * @param contentType
   * @param fileName
   * @param blob
   * @param isTemp
   * @returns
   */
  async uploadFile(
    contentType: string,
    fileName: string,
    blob: any,
    isTemp: boolean = false
  ) {
    const signedUrlResponse = await this.getSignedUrl(
      contentType,
      fileName,
      isTemp
    );
    if (signedUrlResponse?.uploadURL) {
      await persistenceInstance.uploadFile(
        signedUrlResponse.uploadURL,
        contentType,
        blob
      );
      return signedUrlResponse;
    } else return null;
  },
  async uploadFileV2(
    contentType: string,
    fileName: string,
    blob: Blob,
    params: {
      isTemp?: boolean;
      isReturnUrl?: boolean;
      isExtensionEnv?: boolean;
      isPreventSync?: boolean;
      isMeta?: boolean;
      thumbnailBlob?: Blob;
      isGenerateThumbnail?: boolean;
    } = {}
  ) {
    try {
      const accountData = account.get();
      const id = generateResourceId(Resource.file, {
        id: contentType.split("/")[0] + "_" + generateSimpleRandomId()
      });
      logger.log({ at: "uploadFileV2", id, contentType, fileName });
      fileName = fileName
        .replace(/\s+/g, "_")
        .replace(/[()@#$%&*!?<>{}[\]\\\/\^~`+=;:,'"|]/g, "_");

      const isHeicFile = fileName.toLowerCase().endsWith(".heic");
      if (isHeicFile) {
        try {
          const { convertedBlob } = await convertHeicToPng(blob);
          blob = convertedBlob;
          contentType = "image/png";
          fileName = fileName.replace(/\.heic$/i, ".png");
          logger.log({
            at: "uploadFileV2",
            message: "Converted HEIC to PNG",
            originalFileName: fileName,
            newContentType: contentType
          });
        } catch (error) {
          logger.error({
            at: "uploadFileV2",
            error,
            message: "HEIC conversion failed"
          });
          throw new Error(
            "Failed to convert HEIC file. Please try a different format."
          );
        }
      }

      let thumbnailBlob: Blob | undefined = params.thumbnailBlob;
      if (params.isGenerateThumbnail && !thumbnailBlob) {
        if (contentType.includes("image")) {
          thumbnailBlob = await compressImageToTargetSize(blob);
        } else if (contentType.includes("pdf")) {
          const result = await generateImagePreviewFromPdf(blob);
          if (result) thumbnailBlob = result as Blob;
        }
      }
      if (accountData.dataMode === UserDataMode.LOCAL || params.isPreventSync) {
        return await this.saveLocalFile({
          id,
          fileName,
          contentType,
          blob,
          thumbnailBlob,
          isMeta: params.isMeta,
          isExtensionEnv: params.isExtensionEnv,
          isReturnUrl: params.isReturnUrl
        });
      } else {
        const signedUrlResponse = await this.getSignedUrl(
          contentType,
          fileName,
          params.isTemp ?? false
        );
        if (!signedUrlResponse || !signedUrlResponse.uploadURL) {
          return await this.saveLocalFile({
            id,
            fileName,
            contentType,
            blob,
            thumbnailBlob,
            isMeta: params.isMeta,
            isExtensionEnv: params.isExtensionEnv,
            isReturnUrl: params.isReturnUrl
          });
        }

        await persistenceInstance.uploadFile(
          signedUrlResponse.uploadURL,
          contentType,
          blob
        );
        const key = getBucketNameandKey(signedUrlResponse.uploadURL);
        const signedGetUrl =
          await persistenceInstance.fetchSignedUrlForGet(key);
        const url = signedGetUrl?.getUrl;
        let thumbnailUrl: string | undefined;
        if (thumbnailBlob) {
          const signedThumbnailUrlResponse = await this.getSignedUrl(
            "image/jpeg",
            "thumbnail_" + fileName,
            params.isTemp ?? false
          );
          const thumbnailUploadUrl = signedThumbnailUrlResponse?.uploadURL;
          if (thumbnailUploadUrl) {
            await persistenceInstance.uploadFile(
              thumbnailUploadUrl,
              "image/jpeg",
              thumbnailBlob
            );
            const thumbnailKey = getBucketNameandKey(thumbnailUploadUrl);
            const signedThumbnailGetUrl =
              await persistenceInstance.fetchSignedUrlForGet(thumbnailKey);
            thumbnailUrl = signedThumbnailGetUrl?.getUrl;
          }
        }
        const file = {
          id,
          label: fileName,
          type: contentType,
          url,
          size: blob.size,
          isMeta: params.isMeta,
          thumbnailUrl
        };
        if (params.isReturnUrl) {
          return url;
        } else if (params.isExtensionEnv) {
          return file;
        }
        const mutationResult = (await datafn.file.mutate({
          operation: "insert",
          id,
          record: file
        })) as { ok?: boolean; error?: unknown };
        if (mutationResult.ok === false) {
          throw mutationResult.error ?? new Error("File metadata save failed");
        }
        return [file];
      }
    } catch (e) {
      logger.error({ at: "uploadFileV2", error: e });
      throw e;
    }
  },
  async saveLocalFile(params: {
    id: IRecordId;
    fileName: string;
    contentType: string;
    blob: Blob;
    thumbnailBlob?: Blob;
    isMeta?: boolean;
    isExtensionEnv?: boolean;
    isReturnUrl?: boolean;
  }) {
    if (params.isReturnUrl) {
      return URL.createObjectURL(params.blob);
    }
    const arrayBuffer = await params.blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let thumbnailUint8Array: Uint8Array | undefined;
    if (params.thumbnailBlob) {
      const thumbnailArrayBuffer = await params.thumbnailBlob.arrayBuffer();
      thumbnailUint8Array = new Uint8Array(thumbnailArrayBuffer);
    }
    const file = {
      id: params.id,
      label: params.fileName,
      name: params.fileName,
      type: params.contentType,
      data: uint8Array,
      size: uint8Array.length,
      isMeta: params.isMeta,
      thumbnailData: thumbnailUint8Array
    };
    if (params.isExtensionEnv) {
      return file;
    }
    const mutationResult = (await datafn.file.mutate({
      operation: "insert",
      id: params.id,
      record: file
    })) as { ok?: boolean; error?: unknown };
    if (mutationResult.ok === false) {
      throw mutationResult.error ?? new Error("File metadata save failed");
    }
    return [file];
  },
  /**
   * Used to upload a file to s3 temp bucket
   * @param input the file that needs to be uploaded to the S3 temp bucket
   */
  async tempUploadToS3(input: any) {
    let itemLocalURL = new Blob([input], { type: input.type });
    let customName = input.name.split(".")[0].replace(/\s+/g, "");
    const result = await this.uploadFile(
      input.type,
      customName,
      itemLocalURL,
      true
    );
    let url = result.uploadURL.split("?")[0];
    return [url, customName, itemLocalURL];
  }
};
