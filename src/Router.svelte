<script context="module">
  import queryString from 'query-string';
  import Router from 'abstract-nested-router';
  import { CTX_ROUTER, navigateTo, router } from './utils';

  const baseRouter = new Router();

  let t;

</script>

<script>
  import { writable } from 'svelte/store';
  import { onMount, getContext, setContext } from 'svelte';

  let failure;
  let fallback;

  export let path = '/';
  export let nofallback = null;

  const routeInfo = writable({});
  const routerContext = getContext(CTX_ROUTER);
  const basePath = routerContext ? routerContext.basePath : writable(path);

  function fixPath(route) {
    if (route === '/#*' || route === '#*') return '#*_';
    if (route === '/*' || route === '*') return '/*_';
    return route;
  }

  function handleRoutes(map, _path, _query) {
    const _routes = {};
    const _shared = {};
    const _params = map.reduce((prev, cur) => {
      if (cur.key) {
        Object.assign(_shared, cur.params);

        prev[cur.key] = Object.assign(prev[cur.key] || {}, cur.params);
      }

      return prev;
    }, {});

    let skip;

    map.some(x => {
      if (typeof x.condition === 'boolean' || typeof x.condition === 'function') {
        const ok = typeof x.condition === 'function' ? x.condition() : x.condition;

        if (ok === false && x.redirect) {
          navigateTo(x.redirect);
          skip = true;
          return true;
        }
      }

      if (x.key && x.matches && !_routes[x.key]) {
        _routes[x.key] = {
          ...x,
          query: _query,
          params: _params[x.key],
        };
      }

      return false;
    });

    if (!skip) {
      failure = null;

      $routeInfo = _routes;
      $router.params = _shared;
      $router.query = _query;
      $router.path = _path || '/';
    }
  }

  function doFallback(e, path, queryParams) {
    $routeInfo[fallback] = {
      failure: e,
      query: queryParams,
      params: { _: path.substr(1) || undefined },
    };
  }

  function resolveRoutes(path, queryParams) {
    const segments = path.split('#')[0].split('/');
    const prefix = [];
    const map = [];

    segments.forEach(key => {
      const sub = prefix.concat(`/${key}`).join('');

      if (key) prefix.push(`/${key}`);

      try {
        const next = baseRouter.find(sub);

        handleRoutes(next, path, queryParams);
        map.push(...next);
      } catch (e_) {
        doFallback(e_, path, queryParams);
      }
    });

    return map;
  }

  function handlePopState() {
    const [baseUri, searchQuery] = location.href.split('?');

    const fullpath = `/${baseUri.split('/').slice(3).join('/')}`;
    const queryParams  = queryString.parse(searchQuery);

    try {
      const found = resolveRoutes(fullpath, queryParams);

      if (fullpath.includes('#')) {
        const next = baseRouter.find(fullpath);
        const keys = {};

        // override previous routes to avoid non-exact matches
        handleRoutes(found.concat(next).reduce((prev, cur) => {
          if (typeof keys[cur.key] === 'undefined') {
            keys[cur.key] = prev.length;
          }

          prev[keys[cur.key]] = cur;

          return prev;
        }, []), fullpath, queryParams);
      }
    } catch (e) {
      if (!fallback) {
        failure = e;
        return;
      }

      doFallback(e, fullpath, queryParams);
    }
  }

  function _handlePopState() {
    if (!t) {
      t = true;
      setTimeout(() => {
        t = false; handlePopState();
      }, 100);
    }
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

    _handlePopState();

    return [key, fullpath];
  }

  function unassignRoute(route) {
    baseRouter.rm(fixPath(route));
    _handlePopState();
  }

  setContext(CTX_ROUTER, {
    basePath,
    routeInfo,
    assignRoute,
    unassignRoute,
  });
</script>

<svelte:window on:popstate={_handlePopState}></svelte:window>

{#if failure && !nofallback}
  <fieldset>
    <legend>Router failure: {path}</legend>
    <pre>{failure}</pre>
  </fieldset>
{/if}

<slot />
