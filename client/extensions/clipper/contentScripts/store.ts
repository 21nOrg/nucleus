import { retrieveUrlData } from "@nucleum/features/memory/capture/url-data";
import { logger } from "@nucleum/client/runtime/logging/logger";
import type { DfqlRelations } from "@datafn/core";
import { ErrorMessage } from "@nucleum/stores/notifications/error.enum";
import { ResourceErrorCode } from "@nucleum/schema/resource-error.enum";
import { ResourceError } from "@nucleum/datafn/resource-error";
import { DatafnExtensionMethod } from "@nucleum/extensions/extension.store";
import { generateResourceId } from "@nucleum/datafn/id.utils";
import { extensionDatafn } from "@nucleum/extensions/extension.store";
import { Resource } from "@nucleum/datafn/resource.enum";
import type {
  CaptureOmittedFields,
  OmitFields,
  OmitForCapture,
  OmitForCaptureWithId
} from "@nucleum/datafn/resource.type";
import {
  determineResourceType,
  isSameResource,
  resourceInList
} from "@nucleum/datafn/resource.utils";
import { ClipperExtensionEvent } from "@nucleum/client/config/events/clipper-event.type";
import { LinkType, type ILinkTag } from "@nucleum/datafn/link.type";
import {
  type IClip,
  type IClipCapture,
  type IKindleBook,
  type IKindleHighlight,
  type INode,
  type INodePropertyValue,
  type ITextClip,
  type ITweet,
  type ITwitterProfile,
  type IVideoBookmarkCapture,
  type IVideoTimestampClip,
  type IWebPage,
  type IWebScreenshotClip,
  NodeIdPrefix,
  socialPostNodeTypeList,
  socialProfileNodeTypeList
} from "@nucleum/features/memory/node/node.type";
import { NodeType } from "@nucleum/schema/legacy/node-type.enum";
import { generateNodeIdPrefixed } from "@nucleum/features/memory/node/node.utils";
import {
  isSameAsCurrentUrl,
  resolveUrlData
} from "@nucleum/features/memory/node/url.utils";
import { ObservableStore } from "@nucleum/stores/client.store";
import { appEvents } from "@nucleum/stores/events/app-events.store";
import type { IRecordId } from "@nucleum/schema/legacy/data.type";
import { Placement } from "@21n/elements/direction.enum";
import { ExtensionEvent } from "@nucleum/extensions/extension.type";
import { AlertType } from "@nucleum/stores/notifications/notification.type";
import { get, writable } from "svelte/store";

import {
  relayToBackgroundScript,
  relayToSidePanel
} from "@21n/utils/extension.utils";
import { activeResourceFilter } from "@21n/utils/utils";
import { parse, stringify } from "@21n/shared-utils/json.utils";
import { objIsEmpty, shallowDiff } from "@21n/shared-utils/obj.utils";
import { enumToString } from "@21n/shared-utils/text.utils";
import type { ISocialPost } from "@nucleum/extensions/clipper/clipper.type";
import {
  extractFullTabData,
  extractMinimalTabData,
  extractYoutubeVideoData,
  resolveUrl
} from "@nucleum/extensions/clipper/clipper.utils";
import {
  resolveInlineSocialPostParser,
  resolveParser,
  resolveVideoBookmarkParser
} from "@nucleum/extensions/clipper/parsers";
import { captureVideoFrame } from "@nucleum/extensions/clipper/parsers/shared/video.utils";
import { removeHighlight } from "@nucleum/extensions/clipper/contentScripts/highlightV4";
import {
  type IFeedbackPaneStore,
  type ISyncStore,
  type IWebpageStore,
  SyncStatus
} from "@nucleum/extensions/clipper/contentScripts/types";

async function queryOutgoingLinkIdsBySource(sourceIds: IRecordId[]) {
  if (sourceIds.length === 0) return new Map<string, IRecordId[]>();
  const records = await extensionDatafn({
    method: DatafnExtensionMethod.SELECT_MANY,
    args: {
      resource: Resource.node,
      params: {
        filters: {
          id: { $in: sourceIds }
        },
        select: ["id", "links.#"]
      }
    }
  });
  return new Map(
    (records ?? []).map((record: any) => [
      record.id.toString(),
      (record.links ?? [])
        .map((row: any) => row.to ?? row.out ?? row.id)
        .filter(Boolean)
    ])
  );
}

function isCollectionItemResource(resource: Resource) {
  return resource === Resource.node || resource === Resource.objective;
}

function isLinkableResource(resource: Resource) {
  return (
    resource === Resource.node ||
    resource === Resource.objective ||
    resource === Resource.task ||
    resource === Resource.event
  );
}

async function relateRecord(
  from: IRecordId,
  to: IRecordId,
  params?: {
    linkType?: LinkType;
    tags?: IRecordId[];
    location?: string;
  }
) {
  const fromResource = determineResourceType(from);
  const toResource = determineResourceType(to);
  if (toResource === Resource.collection) {
    if (!isCollectionItemResource(fromResource)) return undefined;
    return extensionDatafn({
      method: DatafnExtensionMethod.MUTATION,
      args: {
        resource: fromResource,
        params: {
          operation: "relate",
          id: from.toString(),
          relations: {
            collections: [
              {
                $ref: to.toString(),
                fromResource: fromResource.toString()
              }
            ]
          }
        } as any
      }
    });
  }
  if (!isLinkableResource(fromResource) || !isLinkableResource(toResource)) {
    return undefined;
  }
  return extensionDatafn({
    method: DatafnExtensionMethod.MUTATION,
    args: {
      resource: fromResource,
      params: {
        operation: "relate",
        id: from.toString(),
        relations: {
          links: [
            {
              $ref: to.toString(),
              fromResource: fromResource.toString(),
              toResource: toResource.toString(),
              linkType: params?.linkType ?? LinkType.DIRECT,
              tags: params?.tags,
              location: params?.location
            }
          ]
        }
      } as any
    }
  });
}

