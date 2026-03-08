import type {Patch} from '@portabletext/patches'
import type {
  Path,
  PortableTextBlock,
  PortableTextChild,
  PortableTextObject,
  PortableTextTextBlock,
} from '@sanity/types'
import type {FocusEvent as FocusEvent_2} from 'react'
import {JSX, default as React_2} from 'react'
import type {ActorRef, EventObject, Snapshot} from 'xstate'

declare type AbstractBehaviorEvent =
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'annotation.set'>
      at: AnnotationPath
      props: Record<string, unknown>
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'annotation.toggle'>
      annotation: {
        name: string
        value: {
          [prop: string]: unknown
        }
      }
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'decorator.toggle'>
      decorator: string
      at?: {
        anchor: BlockOffset
        focus: BlockOffset
      }
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'delete.backward'>
      unit: 'character' | 'word' | 'line' | 'block'
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'delete.block'>
      at: BlockPath
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'delete.child'>
      at: ChildPath
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'delete.forward'>
      unit: 'character' | 'word' | 'line' | 'block'
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'delete.text'>
      at: {
        anchor: BlockOffset
        focus: BlockOffset
      }
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'deserialize'>
      originEvent:
        | PickFromUnion<
            NativeBehaviorEvent,
            'type',
            'drag.drop' | 'clipboard.paste'
          >
        | InputBehaviorEvent
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'serialize'>
      originEvent: PickFromUnion<
        NativeBehaviorEvent,
        'type',
        'clipboard.copy' | 'clipboard.cut' | 'drag.dragstart'
      >
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'deserialization.success'>
      mimeType: MIMEType
      data: Array<PortableTextBlock>
      originEvent:
        | PickFromUnion<
            NativeBehaviorEvent,
            'type',
            'drag.drop' | 'clipboard.paste'
          >
        | InputBehaviorEvent
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'deserialization.failure'>
      mimeType: MIMEType
      reason: string
      originEvent:
        | PickFromUnion<
            NativeBehaviorEvent,
            'type',
            'drag.drop' | 'clipboard.paste'
          >
        | InputBehaviorEvent
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'serialization.success'>
      mimeType: MIMEType
      data: string
      originEvent: PickFromUnion<
        NativeBehaviorEvent,
        'type',
        'clipboard.copy' | 'clipboard.cut' | 'drag.dragstart'
      >
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'serialization.failure'>
      mimeType: MIMEType
      reason: string
      originEvent: PickFromUnion<
        NativeBehaviorEvent,
        'type',
        'clipboard.copy' | 'clipboard.cut' | 'drag.dragstart'
      >
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'insert.blocks'>
      blocks: Array<BlockWithOptionalKey>
      placement: InsertPlacement
      select?: 'start' | 'end' | 'none'
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'insert.break'>
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'insert.soft break'>
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'list item.add'>
      listItem: string
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'list item.remove'>
      listItem: string
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'list item.toggle'>
      listItem: string
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'move.block down'>
      at: BlockPath
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'move.block up'>
      at: BlockPath
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'select.previous block'>
      select?: 'start' | 'end'
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'select.next block'>
      select?: 'start' | 'end'
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'split'>
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'style.add'>
      style: string
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'style.remove'>
      style: string
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'style.toggle'>
      style: string
    }

/**************************************
 * Abstract events
 **************************************/
declare const abstractBehaviorEventTypes: readonly [
  'annotation.set',
  'annotation.toggle',
  'decorator.toggle',
  'delete.backward',
  'delete.block',
  'delete.child',
  'delete.forward',
  'delete.text',
  'deserialize',
  'deserialization.success',
  'deserialization.failure',
  'insert.blocks',
  'insert.break',
  'insert.soft break',
  'list item.add',
  'list item.remove',
  'list item.toggle',
  'move.block down',
  'move.block up',
  'select.previous block',
  'select.next block',
  'serialize',
  'serialization.success',
  'serialization.failure',
  'split',
  'style.add',
  'style.remove',
  'style.toggle',
]

/**
 * @public
 */
declare type AnnotationPath = [
  {
    _key: string
  },
  'markDefs',
  {
    _key: string
  },
]

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
 * @beta
 */
declare type Behavior<
  TBehaviorEventType extends
    | '*'
    | `${BehaviorEventTypeNamespace}.*`
    | BehaviorEvent['type'] =
    | '*'
    | `${BehaviorEventTypeNamespace}.*`
    | BehaviorEvent['type'],
  TGuardResponse = true,
  TBehaviorEvent extends
    ResolveBehaviorEvent<TBehaviorEventType> = ResolveBehaviorEvent<TBehaviorEventType>,
