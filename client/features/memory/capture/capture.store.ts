import { navigation } from "@21n/layout/navigation/navigation";
import { fileUpload } from "@nucleum/stores/files/file-upload";
import { retrieveUrlData } from "@nucleum/features/memory/capture/url-data";
import { get, writable } from "svelte/store";
import { Resource } from "@nucleum/datafn/resource.enum";
import { LinkType } from "@nucleum/datafn/link.type";
import {
  type INodeCapture,
  type IMediaNode,
  type INodeThumb,
  type IMediaGridItem,
  type IWebPage,
  type IAudioMetadata,
  type IImageMetadata,
  type IImageNode,
  headingNodeTypes,
  NodeMetaType,
  type INodeStructure,
  type INode,
  type IClip
} from "@nucleum/features/memory/node/node.type";
import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
import {
  CaptureMethod,
  type IActiveCapture,
  type ICapture,
  type ICaptureLink,
  type IPasteCaptureData
} from "@nucleum/features/memory/capture/capture.type";
import account from "@nucleum/stores/account.store";
import { toasts, inlineToasts } from "@nucleum/stores/notification.store";
import { generateResourceId } from "@nucleum/datafn/id.utils";
import {
  generateMarkdownText,
  resolveHeadingParent
} from "@nucleum/features/memory/node/node.utils";
import { hierarchyFactorLimit } from "@nucleum/features/memory/node/node.store";
import { logger } from "@nucleum/client/runtime/logging/logger";
import { resolveContentTypeForFile } from "@nucleum/features/memory/capture/capture.utils";
import { AccessMode } from "@nucleum/datafn/resource.type";
import { ResourceActionType } from "@nucleum/schema/legacy/resource-action.enum";
import type { IRecordId } from "@nucleum/schema/legacy/data.type";
import {
  CollectionType,
  type ICollection,
  type ICollectionItemPropertyValue,
  type ICollectionThumb
} from "@nucleum/features/collections/collection.type";
import {
  determineResourceType,
  isSameResource,
  resourceAction,
  resourceInList
} from "@nucleum/datafn/resource.utils";
import { resolveResource } from "@nucleum/datafn/resource-query.utils";
import type { IFile } from "@nucleum/stores/files/file.type";
import {
  generateMiniRandomId,
  generateSimpleRandomId
} from "@21n/shared-utils/crypto.utils";
import { appStore } from "@nucleum/stores/app.store";
import { uiState } from "@nucleum/stores/uiState/uiState.store";
import { UIState, UIStateScope } from "@nucleum/stores/uiState/uiState.type";
import { UserDataMode } from "@nucleum/client/runtime/account/account.type";
import { MemotronAction } from "@nucleum/features/memory/memory-action.enum";
import view from "@nucleum/stores/view.store";
import context from "@nucleum/stores/context.store";
import { OperatingSystem } from "@nucleum/client/runtime/context.type";
import { isValidArrayWithData } from "@21n/shared-utils/obj.utils";
import {
  fetchYouTubeMetadata,
  resolveUrlData,
  resolveWebpageLabel
} from "@nucleum/features/memory/node/url.utils";
import { getImageColorsFromFile } from "@21n/utils/ui.utils";
import { parseBuffer } from "music-metadata";
import ExifReader from "exifreader";
import { getDeviceInfo, getGeoLocation } from "@21n/utils/browser.utils";
import {
  extractRootStructure,
  extractStructureForChildren,
  isEmptyMd,
  resolveDefaultBodyForBlock,
  textToMdBlocks
} from "@nucleum/features/memory/markdown/markdown.utils";
import type { IBlock } from "@nucleum/features/memory/markdown/md.type";
import { ActiveResourceStore } from "@nucleum/stores/resources/active-resource.store";
import { embedBridge } from "@nucleum/client/runtime/embed/embed.store";
import { EmbedMessage } from "@nucleum/client/runtime/embed/embedMessage.enum";
import { convertWebMToWav } from "@nucleum/client/runtime/audio/audio.utils";
import { TimeScaleUnit } from "@21n/utils/time.type";
import { resolveCalendarNotesId } from "@nucleum/features/calendar/calendar.utils";
import { getUtcSafeDay } from "@21n/elements/datetime/datetime.utils";
import type { IMarkdownTemplate } from "@nucleum/features/memory/markdown/md.type";
import { isValidString } from "@21n/shared-utils/text.utils";
import { isRecordId } from "@nucleum/datafn/resource.utils";
import { debouncer } from "@21n/utils/utils";
import { openPasteConfirmationModalFromClipboard } from "@nucleum/features/memory/capture/paste.utils";
import { datafn } from "@nucleum/datafn/datafn.store";

export const currentUserId: string = get(account)?.userInfo?.id ?? "";
const captureAction = resourceAction(Resource.node, ResourceActionType.CREATE);
type CaptureRelationMutation = {
  operation: "relate";
  id: IRecordId;
  relations: Record<string, unknown>;
  context?: string;
};

function isRecordLinkResource(resource: Resource) {
  return (
    resource === Resource.node ||
    resource === Resource.objective ||
    resource === Resource.task ||
    resource === Resource.event
  );
}

function isCollectionItemResource(resource: Resource) {
  return resource === Resource.node || resource === Resource.objective;
}

async function persistContentLinks(links: any[] = []) {
  return Promise.all(
    links.map((link) => {
      const fromResource = determineResourceType(link.in);
      const toResource = determineResourceType(link.out);
      if (
        toResource === Resource.collection &&
        isCollectionItemResource(fromResource)
      ) {
        return datafn.table(fromResource).mutate({
          operation: "relate",
          id: link.in.toString(),
          relations: {
            collections: [
              {
                $ref: link.out.toString(),
                fromResource: fromResource.toString(),
                location: link.location
              }
            ]
          }
        } as any);
      }
      if (
        fromResource === Resource.collection &&
        isCollectionItemResource(toResource)
      ) {
        return datafn.collection.mutate({
          operation: "relate",
          id: link.in.toString(),
          relations: {
            items: [
              {
                $ref: link.out.toString(),
                fromResource: toResource.toString(),
                location: link.location
              }
            ]
          }
        } as any);
      }
      if (
        !isRecordLinkResource(fromResource) ||
        !isRecordLinkResource(toResource)
      ) {
        logger.warn({
          at: "CaptureStore.persistContentLinks.unsupportedRelation",
          from: link.in,
          out: link.out,
          fromResource,
          toResource
        });
        return undefined;
      }
      return datafn.table(fromResource).mutate({
        operation: "relate",
        id: link.in.toString(),
        relations: {
          links: [
            {
              $ref: link.out.toString(),
              fromResource: fromResource.toString(),
              toResource: toResource.toString(),
              linkType: link.linkType ?? LinkType.DIRECT,
              location: link.location,
              tags: link.tags
            }
          ]
        }
      } as any);
    })
  );
}

