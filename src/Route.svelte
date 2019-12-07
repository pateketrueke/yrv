<script context="module">
  import { writable } from 'svelte/store';
  import { routeInfo } from './router';
  import { CTX_ROUTER, CTX_ROUTE } from './utils';

  function getProps(given, required) {
    const { props: sub, ...others } = given;

    // prune all declared props from this component
    required = !Array.isArray(required)
      ? Object.keys(required)
      : required;

    required.forEach(k => {
      delete others[k];
    });

    return {
      ...sub,
      ...others,
    };
  }
</script>

<script>
  import { onDestroy, getContext, setContext } from 'svelte';

  export let key = null;
  export let path = '/';
  export let exact = null;
  export let disabled = false;
  export let fallback = null;
  export let component = null;
  export let condition = null;
  export let redirect = null;

  const routeContext = getContext(CTX_ROUTE);
  const routerContext = getContext(CTX_ROUTER);

  const { assignRoute, unassignRoute } = routerContext || {};

  const routePath = routeContext ? routeContext.routePath : writable(path);

  let activeRouter = null;
  let activeProps = {};
  let fullpath;
  let failure;

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
    /* global arguments */
    activeRouter = !disabled && $routeInfo[key];
    activeProps = getProps($$props, arguments[0].$$.props);
  }

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
  {#if component}
    <svelte:component this={component} router={activeRouter} {...activeProps} />
  {:else}
    <slot router={activeRouter} props={activeProps} />
  {/if}
{/if}
