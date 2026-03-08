import {KeyboardShortcut as KeyboardShortcut_2} from './keyboard-shortcuts'

/**
 * @beta
 */
export declare const blockquote: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const bold: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const code: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 * Creates a `KeyboardShortcut` from a `KeyboardShortcutDefinition`.
 *
 * `default` keyboard event definitions are required while the `apple`
 * keyboard event definitions are optional.
 *
 * @example
 * ```typescript
 * const shortcut = createKeyboardShortcut({
 *   default: [{
 *     key: 'B',
 *     alt: false,
 *     ctrl: true,
 *     meta: false,
 *     shift: false,
 *   }],
 *   apple: [{
 *     key: 'B',
 *     alt: false,
 *     ctrl: false,
 *     meta: true,
 *     shift: false,
 *   }],
 * })
 * ```
 */
export declare function createKeyboardShortcut<
  TKeyboardEvent extends Pick<
    KeyboardEvent,
    'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'
  > = Pick<
    KeyboardEvent,
    'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'
  >,
>(definition: KeyboardShortcutDefinition): KeyboardShortcut<TKeyboardEvent>

/**
 * @beta
 */
export declare const h1: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const h2: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const h3: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const h4: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const h5: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const h6: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const italic: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 * A keyboard event definition that can be used to create a keyboard shortcut.
 *
 * At least one of `key` or `code` must be provided while the `alt`, `ctrl`,
 * `meta`, and `shift` modifier configurations are optional.
 *
 * The `key` represents a https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
 * and is treated as case-insensitive.
 *
 * The `code` represents a https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
 * and is treated as case-insensitive.
 *
 * @example
 * ```typescript
 * const boldEvent: KeyboardEventDefinition = {
 *   key: 'B',
 *   alt: false,
 *   ctrl: true,
 *   meta: false,
 *   shift: false,
 * }
 * ```
 */
export declare type KeyboardEventDefinition = (
  | {
      key: KeyboardEvent['key']
      code: KeyboardEvent['code']
    }
  | {
      key: KeyboardEvent['key']
      code?: undefined
    }
  | {
      key?: undefined
      code: KeyboardEvent['code']
    }
) & {
  alt?: KeyboardEvent['altKey']
  ctrl?: KeyboardEvent['ctrlKey']
  meta?: KeyboardEvent['metaKey']
  shift?: KeyboardEvent['shiftKey']
}

/**
 * @beta
 * A resolved keyboard shortcut for the current platform that has been
 * processed by `createKeyboardShortcut(...)` to select the appropriate
 * platform-specific key combination. The `guard` function determines if the
 * shortcut applies to the current `KeyboardEvent`, while `keys` contains the
 * display-friendly key combination for the current platform.
 */
export declare type KeyboardShortcut<
  TKeyboardEvent extends Pick<
    KeyboardEvent,
    'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'
  > = Pick<
    KeyboardEvent,
    'key' | 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'
  >,
> = {
  guard: (event: TKeyboardEvent) => boolean
  keys: ReadonlyArray<string>
}

/**
 * @beta
 * Definition of a keyboard shortcut with platform-specific keyboard event
 * definitions.
 *
 * `default` keyboard event definitions are required while the `apple`
 * keyboard event definitions are optional.
 *
 * @example
 * ```typescript
 * const boldShortcut: KeyboardShortcutDefinition = {
 *   default: [{
 *     key: 'B',
 *     alt: false,
 *     ctrl: true,
 *     meta: false,
 *     shift: false,
 *   }],
 *   apple: [{
 *     key: 'B',
 *     alt: false,
 *     ctrl: false,
 *     meta: true,
 *     shift: false,
 *   }],
 * }
 * ```
 */
export declare type KeyboardShortcutDefinition = {
  default: ReadonlyArray<KeyboardEventDefinition>
  apple?: ReadonlyArray<KeyboardEventDefinition>
}

/**
 * @beta
 */
export declare const link: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const normal: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const redo: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const strikeThrough: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const underline: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

/**
 * @beta
 */
export declare const undo: KeyboardShortcut_2<
  Pick<
    KeyboardEvent,
    'ctrlKey' | 'key' | 'code' | 'shiftKey' | 'altKey' | 'metaKey'
  >
>

export {}