async function unrelateRecord(from: IRecordId, to: IRecordId) {
  const fromResource = determineResourceType(from);
  const toResource = determineResourceType(to);
  if (toResource === Resource.collection) {
    if (!isCollectionItemResource(fromResource)) return undefined;
    return extensionDatafn({
      method: DatafnExtensionMethod.MUTATION,
      args: {
        resource: fromResource,
        params: {
          operation: "unrelate",
          id: from.toString(),
          relations: {
            collections: [to.toString()]
          }
        } as any
      }
    });
  }
  if (!isLinkableResource(fromResource)) return undefined;
  return extensionDatafn({
    method: DatafnExtensionMethod.MUTATION,
    args: {
      resource: fromResource,
      params: {
        operation: "unrelate",
        id: from.toString(),
        relations: {
          links: [to.toString()]
        }
      } as any
    }
  });
}

async function insertNodeRecords(
  input: OmitForCaptureWithId<INode> | OmitForCaptureWithId<INode>[]
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
  await extensionDatafn({
    method: DatafnExtensionMethod.MUTATION,
    args: {
      resource: Resource.node,
      params: nodes.map((node) => {
        const { children, collections, links, propertyValues, ...record } =
          node as OmitForCaptureWithId<INode> & {
            children?: IRecordId[];
            collections?: IRecordId[];
            links?: IRecordId[];
            propertyValues?: INodePropertyValue[];
          };
        if (typeof record.parent !== "string") {
          delete record.parent;
        }
        return {
          operation: "insert",
          id: record.id,
          record: {
            ...record,
            ...resolveMarkdownParentFields(record.mdParent)
          }
        };
      }) as any
    }
  });
  const relationMutations = nodes
    .map((node) => {
      const relations: DfqlRelations = {};
      const collections =
        (node as { collections?: IRecordId[] }).collections ?? [];
      const links = (node as { links?: IRecordId[] }).links ?? [];
      const propertyValues =
        (node as { propertyValues?: INodePropertyValue[] }).propertyValues ??
        [];
      if (collections.length > 0) {
        relations.collections = collections.map((id) => ({
          $ref: id.toString(),
          fromResource: Resource.node
        }));
      }
      if (links.length > 0) {
        relations.links = links
          .filter((id) => isLinkableResource(determineResourceType(id)))
          .map((id) => ({
            $ref: id.toString(),
            fromResource: Resource.node,
            toResource: determineResourceType(id).toString(),
            linkType: LinkType.DIRECT
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
        relations
      };
    })
    .filter(Boolean);
  if (relationMutations.length > 0) {
    await extensionDatafn({
      method: DatafnExtensionMethod.MUTATION,
      args: {
        resource: Resource.node,
        params: relationMutations as any
      }
    });
  }
  return nodes.map((node) => ({
    ...node,
    updatedAt: "updatedAt" in node ? node.updatedAt : new Date()
  }));
}

function mergeNodeRecord(id: IRecordId, record: Partial<INode>) {
  return extensionDatafn({
    method: DatafnExtensionMethod.MUTATION,
    args: {
      resource: Resource.node,
      params: {
        operation: "merge",
        id,
        record
      } as any
    }
  });
}

function trashNodeRecord(id: IRecordId) {
  return extensionDatafn({
    method: DatafnExtensionMethod.MUTATION,
    args: {
      resource: Resource.node,
      params: {
        operation: "trash",
        id
      } as any
    }
  });
}

function updateNodePropertyValues(
  id: IRecordId,
  propertyValues: INodePropertyValue[]
) {
  return extensionDatafn({
    method: DatafnExtensionMethod.MUTATION,
    args: {
      resource: Resource.node,
      params: {
        operation: "relate",
        id,
        relations: {
          propertyValues: propertyValues.map((property) => ({
            $ref: property.id.toString(),
            fromResource: Resource.node,
            collectionId: property.collectionId,
            value: property.value
          }))
        }
      } as any
    }
  });
}

class WebpageStore extends ObservableStore<IWebpageStore> {
  previousValue: string = "";
  constructor() {
    super("clipperContentScriptStore");
    this.set({ url: "", clips: [], title: "" });
  }

  reset() {
    this.set({ url: "", clips: [], title: "" });
    appEvents.publish(ClipperExtensionEvent.REFRESH_CLIPS_RENDERING);
  }

  async loader(data: any) {
    logger.debug({ at: "webpage loader", data });
    const page = data.page;
    this.update((n) => {
      n.id = page?.id;
      n.clips =
        page?.clips?.length > 0 ? page.clips.filter(activeResourceFilter) : [];
      n.links = page?.links ?? [];
      n.notes = page?.notes ?? "";
      n.title = page?.label ?? window.document.title;
      n.propertyValues = page?.propertyValues ?? [];
      n.collections = page?.collections ?? [];
      return n;
    });
    appEvents.publish(ClipperExtensionEvent.REFRESH_CLIPS_RENDERING);
    relayToSidePanel({
      event: ExtensionEvent.PAGE_STATE,
      data: {
        page: this.get(),
        toolbar: toolbarState.get()
      }
    });
  }

  /**
   * TODO - save url as top level field - to enable querying via dexie, fetching links
   */
  async refresh() {
    const result = await extensionDatafn({
      method: DatafnExtensionMethod.SELECT_MANY,
      args: {
        resource: Resource.node,
        params: {
          filters: {
            url: this.get().url
          }
        }
      }
    });
    logger.debug({ at: "refresh", result });
    const page =
      result && Array.isArray(result) && result.length > 0
        ? result
            .filter(activeResourceFilter)
            .find((r: IWebPage) => r.url === this.get().url)
        : null;

    logger.debug({ at: "refresh", url: this.get().url, page, result });
    if (!page) {
      this.loader({ page: { url: this.get().url, clips: [] } });
      return;
    }
    const clips = await extensionDatafn({
      method: DatafnExtensionMethod.SELECT_MANY,
      args: {
        resource: Resource.node,
        params: {
          filters: {
            parent: page.id.toString()
          }
        }
      }
    });
    const linkIdsBySource = await queryOutgoingLinkIdsBySource([
      page.id,
      ...(clips?.map((c) => c.id) ?? [])
    ]);
    let rootLinks: IRecordId[] = [];
    if (linkIdsBySource.size > 0) {
      rootLinks = linkIdsBySource.get(page.id.toString()) ?? [];
      if (clips && Array.isArray(clips)) {
        clips.forEach((c) => {
          c.links = linkIdsBySource.get(c.id.toString()) ?? [];
        });
      }
    }
    logger.debug({
      at: "refresh",
      page,
      clips,
      links: rootLinks,
      linkIdsBySource
    });
    this.loader({ page: { ...page, clips: clips ?? [], links: rootLinks } });
  }

  /**
   * when a tab is changed, this method is called to update the store with the new tab data.
   *
   * @param tab
   * @returns
   */
  onContextChange(tab: chrome.tabs.Tab) {
    const url = resolveUrl(tab.url);
    const webpage = this.get();
    logger.debug({ at: "onContextChange", tab, url, webpage });
    toolbarState.refresh();
    this.set({ url, clips: [], title: tab.title ?? window.document.title });
    feedbackPane.reset();
    this.refresh();
  }

  /**
   * @param data - tab data
   * @returns
   */
  async savePage(params?: {
    contentType?: NodeType;
    creationContext?: IRecordId;
  }) {
    const contentType = params?.contentType ?? NodeType.WEB_PAGE;
    const parser = resolveParser(contentType);
    let data: OmitForCapture<IWebPage>;
    logger.debug({ at: "savePage", contentType, parser });
    if (parser) {
      const result = parser();
      if (!result) return;
      if (socialProfileNodeTypeList.has(contentType)) {
        return this.saveSocialProfile(result as IWebPage);
      } else if (socialPostNodeTypeList.has(contentType)) {
        return this.saveSocialPost({
          main: {
            ...result
          } as ISocialPost
        });
      }
    }
    data = await extractData();
    const id = generateResourceId(Resource.node);
    const node = {
      id,
      ...data,
      creationContext: params?.creationContext
    };
    const response = await insertNodeRecords([node]);
    if (!response) return;
    logger.log({ at: "savePage", response });
    this.update((n) => {
      n.id = id;
      return n;
    });
    relayToSidePanel({
      event: ExtensionEvent.PAGE_STATE,
      data: {
        page: node,
        toolbar: toolbarState.get()
      }
    });
    return response;

    /**
     * Disabling capturing of screenshot as it is adding latency to page save action.
     * @returns
     */
    async function extractData() {
      if (
        params?.contentType === NodeType.YOUTUBE_VIDEO ||
        params?.contentType === NodeType.YOUTUBE_SHORT
      ) {
        return extractYoutubeVideoData();
      } else if (params?.contentType === NodeType.YOUTUBE_CHANNEL) {
        const urlData = await retrieveUrlData(window.location.href);
        if (urlData?.parsedData) {
          return urlData.parsedData;
        } else {
          return extractMinimalTabData();
        }
      }
      const host = window.location.host;
      if (resolveUrlData(host)) {
        logger.log({
          at: "extractData",
          host,
          message: "minimal metadata page"
        });
        return extractMinimalTabData();
      }
      // const ssFile = await screenshotWebpage();
      const tab = await extractFullTabData();
      tab.metadata = {
        ...tab.metadata
        //screenshotFile: ssFile.id
      };
      return tab;

      async function screenshotWebpage() {
        const ss = await relayToBackgroundScript({
          event: ClipperExtensionEvent.SCREENSHOT
        });
        const result = await relayToBackgroundScript({
          event: ExtensionEvent.UPLOAD_FILE,
          data: {
            dataUrl: ss.data,
            contentType: "image/png",
            params: {
              isMeta: true,
              thumbnailDataUrl: ss.lowRes
            }
          }
        });
        return result;
      }
    }
  }

  /**
   * Saves the clip to the database. If the webpage is not saved, it will be saved first by parsing the DOM for web page metadata.
   *
   * Note: This method will not work if called from non content script context as parsing the DOM is not possible.
   * @param data
   * @param tabData
   * @returns
   */
  async saveClip(data: IClipCapture | IVideoBookmarkCapture) {
    let webpage = this.get();
    logger.debug({ at: "saveClip", webpage, data });

    const id = generateResourceId(Resource.node);
    if (!webpage.id) {
      await this.savePage({ creationContext: id });
    }
    webpage = this.get();
    const clipUrl = resolveClipUrl(data);
    const clip: OmitForCapture<
      IWebScreenshotClip | ITextClip | IVideoTimestampClip
    > = {
      id,
      url: clipUrl,
      body: {
        ...data.body
      },
      text: data.text,
      metadata: data.metadata,
      parent: webpage.id,
      contentType: data.contentType,
      label: undefined
    };
    const response = await insertNodeRecords([clip]);
    if (!response || !Array.isArray(response)) return;
    logger.debug({ at: "saveClip", response });
    const clipNode = response[0] as IWebScreenshotClip;
    if (!clipNode) return;
    const clips = [...(this.get().clips ?? []), { ...clipNode, links: [] }];
    this.update((n) => {
      n.clips = clips;
      return n;
    });
    appEvents.publish(ClipperExtensionEvent.REFRESH_CLIPS_RENDERING);
    relayToSidePanel({
      event: ClipperExtensionEvent.CLIPS_CHANGED,
      data: clips
    });
    if (clip.contentType === NodeType.WEB_SCREENSHOT) {
      feedbackPane.focus(clipNode, {
        message: "Clip saved!",
        type: AlertType.SUCCESS
      });
    }
    return clip;

    function resolveClipUrl(data: any) {
      if ("url" in data && data.url) return data.url;
      else return `${webpage.url ?? window.location.href}#${id}`;
    }
  }

  private socialIdMapper = (item: any) => {
    let id;
    if (!item) return;
    if (item.id) id = item.id;
    else if (socialProfileNodeTypeList.has(item.contentType)) {
      id = generateNodeIdPrefixed(
        item.contentType,
        item.body.username as string
      );
    } else if (socialPostNodeTypeList.has(item.contentType)) {
      id = generateNodeIdPrefixed(
        item.contentType,
        `${item.metadata.username}_${item.metadata.postId}`
      );
    } else if (!id && item.body.username) {
      id = generateNodeIdPrefixed(
        item.contentType,
        item.body.username as string
      );
    }
    return {
      ...item,
      id
    };
  };

  async saveInlineSocialPost(target: HTMLElement, contentType: NodeType) {
    const parser = resolveInlineSocialPostParser(contentType);
    logger.debug({ at: "saveInlineSocialPost", contentType, parser });
    if (!parser) {
      logger.error("No parser found for social post");
      return;
    }
    const parsed = parser(target);
    if (!parsed) {
      logger.error("Data not found");
      return;
    }
    let main;
    let posts: ISocialPost[] = [];
    if (!parsed.data || !parsed.data.url) return;
    const isMainPost = isSameAsCurrentUrl(parsed.data.url);
    if (isMainPost) {
      main = parsed;
    } else {
      if (parsed.isPostPage) {
        const mainPostResolver = resolveParser(contentType);
        main = mainPostResolver?.() as ISocialPost;
      }
      posts = [parsed];
    }
    return this.saveSocialPost({ main, posts });
  }

  /**
   * @deprecated - use savePage or saveSocialPost instead
   * @param data
   * @param isFromTweetPage
   * @returns
   */
  async saveTweet(
    data: OmitFields<
      ITweet & {
        username: string;
        profileUrl: string;
        authorName: string;
        profileImageUrl: string;
      },
      CaptureOmittedFields | "label"
    >,
    isFromTweetPage: boolean = false
  ) {
    logger.debug({ at: "saveTweet", data });
    // const id = generateResourceId(Resource.node);
    const tweetId = generateResourceId(Resource.node, {
      prefix: NodeIdPrefix.TWEET,
      id: `${data.username}_${data.metadata?.tweetId}`
    });
    const twitterProfileId = generateResourceId(Resource.node, {
      prefix: NodeIdPrefix.TWITTER_PROFILE,
      id: data.username as string
    });
    const tweetNode: OmitForCaptureWithId<ITweet> = {
      id: tweetId,
      url: data.url,
      body: data.body,
      text: data.text ?? data.body.content,
      metadata: data.metadata,
      parent: twitterProfileId,
      contentType: NodeType.TWEET
    };
    const twitterProfileNode: OmitForCapture<ITwitterProfile> = {
      url: data.profileUrl,
      label: data.authorName,
      body: {
        name: data.authorName,
        profileImageUrl: data.profileImageUrl
      },
      metadata: {},
      contentType: NodeType.TWITTER_PROFILE
    };
    const response = await insertNodeRecords([
      { ...tweetNode, label: undefined },
      {
        ...twitterProfileNode,
        id: twitterProfileId,
        creationContext: tweetId
      }
    ]);
    if (!response || !Array.isArray(response)) return;
    const tweet = response[0] as ITweet;
    this.update((n) => {
      n.clips = [...(n.clips ?? []), { ...tweet, links: [] }];
      if (isFromTweetPage) n.id = tweet.id;
      return n;
    });
    if (isFromTweetPage) {
      relayToSidePanel({
        event: ExtensionEvent.PAGE_STATE,
        data: {
          page: this.get(),
          toolbar: toolbarState.get()
        }
      });
    } else {
      feedbackPane.focus(tweet, {
        message: "Tweet saved!",
        type: AlertType.SUCCESS
      });
    }
    return tweetNode;
  }

  focus(id: string, message: string | { message: string; type: AlertType }) {
    logger.log({ at: "focus", id, message });
    const webpage = this.get();
    if (webpage.id === id) {
      feedbackPane.toggle({ isUserInitiated: true });
    } else {
      const clip = webpage.clips?.find((c) => c.id === id);
      if (clip) {
        feedbackPane.focus(clip, message);
      }
    }
  }

  /**
   * @deprecated - use savePage or saveSocialProfile instead
   * Triggers from twitter profile page.
   * @param data
   * @returns
   */
  async saveTwitterProfile(
    data: OmitForCapture<ITwitterProfile & { username: string }>
  ) {
    const twitterProfileId = generateNodeIdPrefixed(
      NodeType.TWITTER_PROFILE,
      data.username as string
    );
    logger.log({ at: "saveTwitterProfile", data, twitterProfileId });
    const response = await insertNodeRecords([
      { ...data, id: twitterProfileId }
    ]);
    if (!response || !Array.isArray(response)) return;
    const node = response[0] as ITwitterProfile;
    this.update((n) => {
      n.clips = [...(n.clips ?? []), { ...node, links: [] }];
      n.id = node.id;
      return n;
    });
    feedbackPane.focus(node, {
      message: "Twitter profile saved!",
      type: AlertType.SUCCESS
    });
    return node;
  }

  private async saveLinkTag(label: string, group: string) {
    const existing = (await extensionDatafn({
      method: DatafnExtensionMethod.SELECT_MANY,
      args: {
        resource: Resource.linkTag,
        params: {
          select: ["id", "label", "group"]
        }
      }
    })) as ILinkTag[] | { data?: ILinkTag[] } | undefined;
    const tags = Array.isArray(existing) ? existing : (existing?.data ?? []);
    const match = tags.find(
      (tag) =>
        tag.label?.toLowerCase() === label.toLowerCase() &&
        (tag.group ?? "").toLowerCase() === group.toLowerCase()
    );
    if (match) return match;
    const record = {
      id: generateResourceId(Resource.linkTag),
      label,
      group: group.toLowerCase()
    };
    await extensionDatafn({
      method: DatafnExtensionMethod.MUTATION,
      args: {
        resource: Resource.linkTag,
        params: {
          operation: "insert",
          id: record.id,
          record
        }
      }
    });
    return record;
  }

  private async saveSocialPost(params: {
    main?: ISocialPost;
    posts?: ISocialPost[];
  }) {
    if (!params.posts && !params.main) return;
    logger.debug({ at: "saveSocialPost", params });
    let posts =
      params.posts
        ?.map((x) => x.data)
        ?.filter(Boolean)
        ?.map(this.socialIdMapper) ?? [];
    const profiles =
      params.posts
        ?.map((x) => x.parent)
        ?.filter(Boolean)
        ?.map(this.socialIdMapper) ?? [];
    const subs =
      params.posts
        ?.map((x) => x.sub)
        ?.filter(Boolean)
        ?.map(this.socialIdMapper) ?? [];
    posts = posts.map((x, index) => ({ ...x, parent: profiles[index].id }));
    const mainParent = params.main
      ? this.socialIdMapper(params.main.parent)
      : null;
    let mainPost = params.main
      ? { ...this.socialIdMapper(params.main.data), parent: mainParent?.id }
      : null;
    const pendingRelations: {
      from: IRecordId;
      to: IRecordId;
      content: { tags: IRecordId[] };
    }[] = [];
    if (mainPost && posts.length > 0) {
      const threadRelation = await this.saveLinkTag("thread", "social");
      const content = {
        tags: threadRelation?.id ? [threadRelation.id] : []
      };
      for (const post of posts) {
        pendingRelations.push({ from: post.id, to: mainPost.id, content });
      }
    }
    if (posts.length > 0 && subs.length > 0) {
      const subRelation = await this.saveLinkTag("sub", "social");
      const content = {
        tags: subRelation?.id ? [subRelation.id] : []
      };
      for (const [index, post] of posts.entries()) {
        const sub = subs[index];
        if (sub) pendingRelations.push({ from: post.id, to: sub.id, content });
      }
    }
    if (mainPost) {
      const genericData = extractMinimalTabData();
      mainPost = {
        ...genericData,
        ...mainPost,
        metadata: {
          ...genericData.metadata,
          ...(mainPost?.metadata ?? {})
        }
      };
    }
    logger.debug({ at: "saveSocialPost", mainPost });
    const main = mainPost ? [mainPost, mainParent] : [];
    const response = await insertNodeRecords([
      ...main,
      ...posts,
      ...profiles,
      ...subs
    ]);
    if (!response || !Array.isArray(response)) return;
    for (const relation of pendingRelations) {
      await relateRecord(relation.from, relation.to, relation.content);
    }
    this.update((n) => {
      n.clips = [
        ...(n.clips ?? []),
        ...posts.map((x) => ({ ...x, links: [] })),
        ...(mainPost ? [{ ...mainPost, links: [] }] : [])
      ];
      if (mainPost) n.id = mainPost.id;
      return n;
    });

    if (posts[0]) {
      feedbackPane.focus(posts[0], {
        message: "Post saved!",
        type: AlertType.SUCCESS
      });
      return posts[0];
    } else if (mainPost) {
      relayToSidePanel({
        event: ExtensionEvent.PAGE_STATE,
        data: {
          page: this.get(),
          toolbar: toolbarState.get()
        }
      });
      feedbackPane.focus(mainPost, {
        message: "Post saved!",
        type: AlertType.SUCCESS
      });
      return mainPost;
    }
  }

  private async saveSocialProfile(data: OmitForCapture<INode>) {
    if (!data.body.username) return;
    const profileId = generateNodeIdPrefixed(
      data.contentType,
      data.body.username
    );
    const genericData = extractMinimalTabData();
    const profile = {
      ...genericData,
      ...data,
      metadata: {
        ...genericData.metadata,
        ...(data?.metadata ?? {})
      }
    };
    logger.debug({ at: "saveSocialProfile", profile, profileId });
    const response = await insertNodeRecords([{ ...data, id: profileId }]);
    if (!response || !Array.isArray(response)) return;
    const node = response[0] as INode;
    this.update((n) => {
      n.clips = [...(n.clips ?? []), { ...node, links: [] }];
      n.id = node.id;
      return n;
    });
    feedbackPane.focus(node, {
      message: `${enumToString(data.contentType)} saved!`,
      type: AlertType.SUCCESS
    });
    return node;
  }

  /**
   * Saves a video bookmark from video platforms (YouTube, Coursera, Udemy)
   * Uses platform-specific parsers to extract video metadata and current timestamp
   * Follows the same pattern as social post clipping with content type detection
   */
  saveVideoBookmark(contentType: NodeType) {
    const parser = resolveVideoBookmarkParser(contentType);
    if (!parser) {
      throw new Error("No video bookmark parser found for content type");
    }
    logger.debug({
      at: "saveVideoBookmark",
      parser,
      contentType
    });

    const bookmarkData = parser();
    if (!bookmarkData) {
      throw new Error("Failed to extract video bookmark data");
    }

    const dataUrl = captureVideoFrame();
    const uploadPromise = relayToBackgroundScript({
      event: ExtensionEvent.UPLOAD_FILE,
      data: { dataUrl, contentType: "image/png" }
    });
    return [this.saveClip(bookmarkData), uploadPromise];
  }

  async linkPage(to: string) {
    try {
      const webpage = this.get();
      const isAlreadyLinked = webpage.links?.some((l) => l === to);
      if (isAlreadyLinked)
        return { message: "Already linked", type: AlertType.ERROR };
      if (!webpage.id) return;
      const response = await relateRecord(webpage.id, to);
      if (!response)
        return { message: "Linking failed", type: AlertType.ERROR };
      const resourceType = determineResourceType(to);
      if (resourceType === Resource.collection) {
        const collections = [...(webpage.collections ?? []), to];
        this.update((n) => {
          n.links = [...(n.links ?? []), to];
          n.collections = collections;
          return n;
        });
        relayToSidePanel({
          event: ClipperExtensionEvent.ON_COLLECTION_LINK_CHANGES,
          data: {
            from: webpage.id,
            to
          }
        });
      } else {
        this.update((n) => {
          n.links = [...(n.links ?? []), to];
          return n;
        });
      }
      return { message: "Linked!", type: AlertType.SUCCESS };
    } catch (e) {
      logger.error(e);
      if (e instanceof ResourceError) {
        if (e.code === ResourceErrorCode.ALREADY_EXISTS) {
          return { message: "Already linked", type: AlertType.ERROR };
        }
      }
      return { message: "Linking failed", type: AlertType.ERROR };
    }
  }

  async removeLinkForPage(to: string) {
    const webpage = this.get();
    if (!webpage.id) return;
    const response = await unrelateRecord(webpage.id, to);
    if (!response)
      return { message: "Unlinking failed", type: AlertType.ERROR };
    const resourceType = determineResourceType(to);
    if (resourceType === Resource.collection) {
      const collections = webpage.collections?.filter(
        (c) => !isSameResource(c, to)
      );
      this.update((n) => {
        n.collections = collections;
        n.links = n.links?.filter((l) => !isSameResource(l, to));
        return n;
      });
      relayToSidePanel({
        event: ClipperExtensionEvent.ON_COLLECTION_LINK_CHANGES,
        data: {
          from: webpage.id,
          to
        }
      });
    } else {
      this.update((n) => {
        n.links = n.links?.filter((l) => !isSameResource(l, to));
        return n;
      });
    }
    return { message: "Unlinked!", type: AlertType.SUCCESS };
  }

  async linkClip(
    from: IRecordId,
    to: IRecordId,
    params?: {
      isFromSidePanel?: boolean;
    }
  ) {
    const webpage = this.get();
    const clip = webpage?.clips?.find(resourceInList(from));
    if (!clip)
      throw new ResourceError("Clip not found", ResourceErrorCode.NOT_FOUND);
    const isAlreadyLinked = clip.links?.some(resourceInList(to));
    if (isAlreadyLinked)
      throw new ResourceError(
        "Already linked",
        ResourceErrorCode.ALREADY_EXISTS
      );
    const response = await relateRecord(from, to);
    if (!response || response.error)
      throw new ResourceError(
        response?.error ?? "Linking failed",
        ResourceErrorCode.INTERNAL_ERROR
      );
    const resourceType = determineResourceType(to);
    if (resourceType === Resource.collection) {
      const collections = [...(clip.collections ?? []), to];
      this.update((n) => {
        n.clips = n.clips?.map((c) => {
          if (isSameResource(c, from)) {
            c.collections = collections;
            c.links = [...(c.links ?? []), to];
            return c;
          }
          return c;
        });
        return n;
      });
    } else {
      this.update((n) => {
        n.clips = n.clips?.map((c) => {
          if (isSameResource(c, from)) {
            c.links = [...(c.links ?? []), to];
          }
          return c;
        });
        return n;
      });
    }
    appEvents.publish(ClipperExtensionEvent.REFRESH_CLIPS_RENDERING);
    if (!params?.isFromSidePanel) {
      this.refreshClip(from);
      if (resourceType === Resource.collection) {
        relayToSidePanel({
          event: ClipperExtensionEvent.ON_COLLECTION_LINK_CHANGES,
          data: {
            from,
            to
          }
        });
      }
    }
    return response;
  }

  async removeLinkForClip(
    from: IRecordId,
    to: IRecordId,
    params?: {
      isFromSidePanel?: boolean;
    }
  ) {
    const response = await unrelateRecord(from, to);
    if (!response)
      return { message: "Unlinking failed", type: AlertType.ERROR };
    const resourceType = determineResourceType(to);
    if (resourceType === Resource.collection) {
      const clip = this.get().clips?.find(resourceInList(from));
      if (!clip) return;
      const collections = clip.collections?.filter(
        (c) => !isSameResource(c, to)
      );
      this.update((n) => {
        n.clips = n.clips?.map((c) => {
          if (isSameResource(c, from)) {
            c.collections = collections;
            c.links = c.links?.filter((l) => !isSameResource(l, to));
          }
          return c;
        });
        return n;
      });
    } else {
      this.update((n) => {
        n.clips = n.clips?.map((c) => {
          if (isSameResource(c, from)) {
            c.links = c.links?.filter((l) => !isSameResource(l, to));
          }
          return c;
        });
        return n;
      });
    }
    appEvents.publish(ClipperExtensionEvent.REFRESH_CLIPS_RENDERING);
    if (!params?.isFromSidePanel) {
      this.refreshClip(from);
      if (resourceType === Resource.collection) {
        relayToSidePanel({
          event: ClipperExtensionEvent.ON_COLLECTION_LINK_CHANGES,
          data: {
            from,
            to
          }
        });
      }
    }
    return { message: "Unlinked!", type: AlertType.SUCCESS };
  }

  async removeClip(
    id: string,
    params?: {
      isFromSidePanel?: boolean;
    }
  ) {
    const response = await trashNodeRecord(id);
    if (!response)
      return { message: "Clip removal failed", type: AlertType.ERROR };
    this.update((n) => {
      n.clips = n.clips?.filter((c) => c.id.toString() !== id.toString());
      return n;
    });
    removeHighlight(id);
    appEvents.publish(ClipperExtensionEvent.REFRESH_CLIPS_RENDERING);
    if (!params?.isFromSidePanel) {
      relayToSidePanel({
        event: ClipperExtensionEvent.CLIPS_CHANGED,
        data: this.get().clips
      });
    }
    return { message: "Clip removed!", type: AlertType.SUCCESS };
  }

  async updateTextClipColor(id: IRecordId, highlighterId: string) {
    const updateResult = await mergeNodeRecord(id, {
      body: { highlighterId }
    });
    if (!updateResult) return;
    this.update((n) => {
      n.clips = n.clips?.map((x) => {
        if (isSameResource(x.id, id)) {
          x.body.highlighterId = highlighterId;
          return x;
        }
        return x;
      });
      return n;
    });
    this.refreshClip(id);

    return { message: "Color updated!", type: AlertType.SUCCESS };
  }

  /**
   *
   * @deprecated - using content script as main source of state. save page event from side panel is now relayed to content script.
   *
   * If the save page happened from side bar - the toolbar and other content on web page should reflect the change. This method is called to update the store with the new page data when content script receive the message from side bar.
   * @param data ``
   */
  propagatePageStatusFromSidebar(data: any) {
    if (this.get().id === data.id) return;
    this.update((n) => {
      n.id = data.id;
      return n;
    });
  }

  private async _persistNotes(id: IRecordId, notes: string) {
    return mergeNodeRecord(id, { notes });
  }

  set(newValue: IWebpageStore) {
    const changedProperties: any = {};
    if (this.previousValue) {
      const differences = shallowDiff(newValue, parse(this.previousValue));
      differences.forEach((key: string) => {
        changedProperties[key] = newValue[key as keyof IWebpageStore];
      });
    }
    // console.log({
    //   previousValue: this.previousValue ? parse(this.previousValue) : null,
    //   newValue,
    //   changedProperties
    // });
    this._set(newValue);
    this.previousValue = stringify(newValue);
    if (!objIsEmpty(changedProperties) && changedProperties.notes) {
      this._persistNotes(newValue.id, newValue.notes);
    }
  }

  async persistPageNotes(
    notes: string,
    params?: { isFromSidePanel?: boolean }
  ) {
    const webpage = this.get();
    if (!webpage.id) return;
    const response = await this._persistNotes(webpage.id, notes);
    if (!response) return;
    this.update((n) => {
      n.notes = notes;
      return n;
    });
    if (!params?.isFromSidePanel) {
      relayToSidePanel({
        event: ExtensionEvent.PAGE_STATE,
        data: {
          page: this.get(),
          toolbar: toolbarState.get()
        }
      });
    }
    return response;
  }

  async persistClipNotes(
    id: IRecordId,
    notes: string,
    params?: {
      isFromSidePanel?: boolean;
    }
  ) {
    const webpage = this.get();
    if (!webpage?.clips) return;
    const clip = webpage.clips?.find(resourceInList(id));
    if (!clip) return;
    const response = await this._persistNotes(id, notes);
    if (!response) return;
    this.update((n) => {
      n.clips = n.clips?.map((c) => {
        if (isSameResource(c, id)) {
          c.notes = notes;
          return c;
        }
        return c;
      });
      return n;
    });
    this.refreshClip(id, params?.isFromSidePanel);
    return response;
  }

  async updateClipLabel(
    id: IRecordId,
    label: string,
    params?: {
      isFromSidePanel?: boolean;
    }
  ) {
    const response = await mergeNodeRecord(id, { label });
    if (!response) return;
    this.update((n) => {
      n.clips = n.clips?.map((c) => {
        if (isSameResource(c, id)) {
          c.label = label;
          return c;
        }
        return c;
      });
      return n;
    });
    this.refreshClip(id, params?.isFromSidePanel);
    return response;
  }

  async updateClipBody(
    id: IRecordId,
    body: any,
    params?: {
      isFromSidePanel?: boolean;
    }
  ) {
    const clip = this.get().clips?.find(resourceInList(id));
    if (!clip) return;
    const response = await mergeNodeRecord(id, {
      body: { ...clip.body, ...body }
    });
    if (!response) return;
    this.update((n) => {
      n.clips = n.clips?.map((c) => {
        if (isSameResource(c, id)) {
          c.body = { ...clip.body, ...body };
          return c;
        }
        return c;
      });
      return n;
    });
    this.refreshClip(id, params?.isFromSidePanel);
    return response;
  }

  async updatePageProperty(property: INodePropertyValue) {
    const webpage = this.get();
    if (!webpage.id) return;
    const propertyValues = webpage.propertyValues?.filter(
      (x) => !isSameResource(x, property)
    );
    const newPropertyValues = [...(propertyValues ?? []), property];
    const response = await this.updateProperties(webpage.id, newPropertyValues);
    if (!response || response.error) return;
    this.update((n) => {
      n.propertyValues = [...newPropertyValues];
      return n;
    });
    return response;
  }

  async updateClipProperty(
    id: IRecordId,
    property: INodePropertyValue,
    params?: {
      isFromSidePanel?: boolean;
    }
  ) {
    logger.log({
      at: "updateClipProperty",
      id,
      property,
      clips: this.get().clips
    });
    const webpage = this.get();
    if (!webpage?.clips) return;
    const clip = webpage.clips?.find(resourceInList(id));
    if (!clip) return;
    const propertyValues = clip.propertyValues?.filter(
      (x) => !isSameResource(x, property)
    );
    const newPropertyValues = [...(propertyValues ?? []), property];
    const response = await this.updateProperties(id, newPropertyValues);
    if (!response || response.error) return;
    this.update((n) => {
      n.clips = n.clips?.map((c) => {
        if (isSameResource(c, id)) {
          c.propertyValues = [...newPropertyValues];
        }
        return c;
      });
      return n;
    });
    this.refreshClip(id, params?.isFromSidePanel);
    return response;
  }

  private updateProperties(id: IRecordId, properties: INodePropertyValue[]) {
    return updateNodePropertyValues(id, [...properties]);
  }

  openInModal(id: string, params?: { isResumeVideoOnClose?: boolean }) {
    const clip = this.get().clips?.find(resourceInList(id));
    if (!clip) return;
    feedbackPane.openInModal({
      ...clip,
      isResumeVideoOnClose: params?.isResumeVideoOnClose
    });
  }

  private refreshClip(id: string, isFromSidePanel: boolean = false) {
    const clip = this.get().clips?.find(resourceInList(id));
    if (!isFromSidePanel) {
      relayToSidePanel({
        event: ClipperExtensionEvent.REFRESH_CLIP,
        data: { clipId: id, clip }
      });
    }
    appEvents.publish(ClipperExtensionEvent.REFRESH_CLIP, clip);
  }
}
export const webpage = new WebpageStore();

class FeedbackPaneStore extends ObservableStore<IFeedbackPaneStore> {
  constructor() {
    super("feedbackPane");
    this.set({
      isShown: false,
      feedback: "",
      focusedClip: null,
      modalClip: null
    });
  }
  reset() {
    this.update(() => {
      return {
        isShown: false,
        feedback: "",
        focusedClip: null,
        modalClip: null
      };
    });
  }
  toggle(params?: { isUserInitiated?: boolean }) {
    this.update((n) => {
      n.isShown = !n.isShown;
      n.isUserInitiated = params?.isUserInitiated ?? false;
      return n;
    });
  }
  focus(
    clip: IClip | null,
    message: string | { message: string; type: AlertType }
  ) {
    logger.log({ at: "feedbackPane.focus", clip, message });
    this.update((n) => {
      n.focusedClip = clip;
      n.feedback = message;
      n.isShown = true;
      return n;
    });
  }
  openInModal(clip: IClip | null) {
    this.update((n) => {
      n.modalClip = clip;
      return n;
    });
  }
  closeModalClip() {
    this.update((n) => {
      n.modalClip = null;
      return n;
    });
  }
  /**
   * Sets saving status with single message and prevents auto close.
   * @param text
   */
  onPageSaveStart(text: string) {
    this.update((n) => {
      n.feedback = {
        message: text,
        type: AlertType.PROGRESS
      };
      n.isShown = true;
      n.isPreventAutoClose = true;
      n.isShowStatusOnly = true;
      return n;
    });
  }

  onPageSaved(message: string, type: AlertType = AlertType.SUCCESS) {
    this.update((n) => {
      n.feedback = {
        message,
        type
      };
      n.isPreventAutoClose = false;
      n.isShowStatusOnly = type !== AlertType.SUCCESS;
      return n;
    });
  }

  setErrorFeedback(params?: {
    message?: string;
    isPreventAutoClose?: boolean;
  }) {
    this.update((n) => {
      n.feedback = {
        message: params?.message ?? ErrorMessage.DEFAULT,
        type: AlertType.ERROR
      };
      if (params?.isPreventAutoClose !== undefined) {
        n.isPreventAutoClose = params.isPreventAutoClose;
      }
      return n;
    });
  }
}

export const feedbackPane = new FeedbackPaneStore();

type ClipperToolbarStateValue = {
  isOpen: boolean;
  isHidden?: boolean;
  position: Placement.Right | Placement.Left | Placement.Bottom;
};

const toolbarStateStore = writable<ClipperToolbarStateValue>({
  isOpen: true,
  position: Placement.Right
});

export const toolbarState = {
  subscribe: toolbarStateStore.subscribe,
  get() {
    return get(toolbarStateStore);
  },
  update: toolbarStateStore.update,
  modify(patch: Partial<ClipperToolbarStateValue>) {
    toolbarStateStore.update((state) => ({ ...state, ...patch }));
    return extensionDatafn({
      method: DatafnExtensionMethod.KV_MERGE,
      args: {
        resource: Resource.clipperToolbarState,
        data: patch
      }
    });
  },
  toggle(isOpen?: boolean) {
    if (isOpen === undefined) {
      isOpen = !this.get().isOpen;
    }
    this.modify({ isOpen });
    if (isOpen) {
      setTimeout(() => {
        webpage.refresh();
      }, 100);
    }
  },

  toggleVisibility(isHidden?: boolean) {
    if (isHidden === undefined) {
      isHidden = !this.get().isHidden;
    }
    this.modify({ isHidden });
    setTimeout(() => {
      webpage.refresh();
    }, 100);
  },

  changePosition(
    position: Placement.Right | Placement.Left | Placement.Bottom
  ) {
    this.modify({ position });
  },

  async refresh() {
    const result = await extensionDatafn({
      method: DatafnExtensionMethod.SELECT,
      args: {
        resourceId: `kv:${Resource.clipperToolbarState}`
      }
    });
    if (result?.id) {
      toolbarStateStore.update((state) => ({
        ...state,
        isOpen: result.isOpen,
        position: result.position
      }));
    }
  }
};

class SyncStore extends ObservableStore<ISyncStore> {
  constructor() {
    super(Resource.clipperSync);
    this.set({
      id: undefined,
      status: SyncStatus.NOT_SYNCED,
      isShowSyncPane: false
    });
  }
  async init(id: string) {
    this.update((n) => {
      n.id = id;
      return n;
    });
    await this.refreshSyncState();
    this.update((n) => {
      n.isShowSyncPane = true;
      return n;
    });
  }

  togglePane() {
    this.update((n) => {
      n.isShowSyncPane = !n.isShowSyncPane;
      return n;
    });
  }

  async save(items: OmitForCaptureWithId<IKindleBook | IKindleHighlight>[]) {
    logger.log({ at: "syncStore save", items });
    if (!items || items.length < 1) return;
    const limitCount = 300;
    this.update((n) => {
      n.progress = 0;
      return n;
    });
    if (items.length > limitCount) {
      const chunks = resolveChunks();
      logger.log({ at: "syncStore save", chunks });
      for (const chunk of chunks) {
        await chunk();
        this.update((n) => {
          n.progress = (chunks.indexOf(chunk) / chunks.length) * 100;
          return n;
        });
      }
    } else {
      await insertNodeRecords(items);
    }
    this.update((n) => {
      n.progress = 100;
      return n;
    });
    function resolveChunks(): (() => Promise<any>)[] {
      const chunks: (() => Promise<any>)[] = [];
      for (let i = 0; i < items.length; i += limitCount) {
        chunks.push(() => insertNodeRecords(items.slice(i, i + limitCount)));
      }
      return chunks;
    }
  }

  async updateSyncStatus(status: SyncStatus, message?: string) {
    this.update((n) => {
      n.status = status;
      n.message = message;
      return n;
    });
    if (status === SyncStatus.SYNCED) {
      this.update((n) => {
        n.lastSyncedAt = new Date().toISOString();
        return n;
      });
      await this.persistSyncStatus(status);
    }
  }

  async refreshSyncState() {
    try {
      const id = this.get().id;
      const result = await extensionDatafn({
        method: DatafnExtensionMethod.SELECT,
        args: {
          resourceId: "kv:clipperSync"
        }
      });
      logger.log({ at: "syncStore refreshSyncState", result, id });
      if (result) {
        const record = result;
        if (record[id]) {
          this.update((n) => {
            n.status = record[id].status;
            n.lastSyncedAt = record[id].updatedAt;
            return n;
          });
        }
      }
    } catch (e) {
      logger.error(e);
    }
  }

  async persistSyncStatus(status: SyncStatus) {
    try {
      const id = this.get().id;
      if (!id) return;
      await extensionDatafn({
        method: DatafnExtensionMethod.KV_MERGE,
        args: {
          resource: Resource.clipperSync,
          data: {
            [id]: {
              status,
              updatedAt: new Date().toISOString()
            }
          }
        }
      });
    } catch (e) {
      logger.error(e);
    }
  }
}

export const syncStore = new SyncStore();
