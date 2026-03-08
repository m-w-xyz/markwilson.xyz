import type {
  KeyedSegment,
  Path,
  PortableTextBlock,
  PortableTextChild,
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
export declare function blockOffsetsToSelection({
  context,
  offsets,
  backward,
}: {
  context: Pick<EditorContext, 'schema' | 'value'>
  offsets: {
    anchor: BlockOffset
    focus: BlockOffset
  }
  backward?: boolean
}): EditorSelection

/**
 * @public
 */
export declare function blockOffsetToBlockSelectionPoint({
  context,
  blockOffset,
}: {
  context: Pick<EditorContext, 'value'>
  blockOffset: BlockOffset
}): EditorSelectionPoint | undefined

/**
 * @public
 */
export declare function blockOffsetToSelectionPoint({
  context,
  blockOffset,
  direction,
}: {
  context: Pick<EditorContext, 'schema' | 'value'>
  blockOffset: BlockOffset
  direction: 'forward' | 'backward'
}): EditorSelectionPoint | undefined

/**
 * @public
 */
export declare function blockOffsetToSpanSelectionPoint({
  context,
  blockOffset,
  direction,
}: {
  context: Pick<EditorContext, 'schema' | 'value'>
  blockOffset: BlockOffset
  direction: 'forward' | 'backward'
}):
  | {
      path: ChildPath
      offset: number
    }
  | undefined

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

/**
 * @public
 */
export declare function childSelectionPointToBlockOffset({
  context,
  selectionPoint,
}: {
  context: Pick<EditorContext, 'schema' | 'value'>
  selectionPoint: EditorSelectionPoint
}): BlockOffset | undefined

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
export declare function getBlockEndPoint({
  context,
  block,
}: {
  context: Pick<EditorContext, 'schema'>
  block: {
    node: PortableTextBlock
    path: BlockPath
  }
}): EditorSelectionPoint

/**
 * @public
 */
export declare function getBlockStartPoint({
  context,
  block,
}: {
  context: Pick<EditorContext, 'schema'>
  block: {
    node: PortableTextBlock
    path: BlockPath
  }
}): EditorSelectionPoint

/**
 * @public
 */
export declare function getSelectionEndPoint<
  TEditorSelection extends NonNullable<EditorSelection> | null,
  TEditorSelectionPoint extends
    EditorSelectionPoint | null = TEditorSelection extends NonNullable<EditorSelection>
    ? EditorSelectionPoint
    : null,
>(selection: TEditorSelection): TEditorSelectionPoint

/**
 * @public
 */
export declare function getSelectionStartPoint<
  TEditorSelection extends NonNullable<EditorSelection> | null,
  TEditorSelectionPoint extends
    EditorSelectionPoint | null = TEditorSelection extends NonNullable<EditorSelection>
    ? EditorSelectionPoint
    : null,
>(selection: TEditorSelection): TEditorSelectionPoint

/**
 * @public
 */
export declare function getTextBlockText(block: PortableTextTextBlock): string

/**
 * @public
 */
declare type InlineObjectSchemaType = BaseDefinition & {
  fields: ReadonlyArray<FieldDefinition>
}

/**
 * @public
 */
export declare function isEmptyTextBlock(
  context: Pick<EditorContext, 'schema'>,
  block: PortableTextBlock,
): boolean

/**
 * @public
 */
export declare function isEqualSelectionPoints(
  a: EditorSelectionPoint,
  b: EditorSelectionPoint,
): boolean

/**
 * @public
 */
export declare function isEqualSelections(
  a: EditorSelection,
  b: EditorSelection,
): boolean

/**
 * @public
 */
export declare function isKeyedSegment(
  segment: unknown,
): segment is KeyedSegment

/**
 * @public
 */
export declare function isSelectionCollapsed(
  selection: EditorSelection,
): boolean

/**
 * @public
 */
export declare function isSpan(
  context: Pick<EditorContext, 'schema'>,
  child: PortableTextChild,
): child is PortableTextSpan

/**
 * @public
 */
export declare function isTextBlock(
  context: Pick<EditorContext, 'schema'>,
  block: unknown,
): block is PortableTextTextBlock

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

/**
 * @beta
 */
export declare function mergeTextBlocks({
  context,
  targetBlock,
  incomingBlock,
}: {
  context: Pick<EditorContext, 'keyGenerator' | 'schema'>
  targetBlock: PortableTextTextBlock
  incomingBlock: PortableTextTextBlock
}): PortableTextTextBlock<PortableTextObject | PortableTextSpan>

declare type MIMEType = `${string}/${string}`

/**
 * @internal
 */
declare type PickFromUnion<
  TUnion,
  TTagKey extends keyof TUnion,
  TPickedTags extends TUnion[TTagKey],
> = TUnion extends Record<TTagKey, TPickedTags> ? TUnion : never

/**
 * @public
 */
export declare function reverseSelection<
  TEditorSelection extends NonNullable<EditorSelection> | null,
>(selection: TEditorSelection): TEditorSelection

/**
 * @public
 */
export declare function selectionPointToBlockOffset({
  context,
  selectionPoint,
}: {
  context: Pick<EditorContext, 'schema' | 'value'>
  selectionPoint: EditorSelectionPoint
}): BlockOffset | undefined

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
export declare function sliceBlocks({
  context,
  blocks,
}: {
  context: Pick<EditorContext, 'schema' | 'selection'>
  blocks: Array<PortableTextBlock>
}): Array<PortableTextBlock>

/**
 * @public
 */
export declare function spanSelectionPointToBlockOffset({
  context,
  selectionPoint,
}: {
  context: Pick<EditorContext, 'schema' | 'value'>
  selectionPoint: EditorSelectionPoint
}): BlockOffset | undefined

/**
 * @beta
 */
export declare function splitTextBlock({
  context,
  block,
  point,
}: {
  context: Pick<EditorContext, 'schema'>
  block: PortableTextTextBlock
  point: EditorSelectionPoint
}):
  | {
      before: PortableTextTextBlock
      after: PortableTextTextBlock
    }
  | undefined

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
