<script context="module">
  import { writable } from 'svelte/store';
  import { routeInfo } from './router';
  import { CTX_ROUTER, CTX_ROUTE, getProps, isPromise, isSvelteComponent, isFunction } from './utils';
</script>

<script>
  import { onDestroy, getContext, setContext } from 'svelte';

  export let key = null;
  export let path = '/';
  export let exact = null;
  export let dynamic = null;
  export let pending = null;
  export let disabled = false;
  export let fallback = null;
  export let component = null;
  export let condition = null;
  export let redirect = null;

  // replacement for `Object.keys(arguments[0].$$.props)`
  const thisProps = ['key', 'path', 'exact', 'dynamic', 'pending', 'disabled', 'fallback', 'component', 'condition', 'redirect'];

  const routeContext = getContext(CTX_ROUTE);
  const routerContext = getContext(CTX_ROUTER);

  const { assignRoute, unassignRoute } = routerContext || {};

  const routePath = routeContext ? routeContext.routePath : writable(path);

  let activeRouter = null;
  let activeProps = {};
  let fullpath;
  let failure;
  let hasLoaded;

  const fixedRoot = $routePath !== path && $routePath !== '/'
    ? `${$routePath}${path !== '/' ? path : ''}`
    : path;

  try {
    if (redirect !== null && !/^(?:\w+:\/\/|\/)/.test(redirect)) {
      throw new TypeError(`Expecting valid URL to redirect, given '${redirect}'`);
    }

    if (condition !== null && typeof condition !== 'function') {
      throw new TypeError(`Expecting condition to be a function, given '${condition}'`);
    }

    if (path.charAt() !== '#' && path.charAt() !== '/') {
      throw new TypeError(`Expecting a leading slash or hash, given '${path}'`);
    }

    if (!assignRoute) {
      throw new TypeError(`Missing top-level <Router>, given route: ${path}`);
    }

    [key, fullpath] = assignRoute(key, fixedRoot, {
      condition, redirect, fallback, exact,
    });
  } catch (e) {
    failure = e;
  }

  $: if (key) {
    activeRouter = !disabled && $routeInfo[key];
    activeProps = getProps($$props, thisProps);
  }

  $: activeRouter && (async () => {
    if (!component) { // component passed as slot
      hasLoaded = true;
    } else if (isSvelteComponent(component)) { // component passed as Svelte component
      hasLoaded = true;
    } else if (isPromise(component)) { // component passed as import()
      const {default: M} = await component;
      component = M;
      hasLoaded = true;
    } else if (isFunction(component) && activeRouter.path === path) { // component passed as () => import()
      const {default: M} = await component();
      component = M;
      hasLoaded = true;
    }
  })();

  onDestroy(() => {
    if (unassignRoute) {
      unassignRoute(fullpath);
    }
  });

  setContext(CTX_ROUTE, {
    routePath,
  });
</script>

<style>
  [data-failure] {
    color: red;
  }
</style>

{#if failure}
  <p data-failure>{failure}</p>
{/if}

{#if activeRouter}
  {#if !hasLoaded}
    {#if pending}
      {#if isSvelteComponent(pending)}
        <svelte:component this={pending} router={activeRouter} {...activeProps} />
      {:else}
        {pending}
      {/if}
    {/if}
  {:else}
    {#if component}
      <svelte:component this={component} router={activeRouter} {...activeProps} />
    {:else}
      <slot router={activeRouter} props={activeProps} />
    {/if}
  {/if}
{/if}