async function insertCapturedNodes(
  input: INodeCapture<any> | INodeCapture<any>[],
  params?: { context?: string }
) {
  function resolveMarkdownParentFields(mdParent: unknown) {
    if (!Array.isArray(mdParent)) return {};
    const parents = mdParent.filter(
      (parent): parent is IRecordId => typeof parent === "string"
    );
    const parent = parents[parents.length - 1];
    if (!parent) return {};
    return {
      parent,
      parentPath: parents.join("-")
    };
  }
  const nodes = (Array.isArray(input) ? input : [input]).map((node) => ({
    metaType: "",
    contentType: NodeType.UNKNOWN,
    ...node,
    id: node.id ?? generateResourceId(Resource.node)
  }));
  await datafn.node.mutate(
    nodes.map((node) => {
      const { collections, propertyValues, ...record } =
        node as INodeCapture<any> & {
          collections?: IRecordId[];
          propertyValues?: ICollectionItemPropertyValue[];
        };
      return {
        operation: "insert",
        id: record.id,
        record: {
          ...record,
          ...resolveMarkdownParentFields(record.mdParent)
        },
        context: params?.context
      };
    })
  );
  const relationMutations = nodes
    .map((node): CaptureRelationMutation | undefined => {
      const relations: Record<string, unknown> = {};
      const collections =
        (node as { collections?: IRecordId[] }).collections ?? [];
      const propertyValues =
        (node as { propertyValues?: ICollectionItemPropertyValue[] })
          .propertyValues ?? [];
      if (collections.length > 0) {
        relations.collections = collections.map((id) => ({
          $ref: id.toString(),
          fromResource: Resource.node
        }));
      }
      if (propertyValues.length > 0) {
        relations.propertyValues = propertyValues.map((property) => ({
          $ref: property.id.toString(),
          fromResource: Resource.node,
          collectionId: property.collectionId,
          value: property.value
        }));
      }
      if (Object.keys(relations).length === 0) return undefined;
      return {
        operation: "relate",
        id: node.id,
        relations,
        context: params?.context
      };
    })
    .filter((mutation): mutation is CaptureRelationMutation =>
      Boolean(mutation)
    );
  if (relationMutations.length > 0) {
    await datafn.node.mutate(relationMutations as any);
  }
  return nodes.map((node) => ({
    ...node,
    updatedAt: "updatedAt" in node ? node.updatedAt : new Date()
  }));
}

export const clipboard = writable<IPasteCaptureData | null>(null);

type IClipboardBlockType =
  | NodeType.CODE
  | NodeType.CALLOUT
  | NodeType.LIST
  | NodeType.ORDERED_LIST
  | NodeType.CHECKLIST
  | NodeType.SIMPLE_TEXT;

function resolveClipboardBlockType(
  contentType?: NodeType
): IClipboardBlockType {
  switch (contentType) {
    case NodeType.CODE:
    case NodeType.CALLOUT:
    case NodeType.LIST:
    case NodeType.ORDERED_LIST:
    case NodeType.CHECKLIST:
      return contentType;
    default:
      return NodeType.SIMPLE_TEXT;
  }
}

