<script context="module">
  import { writable } from 'svelte/store';
  import { routeInfo } from './router';
  import {
    CTX_ROUTER, CTX_ROUTE, router, getProps, isPromise, isSvelteComponent,
  } from './utils';
</script>

<script>
  import { onDestroy, getContext, setContext } from 'svelte';

  export let key = null;
  export let path = '/';
  export let exact = null;
  export let pending = null;
  export let disabled = false;
  export let fallback = null;
  export let component = null;
  export let condition = null;
  export let redirect = null;

  // replacement for `Object.keys(arguments[0].$$.props)`
  const thisProps = ['key', 'path', 'exact', 'pending', 'disabled', 'fallback', 'component', 'condition', 'redirect'];

  const routeContext = getContext(CTX_ROUTE);
  const routerContext = getContext(CTX_ROUTER);

  const { assignRoute, unassignRoute, pendingComponent } = routerContext || {};

  const routePath = routeContext ? routeContext.routePath : writable(path);

  let activeRouter = null;
  let activeProps = {};
  let fullpath;
  let hasLoaded;

  const fixedRoot = $routePath !== path && $routePath !== '/'
    ? `${$routePath}${path !== '/' ? path : ''}`
    : path;

  function resolve() {
    const fixedRoute = path !== fixedRoot && fixedRoot.substr(-1) !== '/'
      ? `${fixedRoot}/`
      : fixedRoot;

    [key, fullpath] = assignRoute(key, fixedRoute, {
      condition, redirect, fallback, exact,
    });
  }

  // IF DEBUG
  let failure;

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

    resolve();
  } catch (e) {
    failure = e;
  }
  // ENDIF
  // IF_NOT DEBUG
  resolve();
  // ENDIF

  $: if (key) {
    activeRouter = !disabled && $routeInfo[key];
    activeProps = getProps($$props, thisProps);
    activeProps.router = activeRouter;
  }

  $: if (activeRouter) {
    for (const k in $router.params) {
      if (typeof activeRouter.params[k] === 'undefined') {
        activeRouter.params[k] = $router.params[k];
      }
    }

    if (!component) { // component passed as slot
      hasLoaded = true;
    } else if (isSvelteComponent(component)) { // component passed as Svelte component
      hasLoaded = true;
    } else if (isPromise(component)) { // component passed as import()
      component.then(module => {
        component = module.default;
        hasLoaded = true;
      });
    } else { // component passed as () => import()
      component().then(module => {
        component = module.default;
        hasLoaded = true;
      });
    }
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

<!--IF DEBUG-->
<style>
  [data-failure] {
    color: red;
  }
</style>

{#if failure}
  <p data-failure>{failure}</p>
{/if}
<!--ENDIF-->

{#if activeRouter}
<!--<fieldset><legend>{key} ({exact} | {fullpath})</legend>-->
  {#if !hasLoaded}
    {#if pending || pendingComponent}
      {#if isSvelteComponent(pending)}
        <svelte:component this={pending} {...activeProps} />
      {:else if isSvelteComponent(pendingComponent)}
        <svelte:component this={pendingComponent} {...activeProps} />
      {:else}
        {pending || pendingComponent}
      {/if}
    {/if}
  {:else}
    {#if component}
      <svelte:component this={component} {...activeProps} />
    {:else}
      <slot {...activeProps} />
    {/if}
  {/if}
<!--</fieldset>-->
{/if}
