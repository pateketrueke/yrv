<script context="module">
  import Router from 'abstract-nested-router';
  import { CTX_ROUTER, navigateTo, router } from './utils';

  const baseRouter = new Router();
</script>

<script>
  import { writable } from 'svelte/store';
  import { onMount, getContext, setContext } from 'svelte';

  let t;
  let failure;
  let fallback;

  export let path = '/';
  export let nofallback = null;

  const routeInfo = writable({});
  const routerContext = getContext(CTX_ROUTER);
  const basePath = routerContext ? routerContext.basePath : writable(path);

  function cleanPath(route) {
    return route.replace(/\?[^#]*/, '').replace(/(?!^)\/#/, '#').replace('/#', '#').replace(/\/$/, '');
  }

  function fixPath(route) {
    if (route === '/#*' || route === '#*') return '#*_';
    if (route === '/*' || route === '*') return '/*_';
    return route;
  }

  function handleRoutes(map, _path) {
    const _shared = {
      params: {},
      path: _path || '/',
    };

    const _params = map.reduce((prev, cur) => {
      if (cur.key) {
        Object.assign(_shared.params, cur.params);

        prev[cur.key] = Object.assign(prev[cur.key] || {}, cur.params);
      }

      return prev;
    }, {});

    const routes = {};

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

      if (x.key && x.matches && !routes[x.key]) {
        routes[x.key] = { ...x, params: _params[x.key] };
      }

      return false;
    });

    $router = _shared;

    if (!skip) {
      failure = null;
      $routeInfo = routes;
    }
  }

  function doFallback(e, path) {
    $routeInfo[fallback] = { failure: e, params: { _: path.substr(1) || undefined } };
  }

  function resolveRoutes(path) {
    const segments = path.split('#')[0].split('/');
    const prefix = [];
    const map = [];

    segments.forEach(key => {
      const sub = prefix.concat(`/${key}`).join('');

      if (key) prefix.push(`/${key}`);

      try {
        const next = baseRouter.find(sub);

        handleRoutes(next, path);
        map.push(...next);
      } catch (e_) {
        doFallback(e_, path);
      }
    });

    return map;
  }

  function handlePopState() {
    const fullpath = cleanPath(`/${location.href.split('/').slice(3).join('/')}`);

    try {
      const found = resolveRoutes(fullpath);

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
        }, []), fullpath);
      }
    } catch (e) {
      if (!fallback) {
        failure = e;
        return;
      }

      doFallback(e, fullpath);
    }
  }

  function _handlePopState() {
    clearTimeout(t);
    t = setTimeout(handlePopState, 100);
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

<svelte:window on:popstate={handlePopState}></svelte:window>

{#if failure && !nofallback}
  <fieldset>
    <legend>Router failure: {path}</legend>
    <pre>{failure}</pre>
  </fieldset>
{/if}

<slot />