> = {
  /**
   * Editor Event that triggers this Behavior.
   */
  on: TBehaviorEventType
  /**
   * Predicate function that determines if the Behavior should be executed.
   * Returning a non-nullable value from the guard will pass the value to the
   * actions and execute them.
   */
  guard?: BehaviorGuard<TBehaviorEvent, TGuardResponse>
  /**
   * Array of Behavior Action sets.
   * Each set represents a step in the history stack.
   */
  actions: Array<BehaviorActionSet<TBehaviorEvent, TGuardResponse>>
}

/**
 * @beta
 */
declare type BehaviorAction =
  | {
      type: 'execute'
      event: SyntheticBehaviorEvent
    }
  | {
      type: 'forward'
      event: NativeBehaviorEvent | SyntheticBehaviorEvent | CustomBehaviorEvent
    }
  | {
      type: 'raise'
      event: SyntheticBehaviorEvent | CustomBehaviorEvent
    }
  | {
      type: 'effect'
      effect: () => void
    }

/**
 * @beta
 */
declare type BehaviorActionSet<TBehaviorEvent, TGuardResponse> = (
  payload: {
    snapshot: EditorSnapshot
    event: TBehaviorEvent
    dom: EditorDom
  },
  guardResponse: TGuardResponse,
) => Array<BehaviorAction>

/**
 * @beta
 */
declare type BehaviorEvent =
  | SyntheticBehaviorEvent
  | NativeBehaviorEvent
  | CustomBehaviorEvent

declare type BehaviorEventTypeNamespace =
  | SyntheticBehaviorEventNamespace
  | NativeBehaviorEventNamespace
  | CustomBehaviorEventNamespace

/**
 * @beta
 */
declare type BehaviorGuard<TBehaviorEvent, TGuardResponse> = (payload: {
  snapshot: EditorSnapshot
  event: TBehaviorEvent
  dom: EditorDom
}) => TGuardResponse | false

/**
 * @beta
 */
export declare function BehaviorPlugin(props: {
  behaviors: Array<Behavior>
}): null

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

declare type BlockWithOptionalKey =
  | TextBlockWithOptionalKey
  | ObjectBlockWithOptionalKey

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

declare type ClipboardBehaviorEvent =
  | {
      type: StrictExtract<NativeBehaviorEventType, 'clipboard.copy'>
      originEvent: {
        dataTransfer: DataTransfer
      }
      position: Pick<EventPosition, 'selection'>
    }
  | {
      type: StrictExtract<NativeBehaviorEventType, 'clipboard.cut'>
      originEvent: {
        dataTransfer: DataTransfer
      }
      position: Pick<EventPosition, 'selection'>
    }
  | {
      type: StrictExtract<NativeBehaviorEventType, 'clipboard.paste'>
      originEvent: {
        dataTransfer: DataTransfer
      }
      position: Pick<EventPosition, 'selection'>
    }

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
 * @beta
 */
declare type CustomBehaviorEvent<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
  TType extends string = string,
  TInternalType extends CustomBehaviorEventType<
    'custom',
    TType
  > = CustomBehaviorEventType<'custom', TType>,
> = {
  type: TInternalType
} & TPayload

/**************************************
 * Custom events
 **************************************/
declare type CustomBehaviorEventNamespace = 'custom'

declare type CustomBehaviorEventType<
  TNamespace extends CustomBehaviorEventNamespace,
  TType extends string = '',
> = TType extends '' ? `${TNamespace}` : `${TNamespace}.${TType}`

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

/**
 * @beta
 * @deprecated Install the plugin from `@portabletext/plugin-character-pair-decorator`
 */
export declare function DecoratorShortcutPlugin(config: {
  decorator: ({schema}: {schema: EditorSchema}) => string | undefined
  pair: {
    char: string
    amount: number
  }
}): null

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

