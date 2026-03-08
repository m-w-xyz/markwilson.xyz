import type {ClientPerspective} from '@sanity/client'
import type {SanityClient} from '@sanity/client'

/** @internal */
export declare function disableVercelProtectionBypass(client: SanityClient): Promise<void>

/** @internal */
export declare function enableVercelProtectionBypass(
  client: SanityClient,
  secret: string,
): Promise<void>

/**
 * A subset type that's compatible with most SanityClient typings,
 * this makes it easier to use this package in libraries that may use `import type { SanityClient } from 'sanity'`
 * as well as those that use `import type { SanityClient } from '@sanity/client'`
 * @public
 */
export declare type SanityClientLike = {
  config(): {
    token?: string
  }
  withConfig(config: {
    apiVersion?: string
    useCdn?: boolean
    perspective?: ClientPerspective
    resultSourceMap?: boolean
  }): SanityClientLike
  fetch<
    R,
    Q = {
      [key: string]: any
    },
  >(
    query: string,
    params: Q,
    options: {
      tag?: string
    },
  ): Promise<R>
}

/** @internal */
declare function subscribeToVercelProtectionBypass(
  client: SanityClient,
  onChange: (secret: string | null) => void,
): () => void
export {subscribeToVercelProtectionBypass as subcribeToVercelProtectionBypass}
export {subscribeToVercelProtectionBypass}

export {}
