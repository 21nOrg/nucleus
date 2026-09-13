<script lang="ts">
  import { fileUpload } from "@nucleum/stores/files/file-upload";

  import { onDestroy, onMount } from "svelte";

  import MediaGridOptions from "@nucleum/features/memory/markdown/mediaGrid/MediaGridOptions.svelte";
  import type { Config } from "@nucleum/features/memory/markdown/mediaGrid/mediaGrid.type";
  import { dragAndDropStore } from "@nucleum/stores/app.store";
  import { DragStatus } from "@nucleum/actions/dragstatus.enum";
  import DraggableMediaGridElement from "@nucleum/features/memory/markdown/mediaGrid/DraggableMediaGridElement.svelte";
  import type { DragAndDrop } from "@nucleum/actions/draganddrop.type";

  import {
    isReplaceableMd,
    type MdStoreType
  } from "@nucleum/features/memory/markdown/markdown.store";
  import {
    MediaGridType,
    type IMediaGridItem,
    type IMediaGridNode
  } from "@nucleum/features/memory/node/node.type";
  import { generateSimpleRandomId } from "@21n/shared-utils/crypto.utils";
  import type { IFile } from "@nucleum/stores/files/file.type";
  import { isSameResource } from "@nucleum/datafn/resource.utils";
  import { cn } from "@21n/utils/ui.utils";
  import { debouncer } from "@21n/utils/utils";
  import { datafn } from "@nucleum/datafn/datafn.store";
  let {
    block,
    mdStore,
    files: initialFiles = [],
    onDelete = undefined,
    onInsert = undefined,
    onUpdate = undefined
  }: {
    block: IMediaGridNode;
    mdStore: MdStoreType;
    files?: IFile[];
    onDelete?: ((event?: CustomEvent<{ id: string }>) => void) | undefined;
    onInsert?:
      | ((event: CustomEvent<{ insertedAt: string; id: string }>) => void)
      | undefined;
    onUpdate?:
      ((event: CustomEvent<IMediaGridNode["body"]>) => void) | undefined;
  } = $props();
  let files = $state<IFile[]>(initialFiles);
  let isUploadInProgress = $state(false);

  function resolveInitialBody(body: IMediaGridNode["body"] | undefined) {
    return {
      items: Array.isArray(body?.items) ? body.items : [],
      type: body?.type ?? MediaGridType.AUTO,
      gap: body?.gap ?? 0,
      altText: body?.altText ?? "media grid",
      noOfColumns: body?.noOfColumns ?? 1,
      isWideLayout: body?.isWideLayout ?? false
    };
  }

  const initialBody = resolveInitialBody(block.body);
  let items = $state<IMediaGridItem[]>(initialBody.items);

  let config = $state<Config>({
    isWideLayout: initialBody.isWideLayout,
    gap: initialBody.gap,
    altText: initialBody.altText,
    type: initialBody.type,
    noOfColumns: initialBody.noOfColumns,
    isHovered: false,
    isAutoHighlighted: false,
    isColumnHighlighted: Array(1).fill(false),
    columns: [],
    lastColumn: undefined,
    isGapSliderEnabled: false,
    leastItemsInAColumn: 3,
    gridWidth: 740
  });

  function emitUpdate(body: IMediaGridNode["body"]) {
    const updateEvent = new CustomEvent<IMediaGridNode["body"]>("update", {
      detail: body
    });
    onUpdate?.(updateEvent);
  }

  const debouncedEmitUpdate = debouncer(
    (body: IMediaGridNode["body"]) => emitUpdate(body),
    0
  );

  $effect(() => {
    debouncedEmitUpdate({
      items: $state.snapshot(items),
      isWideLayout: config.isWideLayout,
      gap: config.gap,
      altText: config.altText,
      type: config.type,
      noOfColumns: config.noOfColumns
    });
  });

  let isDragging = $state(false);
  let typeURLFocused = $state(false);
  /**
   * To store the length of each column, used to sort items on chev up and down
   * @type {number[]}
   */
  let columnArray = $state<number[]>([]);
  let columnsGrid = $state<HTMLButtonElement[]>([]);
  $effect(() => {
    config.columns = Array(config.noOfColumns).fill("");
  });
  let autoGrid: HTMLButtonElement;
  let autoGridNewItemIndex: number = 0;
  let dropHereHeight: number = 10;
  let autoItems = $state<any[]>([]);
  let unSubdragAndDropStore: () => void = () => {};

  function emitInsert(insertedAt: string, insertedId: string) {
    const insertEvent = new CustomEvent<{ insertedAt: string; id: string }>(
      "insert",
      {
        detail: {
          insertedAt,
          id: insertedId
        }
      }
    );
    onInsert?.(insertEvent);
  }

  function emitDelete() {
    const deleteEvent = new CustomEvent<{ id: string }>("delete", {
      detail: { id: block.id }
    });
    onDelete?.(deleteEvent);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key == "Enter" && block.id) {
      const newBlockId = mdStore.insert({ source: block.id });
      emitInsert(block.id, newBlockId);
    }
  }
  /**
   * handleNewImageLoad is used to rezie the images in the media grid whenever a new image is uploaded or dropped and also when spacing and layout changes changes.
   * Since the height of the grid container is 370px we set the intial height of each image as 360px to start with.
   * We set 360px at each call even for the already exisiting images else the old images height will become lesser and lesser for every new item added.
   * Note: The index parameter is useful when we plan to resize the column mode height too.
   * @param index
   */
  function handleNewImageLoad(index: number | undefined = undefined) {
    if (index == undefined) {
      if (autoItems.length > 1) {
        let i =
          autoItems.length - 1 == autoGridNewItemIndex
            ? autoItems.length - 2
            : autoItems.length - 1;
        if (
          autoItems[autoGridNewItemIndex] &&
          autoItems[autoGridNewItemIndex].style
        ) {
          autoItems[autoGridNewItemIndex].style.height =
            `${autoItems[i]?.clientHeight}px`;
          dropHereHeight = autoItems[i]?.clientHeight;
        }
      }
      autoItems.forEach((item) => {
        if (item && item.style) item.style.height = `360px`;
      });
      while (autoGrid.scrollHeight > autoGrid.clientHeight) {
        autoItems.forEach((item) => {
          if (item && item.style) {
            item.style.height = `${item.clientHeight - 10}px`;
            dropHereHeight = item.clientHeight;
          }
        });
      }
    } else {
      if (columnsGrid[index] == null) {
        return;
      }
      let columnChilds = Array.from(
        columnsGrid[index].children
      ) as HTMLElement[];
      let columnHeight = columnsGrid[index].clientHeight;
      let itemHeight =
        (columnHeight - columnChilds.length * config.gap) / columnChilds.length;
      columnChilds.forEach((item) => {
        item.style.height = `${itemHeight}px`;
      });
    }
  }
  function accomodateDropHere(columnNo: number) {
    if (columnsGrid[columnNo] == null) {
      return;
    }
    let columnChilds = Array.from(
      columnsGrid[columnNo].children
    ) as HTMLElement[];
    let columnHeight = columnsGrid[columnNo].clientHeight;
    let itemHeight =
      (columnHeight - columnChilds.length * config.gap) / columnChilds.length +
      1;
    columnChilds.forEach((item) => {
      item.style.height = `${itemHeight}px`;
    });
    dropHereHeight = itemHeight;
  }
  function ResizeImageForAllColumns() {
    for (let i = 0; i < columnsGrid.length; i++) {
      handleNewImageLoad(i);
    }
  }

  /**
   * Used to show "Drop Here" feedback when a item is dragged into an empty column or grid.
   * Invoked on DragEnter
   * @param e
   * @param index
   */
  function highlight(e: Event, index?: number | undefined) {
    preventDefault(e);
    if (isDragging) return;
    if (index !== undefined) {
      config.isColumnHighlighted[index] = true;
    } else config.isAutoHighlighted = true;
  }
  /**
   * Used to remove "Drop Here" feedback when a item is dropped or moved away from an empty column or grid.
   * Invoked on DragLeave
   * @param e
   * @param index
   */
  function unhighlight(e: any, index?: number | undefined) {
    preventDefault(e);
    if (isDragging) return;
    if (index !== undefined) {
      if (!columnsGrid[index].contains(e.relatedTarget)) {
        config.isColumnHighlighted[index] = false;
      }
    } else if (!autoGrid.contains(e.relatedTarget)) {
      config.isAutoHighlighted = false;
    }
  }
  /**
   * Used to prevent the default behaviour when an item is dropped inside an element.
   * The default behaviour is to open the image in a new tab.
   * @param e
   */
  function preventDefault(e: any) {
    e.preventDefault();
    e.stopPropagation();
  }
  /**
   * Sorting the items to display them in the proper order when the mode changes.
   * @param type
   */
  function sortItems(type: MediaGridType.AUTO | MediaGridType.COLUMNS) {
    if (items.length == 0) return;
    if (type === MediaGridType.AUTO)
      items?.sort((a, b) => a.position.auto - b.position.auto);
    else if (type === MediaGridType.COLUMNS)
      items?.sort(
        (a, b) => a.position.columns.index - b.position.columns.index
      );
    items = items;
  }
  /**
   * Used to upload a file to s#
   * @param input the file that needs to be uploaded to the S3
   * @returns {string} S3Url where the file is available
   *
   */
  async function uploadToS3(input: any) {
    let itemLocalURL = new Blob([input], { type: input.type });
    let customName = input.name.split(".")[0].trim();
    let response = await fileUpload.uploadFileV2(
      input.type,
      customName,
      itemLocalURL,
      {
        isTemp: $isReplaceableMd
      }
    );
    return response[0];
  }

  /**
   * Used to update the columnArray whenever a new image is added in column mode
   * @param {number} columnNo
   */
  function updateColumnArray(columnNo: number) {
    if (!columnArray[columnNo]) {
      columnArray[columnNo] = 1;
      config.noOfColumns = columnArray.length;
    } else {
      columnArray[columnNo]++;
    }
  }
  /**
   * Used to create the columnArray when the mediaGrid is mounted and also to recreate when an column is removed during drag operation
   */
  function calculateColumnArray() {
    if (items.length == 0) return;
    items.forEach((item) => {
      const columnNo = item.position.columns.columnNo;
      updateColumnArray(columnNo);
    });
  }

  function swapAutoIndex(
    id1: string,
    index1: number,
    id2: string,
    index2: number
  ) {
    // let id=id1;
    let item = items.find((item) => item.id == id1);
    if (item) item.position.auto = index2;
    item = items.find((item) => item.id == id2);
    if (item) item.position.auto = index1;
  }

  /**
   * Used to move an item positioned at column:columnNo and index:index to another position
   * @param columnNo
   * @param index
   * @param insertAtColumnNo
   * @param insertAtIndex
   */
  function updateColumnIndex(
    columnNo: number,
    index: number,
    insertAtColumnNo: number,
    insertAtIndex: number
  ) {
    let itemIndex = items.findIndex(
      (item) =>
        item.position.columns.columnNo === columnNo &&
        item.position.columns.index === index
    );
    if (itemIndex < 0) {
      return;
    }
    items[itemIndex].position.columns.columnNo = insertAtColumnNo;
    items[itemIndex].position.columns.index = insertAtIndex;
    updateColumnArray(insertAtColumnNo);
  }

  /**
   * Used to distibute items to newly created column.
   * Inovked when chevUp is clicked in column mode
   * Gets the column having the highest number of items and distributes it to the newly created column, this process continous until the newly created column acquires leastItems as defined or when there is no column having items more than 1.
   */
  function chevUp() {
    if (!isAnyColumnGreaterThanTarget(1)) {
      alert(
        "Items cannot be further distributed,since all columns have only one item.For an new empty column use + button instead."
      );
      return;
    }
    if (config.noOfColumns == columnArray.length) config.noOfColumns += 1;
    updateLeastItemsInAColumn();
    let index = 0;
    for (; index < config.leastItemsInAColumn; index++) {
      let maxColumn = columnArray.indexOf(Math.max(...columnArray));
      let lastItem = columnArray[maxColumn];
      if (lastItem == 1 || maxColumn == config.noOfColumns - 1) break;
      updateColumnIndex(maxColumn, lastItem - 1, config.noOfColumns - 1, index);
      columnArray[maxColumn] -= 1;
      sortItems(MediaGridType.COLUMNS);
    }
  }
  /**
   * Used to remove items from the last column and distribute it the previous columns.
   * Inovked when chevDown is clicked in column mode.
   * Gets the number of items in the last column and distributes it to the previous columns based on columns having the least items.
   */
  function chevDown() {
    if (config.noOfColumns == 1) {
      alert(
        "columns cannot be lesser than one, switch to Auto mode for columnless view"
      );
      return;
    }
    config.noOfColumns -= 1;
    if (columnArray[config.noOfColumns] == undefined) {
      return;
    }
    let lastColumn = columnArray.length - 1;
    let index = columnArray[lastColumn] - 1;
    columnArray.pop();
    for (; index >= 0; index--) {
      let minColumn = columnArray.indexOf(Math.min(...columnArray));
      let lastItem = columnArray[minColumn];
      // if (lastItem == 1) break;
      updateColumnIndex(config.noOfColumns, index, minColumn, lastItem);
      sortItems(MediaGridType.COLUMNS);
    }
  }
  function isAnyColumnLesserThanTarget(target: number) {
    for (let i = 0; i < columnArray.length; i++) {
      if (columnArray[i] < target) {
        return true;
      }
    }
    return false;
  }
  function isAnyColumnGreaterThanTarget(target: number) {
    for (let i = 0; i < columnArray.length; i++) {
      if (columnArray[i] > target) {
        return true;
      }
    }
    return false;
  }
  function isValidUrl(url: string) {
    const pattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w.-]*)*\/?$/;
    return pattern.test(url);
  }
  function handleKeyDownInTypeURL(e: KeyboardEvent) {
    if (e.key === "Enter") {
      let URL = (e.target as HTMLInputElement).value;
      //TODO-research how to get the file type from URL and then enable saving & correpsonding enable GridOption
      // if (isValidUrl(URL)) {
      //   handleFileUpload({ e: { URL: URL, fileType: "image/png" } },undefined, -1);
      // }
    }
  }
  /**
   * Used to update the number of items each column can hold.
   * Auto generated column is restricted to six using this.
   */
  function updateLeastItemsInAColumn() {
    if (items.length >= 6 * config.leastItemsInAColumn) {
      config.leastItemsInAColumn = Math.ceil((items.length + 1) / 6);
    }
  }

  /**
   * @returns the columnNo and index where an new item should be placed when uploaded using upload button or dropped in Auto mode
   */
  function getNewItemColumnIndex() {
    updateLeastItemsInAColumn();
    let columHasSpace: boolean = false;
    if (columnArray.length === 0) {
      return [0, 0];
    }
    columHasSpace = isAnyColumnLesserThanTarget(config.leastItemsInAColumn);

    if (!columHasSpace) {
      return [columnArray.length, 0];
    }
    let minIndex = columnArray.indexOf(Math.min(...columnArray));
    if (minIndex < 0) throw new Error(`minIndex can't be found: ${minIndex}`);
    return [minIndex, columnArray[minIndex]];
  }

  /**
   * Used to handle drag & drop from system files, upload through upload button and upload through type URL.
   * if column==-1 the upload is happening through typeURL
   * if both column and auto is undefined file is uploaded using upload button
   * dt.files[0] is true when drag & drop from system files
   * e?.target?.files[0] is true when upload through upload button
   * @param e
   * @param auto
   * @param column
   * @param columnIndex
   */
  async function handleFileUpload(
    e: any,
    auto: number | undefined = undefined,
    column: number | undefined = undefined,
    columnIndex: number | undefined = undefined
  ) {
    preventDefault(e);
    isUploadInProgress = true;
    let columnNo: number, index: number;
    if (
      column == undefined ||
      column == -1 ||
      config.type == MediaGridType.AUTO
    ) {
      config.isAutoHighlighted = false;
      [columnNo, index] = getNewItemColumnIndex();
    } else {
      columnNo = column;
      config.isColumnHighlighted[columnNo] = false;
      if (columnIndex != undefined) index = columnIndex;
      else if (columnArray[columnNo]) index = columnArray[columnNo];
      else index = 0;
    }
    let dt = e?.dataTransfer;
    let file;
    let fileRecord: IFile;
    if (column == -1) fileRecord = e.URL;
    else {
      /**
       * "else return" is in cases where the item is dragged and dropped in an empty space
       */
      if (dt?.files[0]) file = dt.files[0];
      else if (e?.target?.files[0]) file = e.target.files[0];
      else {
        isUploadInProgress = false;
        return;
      }
      fileRecord = await uploadToS3(file);
    }
    console.log("fileRecord", fileRecord);
    let item: IMediaGridItem = {
      id: generateSimpleRandomId(),
      file: fileRecord.id,
      position: {
        auto: auto != undefined ? auto : items.length,
        columns: {
          index: index,
          columnNo: columnNo
        }
      }
    };
    items = [...items, item];
    files = [...files, fileRecord];
    autoGridNewItemIndex = item.position.auto;
    /**
     * setTimeout is used to avoid showing duplicate image until the the new image is loaded increase or decrese the timeout based on loading time taken in production.
     */
    setTimeout(() => {
      if (auto != undefined && auto >= 0)
        onReverseMove(MediaGridType.AUTO, items.length, auto, item.id);
      if (config.type == MediaGridType.COLUMNS) {
        if (columnIndex != undefined && columnIndex >= 0)
          onReverseMove(
            MediaGridType.COLUMNS,
            -1,
            columnIndex,
            item.id,
            columnNo
          );
      }
      if (config.type == MediaGridType.AUTO) sortItems(MediaGridType.AUTO);
      else sortItems(MediaGridType.COLUMNS);
      updateColumnArray(columnNo);
    }, 3000);
    isUploadInProgress = false;
  }
  /**
   * Used whenever an item need to be moved in reverse direction, either from right to left in auto mode or bottom to top in column mode.
   * One key thing that ReverseMove differs from ForwardMove is, drop from another column or drop from system file can also be assumed as ReverseMove & utilized
   * Baiscally increases the item index for all items following the newly inserted item.
   * if dragItemIndex is -1, it means, the drop column is different and hence there is no upper limit until condition
   * @param type
   * @param dragItemIndex
   * @param dropItemIndex
   * @param id
   * @param dropItemColumn
   */
  function onReverseMove(
    type: MediaGridType.AUTO | MediaGridType.COLUMNS,
    dragItemIndex: number,
    dropItemIndex: number,
    id: string | undefined = undefined,
    dropItemColumn: number | undefined = undefined
  ) {
    items.forEach((item) => {
      if (type == MediaGridType.COLUMNS) {
        if (item.position.columns.columnNo == dropItemColumn)
          if (dragItemIndex == -1) {
            if (
              item.position.columns.index >= dropItemIndex &&
              (id == undefined || id != item.id)
            ) {
              item.position.columns.index += 1;
            }
          } else {
            if (
              item.position.columns.index >= dropItemIndex &&
              item.position.columns.index < dragItemIndex &&
              (id == undefined || id != item.id)
            ) {
              item.position.columns.index += 1;
            }
          }
      } else {
        if (
          item.position.auto >= dropItemIndex &&
          item.position.auto < dragItemIndex &&
          (id == undefined || id != item.id)
        ) {
          item.position.auto += 1;
        }
      }
    });
  }
  /**
   * Used whenever an item need to be moved in forward direction, either from left to right in auto mode or top to bottom in column mode.
   * Baiscally decreases the item index for all items following the newly inserted item.
   * @param type
   * @param dragItemIndex
   * @param dropItemIndex
   * @param id
   * @param dropItemColumn
   */
  function onForwardMove(
    type: MediaGridType.AUTO | MediaGridType.COLUMNS,
    dragItemIndex: number,
    dropItemIndex: number,
    id: string | undefined = undefined,
    dropItemColumn: number | undefined = undefined
  ) {
    items.forEach((item) => {
      if (type == MediaGridType.COLUMNS) {
        if (item.position.columns.columnNo == dropItemColumn)
          if (dragItemIndex == -1) {
            if (
              item.position.columns.index < dropItemIndex &&
              (id == undefined || id != item.id)
            ) {
              item.position.columns.index -= 1;
            }
          } else {
            if (
              item.position.columns.index < dropItemIndex &&
              item.position.columns.index > dragItemIndex &&
              (id == undefined || id != item.id)
            ) {
              item.position.columns.index -= 1;
            }
          }
      } else {
        if (
          item.position.auto < dropItemIndex &&
          item.position.auto > dragItemIndex &&
          (id == undefined || id != item.id)
        ) {
          item.position.auto -= 1;
        }
      }
    });
  }
  /**
   * Used to update columnNo in each item before a column is removed when the item dragged to another column and it is the only item in it's column.
   * @param columnNo
   */
  function updateColumnNumbers(columnNo: number) {
    items.forEach((item) => {
      if (item.position.columns.columnNo > columnNo)
        item.position.columns.columnNo -= 1;
    });
  }
  /**
   * Used to update the columnNo or index depending on whether there are remaining items in the column from which an item is dragged to a another column.
   * Invoked when drag columNo and dropColumnNo differ.
   * @param columnNo
   * @param index
   */
  function downgradeColumn(columnNo: number, index: number) {
    if (columnArray[columnNo] == 1) {
      updateColumnNumbers(columnNo);
      columnArray = [];
      calculateColumnArray();
    } else {
      items.forEach((item) => {
        if (
          item.position.columns.columnNo == columnNo &&
          item.position.columns.index > index
        ) {
          item.position.columns.index -= 1;
        }
      });
      columnArray[columnNo] -= 1;
    }
  }
  /**
   * Used to move the items around in the mediaGrid in both Auto and Column mode.
   * The column Mode logic is branched based on whether drop occurs on same column or different column.
   * The logic for dropIndex == 0 is seperated in both modes because the default logic is assign to drag item index one lesser than or greater than the drop item index
   * @param x
   */
  function handleDragDropStoreChange(x: DragAndDrop) {
    if (x.dragStatus == DragStatus.DROPPED) {
      config.isColumnHighlighted[x.dropItem.position.columns.columnNo] = false;
      let dropItemId = x.dropItem.id;
      let dragItemId = x.dragItem.id;
      if (dragItemId == dropItemId) return;
      if (config.type == MediaGridType.COLUMNS) {
        let dragItem = {
          columnNo: x.dragItem.position.columns.columnNo,
          index: x.dragItem.position.columns.index
        };
        let dropItem = {
          columnNo: x.dropItem.position.columns.columnNo,
          index: x?.forwardDrop
            ? x.dropItem.position.columns.index + 1
            : x.dropItem.position.columns.index
        };
        let dropItemColumnIndex = dropItem.index;
        let dragItemColumnIndex = dragItem.index;
        if (dropItem.columnNo == dragItem.columnNo) {
          if (dropItemColumnIndex == 0) {
            onReverseMove(
              MediaGridType.COLUMNS,
              dragItemColumnIndex,
              dropItemColumnIndex,
              undefined,
              dropItem.columnNo
            );
            x.dragItem.position.columns.index = 0;
          } else {
            if (dragItemColumnIndex < dropItemColumnIndex) {
              onForwardMove(
                MediaGridType.COLUMNS,
                dragItemColumnIndex,
                dropItemColumnIndex,
                undefined,
                dropItem.columnNo
              );
              x.dragItem.position.columns.index = dropItemColumnIndex - 1;
            } else {
              onReverseMove(
                MediaGridType.COLUMNS,
                dragItemColumnIndex,
                dropItemColumnIndex,
                undefined,
                dropItem.columnNo
              );
              x.dragItem.position.columns.index = dropItemColumnIndex;
            }
          }
        } else {
          /**
           * onReverseMove here implicate assumption that the dragItem is the last item in the dropItem Column for the sake of understanding.
           * In truth the dragitem is belonging to a different column that's the case for which the program control is transferred to this else block.
           * Since this block is for handling drop in another column we Call updateColumn(where columnArray also gets updated for the dropColumn) and also call downgradeColumn(where columnArray gets updated for the dragColumn) instead of just updating the dragItemfter reverseMove
           */
          onReverseMove(
            MediaGridType.COLUMNS,
            -1,
            dropItemColumnIndex,
            undefined,
            dropItem.columnNo
          );
          updateColumnIndex(
            dragItem.columnNo,
            dragItem.index,
            dropItem.columnNo,
            dropItem.index
          );
          downgradeColumn(dragItem.columnNo, dragItem.index);
        }
        sortItems(MediaGridType.COLUMNS);
      } else {
        let dragItemAutoIndex;
        let dropItemAutoIndex;
        dragItemAutoIndex = x.dragItem.position.auto;
        dropItemAutoIndex = x.forwardDrop
          ? x.dropItem.position.auto + 1
          : x.dropItem.position.auto;
        if (dropItemAutoIndex == 0) {
          onReverseMove(
            MediaGridType.AUTO,
            dragItemAutoIndex,
            dropItemAutoIndex
          );
          x.dragItem.position.auto = 0;
        } else {
          if (dragItemAutoIndex < dropItemAutoIndex) {
            onForwardMove(
              MediaGridType.AUTO,
              dragItemAutoIndex,
              dropItemAutoIndex
            );
            x.dragItem.position.auto = dropItemAutoIndex - 1;
          } else {
            onReverseMove(
              MediaGridType.AUTO,
              dragItemAutoIndex,
              dropItemAutoIndex
            );
            x.dragItem.position.auto = dropItemAutoIndex;
          }
        }
        sortItems(MediaGridType.AUTO);
        setTimeout(handleNewImageLoad, 1);
      }
      dragAndDropStore.reset();
    }
  }

  function wideOut() {
    config.gridWidth = config.isWideLayout
      ? config.gridWidth * 1.3
      : config.gridWidth;
    if (config.type == MediaGridType.AUTO)
      /**
       * setTimeout is to set a delay for all images to load and scrollHeight to form.
       */
      setTimeout(() => handleNewImageLoad(), 1);
  }
  function handleDelete() {
    mdStore.deleteBlock(block.id);
    emitDelete();
  }

  onMount(async () => {
    if (config.type == MediaGridType.AUTO) sortItems(MediaGridType.AUTO);
    else sortItems(MediaGridType.COLUMNS);
    // if (files.length == 0) await fetchAllFiles();
    calculateColumnArray();
    unSubdragAndDropStore = dragAndDropStore.subscribe(
      handleDragDropStoreChange
    );
    wideOut();
  });
  onDestroy(() => {
    unSubdragAndDropStore();
  });

  async function fetchAllFiles() {
    const fileIds = items.map((item) => item.file);
    const filesResult = await datafn.file.query({
      filters: {
        id: fileIds
      }
    });
    if (filesResult.data.length > 0) files = filesResult.data as IFile[];
  }