declare type DragBehaviorEvent =
  | {
      type: StrictExtract<NativeBehaviorEventType, 'drag.dragstart'>
      originEvent: {
        clientX: number
        clientY: number
        dataTransfer: DataTransfer
      }
      position: Pick<EventPosition, 'selection'>
    }
  | {
      type: StrictExtract<NativeBehaviorEventType, 'drag.drag'>
      originEvent: {
        dataTransfer: DataTransfer
      }
    }
  | {
      type: StrictExtract<NativeBehaviorEventType, 'drag.dragend'>
      originEvent: {
        dataTransfer: DataTransfer
      }
    }
  | {
      type: StrictExtract<NativeBehaviorEventType, 'drag.dragenter'>
      originEvent: {
        dataTransfer: DataTransfer
      }
      position: EventPosition
    }
  | {
      type: StrictExtract<NativeBehaviorEventType, 'drag.dragover'>
      originEvent: {
        dataTransfer: DataTransfer
      }
      dragOrigin?: Pick<EventPosition, 'selection'>
      position: EventPosition
    }
  | {
      type: StrictExtract<NativeBehaviorEventType, 'drag.drop'>
      originEvent: {
        dataTransfer: DataTransfer
      }
      dragOrigin?: Pick<EventPosition, 'selection'>
      position: EventPosition
    }
  | {
      type: StrictExtract<NativeBehaviorEventType, 'drag.dragleave'>
      originEvent: {
        dataTransfer: DataTransfer
      }
    }

/**
 * @public
 */
declare type Editor = {
  dom: EditorDom
  getSnapshot: () => EditorSnapshot
  /**
   * @beta
   */
  registerBehavior: (config: {behavior: Behavior}) => () => void
  send: (event: EditorEvent) => void
  on: ActorRef<Snapshot<unknown>, EventObject, EditorEmittedEvent>['on']
}

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

declare type EditorDom = {
  getBlockNodes: (snapshot: EditorSnapshot) => Array<Node>
  getChildNodes: (snapshot: EditorSnapshot) => Array<Node>
  /**
   * Let the Editor set the drag ghost. This is to be sure that it will get
   * properly removed again when the drag ends.
   */
  setDragGhost: ({
    event,
    ghost,
  }: {
    event: PickFromUnion<BehaviorEvent, 'type', 'drag.dragstart'>
    ghost: {
      element: HTMLElement
      x: number
      y: number
    }
  }) => void
}

/**
 * @public
 */
declare type EditorEmittedEvent =
  | {
      type: 'blurred'
      event: FocusEvent_2<HTMLDivElement, Element>
    }
  | {
      /**
       * @deprecated Will be removed in the next major version
       */
      type: 'done loading'
    }
  | {
      type: 'editable'
    }
  | ErrorEvent_2
  | {
      type: 'focused'
      event: FocusEvent_2<HTMLDivElement, Element>
    }
  | {
      type: 'invalid value'
      resolution: InvalidValueResolution | null
      value: Array<PortableTextBlock> | undefined
    }
  | {
      /**
       * @deprecated Will be removed in the next major version
       */
      type: 'loading'
    }
  | MutationEvent
  | PatchEvent
  | {
      type: 'read only'
    }
  | {
      type: 'ready'
    }
  | {
      type: 'selection'
      selection: EditorSelection
    }
  | {
      type: 'value changed'
      value: Array<PortableTextBlock> | undefined
    }

/**
 * @public
 */
declare type EditorEvent =
  | ExternalEditorEvent
  | ExternalBehaviorEvent
  | {
      type: 'update value'
      value: Array<PortableTextBlock> | undefined
    }

/**
 * @beta
 */
export declare const EditorRefPlugin: React_2.ForwardRefExoticComponent<
  React_2.RefAttributes<Editor | null>
>

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
 * @deprecated The event is no longer emitted
 */
declare type ErrorEvent_2 = {
  type: 'error'
  name: string
  description: string
  data: unknown
}

/**
 * @public
 * Listen for events emitted by the editor. Must be used inside `EditorProvider`. Events available include:
 *  - 'blurred'
 *  - 'done loading'
 *  - 'editable'
 *  - 'error'
 *  - 'focused'
 *  - 'invalid value'
 *  - 'loading'
 *  - 'mutation'
 *  - 'patch'
 *  - 'read only'
 *  - 'ready'
 *  - 'selection'
 *  - 'value changed'
 *
 * @example
 * Listen and log events.
 * ```tsx
 * import {EditorProvider} from '@portabletext/editor'
 * import {EventListenerPlugin} from '@portabletext/editor/plugins'
 *
 * function MyComponent() {
 *  return (
 *  <EditorProvider>
 *   <EventListenerPlugin
 *    on={(event) => {
 *     console.log(event)
 *    }
 *   } />
 *   { ... }
 * </EditorProvider>
 *  )
 * }
 * ```
 * @example
 * Handle events when there is a mutation.
 * ```tsx
 * <EventListenerPlugin
 *  on={(event) => {
 *    if (event.type === 'mutation') {
 *      console.log('Value changed:', event.snapshot)
 *    }
 *  }}
 * />
 * ```
 * @group Components
 */
