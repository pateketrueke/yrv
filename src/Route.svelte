<script context="module">
  import { CTX_ROUTER, CTX_ROUTE } from './utils';
</script>

<script>
  import { writable } from 'svelte/store';
  import { onDestroy, getContext, setContext } from 'svelte';

  export let key = null;
  export let path = '';
  export let props = null;
  export let exact = undefined;
  export let fallback = undefined;
  export let component = undefined;
  export let condition = undefined;
  export let redirect = undefined;

  const routeContext = getContext(CTX_ROUTE);
  const routePath = routeContext ? routeContext.routePath : writable(path);

  const { assignRoute, unassignRoute, routeInfo } = getContext(CTX_ROUTER);

  let activeRouter = null;
  let activeProps = {};
  let fullpath;

  function getProps(given, required) {
    const { props, ...others } = given;

    // prune all declared props from this component
    required.forEach(k => {
      delete others[k];
    });

    return {
      ...props,
      ...others,
    };
  }

  const fixedRoot = $routePath !== path && $routePath !== '/'
    ? `${$routePath}${path !== '/' ? path : ''}`
    : path;

  [key, fullpath] = assignRoute(key, fixedRoot, { condition, redirect, fallback, exact });

  $: {
    activeRouter = $routeInfo[key];
    activeProps = getProps($$props, arguments[0]['$$'].props);
  }

  onDestroy(() => {
    unassignRoute(fullpath);
  });

  setContext(CTX_ROUTE, {
    routePath,
  });
</script>

{#if activeRouter}
  {#if component}
    <svelte:component this={component} router={activeRouter} {...activeProps} />
  {:else}
    <slot router={activeRouter} props={activeProps} />
  {/if}
{/if}
