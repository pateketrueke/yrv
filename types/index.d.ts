import { SvelteComponentTyped, SvelteComponent } from "svelte";
import { Writable } from 'svelte/store';

interface RouterState {
  path: string;
  query: Record<string, any>;
  params: Record<string, any>;
  initial?: boolean;
}

interface RouterProps {
  /**
   * @description any segment to derive a fullpath from. 
   * @default /
   */
  path?: string;
  /**
   * @description A Svelte-component or string. Shown while we wait for a component to load.
   */
  pending?: SvelteComponent | string;
  /**
   * @description Similar to condition, but for bound props.
   */
  disabled?: boolean;
  /**
   * @description If given, render only if this function evaluates to true.
   */
  condition?: () => boolean;
}
interface RouterSlots {
  router: RouterState;
}
export class Router extends SvelteComponentTyped<RouterProps & {
  /**
   * @description if set, non-matched routes will never raise a failure.
   */
  nofallback?: boolean;
}, any, RouterSlots> { }

interface RouteProps extends RouterProps {
  /**
   * @description the route identity, not its path; defaults to a random psuedo-hash
   */
  key?: string;
  /**
   * @description if set, the route will only render if the route _exact_ matches the current route. 
   */
  exact?: boolean;
  /**
   * @description if set the route will render only if no more routes were matched.
   */
  fallback?: boolean;
  /**
   * @description accepts either a valid Svelte component, a promise that resolves to a component, or a dynamic import function.
   * 
   * _Note:_ supplying a dynamic import function will start the network call immediately when the route is mounted. If you would like to wait until the route is matched to start loading, use `() => import()` instead.
   */
  component?: SvelteComponent | Promise<SvelteComponent> | Promise<typeof import('*.svelte')> | (() => Promise<SvelteComponent>) | (() => Promise<typeof import('*.svelte')>);
  /**
   * @description alternate redirection location, only if the `condition` is true.
   */
  redirect?: string;
}

export class Route extends SvelteComponentTyped<RouteProps> { }

interface LinkProps {
  /**
   * @description history shortcut.
   */
  go?: 'back' | 'fwd' | number;
  /**
   * @description New location; defaults to `/`
   */
  href?: string;
  /** 
   * @description Same behavior as `<a target="_blank">`
   */
  open?: boolean;
  /**
   * @description HTML title-attribute value.
   */
  title?: string;
  /**
   * @description if set will use a button-tag instead of an anchor tag.
   */
  button?: boolean;
  /**
   * determine if the link should be matched exactly in order to be set as active.
   */
  exact?: boolean;
  /**
   * @description use `location.href` instead
   */
  reload?: boolean;
  /**
   * @description use `history.replaceState()` instead.
   */
  replace?: boolean;
  /**
   * @description custom class name for the mounted anchor.
   */
  class?: string;
}

export class Link extends SvelteComponentTyped<LinkProps> { }

interface NavigateToOps {
  /**
   * @description if true will use `location.href` instead.
   */
  reload?: boolean;
  /**
   * @description if true will use `history.replaceState()` instead.
   */
  replace?: boolean;
  /**
   * @description used to replace `:placeholders` in the `path` value.
   */
  params?: Record<string, any>;
  /**
   * @description additional search-parameters for new location.
   */
  queryParams?: string | Record<string, any>;
}
/**
 * 
 * @param path the path to change the URL to.
 * @param options changes behavior of function call.
 */
export function navigateTo(path: string, options?: NavigateToOps);
/**
 * @description a store with shared route information; similar to `let:router`
 * 
 * ```js
 * import { router } from 'yrv'
 * router.subscribe($router => {
 *  // code run on router update.
 * })
 * ```
 */
export const router: Writable<RouterState>

