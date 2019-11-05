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

  function doFallback(root, failure, fallback) {
    console.log('FALLBACK', root, failure, fallback);
  }

  function handleRoutes(map, _path, _query) {
    map.some(x => {
      if (x.key && x.matches && !x.fallback && !context.routeInfo[x.key]) {
        context.params = Object.assign(context.params || {}, x.params);

        if (x.redirect && (x.condition === null || x.condition(context.router) !== true)) {
          if (x.exact && _path !== x.path) return false;
          navigateTo(x.redirect);
          return true;
        }

        routeInfo.update(defaults => ({
          ...defaults,
          [x.key]: {
            ...x,
            query: _query,
            params: context.params,
          },
        }));
      }

      return false;
    });
  }

  function evtHandler() {
    let baseUri = !hashchangeEnable() ? window.location.href.replace(window.location.origin, '') : window.location.hash;

    // unprefix active URL
    if (ROOT_URL !== '/') {
      baseUri = baseUri.replace(ROOT_URL, '');
    }

    const [fullpath, qs] = baseUri.replace('/#', '#').replace(/^#\//, '/').split('?');
    const query = queryString.parse(qs);

    routeInfo.set({});
    router.set({
      query,
      path: fullpath,
      params: context.params,
    });

    let failure;

    baseRouter.resolve(fullpath, (err, result) => {
      if (err) {
        failure = err;
        return;
      }

      handleRoutes(result, fullpath, query);
    });

    try {
      baseRouter.find(fullpath).forEach(sub => {
        // clear routes that not longer matches!
        if (sub.exact && !sub.matches) {
          // $routeInfo[sub.key] = null;
          routeInfo.update(defaults => ({
            ...defaults,
            [sub.key]: null,
          }));
        }

        // upgrade existing routes...
        if (sub.key && sub.matches && !sub.fallback) {
          // $routeInfo[sub.key] = { ...sub, query };
        }
      });
    } catch (e) {
      // this is fine
    }

    // FIXME: find another way to make-it reactive...
    Object.keys(callbacks).forEach(root => {
      callbacks[root](isActive(root, fullpath, false) ? failure : null);
    });
  }

  function addRouter(root, callback) {
    if (!routers) {
      window.addEventListener('popstate', evtHandler, false);
    }

    callbacks[root] = callback;
    routers += 1;

    clearTimeout(interval);
    interval = setTimeout(evtHandler);

    return () => {
      routers -= 1;

      delete callbacks[root];

      if (!routers) {
        window.removeEventListener('popstate', evtHandler, false);
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

    return [key, fullpath];
  }

  function unassignRoute(route) {
    baseRouter.rm(route);
  }

  onMount(() => {
    cleanup = addRouter(fixedRoot, (err, root) => {
      failure = err;

      if (failure && fallback) {
        doFallback(root, failure, fallback);
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
