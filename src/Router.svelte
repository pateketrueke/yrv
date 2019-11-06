<script context="module">
  import queryString from 'query-string';
  import Router from 'abstract-nested-router';
  import { writable } from 'svelte/store';

  import {
    CTX_ROUTER, ROOT_URL, hashchangeEnable, navigateTo, isActive, router,
  } from './utils';

  const baseRouter = new Router();
  const routeInfo = writable({});
  const callbacks = {};
  const context = {};

  let routers = 0;
  let interval;

  // take snapshot from current state...
  router.subscribe(value => { context.router = value; });
  routeInfo.subscribe(value => { context.routeInfo = value; });

  function doFallback(failure, fallback) {
    routeInfo.update(defaults => ({
      ...defaults,
      [fallback]: {
        ...context.router,
        failure,
      },
    }));
  }

  function handleRoutes(map, params) {
    const exactKeys = [];

    map.some(x => {
      if (x.key && x.matches && !x.fallback && !context.routeInfo[x.key]) {
        if (x.redirect && (x.condition === null || x.condition(context.router) !== true)) {
          if (x.exact && context.router.path !== x.path) return false;
          navigateTo(x.redirect);
          return true;
        }

        if (x.exact) {
          exactKeys.push(x.key);
        }

        // extend shared params...
        Object.assign(params, x.params);

        // upgrade matching routes!
        routeInfo.update(defaults => ({
          ...defaults,
          [x.key]: {
            ...context.router,
            ...x,
          },
        }));
      }

      return false;
    });

    return exactKeys;
  }

  function evtHandler() {
    let baseUri = !hashchangeEnable() ? window.location.href.replace(window.location.origin, '') : window.location.hash;

    // unprefix active URL
    if (ROOT_URL !== '/') {
      baseUri = baseUri.replace(ROOT_URL, '');
    }

    const [fullpath, qs] = baseUri.replace('/#', '#').replace(/^#\//, '/').split('?');
    const query = queryString.parse(qs);
    const params = {};
    const keys = [];

    // reset current state
    routeInfo.set({});
    router.set({
      query,
      params,
      path: fullpath,
    });

    let failure;

    baseRouter.resolve(fullpath, (err, result) => {
      if (err) {
        failure = err;
        return;
      }

      keys.push(...handleRoutes(result, params));
    });

    try {
      // clear routes that not longer matches!
      baseRouter.find(fullpath).forEach(sub => {
        if (sub.exact && !sub.matches) {
          routeInfo.update(defaults => ({
            ...defaults,
            [sub.key]: null,
          }));
        }
      });
    } catch (e) {
      // this is fine
    }

    if (failure) {
      const toDelete = keys.reduce((prev, cur) => {
        prev[cur] = null;
        return prev;
      }, {});

      routeInfo.update(defaults => ({
        ...defaults,
        ...toDelete,
      }));
    }

    // FIXME: find another way to make-it reactive...
    Object.keys(callbacks).forEach(root => {
      callbacks[root](isActive(root, fullpath, false) ? failure : null);
    });
  }

  function findRoutes() {
    clearTimeout(interval);
    interval = setTimeout(evtHandler);
  }

  function addRouter(root, callback) {
    if (!routers) {
      window.addEventListener('popstate', findRoutes, false);
    }

    // FIXME: how to get rid of these callbacks?
    callbacks[root] = callback;
    routers += 1;

    return () => {
      delete callbacks[root];
      routers -= 1;

      if (!routers) {
        window.removeEventListener('popstate', findRoutes, false);
      }
    };
  }
</script>

<script>
  import {
    onMount, onDestroy, getContext, setContext,
  } from 'svelte';

  let cleanup;
  let failure;
  let fallback;

  export let path = '/';
  export let nofallback = false;

  const routerContext = getContext(CTX_ROUTER);
  const basePath = routerContext ? routerContext.basePath : writable(path);

  const fixedRoot = $basePath !== path && $basePath !== '/'
    ? `${$basePath}${path !== '/' ? path : ''}`
    : path;

  function assignRoute(key, route, detail) {
    key = key || Math.random().toString(36).substr(2);

    // consider as nested routes if they does not have any segment
    const nested = !route.substr(1).includes('/');
    const handler = { key, nested, ...detail };

    let fullpath;

    baseRouter.mount(fixedRoot, () => {
      fullpath = baseRouter.add(route, handler);
      fallback = (handler.fallback && key) || fallback;
    });

    findRoutes();

    return [key, fullpath];
  }

  function unassignRoute(route) {
    baseRouter.rm(route);
    findRoutes();
  }

  onMount(() => {
    cleanup = addRouter(fixedRoot, err => {
      failure = err;

      if (failure && fallback) {
        doFallback(failure, fallback);
      }
    });
  });

  onDestroy(() => {
    cleanup();
  });

  setContext(CTX_ROUTER, {
    basePath,
    routeInfo,
    assignRoute,
    unassignRoute,
  });
</script>

<style>
  [data-failure] {
    border: 1px dashed silver;
  }
</style>

<slot />

{#if failure && !fallback && !nofallback}
  <fieldset data-failure>
    <legend>Router failure: {path}</legend>
    <pre>{failure}</pre>
  </fieldset>
{/if}
