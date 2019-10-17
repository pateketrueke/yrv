import { writable } from 'svelte/store';
import queryString from 'query-string';

export const router = writable({
  path: '/',
  params: {},
});

export const CTX_ROUTER = {};
export const CTX_ROUTE = {};

// use location.hash on embedded pages, e.g. Svelte REPL
export let HASHCHANGE = location.origin === 'null';

export function hashchangeEnable(value) {
  if (typeof value === 'boolean') {
    HASHCHANGE = !!value;
  }

  return HASHCHANGE;
}

export function fixedLocation(path, callback) {
  const baseUri = hashchangeEnable() ? location.hash.replace('#', '') : location.pathname;

  // this will rebase anchors to avoid location changes
  if (path.charAt() !== '/') {
    path = baseUri + path;
  }

  // do not change location et all...
  if ((baseUri + location.search) !== path) {
    callback(path);
  }
}

export function navigateTo(path, options) {
  const {
    reload, replace,
    params, queryParams,
  } = options || {};

  // If path empty or no string, throws error
  if (!path || typeof path !== 'string') {
    throw new Error(`yrv expects navigateTo() to have a string parameter. The parameter provided was: ${path} of type ${typeof path} instead.`);
  }

  if (path[0] !== '/' && path[0] !== '#') {
    throw new Error(`yrv expects navigateTo() param to start with slash or hash, e.g. "/${path}" or "#${path}" instead of "${path}".`);
  }

  if (params) {
    path = path.replace(/:([a-zA-Z][a-zA-Z0-9_-]*)/g, (_, key) => params[key]);
  }

  if (queryParams) {
    const qs = queryString.stringify(queryParams);

    if (qs) {
      path += `?${qs}`;
    }
  }

  if (hashchangeEnable()) {
    location.hash = path.replace(/^#/, '');
    return;
  }

  // If no History API support, fallbacks to URL redirect
  if (reload || !history.pushState || !dispatchEvent) {
    location.href = path;
    return;
  }

  // If has History API support, uses it
  fixedLocation(path, nextURL => {
    history[replace ? 'replaceState' : 'pushState'](null, '', nextURL);
    dispatchEvent(new Event('popstate'));
  });
}

export function isActive(uri, path, exact) {
  if (exact !== true && path.indexOf(uri) === 0) {
    return /^[#/?]?$/.test(path.substr(uri.length, 1));
  }

  return path === uri;
}
