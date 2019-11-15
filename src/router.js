import queryString from 'query-string';
import Router from 'abstract-nested-router';
import { writable } from 'svelte/store';

import {
  ROOT_URL, hashchangeEnable, navigateTo, isActive, router,
} from './utils';

export const baseRouter = new Router();
export const routeInfo = writable({});

// private registries
const onError = {};
const shared = {};

let routers = 0;
let interval;

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

export function handleRoutes(map, params) {
  const keys = [];

  map.some(x => {
    if (x.key && x.matches && !x.fallback && !shared.routeInfo[x.key]) {
      if (x.redirect && (x.condition === null || x.condition(shared.router) !== true)) {
        if (x.exact && shared.router.path !== x.path) return false;
        navigateTo(x.redirect);
        return true;
      }

      if (x.exact) {
        keys.push(x.key);
      }

      // extend shared params...
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

  return keys;
}

export function evtHandler() {
  let baseUri = !hashchangeEnable() ? window.location.href.replace(window.location.origin, '') : window.location.hash || '/';
  let failure;

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

  // load all matching routes...
  baseRouter.resolve(fullpath, (err, result) => {
    if (err) {
      failure = err;
      return;
    }

    // save exact-keys for deletion after failures!
    keys.push(...handleRoutes(result, params));
  });

  const toDelete = {};

  if (failure) {
    keys.reduce((prev, cur) => {
      prev[cur] = null;
      return prev;
    }, toDelete);
  }

  try {
    // clear routes that not longer matches!
    baseRouter.find(fullpath).forEach(sub => {
      if (sub.exact && !sub.matches) {
        toDelete[sub.key] = null;
      }
    });
  } catch (e) {
    // this is fine
  }

  // drop unwanted routes...
  routeInfo.update(defaults => ({
    ...defaults,
    ...toDelete,
  }));

  let fallback;

  // invoke error-handlers to clear out previous state!
  Object.keys(onError).forEach(root => {
    if (isActive(root, fullpath, false)) {
      onError[root].callback(failure);
    }

    if (onError[root].fallback) {
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
  onError[root] = { fallback, callback };
  routers += 1;

  return () => {
    delete onError[root];
    routers -= 1;

    if (!routers) {
      window.removeEventListener('popstate', findRoutes, false);
    }
  };
}