</script>

<!-- <div> -->
<button
  onmouseenter={() => (config.isHovered = true)}
  onmouseleave={() => (config.isHovered = false)}
  onkeydown={handleKeyDown}
  class={"relative p-1 border border-brs3 rounded-md flex flex-col gap-1 w-full max-w-full"}
  style="width-:{config.gridWidth}px; height:{config.type == 'AUTO'
    ? '370px'
    : 'auto'}"
>
  {#if config.type === MediaGridType.AUTO}
    <button
      class={cn(
        "relative w-full flex min-h-[280px] flex-1 items-center overflow-auto flex-wrap",
        {
          "justify-center": items.length < 3
        }
      )}
      ondragover={preventDefault}
      ondrop={preventDefault}
      ondragenter={highlight}
      ondragleave={unhighlight}
      bind:this={autoGrid}
    >
      {#if items.length == 0}
        <button
          ondrop={handleFileUpload}
          class={cn(
            "absolute text-fgs3 w-full h-full border border-brs3 border-dashed flex items-center justify-center rounded-md",
            {
              "bg-bgs2": !config.isAutoHighlighted,
              "bg-bgs4": config.isAutoHighlighted
            }
          )}
        >
          <span>Drop and drop media files here</span>
        </button>
      {/if}
      {#each items as item, index}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <DraggableMediaGridElement
          {handleFileUpload}
          isDraggable={true}
          {item}
          file={files.find((f) => isSameResource(f, item.file))}
          id={item.id}
          onLoad={() => handleNewImageLoad()}
          bind:ref={autoItems[index]}
          bind:isDragging
          bind:gap={config.gap}
        />
      {/each}
    </button>
  {:else if config.type === MediaGridType.COLUMNS}
    <div
      class="columnContainer w-full h-auto"
      style="display:flex;gap:{config.gap}px;min-height:370px"
    >
      {#each config.columns as _, index}
        <button
          ondragover={preventDefault}
          ondragenter={(e) => highlight(e, index)}
          ondragleave={(e) => unhighlight(e, index)}
          bind:this={columnsGrid[index]}
          style="position:relative;width:100%;display:flex;flex-direction:column;gap:{config.gap}px;"
        >
          {#if columnArray[index] == undefined}
            <DraggableMediaGridElement
              bind:isDragging
              {handleFileUpload}
              isGridItem={false}
              item={{
                id: generateSimpleRandomId(),
                file: "",
                position: {
                  columns: { columnNo: index, index: 0 },
                  auto: 0
                }
              }}
              id="dummmyDropArea01"
            />
          {/if}
          {#each items as item, i}
            {#if item.position.columns.columnNo === index}
              <DraggableMediaGridElement
                sizeProperty="width"
                {handleFileUpload}
                isDraggable={true}
                {item}
                file={files.find((f) => f.id === item.file)}
                id={item.id}
                bind:isDragging
              />
            {/if}
          {/each}
        </button>
      {/each}
    </div>
  {/if}
  {#if !$mdStore.params?.isReadOnly}
    <MediaGridOptions
      {chevDown}
      {chevUp}
      {handleFileUpload}
      {handleNewImageLoad}
      {sortItems}
      {isUploadInProgress}
      bind:config
      {columnArray}
      onDelete={handleDelete}
    />
  {/if}
</button>
