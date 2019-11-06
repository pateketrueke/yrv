import queryString from 'query-string';
import Router from 'abstract-nested-router';
import { writable } from 'svelte/store';

import {
  ROOT_URL, hashchangeEnable, navigateTo, isActive, router,
} from './utils';

export const baseRouter = new Router();
export const routeInfo = writable({});

const context = {};
const callbacks = {};

let routers = 0;
let interval;

// take snapshot from current state...
router.subscribe(value => { context.router = value; });
routeInfo.subscribe(value => { context.routeInfo = value; });

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

export function findRoutes() {
  clearTimeout(interval);
  interval = setTimeout(evtHandler);
}

export function addRouter(root, callback) {
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

export function doFallback(failure, fallback) {
  routeInfo.update(defaults => ({
    ...defaults,
    [fallback]: {
      ...context.router,
      failure,
    },
  }));
}
