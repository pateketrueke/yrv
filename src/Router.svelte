<script context="module">
  import queryString from 'query-string';
  import Router from 'abstract-nested-router';

  import {
    CTX_ROUTER, ROOT_URL, hashchangeEnable, navigateTo, isActive, router,
  } from './utils';

  const baseRouter = new Router();
</script>

<script>
  import {
    onMount, onDestroy, getContext, setContext,
  } from 'svelte';

  import { writable } from 'svelte/store';

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

        prev[cur.key] = Object.assign(prev[cur.key] || {}, cur.params);
      }

      return prev;
    }, {});

    map.some(x => {
      if (x.key && x.matches && !$routeInfo[x.key]) {
        if (typeof x.condition === 'boolean' || typeof x.condition === 'function') {
          const ok = typeof x.condition === 'function' ? x.condition($router) : x.condition;

          if (ok !== true && x.redirect) {
            navigateTo(x.redirect);
            return true;
          }
        }

        if (x.redirect && !x.condition) {
          navigateTo(x.redirect);
          return true;
        }

        if (!x.fallback) {
          $routeInfo[x.key] = {
            ...x,
            query: _query,
            params: _params[x.key],
          };
        }
      }

      return false;
    });
  }

  function resolveRoutes() {
    clearTimeout(resolveRoutes.t);

    resolveRoutes.t = setTimeout(() => {
      failure = null;
      $routeInfo = {};

      let baseUri = !hashchangeEnable() ? location.href.replace(location.origin, '') : location.hash;

      // unprefix active URL
      if (ROOT_URL !== '/') {
        baseUri = baseUri.replace(ROOT_URL, '');
      }

      const [fullpath, searchQuery] = baseUri.replace('/#', '#').split('?');
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
        // FIXME: this smeels like more compelxity... how to avoid?
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
    }, 50);
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
