import type {
  Path,
  PortableTextBlock,
  PortableTextListBlock,
  PortableTextTextBlock,
} from '@sanity/types'
import {PortableTextObject, PortableTextSpan} from '@sanity/types'

/**
 * @public
 */
declare type AnnotationSchemaType = BaseDefinition & {
  fields: ReadonlyArray<FieldDefinition>
}

/**
 * @public
 */
declare type BaseDefinition = {
  name: string
  title?: string
}

/**
 * @public
 */
declare type BlockObjectSchemaType = BaseDefinition & {
  fields: ReadonlyArray<FieldDefinition>
}

/**
 * @beta
 */
declare type BlockOffset = {
  path: BlockPath
  offset: number
}

/**
 * @public
 */
declare type BlockPath = [
  {
    _key: string
  },
]

/**
 * @public
 */
declare type ChildPath = [
  {
    _key: string
  },
  'children',
  {
    _key: string
  },
]

declare type Converter<TMIMEType extends MIMEType = MIMEType> = {
  mimeType: TMIMEType
  serialize: Serializer<TMIMEType>
  deserialize: Deserializer<TMIMEType>
}

declare type ConverterEvent<TMIMEType extends MIMEType = MIMEType> =
  | {
      type: 'serialize'
      originEvent: 'clipboard.copy' | 'clipboard.cut' | 'drag.dragstart'
    }
  | {
      type: 'serialization.failure'
      mimeType: TMIMEType
      originEvent: 'clipboard.copy' | 'clipboard.cut' | 'drag.dragstart'
      reason: string
    }
  | {
      type: 'serialization.success'
      data: string
      mimeType: TMIMEType
      originEvent: 'clipboard.copy' | 'clipboard.cut' | 'drag.dragstart'
    }
  | {
      type: 'deserialize'
      data: string
    }
  | {
      type: 'deserialization.failure'
      mimeType: TMIMEType
      reason: string
    }
  | {
      type: 'deserialization.success'
      data: Array<PortableTextBlock>
      mimeType: TMIMEType
    }

/**
 * @public
 */
declare type DecoratorSchemaType = BaseDefinition & {
  /**
   * @deprecated
   * Use `name` instead
   */
  value: string
}

declare type Deserializer<TMIMEType extends MIMEType> = ({
  snapshot,
  event,
}: {
  snapshot: EditorSnapshot
  event: PickFromUnion<ConverterEvent<TMIMEType>, 'type', 'deserialize'>
}) => PickFromUnion<
  ConverterEvent<TMIMEType>,
  'type',
  'deserialization.success' | 'deserialization.failure'
>

/**
 * @public
 */
declare type EditorContext = {
  converters: Array<Converter>
  keyGenerator: () => string
  readOnly: boolean
  schema: EditorSchema
  selection: EditorSelection
  value: Array<PortableTextBlock>
}

/**
 * @public
 */
declare type EditorSchema = {
  annotations: ReadonlyArray<AnnotationSchemaType>
  block: {
    name: string
  }
  blockObjects: ReadonlyArray<BlockObjectSchemaType>
  decorators: ReadonlyArray<DecoratorSchemaType>
  inlineObjects: ReadonlyArray<InlineObjectSchemaType>
  span: {
    name: string
  }
  styles: ReadonlyArray<StyleSchemaType>
  lists: ReadonlyArray<ListSchemaType>
}

/** @public */
declare type EditorSelection = {
  anchor: EditorSelectionPoint
  focus: EditorSelectionPoint
  backward?: boolean
} | null

/** @public */
declare type EditorSelectionPoint = {
  path: Path
  offset: number
}

/**
 * @public
 */
declare type EditorSelector<TSelected> = (snapshot: EditorSnapshot) => TSelected

/**
 * @public
 */
declare type EditorSnapshot = {
  context: EditorContext
  blockIndexMap: Map<string, number>
  /**
   * @beta
   * Subject to change
   */
  decoratorState: Record<string, boolean | undefined>
}

