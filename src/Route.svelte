<script>
  import { writable } from 'svelte/store';
  import { onDestroy, getContext, setContext } from 'svelte';
  import { CTX_ROUTER, CTX_ROUTE } from './utils';

  export let key = null;
  export let path = '/';
  export let props = null;
  export let exact = null;
  export let fallback = null;
  export let component = null;
  export let condition = null;
  export let redirect = null;

  const routeContext = getContext(CTX_ROUTE);
  const routePath = routeContext ? routeContext.routePath : writable(path);

  const {
    assignRoute, unassignRoute, routeInfo,
  } = getContext(CTX_ROUTER);

  let activeRouter = null;
  let activeProps = {};
  let fullpath;
  let failure;

  function getProps(given, required) {
    const { props: sub, ...others } = given;

    // prune all declared props from this component
    required.forEach(k => {
      delete others[k];
    });

    return {
      ...sub,
      ...others,
    };
  }

  const fixedRoot = $routePath !== path && $routePath !== '/'
    ? `${$routePath}${path !== '/' ? path : ''}`
    : path;

  try {
    [key, fullpath] = assignRoute(key, fixedRoot, {
      condition, redirect, fallback, exact,
    });
  } catch (e) {
    failure = e;
  }

  $: if (key) {
    /* global arguments */
    activeRouter = $routeInfo[key];
    activeProps = getProps($$props, arguments[0].$$.props);
  }

  onDestroy(() => {
    unassignRoute(fullpath);
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