export declare function EventListenerPlugin(props: {
  on: (event: EditorEmittedEvent) => void
}): null

declare type EventPosition = {
  block: 'start' | 'end'
  /**
   * Did the event origin from the editor DOM node itself or from a child node?
   */
  isEditor: boolean
  selection: NonNullable<EditorSelection>
}

declare type ExternalBehaviorEvent =
  | {
      type: ExternalBehaviorEventType<'blur'>
    }
  | {
      type: ExternalBehaviorEventType<'focus'>
    }
  | {
      type: ExternalBehaviorEventType<'insert', 'block object'>
      placement: InsertPlacement
      blockObject: {
        name: string
        value?: {
          [prop: string]: unknown
        }
      }
    }
  | SyntheticBehaviorEvent
  | CustomBehaviorEvent

/**************************************
 * External events
 **************************************/
declare type ExternalBehaviorEventNamespace = 'blur' | 'focus' | 'insert'

declare type ExternalBehaviorEventType<
  TNamespace extends ExternalBehaviorEventNamespace,
  TType extends string = '',
> = TType extends '' ? `${TNamespace}` : `${TNamespace}.${TType}`

/**
 * @public
 */
declare type ExternalEditorEvent =
  | {
      type: 'update readOnly'
      readOnly: boolean
    }
  | {
      type: 'update maxBlocks'
      maxBlocks: number | undefined
    }
  | PatchesEvent

declare type ExtractNamespace<TType extends string> =
  TType extends `${infer Namespace}.${string}` ? Namespace : TType

/**
 * @public
 */
declare type FieldDefinition = BaseDefinition & {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
}

/**
 * @public
 */
declare type InlineObjectSchemaType = BaseDefinition & {
  fields: ReadonlyArray<FieldDefinition>
}

/**
 * Used to represent native InputEvents that hold a DataTransfer object.
 *
 * These can either be one of:
 *
 * - insertFromPaste
 * - insertFromPasteAsQuotation
 * - insertFromDrop
 * - insertReplacementText
 * - insertFromYank
 */
declare type InputBehaviorEvent = {
  type: StrictExtract<NativeBehaviorEventType, 'input.*'>
  originEvent: {
    dataTransfer: DataTransfer
  }
}

/**
 * @beta
 */
declare type InsertPlacement = 'auto' | 'after' | 'before'

/**
 * The editor has invalid data in the value that can be resolved by the user
 * @beta */
declare type InvalidValueResolution = {
  autoResolve?: boolean
  patches: Patch[]
  description: string
  action: string
  item: PortableTextBlock[] | PortableTextBlock | PortableTextChild | undefined
  /**
   * i18n keys for the description and action
   *
   * These are in addition to the description and action properties, to decouple the editor from
   * the i18n system, and allow usage without it. The i18n keys take precedence over the
   * description and action properties, if i18n framework is available.
   */
  i18n: {
    description: `inputs.portable-text.invalid-value.${Lowercase<string>}.description`
    action: `inputs.portable-text.invalid-value.${Lowercase<string>}.action`
    values?: Record<string, string | number | string[]>
  }
}

declare type KeyboardBehaviorEvent =
  | {
      type: StrictExtract<NativeBehaviorEventType, 'keyboard.keydown'>
      originEvent: Pick<
        KeyboardEvent,
        'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'
      >
    }
  | {
      type: StrictExtract<NativeBehaviorEventType, 'keyboard.keyup'>
      originEvent: Pick<
        KeyboardEvent,
        'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'
      >
    }

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

declare type MarkdownBehaviorsConfig = {
  horizontalRuleObject?: (context: {schema: EditorSchema}) =>
    | {
        name: string
        value?: {
          [prop: string]: unknown
        }
      }
    | undefined
  defaultStyle?: (context: {schema: EditorSchema}) => string | undefined
  headingStyle?: (context: {
    schema: EditorSchema
    level: number
  }) => string | undefined
  blockquoteStyle?: (context: {schema: EditorSchema}) => string | undefined
  unorderedListStyle?: (context: {schema: EditorSchema}) => string | undefined
  orderedListStyle?: (context: {schema: EditorSchema}) => string | undefined
}