/**
 * @public
 */
declare type FieldDefinition = BaseDefinition & {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
}

/**
 * @public
 */
export declare const getActiveAnnotations: EditorSelector<
  Array<PortableTextObject>
>

/**
 * @public
 */
export declare const getActiveListItem: EditorSelector<
  PortableTextListBlock['listItem'] | undefined
>

/**
 * @public
 */
export declare const getActiveStyle: EditorSelector<
  PortableTextTextBlock['style']
>

/**
 * @public
 */
export declare const getAnchorBlock: EditorSelector<
  | {
      node: PortableTextBlock
      path: BlockPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getAnchorChild: EditorSelector<
  | {
      node: PortableTextObject | PortableTextSpan
      path: ChildPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getAnchorSpan: EditorSelector<
  | {
      node: PortableTextSpan
      path: ChildPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getAnchorTextBlock: EditorSelector<
  | {
      node: PortableTextTextBlock
      path: BlockPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getBlockOffsets: EditorSelector<
  | {
      start: BlockOffset
      end: BlockOffset
    }
  | undefined
>

/**
 * @public
 */
export declare const getBlockTextBefore: EditorSelector<string>

/**
 * @public
 * Returns the selection of the of the word the caret is placed in.
 * Note: Only returns a word selection if the current selection is collapsed
 */
export declare const getCaretWordSelection: EditorSelector<EditorSelection>

/**
 * @public
 */
export declare const getFirstBlock: EditorSelector<
  | {
      node: PortableTextBlock
      path: BlockPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getFocusBlock: EditorSelector<
  | {
      node: PortableTextBlock
      path: BlockPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getFocusBlockObject: EditorSelector<
  | {
      node: PortableTextObject
      path: BlockPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getFocusChild: EditorSelector<
  | {
      node: PortableTextObject | PortableTextSpan
      path: ChildPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getFocusInlineObject: EditorSelector<
  | {
      node: PortableTextObject
      path: ChildPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getFocusListBlock: EditorSelector<
  | {
      node: PortableTextListBlock
      path: BlockPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getFocusSpan: EditorSelector<
  | {
      node: PortableTextSpan
      path: ChildPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getFocusTextBlock: EditorSelector<
  | {
      node: PortableTextTextBlock
      path: BlockPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getLastBlock: EditorSelector<
  | {
      node: PortableTextBlock
      path: BlockPath
    }
  | undefined
>

/**
 * @beta
 * @deprecated Use the precomputed `data-list-index` on text blocks instead.
 * Given the `path` of a block, this selector will return the "list index" of
 * the block.
 */
export declare function getListIndex({
  path,
}: {
  path: BlockPath
}): EditorSelector<number | undefined>

/**
 * @public
 */
export declare const getNextBlock: EditorSelector<
  | {
      node: PortableTextBlock
      path: BlockPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getNextInlineObject: EditorSelector<
  | {
      node: PortableTextObject
      path: ChildPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getPreviousBlock: EditorSelector<
  | {
      node: PortableTextBlock
      path: BlockPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getPreviousInlineObject: EditorSelector<
  | {
      node: PortableTextObject
      path: ChildPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getSelectedBlocks: EditorSelector<
  Array<{
    node: PortableTextBlock
    path: BlockPath
  }>
>

/**
 * @public
 * @deprecated Renamed to `getSelectedValue`.
 */
export declare const getSelectedSlice: EditorSelector<Array<PortableTextBlock>>

/**
 * @public
 */
export declare const getSelectedSpans: EditorSelector<
  Array<{
    node: PortableTextSpan
    path: ChildPath
  }>
>

/**
 * @public
 */
export declare const getSelectedTextBlocks: EditorSelector<
  Array<{
    node: PortableTextTextBlock
    path: BlockPath
  }>
>

/**
 * @public
 */
export declare const getSelectedValue: EditorSelector<Array<PortableTextBlock>>

/**
 * @public
 */
declare const getSelection_2: EditorSelector<EditorSelection>
export {getSelection_2 as getSelection}

/**
 * @public
 */
export declare const getSelectionEndBlock: EditorSelector<
  | {
      node: PortableTextBlock
      path: BlockPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getSelectionEndChild: EditorSelector<
  | {
      node: PortableTextSpan | PortableTextObject
      path: ChildPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getSelectionEndPoint: EditorSelector<
  EditorSelectionPoint | undefined
>

/**
 * @public
 */
export declare const getSelectionStartBlock: EditorSelector<
  | {
      node: PortableTextBlock
      path: BlockPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getSelectionStartChild: EditorSelector<
  | {
      node: PortableTextSpan | PortableTextObject
      path: ChildPath
    }
  | undefined
>

/**
 * @public
 */
export declare const getSelectionStartPoint: EditorSelector<
  EditorSelectionPoint | undefined
>

/**
 * @public
 */
export declare const getSelectionText: EditorSelector<string>

/**
 * @public
 */
export declare const getTrimmedSelection: EditorSelector<EditorSelection>

/**
 * @public
 */
export declare const getValue: EditorSelector<Array<PortableTextBlock>>

/**
 * @public
 */
declare type InlineObjectSchemaType = BaseDefinition & {
  fields: ReadonlyArray<FieldDefinition>
}

/**
 * @public
 */
export declare function isActiveAnnotation(
  annotation: string,
): EditorSelector<boolean>

/**
 * @public
 */
export declare function isActiveDecorator(
  decorator: string,
): EditorSelector<boolean>

/**
 * @public
 */
export declare function isActiveListItem(
  listItem: string,
): EditorSelector<boolean>

/**
 * @public
 */
export declare function isActiveStyle(style: string): EditorSelector<boolean>

/**
 * @public
 */
export declare function isAtTheEndOfBlock(block: {
  node: PortableTextBlock
  path: BlockPath
}): EditorSelector<boolean>

/**
 * @public
 */
export declare function isAtTheStartOfBlock(block: {
  node: PortableTextBlock
  path: BlockPath
}): EditorSelector<boolean>

/**
 * @public
 */
export declare function isOverlappingSelection(
  selection: EditorSelection,
): EditorSelector<boolean>

/**
 * @public
 */
export declare function isPointAfterSelection(
  point: EditorSelectionPoint,
): EditorSelector<boolean>

/**
 * @public
 */
export declare function isPointBeforeSelection(
  point: EditorSelectionPoint,
): EditorSelector<boolean>

/**
 * @public
 */
export declare const isSelectingEntireBlocks: EditorSelector<boolean>

/**
 * @public
 */
export declare const isSelectionCollapsed: EditorSelector<boolean>

/**
 * @public
 */
export declare const isSelectionExpanded: EditorSelector<boolean>

/**
 * @public
 */
declare type ListSchemaType = BaseDefinition & {
  /**
   * @deprecated
   * Use `name` instead
   */
  value: string
}

declare type MIMEType = `${string}/${string}`

/**
 * @internal
 */
declare type PickFromUnion<
  TUnion,
  TTagKey extends keyof TUnion,
  TPickedTags extends TUnion[TTagKey],
> = TUnion extends Record<TTagKey, TPickedTags> ? TUnion : never

declare type Serializer<TMIMEType extends MIMEType> = ({
  snapshot,
  event,
}: {
  snapshot: EditorSnapshot
  event: PickFromUnion<ConverterEvent<TMIMEType>, 'type', 'serialize'>
}) => PickFromUnion<
  ConverterEvent<TMIMEType>,
  'type',
  'serialization.success' | 'serialization.failure'
>

/**
 * @public
 */
declare type StyleSchemaType = BaseDefinition & {
  /**
   * @deprecated
   * Use `name` instead
   */
  value: string
}

export {}
