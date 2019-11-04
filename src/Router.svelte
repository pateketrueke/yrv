<script context="module">
  import queryString from 'query-string';
  import Router from 'abstract-nested-router';

  const baseRouter = new Router();
</script>

<script>
  import {
    onDestroy, getContext, setContext,
  } from 'svelte';

  import { writable } from 'svelte/store';

  import {
    CTX_ROUTER, ROOT_URL, hashchangeEnable, navigateTo, isActive, router,
  } from './utils';

  let failure;
  let fallback;

  export let path = '/';
  export let nofallback = false;

  const routerContext = getContext(CTX_ROUTER);
  const routeInfo = routerContext ? routerContext.routeInfo : writable({});
  const basePath = routerContext ? routerContext.basePath : writable(path);

  const fixedRoot = $basePath !== path && $basePath !== '/'
    ? `${$basePath}${path !== '/' ? path : ''}`
    : path;

  function doFallback(e, _path, queryParams) {
    $routeInfo = {
      [fallback]: {
        failure: e,
        query: queryParams,
        params: { _: _path.substr(1) || undefined },
      },
    };
  }

  function handleRoutes(map, _path, _query, _shared) {
    const _params = map.reduce((prev, cur) => {
      if (cur.key) {
        Object.assign(_shared, cur.params);

        prev[cur.key] = {
          ...prev[cur.key],
          ...cur.params,
        };
      }

      return prev;
    }, {});

    map.some(x => {
      if (x.key && x.matches && !x.fallback && !$routeInfo[x.key]) {
        if (x.redirect && typeof x.condition === 'function') {
          const ok = typeof x.condition === 'function' ? x.condition($router) : x.condition;

          if (ok !== true && x.redirect) {
            navigateTo(x.redirect);
            return true;
          }

          return false;
        }

        if (x.redirect && x.condition === null) {
          navigateTo(x.redirect);
          return true;
        }

        $routeInfo[x.key] = {
          ...x,
          query: _query,
          params: _params[x.key],
        };
      }

      return false;
    });
  }

  function resolveRoutes() {
    clearTimeout(resolveRoutes.t);

    resolveRoutes.t = setTimeout(() => {
      failure = null;
      $routeInfo = {};

      let baseUri = !hashchangeEnable() ? window.location.href.replace(window.location.origin, '') : window.location.hash;

      // unprefix active URL
      if (ROOT_URL !== '/') {
        baseUri = baseUri.replace(ROOT_URL, '');
      }

      const [fullpath, searchQuery] = baseUri.replace('/#', '#').replace(/^#\//, '/').split('?');
      const query = queryString.parse(searchQuery);
      const ctx = {};

      try {
        if (isActive(fixedRoot, fullpath, false) || fixedRoot === '/') {
          baseRouter.resolve(fullpath, (err, result) => {
            if (err) {
              failure = err;
              return;
            }

            handleRoutes(result, fullpath, query, ctx);
          });
        }
      } catch (e) {
        failure = e;
      } finally {
        $router.path = fullpath;
        $router.query = query;
        $router.params = ctx;
      }

      if (failure && fallback) {
        doFallback(failure, fullpath, query);
        return;
      }

      try {
        baseRouter.find(fullpath).forEach(sub => {
          // clear routes that not longer matches!
          if (sub.exact && !sub.matches) {
            $routeInfo[sub.key] = null;
          }

          if (sub.matches && !sub.fallback) {
            $routeInfo[sub.key] = { ...sub, query };
          }
        });
      } catch (e) {
        // this is fine
      }
    });
  }

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

    resolveRoutes();

    return [key, fullpath];
  }

  function unassignRoute(route) {
    baseRouter.rm(route);
    resolveRoutes();
  }

  window.addEventListener('popstate', resolveRoutes, false);

  onDestroy(() => {
    window.removeEventListener('popstate', resolveRoutes, false);
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
