import { writable } from 'svelte/store';
import { Router, parse } from '../vendor';

import {
  ROOT_URL, navigateTo, cleanPath, isActive, router,
} from './utils';

export const baseRouter = new Router();
export const routeInfo = writable({});

// private registries
const onError = {};
const shared = {};

let errors = [];
let routers = 0;
let interval;
let currentURL;

// take snapshot from current state...
router.subscribe(value => { shared.router = value; });
routeInfo.subscribe(value => { shared.routeInfo = value; });

export function doFallback(failure, fallback) {
  routeInfo.update(defaults => ({
    ...defaults,
    [fallback]: {
      ...shared.router,
      failure,
    },
  }));
}

export function handleRoutes(map, params, enforce) {
  map.some(x => {
    if (x.key && (enforce || (x.matches && !shared.routeInfo[x.key]))) {
      if (x.redirect && (x.condition === null || x.condition(shared.router) !== true)) {
        if (x.exact && shared.router.path !== x.path) return false;
        navigateTo(x.redirect);
        return true;
      }

      if (x.exact && x.path !== currentURL) {
        if (currentURL.replace(/[#/]$/, '') !== x.path) return false;
      }

      if (enforce && x.fallback) {
        return false;
      }

      Object.assign(params, x.params);

      // upgrade matching routes!
      routeInfo.update(defaults => ({
        ...defaults,
        [x.key]: {
          ...shared.router,
          ...x,
        },
      }));
    }

    return false;
  });
}

export function evtHandler() {
  let baseUri = !router.hashchange ? window.location.href.replace(window.location.origin, '') : window.location.hash || '/';
  let failure;

  // unprefix active URL
  if (ROOT_URL !== '/') {
    baseUri = baseUri.replace(cleanPath(ROOT_URL), '');
  }

  // skip given anchors if already exists on document, see #43
  if (
    /^#[\w-]+$/.test(window.location.hash)
    && document.querySelector(window.location.hash)
    && currentURL === baseUri.split('#')[0]
  ) return;

  // trailing slash is required to keep route-info on nested routes!
  // see: https://github.com/pateketrueke/abstract-nested-router/commit/0f338384bddcfbaee30f3ea2c4eb0c24cf5174cd
  const normalizedURL = baseUri.replace('/#', '#').replace(/^#\//, '/');
  const [path, qs] = normalizedURL.split('?');
  const fullpath = path.replace(/\/?$/, '/');
  const params = {};

  if (currentURL !== normalizedURL) {
    currentURL = normalizedURL;
    router.set({
      path: cleanPath(fullpath),
      query: parse(qs),
      params,
    });
  }

  routeInfo.set({});

  // load all matching routes...
  baseRouter.resolve(fullpath, (err, result) => {
    if (err) {
      failure = err;
      return;
    }

    handleRoutes(result, params);
  });

  if (!failure) {
    try {
      handleRoutes(baseRouter.find(fullpath), params, true);
    } catch (e) {
      // noop
    }
  }

  // it's fine to omit failures for '/' paths
  if (failure && failure.path !== '/') {
    console.debug(failure);
  } else {
    failure = null;
  }

  // clear previously failed handlers
  errors.forEach(cb => cb());
  errors = [];

  let fallback;

  // invoke error-handlers to clear out previous state!
  Object.keys(onError).forEach(root => {
    if (isActive(root, fullpath, false)) {
      const fn = onError[root].callback;

      fn(failure);
      errors.push(fn);
    }

    if (!fallback && onError[root].fallback) {
      fallback = onError[root].fallback;
    }
  });

  // handle unmatched fallbacks
  if (failure && fallback) {
    doFallback(failure, fallback);
  }
}

export function findRoutes() {
  clearTimeout(interval);
  interval = setTimeout(evtHandler);
}

export function addRouter(root, fallback, callback) {
  if (!routers) {
    window.addEventListener('popstate', findRoutes, false);
  }

  // register error-handlers
  if (!onError[root] || fallback) {
    onError[root] = { fallback, callback };
  }

  routers += 1;

  return () => {
    routers -= 1;

    if (!routers) {
      window.removeEventListener('popstate', findRoutes, false);
    }
  };
}