function resolveBlobPart(data: Uint8Array<ArrayBufferLike>) {
  return Uint8Array.from(data).buffer;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function hasStringProperty<K extends string>(
  value: unknown,
  key: K
): value is Record<K, string> {
  return isObject(value) && typeof value[key] === "string";
}

function isMediaGridBlock(block: IBlock): block is IBlock & {
  contentType: NodeType.MEDIA_GRID;
  body: { items: IMediaGridItem[] };
} {
  return (
    block.contentType === NodeType.MEDIA_GRID &&
    isObject(block.body) &&
    "items" in block.body &&
    Array.isArray(block.body.items)
  );
}

function generateSeedStore(): IActiveCapture {
  const blockId = generateResourceId(Resource.node);
  const nodeId = generateResourceId(Resource.node);
  return {
    id: generateResourceId(Resource.capture),
    accessMode: AccessMode.MAIN,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: currentUserId,
    updatedBy: currentUserId,
    method: CaptureMethod.MARKDOWN,
    nodeId,
    refreshId: new Date().getTime(),
    label: "",
    propertyValues: [],
    links: [],
    avatar: null,
    childrenWithStructure: [],
    rootStructure: [],
    body: {
      blocks: [
        {
          contentType: NodeType.SIMPLE_TEXT,
          body: "",
          id: blockId
        }
      ]
    }
  };
}

export type IActiveCaptureStore = InstanceType<typeof ActiveCaptureStore>;

export class ActiveCaptureStore extends ActiveResourceStore<
  ICapture,
  IActiveCapture
> {
  constructor(capture: IRecordId) {
    super(capture);
    this.set({ ...generateSeedStore(), id: capture });
  }

  async modify(
    val: Partial<ICapture>,
    params?: { isPreventBackPropagation?: boolean }
  ) {
    const shouldUpdateActive = !params?.isPreventBackPropagation;
    const previous = shouldUpdateActive ? this.get() : undefined;
    if (shouldUpdateActive) {
      this.update((prev) => ({ ...prev, ...val }));
    }
    try {
      await datafn.capture.mutate({
        operation: "merge",
        id: this.id.toString(),
        record: {
          id: this.id,
          ...val
        }
      });
    } catch (error) {
      if (previous) this.set(previous);
      throw error;
    }
  }

  async delete() {
    return this.deletePermanently();
  }

  async deletePermanently() {
    await datafn.capture.mutate({
      operation: "delete",
      id: this.id.toString()
    });
  }

  async init(params?: {
    isWindowDnD?: boolean;
    method?: CaptureMethod;
    linkQueryParam?: string | null;
    bulkQueryParam?: string | null;
    clipBoardQueryParam?: string | null;
  }) {
    this.update((store) => {
      return {
        ...store,
        ...params
      };
    });
    if (params?.linkQueryParam) {
      await this.setTypeFromLinkParam(params.linkQueryParam);
    } else {
      this.refreshEmptyState();
    }
    if (params?.clipBoardQueryParam === "true") {
      await this.onClipboard();
    }
  }

  /**
   * Handles clipboard event - insert into markdown option via global paste or file uploader
   */
  async onClipboard() {
    try {
      const data = get(clipboard);
      logger.debug({
        at: "Capture.svelte - onClipboard",
        data
      });
      const val = this.get();
      const ogEmptyState = val.isEmpty;
      this.update((store) => ({
        ...store,
        isEmpty: false,
        isProcessingClipboard: true
      }));
      if (!data) return;
      let newBlock: IBlock[] | undefined = undefined;
      if (data.multipleFiles) {
        const result = await this.saveMultipleFiles(data.multipleFiles.files, {
          isEmbedContext: true
        });
        if (!result || "error" in result) return;
        result.forEach((x) => {
          const block: IBlock = {
            id: generateResourceId(Resource.node),
            contentType: NodeType.EMBED,
            body: {
              id: x.id,
              subType: x.contentType
            }
          };
          newBlock = [...(newBlock ?? []), block];
          this.addMentionLink("root", x as INodeThumb, {
            location: block.id
          });
        });
      } else if (data.file) {
        const result = await this.saveFile(data.file, data.contentType, {
          isEmbedContext: true
        });
        if (!result || "error" in result) return;
        newBlock = [
          {
            id: generateResourceId(Resource.node),
            contentType: NodeType.EMBED,
            body: {
              id: result.id,
              subType: result.contentType
            }
          }
        ];
        this.addMentionLink("root", result as INodeThumb, {
          location: newBlock[0].id
        });
      } else if (data.text) {
        if (data.textMetadata?.isMultiBlockText) {
          newBlock = textToMdBlocks(data.text);
        } else if (data.textMetadata?.isUrl) {
          const saveResult = await this.saveWebpage(data.text, {
            contentType: data.contentType,
            isEmbedContext: true
          });
          if (
            !saveResult ||
            !Array.isArray(saveResult) ||
            "error" in saveResult
          )
            return;
          newBlock = [
            {
              id: generateResourceId(Resource.node),
              contentType: NodeType.EMBED,
              body: {
                id: saveResult[0].id,
                subType: saveResult[0].contentType
              }
            }
          ];
          this.addMentionLink("root", saveResult[0] as INodeThumb, {
            location: newBlock[0].id
          });
        } else {
          const contentType = resolveClipboardBlockType(data.contentType);
          newBlock = [
            {
              id: generateResourceId(Resource.node),
              contentType,
              body: resolveDefaultBodyForBlock(contentType, data.text)
            } as IBlock
          ];
        }
      }

      if (!newBlock) return;
      if (val.body) {
        if (ogEmptyState) {
          val.body.blocks.unshift(...newBlock);
        } else {
          val.body.blocks.push(...newBlock);
        }
      }
      this.update((store) => ({
        ...store,
        body: val.body,
        refreshId: new Date().getTime()
      }));
      this.persistContent();
    } catch (e) {
      logger.error({ at: "Capture.svelte - onClipboard", error: e });
    } finally {
      this.update((store) => ({
        ...store,
        isEmpty: false,
        isProcessingClipboard: false
      }));
      clipboard.set(null);
    }
  }

  load(draft: ICapture) {
    this.update((store) => {
      return {
        ...store,
        ...draft,
        isEmpty: false,
        refreshId: new Date().getTime()
      };
    });
  }

  reset() {
    logger.log({ at: "CaptureStore.reset" });
    const seedStore = generateSeedStore();
    this.update(() => {
      return {
        ...seedStore,
        isEmpty: true,
        method: CaptureMethod.MARKDOWN,
        refreshId: new Date().getTime()
      };
    });
  }

  async onTypeSelect(val: CaptureMethod | IRecordId) {
    logger.debug({ context: "onTypeSelect", val });
    if (!val) return;
    if (val === CaptureMethod.PASTE) {
      await openPasteConfirmationModalFromClipboard();
      navigation.closeResource({ accessMode: AccessMode.MAIN });
      return;
    }
    const isCollection = isRecordId(val, Resource.collection);
    if (!isCollection) {
      this.update((store) => {
        return {
          ...store,
          method: val as CaptureMethod,
          isEmpty: false
        };
      });
      return;
    }
    const typeResult = await datafn.collection.query({
      filters: { id: val },
      limit: 1,
      metadata: {
        includeTrashed: true,
        includeArchived: true
      }
    });
    const type = typeResult.data[0] as ICollection | undefined;
    if (!type) return;
    const link: ICaptureLink = {
      from: "root",
      to: type.id,
      linkType: LinkType.DIRECT,
      toType: Resource.collection,
      toSubType: CollectionType.TYPED
    };

    this.update((store) => {
      return {
        ...store,
        isLinksExpanded: true,
        isEmpty: false,
        expandedType: val
      };
    });
    const store = this.get();
    this.modify({
      links: [...(store.links ?? []), link]
    });
  }

  refreshEmptyState(e?: CustomEvent) {
    logger.log({
      at: "Capture.svelte - refreshEmptyState",
      e
    });
    const val = this.get();
    const isNonEmptyMd =
      val.body &&
      "blocks" in val.body &&
      !isEmptyMd(e?.detail?.md?.blocks ?? val.body.blocks);
    const isNonEmptyLabel = isValidString(val.label);
    const hasLinks = val.links && val.links.length > 0;
    if (
      val.isWindowDnD ||
      isNonEmptyLabel ||
      isNonEmptyMd ||
      val.method === CaptureMethod.AUDIO ||
      hasLinks
    ) {
      this.update((store) => {
        return {
          ...store,
          isEmpty: false
        };
      });
    } else {
      this.update((store) => {
        return {
          ...store,
          isEmpty: true
        };
      });
    }
  }

  private setIsSaving(val: boolean) {
    this.update((store) => {
      return {
        ...store,
        isSaving: val
      };
    });
  }

  private async setTypeFromLinkParam(linkQueryParam: string) {
    await this.directLink(linkQueryParam);
    this.update((store) => {
      return {
        ...store,
        isLinksExpanded: true,
        isCaptureFromCollectionPage: true
      };
    });
  }

  /**
   * Notes: isAvoidSaveLeaks is used to prevent save after delete action of capture. This is happening when using shortcut to save which is in turn triggering keyboard events -> onContentChange -> persist or persistLabel.
   */
  persistContent() {
    const val = this.get();
    if (val.isSaving || val.isAvoidSaveLeaks) return;
    this.modify(
      {
        body: val.body,
        childrenWithStructure: val.childrenWithStructure,
        rootStructure: val.rootStructure
      },
      { isPreventBackPropagation: true }
    );
  }

  private debouncedPersistContent = debouncer(this.persistContent, 1000);

  /**
   * Note: Timeout is added to refreshEmptyState as the the captureStore.body is not populated immediately in case of pasting something into capture.
   * @param e
   */
  onMdContentChanges(e: CustomEvent) {
    const val = this.get();
    if (val.isSaving) return;
    logger.log({
      at: "CaptureStore.onMdContentChanges",
      captureId: val.id,
      blockCount:
        val.body && "blocks" in val.body ? val.body.blocks.length : undefined,
      rootStructureLength: val.rootStructure.length,
      childrenWithStructureLength: val.childrenWithStructure.length,
      detailRootLength: Array.isArray(e.detail?.root)
        ? e.detail.root.length
        : 0,
      detailChildrenWithStructureLength: Array.isArray(
        e.detail?.childrenWithStructure
      )
        ? e.detail.childrenWithStructure.length
        : 0
    });
    this.debouncedPersistContent();
    setTimeout(() => {
      this.refreshEmptyState();
    }, 100);
  }

  async save() {
    this.setIsSaving(true);
    await this.saveMarkdownCapture();
    const val = this.get();
    if (val.bulkQueryParam === "true" && val.linkQueryParam) {
      await this.setTypeFromLinkParam(val.linkQueryParam);
    } else {
      this.update((store) => {
        return {
          ...store,
          isEmpty: true
        };
      });
    }
    this.setIsSaving(false);
  }

  async handleCapture(event: Event) {
    logger.log({ at: "Capture.svelte - handleCapture", event });
    try {
      this.setIsSaving(true);
      const input = event.target as HTMLInputElement;
      if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file) {
          await this.saveFile(file);
          this.setIsSaving(false);
          return;
        }
      } else {
        logger.log({
          at: "Capture.svelte - handleCapture - no file present"
        });
      }
    } catch (e) {
      logger.error({ at: "Capture.svelte - handleCapture", error: e });
      this.setIsSaving(false);
    }
  }

  addMentionLink(
    from: IRecordId,
    to: INodeThumb | ICollectionThumb,
    params?: {
      location?: IRecordId;
      linkTags?: IRecordId[];
    }
  ) {
    return this._addLink(from, to, LinkType.MENTION, params);
  }

  removeMentionLink(from: IRecordId, to: IRecordId) {
    const store = this.get();
    if (!store.links) return;
    if (
      !store.links.some(
        (link) => isSameResource(link.from, from) && isSameResource(link.to, to)
      )
    )
      return;
    const modifiedLinks = store.links.filter(
      (link) =>
        !(isSameResource(link.from, from) && isSameResource(link.to, to))
    );
    this.modify({
      links: modifiedLinks
    });
  }

  async directLink(item: IRecordId | INodeThumb | ICollectionThumb) {
    if (typeof item === "string" || "tb" in item) {
      const resource = await resolveResource(item as IRecordId);
      if (!resource) return;
      return this._addLink(
        "root",
        resource as INodeThumb | ICollectionThumb,
        LinkType.DIRECT
      );
    } else if (typeof item !== "string") {
      return this._addLink("root", item, LinkType.DIRECT);
    }
  }

  private _addLink(
    from: IRecordId | "root",
    to: INodeThumb | ICollectionThumb,
    linkType: LinkType,
    params?: {
      location?: IRecordId;
      linkTags?: IRecordId[];
    }
  ) {
    const store = this.get();
    if (store.links?.some((link) => isSameResource(link.to, to.id))) return;
    const toType = determineResourceType(to.id);
    const link = {
      from,
      to: to.id,
      linkType,
      toType: toType as typeof Resource.node | typeof Resource.collection,
      toSubType: ("contentType" in to ? to.contentType : to.type) as
        NodeType | CollectionType,
      location: params?.location,
      tags: params?.linkTags
    };
    const links = [...(store.links ?? []), link];
    this.update((current) => ({
      ...current,
      isLinksExpanded: true,
      isEmpty: false,
      links
    }));
    return this.modify(
      {
        links
      },
      {
        isPreventBackPropagation: true
      }
    );
  }

  removeDLink(id: IRecordId) {
    const store = this.get();
    if (!store.links) return;
    if (!store.links.some((link) => isSameResource(link.to, id))) return;
    const modifiedLinks = store.links.filter(
      (link) => !isSameResource(link.to, id)
    );
    this.update((current) => ({
      ...current,
      links: modifiedLinks
    }));
    this.modify(
      {
        links: modifiedLinks
      },
      {
        isPreventBackPropagation: true
      }
    );
  }

  private async parseMetadata(file: File) {
    try {
      if (file.type.startsWith("image/")) {
        let metadata: IImageMetadata = {};
        const colors = await getImageColorsFromFile(file, 10);
        const tags = await ExifReader.load(file);
        const importantMetadata = extractImportantMetadata(tags);
        metadata = {
          colors,
          ...importantMetadata
        };
        return metadata;
      }
      if (file.type.startsWith("audio/")) {
        let metadata: IAudioMetadata = {};

        let parsedMetadata = await parseBuffer(
          new Uint8Array(await file.arrayBuffer())
        );
        if (parsedMetadata?.common) {
          let imageId: IRecordId | undefined = undefined;
          if (parsedMetadata.common.picture?.[0]?.data) {
            try {
              const imageData = parsedMetadata.common.picture[0].data;
              const imageFile = new File(
                [resolveBlobPart(imageData)],
                file.name,
                {
                  type: "image/jpeg"
                }
              );
              const imageUploadResponse = await fileUpload.uploadFileV2(
                "image/jpeg",
                file.name,
                imageFile,
                {
                  isGenerateThumbnail: true
                }
              );
              if (imageUploadResponse) {
                imageId = imageUploadResponse[0].id;
              }
            } catch (e) {
              logger.error({
                at: "CaptureStore.parseMetadata.picture",
                error: e
              });
            }
          }
          metadata = {
            ...parsedMetadata.common,
            ...parsedMetadata.format,
            picture: imageId
          };
        }
        return metadata;
      }
    } catch (e: any) {
      logger.error({ at: "CaptureStore.parseMetadata", error: e });
      return;
    }

    function extractImportantMetadata(tags: any): IImageMetadata {
      return {
        deviceInfo: {
          make: tags.Make?.description,
          model: tags.Model?.description,
          software: tags.Software?.description
        },
        imageDetails: {
          width: tags["Image Width"]?.value || tags.PixelXDimension?.value || 0,
          height:
            tags["Image Height"]?.value || tags.PixelYDimension?.value || 0,
          orientation: tags.Orientation?.description,
          dateTime: tags.DateTime?.description
        },
        cameraSettings: {
          aperture: tags.FNumber?.description,
          exposureTime: tags.ExposureTime?.description,
          iso: tags.ISOSpeedRatings?.value,
          focalLength: tags.FocalLength?.description,
          flash: tags.Flash?.description
        },
        location: tags.GPSLatitude
          ? {
              latitude: tags.GPSLatitude.description,
              longitude: tags.GPSLongitude?.description,
              altitude: tags.GPSAltitude?.description
            }
          : undefined
      };
    }
  }

  async saveFile(
    file: File,
    contentType?: NodeType,
    params?: {
      isOpenOnSave?: boolean;
      isEmbedContext?: boolean;
      creationContext?: IRecordId;
    }
  ) {
    contentType = contentType ?? resolveContentTypeForFile(file);
    if (!contentType) return { error: "File type not supported" };
    if (!params?.isEmbedContext) this.setIsSaving(true);
    try {
      if (
        contentType === NodeType.NODULAR_MARKDOWN &&
        !params?.isEmbedContext
      ) {
        const result = await this.saveMarkdownFromMdFile(file);
        this.postSave(result?.slice(0, 1), {
          isOpenOnSave: params?.isOpenOnSave,
          isEmbedContext: params?.isEmbedContext
        });
        return result?.[0];
      }
      const response = await fileUpload.uploadFileV2(
        file.type,
        file.name,
        new Blob([file], { type: file.type }),
        {
          isGenerateThumbnail: true
        }
      );

      if (!response || !response[0].id) {
        return;
      }
      const id = generateResourceId(Resource.node);
      const collections = params?.isEmbedContext
        ? []
        : this.resolveCollections();
      const fileId = response[0].id;
      const metadata = (await this.parseMetadata(file)) ?? {};
      if (!metadata?.location) {
        metadata.location = await this.resolveLocation();
      }
      const captureStore = this.get();
      const node = {
        id,
        contentType,
        file: fileId,
        label:
          (isValidString(captureStore.label) ? captureStore.label : null) ??
          file.name,
        body: {},
        metadata: {
          ...metadata
        },
        propertyValues: params?.isEmbedContext
          ? []
          : captureStore.propertyValues,
        collections,
        creationContext: params?.isEmbedContext
          ? (params?.creationContext ?? this.get().nodeId)
          : undefined
      } as INodeCapture<IMediaNode>;
      const result = await insertCapturedNodes([node], {
        context: captureAction
      });
      if (!params?.isEmbedContext) {
        await this.saveLinks(id);
      }
      this.postSave(result, {
        isOpenOnSave: params?.isOpenOnSave,
        isEmbedContext: params?.isEmbedContext
      });
      return Array.isArray(result) ? result?.[0] : result;
    } finally {
      if (!params?.isEmbedContext) this.setIsSaving(false);
    }
  }

  async saveMarkdownFromMdFile(file: File) {
    try {
      const text = await file.text();
      return this.saveMarkdownFromText(text, file.name);
    } catch (e: any) {
      logger.error({
        at: "CaptureStore - saveMarkdownFromMdFile",
        message: e.message,
        file: file.name
      });
      return;
    }
  }

  async saveMarkdownFromText(text: string, title?: string) {
    const blocks: IBlock[] = textToMdBlocks(text);
    const structure = extractStructureForChildren(blocks);
    const rootStructure = extractRootStructure(structure, hierarchyFactorLimit);
    const id = generateResourceId(Resource.node);
    const collections = this.resolveCollections();
    const rootBlocks = blocks.filter((b) =>
      rootStructure.some(resourceInList(b))
    );
    const mdText = generateMarkdownText(rootBlocks);
    let root: INodeCapture<INode> = {
      id,
      label: title ?? text.split("\n")[0].trim().slice(0, 100),
      propertyValues: [],
      body: "",
      text: mdText,
      mdChildOrder: rootStructure.map((x: any) => x.id),
      contentType: NodeType.NODULAR_MARKDOWN,
      collections
    };
    let remainingResources: INodeCapture<INode>[] = [];
    for (const block of structure) {
      const correspondingContent = blocks.find(resourceInList(block));
      let parent = undefined;
      if (
        correspondingContent?.contentType &&
        headingNodeTypes.includes(correspondingContent.contentType)
      ) {
        parent = resolveHeadingParent(block.id, structure, [id]);
      }
      let mdText = "";
      if (block.children && block.children.length > 0) {
        const childrenNodes = blocks.filter((b) =>
          block.children?.some(resourceInList(b))
        );
        mdText = generateMarkdownText(childrenNodes);
      }
      remainingResources.push({
        id: block.id,
        contentType: correspondingContent?.contentType ?? NodeType.SIMPLE_TEXT,
        body: correspondingContent?.body,
        label: correspondingContent?.label ?? "",
        text: mdText,
        creationContext: id,
        mdChildOrder: block.children,
        mdParent: parent
      } as INodeCapture<INode>);
    }
    const result: any = await insertCapturedNodes(
      [root, ...remainingResources],
      {
        context: captureAction
      }
    );
    return result;
  }

  async saveMarkdownFromMdFiles(files: File[]) {
    const results = await Promise.all(
      files.map((file) => this.saveMarkdownFromMdFile(file))
    );
    return results.map((x) => x?.[0]);
  }

  async saveMultipleFiles(
    files: { file: File; contentType: NodeType }[],
    params?: {
      isEmbedContext?: boolean;
      creationContext?: IRecordId;
      uploadProgressId?: string;
    }
  ) {
    if (!params?.isEmbedContext) this.setIsSaving(true);
    try {
      if (
        files.every((x) => x.contentType === NodeType.NODULAR_MARKDOWN) &&
        !params?.isEmbedContext
      ) {
        const result = await this.saveMarkdownFromMdFiles(
          files.map((x) => x.file)
        );
        this.postSave(result, {
          isEmbedContext: params?.isEmbedContext
        });
        return result;
      }
      let nodes: INodeCapture<IMediaNode>[] = [];
      let mdNodesResult: any[] = [];
      const captureStore = this.get();
      const collections = params?.isEmbedContext
        ? []
        : this.resolveCollections();
      for (const [index, item] of files.entries()) {
        if (params?.uploadProgressId) {
          const progressElement = document.getElementById(
            params.uploadProgressId
          );
          if (progressElement) {
            progressElement.dataset.progress = `${(index + 1) / files.length}`;
            progressElement.innerHTML = `${index + 1} / ${files.length}`;
          }
        }
        if (!item.contentType) continue;
        if (
          item.contentType === NodeType.NODULAR_MARKDOWN &&
          !params?.isEmbedContext
        ) {
          const result = await this.saveMarkdownFromMdFile(item.file);
          mdNodesResult.push(result?.[0]);
          continue;
        }
        const response = await fileUpload.uploadFileV2(
          item.file.type,
          item.file.name,
          new Blob([item.file], { type: item.file.type }),
          {
            isGenerateThumbnail: true
          }
        );
        if (!response) continue;
        if (!response[0].id) continue;
        const fileId = response[0].id;
        const id = generateResourceId(Resource.node);
        const metadata = await this.parseMetadata(item.file);
        const node = {
          id,
          contentType: item.contentType,
          file: fileId,
          body: {},
          label: item.file.name,
          metadata,
          collections,
          propertyValues: params?.isEmbedContext
            ? []
            : captureStore.propertyValues,
          creationContext: params?.isEmbedContext
            ? (params?.creationContext ?? this.get().nodeId)
            : undefined
        } as INodeCapture<IMediaNode>;
        nodes.push(node);
      }
      const mediaNodesResult = await insertCapturedNodes(nodes, {
        context: captureAction
      });
      const result = [...(mediaNodesResult ?? []), ...(mdNodesResult ?? [])];
      if (!params?.isEmbedContext) {
        await this.saveLinksForMultiFileCapture(nodes);
      }
      this.postSave(result, {
        isEmbedContext: params?.isEmbedContext
      });
      return result;
    } finally {
      if (!params?.isEmbedContext) this.setIsSaving(false);
    }
  }
  // TODO - check for persistance need here
  updateProperty = async (property: ICollectionItemPropertyValue) => {
    let propertyValues = this.get().propertyValues ?? [];
    propertyValues = propertyValues.filter((x) => !isSameResource(x, property));
    this.update((prev) => ({
      ...prev,
      propertyValues: [...propertyValues, property]
    }));
  };

  async saveAudioRecording(
    data: Blob,
    duration: number,
    params?: {
      isOpenOnSave?: boolean;
      isEmbedContext?: boolean;
      creationContext?: IRecordId;
      thumbnailBlob?: Blob;
    }
  ) {
    if (!params?.isEmbedContext) this.setIsSaving(true);
    try {
      const contentType = "audio/wav";
      const wavData = await convertWebMToWav(data);
      const id = generateResourceId(Resource.node);
      const collections = params?.isEmbedContext
        ? []
        : this.resolveCollections();
      const fileName = generateSimpleRandomId();
      const result = await fileUpload.uploadFileV2(
        contentType,
        `${fileName}.wav`,
        wavData,
        {
          thumbnailBlob: params?.thumbnailBlob
        }
      );
      if (!result) return;
      const fileId = result[0].id;
      const location = await this.resolveLocation();
      const metadata = await this.parseMetadata(
        new File([wavData], `${fileName}.wav`, { type: contentType })
      );
      const captureStore = this.get();
      const node: INodeCapture<IMediaNode> = {
        id,
        contentType: NodeType.AUDIO,
        file: fileId,
        metadata: {
          location,
          ...metadata
        },
        collections,
        propertyValues: params?.isEmbedContext
          ? []
          : captureStore.propertyValues,
        creationContext: params?.isEmbedContext
          ? (params?.creationContext ?? this.get().nodeId)
          : undefined,
        label:
          (isValidString(captureStore.label) ? captureStore.label : null) ??
          `Audio Recording - ${new Date().toLocaleString()}`,
        body: {
          duration
        }
      };
      const result2 = await insertCapturedNodes(node, {
        context: captureAction
      });
      if (!params?.isEmbedContext) {
        await this.saveLinks(id);
      }
      this.postSave(result2, {
        isOpenOnSave: params?.isOpenOnSave,
        isEmbedContext: params?.isEmbedContext
      });
      return result2?.[0];
    } finally {
      if (!params?.isEmbedContext) this.setIsSaving(false);
    }
  }

  /**
   *
   * Note: not opening upon save for macOS case because it is causing camera in use indicator to continue to be turned on when the camera is not in use anymore.
   * @param data
   * @param params
   * @returns
   */
  async saveCameraCapture(
    data: Blob,
    params?: {
      deviceInfo?: MediaDeviceInfo | null;
      isMediaDeviceCapture?: boolean;
    }
  ) {
    logger.debug({
      at: "CaptureStore.saveCameraCapture",
      length: data.size,
      params
    });
    const contentType = "image/jpeg";
    const id = generateResourceId(Resource.node);
    const fileName = generateSimpleRandomId();
    const result = await fileUpload.uploadFileV2(
      contentType,
      `${fileName}.jpeg`,
      data,
      {
        isGenerateThumbnail: true
      }
    );
    if (!result) return;
    const fileId = result[0].id;
    // const colors = await getImageColorsFromFile(
    //   new File([data], fileName, { type: contentType }),
    //   10
    // );
    const metadata: IImageMetadata | undefined = await this.parseMetadata(
      new File([data], fileName, { type: contentType })
    );
    const deviceInfo = await getDeviceInfo();
    const location = await this.resolveLocation();
    const captureStore = this.get();
    const collections = this.resolveCollections();
    const node: INodeCapture<IImageNode> = {
      id,
      contentType: NodeType.IMAGE,
      file: fileId,
      label:
        (isValidString(captureStore.label) ? captureStore.label : null) ??
        `Image Capture - ${new Date().toLocaleString()}`,
      body: {},
      propertyValues: captureStore.propertyValues,
      collections,
      metadata: {
        ...metadata,
        location,
        deviceInfo: {
          deviceLabel: params?.deviceInfo?.label,
          deviceId: params?.deviceInfo?.deviceId,
          model: metadata?.deviceInfo?.model ?? deviceInfo?.model,
          make: metadata?.deviceInfo?.make ?? deviceInfo?.make,
          platform: deviceInfo?.platform
        },
        imageDetails: {
          ...metadata?.imageDetails,
          dateTime: metadata?.imageDetails?.dateTime ?? new Date().toISOString()
        }
      }
    };
    const result2 = await insertCapturedNodes(node, {
      context: captureAction
    });
    await this.saveLinks(id);
    const ctx = get(context);
    if (
      params?.isMediaDeviceCapture &&
      ctx.isEmbed === true &&
      ctx.os === OperatingSystem.MACOS
    ) {
      return result2;
    }
    this.postSave(result2, {});
  }

  async saveWebpage(
    text: string,
    params?: {
      contentType?: NodeType;
      isOpenOnSave?: boolean;
      isEmbedContext?: boolean;
      creationContext?: IRecordId;
    }
  ) {
    const urlData = resolveUrlData(text);
    if (urlData?.convertToEmbedUrl) {
      text = urlData.convertToEmbedUrl(text);
    }
    let contentType = params?.contentType ?? NodeType.WEB_PAGE;
    let label = resolveWebpageLabel(text);
    let url = text;
    const creationContext = params?.isEmbedContext
      ? (params?.creationContext ?? this.get().nodeId)
      : undefined;
    const body = {
      hash: "",
      description: ""
    };
    let metadata: Record<string, unknown> | undefined = undefined;
    const accountVal = account.get();
    if (accountVal?.dataMode === UserDataMode.CLOUD) {
      if (
        contentType === NodeType.YOUTUBE_VIDEO ||
        contentType === NodeType.YOUTUBE_SHORT
      ) {
        const youtubeMetadata = await fetchYouTubeMetadata(text);
        if (youtubeMetadata) {
          label = youtubeMetadata.title;
          metadata = {
            authorName: youtubeMetadata.author_name,
            authorUrl: youtubeMetadata.author_url,
            thumbnailUrl: youtubeMetadata.thumbnail_url
          };
        }
      } else if (!params?.isEmbedContext) {
        const data = await retrieveUrlData(text);
        if (data?.parsedData) {
          const parsedData = data.parsedData;
          label = parsedData.label ?? label;
          url = parsedData.url ?? url;
          contentType =
            params?.contentType ?? parsedData.contentType ?? contentType;
          if (hasStringProperty(parsedData.body, "description")) {
            body.description = parsedData.body.description;
          }
          if (hasStringProperty(parsedData.body, "hash")) {
            body.hash = parsedData.body.hash;
          }
          metadata = {
            ...parsedData.metadata
          };
        }
      }
    }
    const node = {
      contentType,
      label,
      url,
      creationContext,
      body,
      metadata
    } as INodeCapture<IWebPage | IClip>;
    const result = await insertCapturedNodes(node, {
      context: captureAction
    });
    this.postSave(result, {
      isOpenOnSave: params?.isOpenOnSave,
      isEmbedContext: params?.isEmbedContext
    });
    return Array.isArray(result) ? result?.[0] : result;
  }

  async postSave(
    result: any,
    params?: {
      isEmbedContext?: boolean;
      isOpenOnSave?: boolean;
    }
  ) {
    logger.debug({ at: "CaptureStore.postSave", result, params });
    const node = result?.[0];
    const captureState = this.get();
    if (!result || result.error || !node || !node.id) {
      logger.error({ at: "CaptureStore.postSave", result });
      toasts.error("Something went wrong. Please try again later.");
      return;
    }

    // Get the global setting for opening nodes upon save
    const shouldOpenUponSave =
      params?.isOpenOnSave ??
      uiState.getState(UIState.openNodesUponSave, {
        scope: UIStateScope.PRODUCT
      }) ??
      true;
    const linkedCollectionId = this.resolveLinkedCollectionId(captureState);
    const shouldReturnToLinkedCollection = Boolean(linkedCollectionId);

    const viewStore = get(view);
    if (result.length === 1) {
      appStore.addToRecents({
        record: node,
        type: Resource.node,
        timestamp: new Date()
      });
      this.handleSingleNodePostSave({
        node,
        isEmbedContext: params?.isEmbedContext,
        isConstrainedWidth: viewStore.isConstrainedWidth,
        shouldOpenUponSave,
        linkedCollectionId,
        shouldReturnToLinkedCollection
      });
    } else if (!viewStore.isConstrainedWidth && !params?.isEmbedContext) {
      toasts.success(`${result.length} nodes saved successfully!`);
    }
    if (params?.isEmbedContext) return;
    this.closeCaptureAfterSave(shouldOpenUponSave);
    this.update((prev) => ({ ...prev, isAvoidSaveLeaks: true }));
    await this.deletePermanently();
    // this.modify({ ...generateSeedStore() }, { isPersist: false });
  }

  private resolveLinkedCollectionId(captureState: {
    isCaptureFromCollectionPage?: boolean;
    linkQueryParam?: string | null;
  }) {
    const linkQueryParam = captureState.linkQueryParam;
    if (
      !captureState.isCaptureFromCollectionPage ||
      typeof linkQueryParam !== "string" ||
      !isValidString(linkQueryParam) ||
      !linkQueryParam.startsWith(`${Resource.collection}:`)
    ) {
      return undefined;
    }
    return linkQueryParam as IRecordId;
  }

  private handleSingleNodePostSave(params: {
    node: { id: IRecordId };
    isEmbedContext?: boolean;
    isConstrainedWidth: boolean;
    shouldOpenUponSave: boolean;
    linkedCollectionId?: IRecordId;
    shouldReturnToLinkedCollection: boolean;
  }) {
    if (!params.isConstrainedWidth && !params.isEmbedContext) {
      toasts.success("Node saved successfully!");
    }

    if (!params.isEmbedContext && !params.shouldOpenUponSave) {
      inlineToasts.success({
        id: "nodecapture",
        message: "Node saved successfully",
        data: params.node
      });
    }

    if (params.isEmbedContext) {
      return;
    }

    if (params.shouldReturnToLinkedCollection && params.linkedCollectionId) {
      navigation.openResource(params.linkedCollectionId, AccessMode.POP, {
        searchParams: {
          [AccessMode.MAIN]: null
        }
      });
      return;
    }

    if (params.shouldOpenUponSave) {
      navigation.openResource(params.node.id, AccessMode.POP, {
        searchParams: {
          [AccessMode.MAIN]: null
        }
      });
    }
  }

  private closeCaptureAfterSave(shouldOpenUponSave: boolean) {
    if (shouldOpenUponSave) {
      return;
    }
    navigation.closeResource({
      id: captureAction,
      accessMode: AccessMode.MAIN
    });
    navigation.closeResource({
      id: MemotronAction.CAPTURE_DND,
      accessMode: AccessMode.MAIN
    });
    navigation.closeResource({
      id: MemotronAction.CAPTURE_SECONDARY,
      accessMode: AccessMode.MAIN
    });
  }

  private async saveLinks(rootId: IRecordId) {
    const val = this.get();
    const rootLinks = [
      ...(val.links ? val.links.filter((x) => x.from === "root") : [])
    ].map((x) => {
      return { ...x, from: rootId };
    });
    const blockLinks = val.links?.filter((x) => x.from !== "root");
    logger.debug({ at: "CaptureStore.saveLinks", rootLinks, blockLinks, val });
    if (!isValidArrayWithData(rootLinks) && !isValidArrayWithData(blockLinks))
      return;
    const links = [...(rootLinks ?? []), ...(blockLinks ?? [])].map((x) => {
      return {
        in: x.from,
        out: x.to,
        linkType: x.linkType,
        toType: x.toType,
        location: x.location,
        tags: x.tags
      };
    });
    logger.log({ at: "CaptureStore.save", rootLinks, blockLinks, links });
    return persistContentLinks(links);
  }

  private async saveLinksForMultiFileCapture(nodes: any[]) {
    const val = this.get();
    const rootLinks = [
      ...(val.links ? val.links.filter((x) => x.from === "root") : [])
    ];
    if (!isValidArrayWithData(rootLinks)) return;
    let links: any[] = [];
    nodes.forEach((node) => {
      links.push(
        ...(rootLinks.map((x) => ({
          in: node.id,
          out: x.to,
          linkType: x.linkType,
          toType: x.toType,
          tags: x.tags
        })) ?? [])
      );
    });
    return persistContentLinks(links);
  }

  private async resolveLocation() {
    const ctx = get(context);
    if (ctx.isEmbed) {
      try {
        const locationResult = await embedBridge.fetch(
          generateMiniRandomId(),
          EmbedMessage.LOCATION,
          {}
        );
        if (locationResult && !locationResult.error) {
          return locationResult;
        }
      } catch (e) {
        logger.debug({
          at: "CaptureStore.resolveLocation - embed timeout",
          error: e
        });
        return undefined;
      }
    } else {
      try {
        const geoLocation = await getGeoLocation();
        return {
          latitude: geoLocation?.coords.latitude ?? 0,
          longitude: geoLocation?.coords.longitude ?? 0,
          accuracy: geoLocation?.coords.accuracy ?? 0
        };
      } catch (e) {
        logger.debug({
          at: "CaptureStore.resolveLocation - geolocation error",
          error: e
        });
        return undefined;
      }
    }
  }

  async saveMarkdownCapture() {
    const val = this.get();
    //TODO - extract nodes from markdown blocks and save
    const ctx = get(context);
    const location = await this.resolveLocation();
    let metadata = {
      location
    };
    logger.log({ at: "CaptureStore.saveMarkdownCapture", val, metadata });
    // const id = prefixTable(generateRandomId(), Resource.node);
    const id = val.nodeId ?? generateResourceId(Resource.node);
    const collections = this.resolveCollections();
    let root: INodeCapture<INode> = {
      id,
      label: val.label ?? "",
      propertyValues: val.propertyValues,
      body: "",
      contentType: NodeType.NODULAR_MARKDOWN,
      metadata,
      collections
    };

    let remainingResources: INodeCapture<INode>[] = [];
    if (val.body && "blocks" in val.body) {
      const resolvedChildrenWithStructure =
        val.childrenWithStructure.length > 0
          ? val.childrenWithStructure
          : extractStructureForChildren(val.body.blocks);
      const resolvedRootStructure =
        val.rootStructure.length > 0
          ? val.rootStructure
          : extractRootStructure(
              resolvedChildrenWithStructure,
              hierarchyFactorLimit
            ).map((x) => x.id);
      logger.log({
        at: "CaptureStore.saveMarkdownCapture.structure",
        captureId: val.id,
        label: val.label,
        blockCount: val.body.blocks.length,
        rootStructureLength: resolvedRootStructure.length,
        childrenWithStructureLength: resolvedChildrenWithStructure.length,
        firstBlock: val.body.blocks[0]
      });
      let data;
      let contentType;
      let name;
      for (let block of val.body.blocks) {
        if (isMediaGridBlock(block)) {
          const filesResult = await datafn.file.query({
            filters: {
              id: block.body.items.map((item: IMediaGridItem) => item.file)
            }
          });
          const files = filesResult.data as IFile[];
          for (let item of block.body.items) {
            const file = files.find(resourceInList(item.file));
            if (!file) continue;
            if (!file.url) continue;
            data = await fetch(file.url).then((r) => r.blob());
            contentType = file.type;
            name = file.name ?? file.label ?? file.id;
            const result = await fileUpload.uploadFileV2(
              contentType,
              name,
              data
            );
            if (result) {
              item.file = result[0].id;
            }
          }
        }
      }
      let mdText = "";
      if (resolvedRootStructure.length > 0) {
        const rootBlocks = val.body.blocks.filter((b) =>
          resolvedRootStructure.some(resourceInList(b))
        );
        mdText = generateMarkdownText(rootBlocks);
      }
      root = {
        ...root,
        mdChildOrder: resolvedRootStructure,
        text: mdText
      };

      for (let block of resolvedChildrenWithStructure) {
        const correspondingContent = val.body.blocks.find(
          (b) => b.id === block.id
        );
        let parent = undefined;
        if (
          correspondingContent?.contentType &&
          headingNodeTypes.includes(correspondingContent.contentType)
        ) {
          parent = resolveHeadingParent(
            block.id,
            resolvedChildrenWithStructure,
            [id]
          );
        }
        //TODO - links for each block
        let mdText = "";
        if (block.children && block.children.length > 0) {
          const childrenNodes = val.body.blocks.filter((b) =>
            block.children?.includes(b.id)
          );
          mdText = generateMarkdownText(childrenNodes);
        }
        remainingResources.push({
          id: block.id,
          contentType:
            correspondingContent?.contentType ?? NodeType.SIMPLE_TEXT,
          body: correspondingContent?.body ?? "",
          label: correspondingContent?.label ?? "",
          text: mdText,
          metadata: correspondingContent?.metadata,
          creationContext: id,
          mdChildOrder: block.children,
          mdParent: parent
        });
      }
    }

    let result: any = await insertCapturedNodes([root, ...remainingResources], {
      context: captureAction
    });
    await this.saveLinks(id);
    this.postSave(result.slice(0, 1));
    return result;
  }

  async saveCalendarNotes(params: {
    date: Date;
    scale: TimeScaleUnit;
    template?: IMarkdownTemplate;
  }) {
    try {
      let blocks: IBlock[] = [];
      let rootStructure: IRecordId[] = [];
      let childrenWithStructure: INodeStructure[] = [];
      const template = params.template;

      if (template) {
        const idMapping = new Map<string, IRecordId>();
        if ("blocks" in template.body) {
          template.body.blocks.forEach((block) => {
            idMapping.set(
              block.id.toString(),
              generateResourceId(Resource.node)
            );
          });
        }
        const replaceIds = (ids: IRecordId[] | undefined): IRecordId[] => {
          if (!ids) return [];
          return ids.map((id) => idMapping.get(id.toString()) || id);
        };

        blocks =
          template.body.blocks?.map((block) => ({
            ...block,
            id: idMapping.get(block.id.toString()) || block.id
          })) || [];

        rootStructure = replaceIds(template.rootStructure);

        childrenWithStructure = template.childrenWithStructure.map((block) => ({
          ...block,
          id: idMapping.get(block.id.toString()) || block.id,
          children: replaceIds(block.children)
        }));
      }

      const location = await this.resolveLocation();
      let metadata = {
        location
      };
      logger.log({
        at: "CaptureStore.saveCalendarNotes",
        val: template,
        metadata
      });
      const id = resolveCalendarNotesId(params.date, params.scale);
      let root: INodeCapture<INode> = {
        id,
        contentType: NodeType.NODULAR_MARKDOWN,
        label: `Calendar ${params.scale.toLowerCase()} notes - ${formatDate(params.date, params.scale)}`,
        body: "",
        metaType: NodeMetaType.CALENDAR_NOTES,
        date: getUtcSafeDay(params.date),
        mdChildOrder: []
      };

      let remainingResources: INodeCapture<INode>[] = [];
      if (blocks.length > 0) {
        let mdText = "";
        if (rootStructure.length > 0) {
          const rootBlocks = blocks.filter((b) =>
            rootStructure.some(resourceInList(b))
          );
          mdText = generateMarkdownText(rootBlocks);
        }
        root = {
          ...root,
          mdChildOrder: rootStructure,
          text: mdText
        };

        for (let block of childrenWithStructure) {
          const correspondingContent = blocks.find((b) => b.id === block.id);
          let parent = undefined;
          if (
            correspondingContent?.contentType &&
            headingNodeTypes.includes(correspondingContent.contentType)
          ) {
            parent = resolveHeadingParent(block.id, childrenWithStructure, [
              id
            ]);
          }
          let mdText = "";
          if (block.children && block.children.length > 0) {
            const childrenNodes = blocks.filter((b) =>
              block.children?.includes(b.id)
            );
            mdText = generateMarkdownText(childrenNodes);
          }
          remainingResources.push({
            id: block.id,
            contentType:
              correspondingContent?.contentType ?? NodeType.SIMPLE_TEXT,
            body: correspondingContent?.body ?? "",
            label: correspondingContent?.label ?? "",
            text: mdText,
            metadata: correspondingContent?.metadata,
            creationContext: id,
            mdChildOrder: block.children,
            mdParent: parent
          });
        }
      }

      let result: any = await insertCapturedNodes(
        [root, ...remainingResources],
        {
          context: captureAction
        }
      );
      return result;

      function formatDate(date: Date, scale: TimeScaleUnit) {
        if (scale === TimeScaleUnit.YEAR) {
          return date.toLocaleDateString("en-US", {
            year: "numeric"
          });
        } else if (scale === TimeScaleUnit.MONTH) {
          return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long"
          });
        } else {
          return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });
        }
      }
    } catch (e) {
      logger.error({
        at: "CaptureStore.saveCalendarNotes",
        error: e
      });
      throw e;
    }
  }

  private resolveCollections() {
    try {
      const val = this.get();
      const collections = val.links
        ?.filter(
          (x) =>
            x.from === "root" &&
            (x.toType === Resource.collection ||
              determineResourceType(x.to) === Resource.collection)
        )
        .map((x) => x.to);
      return collections ?? [];
    } catch (e) {
      logger.error({ at: "CaptureStore.resolveCollections", error: e });
      return [];
    }
  }
}
