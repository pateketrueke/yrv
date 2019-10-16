<script context="module">
  import queryString from 'query-string';
  import Router from 'abstract-nested-router';

  import { CTX_ROUTER, navigateTo, isActive, router } from './utils';

  const baseRouter = new Router();
</script>

<script>
  import { onMount, getContext, setContext } from 'svelte';
  import { writable } from 'svelte/store';

  let failure;
  let fallback;

  export let path = '/';
  export let exact = null;
  export let nofallback = false;

  const isExact = exact;
  const routerContext = getContext(CTX_ROUTER);
  const routeInfo = routerContext ? routerContext.routeInfo : writable({});
  const basePath = routerContext ? routerContext.basePath : writable(path);

  function fixPath(route) {
    if (route === '/#*' || route === '#*') return '#*_';
    if (route === '/*' || route === '*') return '/*_';
    return route;
  }

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

      const [baseUri, searchQuery] = location.href.split('?');
      const fullpath = `/${baseUri.split('/').slice(3).join('/')}`;
      const query = queryString.parse(searchQuery);
      const ctx = {};

      try {
        if (isActive($basePath, fullpath, exact)) {
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
      }
    }, 50);
  }

  function assignRoute(key, route, detail) {
    key = key || Math.random().toString(36).substr(2);

    const fixedRoot = $basePath !== path && $basePath !== '/'
      ? `${$basePath}${path !== '/' ? path : ''}`
      : path;

    const handler = { key, ...detail };

    let fullpath;

    baseRouter.mount(fixedRoot, () => {
      fullpath = baseRouter.add(route !== '/' ? fixPath(route) : '', handler);
      fallback = (handler.fallback && key) || fallback;
    });

    resolveRoutes();

    return [key, fullpath];
  }

  function unassignRoute(route) {
    baseRouter.rm(fixPath(route));
    resolveRoutes();
  }

  setContext(CTX_ROUTER, {
    isExact,
    basePath,
    routeInfo,
    assignRoute,
    unassignRoute,
  });
</script>

<slot />

{#if failure && !fallback}
  <fieldset>
    <legend>Router failure: {path}</legend>
    <pre>{failure}</pre>
  </fieldset>
{/if}

<svelte:window on:popstate={resolveRoutes}></svelte:window>