/**
 * @beta
 * Add markdown behaviors for common markdown actions such as converting ### to headings, --- to HRs, and more.
 *
 * @example
 * Configure the bundled markdown behaviors
 * ```ts
 * import {EditorProvider} from '@portabletext/editor'
 * import {MarkdownPlugin} from '@portabletext/editor/plugins'
 *
 * function App() {
 *   return (
 *    <EditorProvider>
 *      <MarkdownPlugin
 *        config={{
 *          boldDecorator: ({schema}) =>
 *            schema.decorators.find((decorator) => decorator.value === 'strong')?.value,
 *          codeDecorator: ({schema}) =>
 *            schema.decorators.find((decorator) => decorator.value === 'code')?.value,
 *          italicDecorator: ({schema}) =>
 *            schema.decorators.find((decorator) => decorator.value === 'em')?.value,
 *          strikeThroughDecorator: ({schema}) =>
 *            schema.decorators.find((decorator) => decorator.value === 'strike-through')?.value,
 *          horizontalRuleObject: ({schema}) => {
 *            const name = schema.blockObjects.find(
 *              (object) => object.name === 'break',
 *            )?.name
 *            return name ? {name} : undefined
 *          },
 *          defaultStyle: ({schema}) => schema.styles[0].value,
 *          headingStyle: ({schema, level}) =>
 *            schema.styles.find((style) => style.value === `h${level}`)
 *              ?.value,
 *          blockquoteStyle: ({schema}) =>
 *            schema.styles.find((style) => style.value === 'blockquote')
 *              ?.value,
 *          unorderedListStyle: ({schema}) =>
 *            schema.lists.find((list) => list.value === 'bullet')?.value,
 *          orderedListStyle: ({schema}) =>
 *            schema.lists.find((list) => list.value === 'number')?.value,
 *        }}
 *      />
 *      {...}
 *    </EditorProvider>
 *  )
 * }
 * ```
 *
 * @deprecated Install the plugin from `@portabletext/plugin-markdown-shortcuts`
 */
export declare function MarkdownPlugin(props: {
  config: MarkdownPluginConfig
}): JSX.Element

/**
 * @beta
 */
export declare type MarkdownPluginConfig = MarkdownBehaviorsConfig & {
  boldDecorator?: ({schema}: {schema: EditorSchema}) => string | undefined
  codeDecorator?: ({schema}: {schema: EditorSchema}) => string | undefined
  italicDecorator?: ({schema}: {schema: EditorSchema}) => string | undefined
  strikeThroughDecorator?: ({
    schema,
  }: {
    schema: EditorSchema
  }) => string | undefined
}

declare type MIMEType = `${string}/${string}`

declare type MouseBehaviorEvent = {
  type: StrictExtract<NativeBehaviorEventType, 'mouse.click'>
  position: EventPosition
}

/**
 * @public
 */
declare type MutationEvent = {
  type: 'mutation'
  patches: Array<Patch>
  /**
   * @deprecated Use `value` instead
   */
  snapshot: Array<PortableTextBlock> | undefined
  value: Array<PortableTextBlock> | undefined
}

declare type NamespacedBehaviorEventType<
  TNamespace extends BehaviorEventTypeNamespace | '',
> = TNamespace extends ''
  ? BehaviorEvent['type']
  : Extract<BehaviorEvent['type'], TNamespace | `${TNamespace}.${string}`>

/**
 * @beta
 */
declare type NativeBehaviorEvent =
  | ClipboardBehaviorEvent
  | DragBehaviorEvent
  | InputBehaviorEvent
  | KeyboardBehaviorEvent
  | MouseBehaviorEvent

declare type NativeBehaviorEventNamespace =
  ExtractNamespace<NativeBehaviorEventType>

declare type NativeBehaviorEventType = (typeof nativeBehaviorEventTypes)[number]

/**************************************
 * Native events
 **************************************/
declare const nativeBehaviorEventTypes: readonly [
  'clipboard.copy',
  'clipboard.cut',
  'clipboard.paste',
  'drag.dragstart',
  'drag.drag',
  'drag.dragend',
  'drag.dragenter',
  'drag.dragover',
  'drag.dragleave',
  'drag.drop',
  'input.*',
  'keyboard.keydown',
  'keyboard.keyup',
  'mouse.click',
]

declare type ObjectBlockWithOptionalKey = Omit<PortableTextObject, '_key'> & {
  _key?: PortableTextObject['_key']
}

