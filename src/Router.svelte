<script context="module">
  import { writable } from 'svelte/store';
  import queryString from 'query-string';
  import Router from 'abstract-nested-router';

  import { CTX_ROUTER, navigateTo, router } from './utils';

  const baseRouter = new Router();

  function handleRoutes(map, query, callback) {
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
      if (x.key && x.matches && !_routes[x.key]) {
        if (typeof x.condition === 'boolean' || typeof x.condition === 'function') {
          const ok = typeof x.condition === 'function' ? x.condition() : x.condition;

          if (ok !== true && x.redirect) {
            navigateTo(x.redirect);
            skip = true;
            return true;
          }
        }

        if (x.redirect && !x.condition) {
          navigateTo(x.redirect);
          skip = true;
          return true;
        }

        _routes[x.key] = { ...x, query, params: _params[x.key] };
      }

      return false;
    });

    if (!skip) {
      callback(_routes);
    }
  }

  function resolveRoutes(_path, query, callback) {
    const segments = _path.split('#')[0].split('/');
    const prefix = [];
    const map = [];

    segments.some(key => {
      const sub = prefix.concat(`/${key}`).join('');

      if (key) prefix.push(`/${key}`);

      try {
        const next = baseRouter.find(sub);

        handleRoutes(next, query, callback);
        map.push(...next);
      } catch (e) {
        console.log('FATAL?', e);
        return true;
      }

      return false;
    });

    return map;
  }

  function matchRoutes(rootDir, callback) {
    const [baseUri, searchQuery] = location.href.split('?');
    const fullpath = `/${baseUri.split('/').slice(3).join('/')}`;
    const query = queryString.parse(searchQuery);

    if (fullpath.indexOf(rootDir) === 0) {
      const found = resolveRoutes(fullpath, query, callback);

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
        }, []), query, callback);
      }
    }
  }
</script>

<script>
  import { onMount, getContext, setContext } from 'svelte';

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

  function resolveRoutes() {
    clearTimeout(resolveRoutes.t);

    resolveRoutes.t = setTimeout(() => {
      failure = null;
      $routeInfo = {};

      try {
        matchRoutes($basePath, matches => {
          $routeInfo = matches;
        });
      } catch (e) {
        if (!fallback) {
          failure = e;
          return;
        }

        console.log('FALLBACK', e);
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

{#if failure}
  <fieldset>
    <legend>Router failure: {path}</legend>
    <pre>{failure}</pre>
  </fieldset>
{/if}

<svelte:window on:popstate={resolveRoutes}></svelte:window>
