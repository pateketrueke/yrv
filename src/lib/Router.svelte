<script context="module">
  import { writable } from 'svelte/store';
  import { CTX_ROUTER, router } from './utils';
  import {
    baseRouter, addRouter, findRoutes, doFallback,
  } from './router';

  // const __CACHED_ROUTES__ = new Map();
</script>

<script>
  import {
    onMount, onDestroy, getContext, setContext,
  } from 'svelte';

  let cleanup;
  let failure;
  let fallback;

  export let key = '';
  export let path = '/';
  export let pending = null;
  export let disabled = false;
  export let condition = null;

  // IF DEBUG
  export let nofallback = false;
  // ENDIF

  const routerContext = getContext(CTX_ROUTER);
  const basePath = routerContext ? routerContext.basePath : writable(path);

  const fixedRoot = $basePath !== path && $basePath !== '/'
    ? `${$basePath}${path !== '/' ? path : ''}`
    : path;

  // IF DEBUG
  try {
    if (condition !== null && typeof condition !== 'function') {
      throw new TypeError(`Expecting condition to be a function, given '${condition}'`);
    }

    if (path.charAt() !== '#' && path.charAt() !== '/') {
      throw new TypeError(`Expecting a leading slash or hash, given '${path}'`);
    }
  } catch (e) {
    failure = e;
  }
  // ENDIF

  function assignRoute(_key, route, detail) {
    const $key = [key, _key].filter(Boolean).join('.');
    const handler = { key: $key, ...detail };

    let fullpath;
    baseRouter.mount(fixedRoot, () => {
      fullpath = baseRouter.add(route, handler);
      fallback = (handler.fallback && $key) || fallback;
    });

    findRoutes();

    return [$key, fullpath];
  }

  function unassignRoute(route) {
    try {
      baseRouter.rm(route);
    } catch (e) {
      // 🔥 this is fine...
    }
    findRoutes();
  }

  function onError(err) {
    failure = err;

    if (failure && fallback) {
      doFallback(failure, fallback);
    }
  }

  onMount(() => {
    cleanup = addRouter(fixedRoot, fallback, onError);
  });

  onDestroy(() => {
    if (cleanup) cleanup();
  });

  setContext(CTX_ROUTER, {
    basePath,
    assignRoute,
    unassignRoute,
    pendingComponent: pending,
  });

  $: if (condition) {
    disabled = !condition($router);
  }
</script>

{#if !disabled}
  <slot router={$router} />
{/if}

<!--IF DEBUG-->
<style>
  [data-failure] {
    border: 1px dashed silver;
  }
</style>

{#if failure && !fallback && !nofallback}
  <fieldset data-failure>
    <legend>Router failure: {path}</legend>
    <pre>{failure}</pre>
  </fieldset>
{/if}
<!--ENDIF-->