/**
 * @beta
 * Restrict the editor to one line. The plugin takes care of blocking
 * `insert.break` events and smart handling of other `insert.*` events.
 *
 * Place it with as high priority as possible to make sure other plugins don't
 * overwrite `insert.*` events before this plugin gets a chance to do so.
 *
 * @deprecated Install the plugin from `@portabletext/plugin-one-line`
 */
export declare function OneLinePlugin(): JSX.Element

/**
 * @public
 */
declare type PatchesEvent = {
  type: 'patches'
  patches: Array<Patch>
  snapshot: Array<PortableTextBlock> | undefined
}

declare type PatchEvent = {
  type: 'patch'
  patch: Patch
}

/**
 * @internal
 */
declare type PickFromUnion<
  TUnion,
  TTagKey extends keyof TUnion,
  TPickedTags extends TUnion[TTagKey],
> = TUnion extends Record<TTagKey, TPickedTags> ? TUnion : never

/**************************************
 * Resolve behavior event
 **************************************/
declare type ResolveBehaviorEvent<
  TBehaviorEventType extends
    | '*'
    | `${BehaviorEventTypeNamespace}.*`
    | BehaviorEvent['type'],
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> = TBehaviorEventType extends '*'
  ? BehaviorEvent
  : TBehaviorEventType extends `${infer TNamespace}.*`
    ? TNamespace extends BehaviorEventTypeNamespace
      ? PickFromUnion<
          BehaviorEvent,
          'type',
          NamespacedBehaviorEventType<TNamespace>
        >
      : never
    : TBehaviorEventType extends `custom.${infer TType}`
      ? CustomBehaviorEvent<TPayload, TType>
      : TBehaviorEventType extends BehaviorEvent['type']
        ? PickFromUnion<BehaviorEvent, 'type', TBehaviorEventType>
        : never

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

declare type StrictExtract<T, U extends T> = U

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

/**
 * @beta
 */
declare type SyntheticBehaviorEvent =
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'annotation.add'>
      annotation: {
        name: string
        value: {
          [prop: string]: unknown
        }
      }
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'annotation.remove'>
      annotation: {
        name: string
      }
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'block.set'>
      at: BlockPath
      props: Record<string, unknown>
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'block.unset'>
      at: BlockPath
      props: Array<string>
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'child.set'>
      at: ChildPath
      props: {
        [prop: string]: unknown
      }
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'child.unset'>
      at: ChildPath
      props: Array<string>
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'decorator.add'>
      decorator: string
      at?: {
        anchor: BlockOffset
        focus: BlockOffset
      }
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'decorator.remove'>
      decorator: string
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'delete'>
      at: NonNullable<EditorSelection>
      /**
       * Defaults to forward deletion.
       */
      direction?: 'backward' | 'forward'
      /**
       * Defaults to character deletion.
       */
      unit?: 'character' | 'word' | 'line' | 'block'
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'history.redo'>
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'history.undo'>
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'insert.inline object'>
      inlineObject: {
        name: string
        value?: {
          [prop: string]: unknown
        }
      }
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'insert.block'>
      block: BlockWithOptionalKey
      placement: InsertPlacement
      select?: 'start' | 'end' | 'none'
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'insert.span'>
      text: string
      annotations?: Array<{
        name: string
        value: {
          [prop: string]: unknown
        }
      }>
      decorators?: Array<string>
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'insert.text'>
      text: string
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'move.backward'>
      distance: number
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'move.block'>
      at: BlockPath
      to: BlockPath
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'move.forward'>
      distance: number
    }
  | {
      type: StrictExtract<SyntheticBehaviorEventType, 'select'>
      at: EditorSelection
    }
  | AbstractBehaviorEvent

declare type SyntheticBehaviorEventNamespace =
  ExtractNamespace<SyntheticBehaviorEventType>

declare type SyntheticBehaviorEventType =
  | (typeof syntheticBehaviorEventTypes)[number]
  | (typeof abstractBehaviorEventTypes)[number]

/**************************************
 * Synthetic events
 **************************************/
declare const syntheticBehaviorEventTypes: readonly [
  'annotation.add',
  'annotation.remove',
  'block.set',
  'block.unset',
  'child.set',
  'child.unset',
  'decorator.add',
  'decorator.remove',
  'delete',
  'history.redo',
  'history.undo',
  'insert.inline object',
  'insert.block',
  'insert.span',
  'insert.text',
  'move.backward',
  'move.block',
  'move.forward',
  'select',
]

declare type TextBlockWithOptionalKey = Omit<PortableTextTextBlock, '_key'> & {
  _key?: PortableTextTextBlock['_key']
}

export {}
