import { writable } from 'svelte/store';
import { Router, stringify } from '../vendor';

const cache = {};
const baseTag = document.getElementsByTagName('base');
const basePrefix = (baseTag[0] && baseTag[0].href) || '/';

export const ROOT_URL = basePrefix.replace(window.location.origin, '');

export const router = writable({
  path: '/',
  query: {},
  params: {},
  initial: true,
});

export const CTX_ROUTER = {};
export const CTX_ROUTE = {};

// use location.hash on embedded pages, e.g. Svelte REPL
let HASHCHANGE = window.location.origin === 'null';

export function hashchangeEnable(value) {
  if (typeof value === 'boolean') {
    HASHCHANGE = !!value;
  }

  return HASHCHANGE;
}

Object.defineProperty(router, 'hashchange', {
  set: value => hashchangeEnable(value),
  get: () => hashchangeEnable(),
  configurable: false,
  enumerable: false,
});

export function fixedLocation(path, callback, doFinally) {
  const baseUri = router.hashchange ? window.location.hash.replace('#', '') : window.location.pathname;

  // this will rebase anchors to avoid location changes
  if (path.charAt() !== '/') {
    path = baseUri + path;
  }

  const currentURL = baseUri + window.location.hash + window.location.search;

  // do not change location et all...
  if (currentURL !== path) {
    callback(path);
  }

  // invoke final guard regardless of previous result
  if (typeof doFinally === 'function') {
    doFinally();
  }
}

export function cleanPath(uri, fix) {
  return uri !== '/' || fix ? uri.replace(/\/$/, '') : uri;
}

export function navigateTo(path, options) {
  const {
    reload, replace,
    params, queryParams,
  } = options || {};

  // If path empty or no string, throws error
  if (!path || typeof path !== 'string' || (path[0] !== '/' && path[0] !== '#')) {
    throw new Error(`Expecting '/${path}' or '#${path}', given '${path}'`);
  }

  if (params) {
    path = path.replace(/:([a-zA-Z][a-zA-Z0-9_-]*)/g, (_, key) => params[key]);
  }

  if (queryParams) {
    const qs = stringify(queryParams);

    if (qs) {
      path += `?${qs}`;
    }
  }

  if (router.hashchange) {
    let fixedURL = path.replace(/^#|#$/g, '');

    if (ROOT_URL !== '/') {
      fixedURL = fixedURL.replace(cleanPath(ROOT_URL), '');
    }

    window.location.hash = fixedURL !== '/' ? fixedURL : '';
    return;
  }

  // If no History API support, fallbacks to URL redirect
  if (reload || !window.history.pushState || !window.dispatchEvent) {
    window.location.href = path;
    return;
  }

  // If has History API support, uses it
  fixedLocation(path, nextURL => {
    window.history[replace ? 'replaceState' : 'pushState'](null, '', nextURL);
    window.dispatchEvent(new Event('popstate'));
  });
}

export function getProps(given, required) {
  const { props: sub, ...others } = given;

  // prune all declared props from this component
  required.forEach(k => {
    delete others[k];
  });

  return {
    ...sub,
    ...others,
  };
}

export function isActive(uri, path, exact) {
  if (!cache[[uri, path, exact]]) {
    if (exact !== true && path.indexOf(uri) === 0) {
      cache[[uri, path, exact]] = /^[#/?]?$/.test(path.substr(uri.length, 1));
    } else if (uri.includes('*') || uri.includes(':')) {
      cache[[uri, path, exact]] = Router.matches(uri, path);
    } else {
      cache[[uri, path, exact]] = cleanPath(path) === uri;
    }
  }

  return cache[[uri, path, exact]];
}

export function isPromise(object) {
  return object && typeof object.then === 'function';
}

export function isSvelteComponent(object) {
  return object && object.prototype;
}
