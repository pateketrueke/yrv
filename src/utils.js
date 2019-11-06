import Router from 'abstract-nested-router';
import { writable } from 'svelte/store';
import queryString from 'query-string';

const cache = {};
const baseTag = document.getElementsByTagName('base');
const basePrefix = (baseTag[0] && baseTag[0].href.replace(/\/$/, '')) || '/';

export const ROOT_URL = basePrefix.replace(window.location.origin, '');

export const router = writable({
  path: '/',
  query: {},
  params: {},
});

export const CTX_ROUTER = {};
export const CTX_ROUTE = {};

// use location.hash on embedded pages, e.g. Svelte REPL
export let HASHCHANGE = window.location.origin === 'null';

export function hashchangeEnable(value) {
  if (typeof value === 'boolean') {
    HASHCHANGE = !!value;
  }

  return HASHCHANGE;
}

export function fixedLocation(path, callback) {
  const baseUri = hashchangeEnable() ? window.location.hash.replace('#', '') : window.location.pathname;

  // this will rebase anchors to avoid location changes
  if (path.charAt() !== '/') {
    path = baseUri + path;
  }

  const currentURL = baseUri + window.location.hash + window.location.search;

  // do not change location et all...
  if (currentURL !== path) {
    callback(path);
  }
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

  // rebase active URL
  if (ROOT_URL !== '/' && path.indexOf(ROOT_URL) !== 0) {
    path = ROOT_URL + path;
  }

  if (queryParams) {
    const qs = queryString.stringify(queryParams);

    if (qs) {
      path += `?${qs}`;
    }
  }

  if (hashchangeEnable()) {
    window.location.hash = path.replace(/^#/, '');
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

export function isActive(uri, path, exact) {
  if (!cache[[uri, path, exact]]) {
    if (exact !== true && path.indexOf(uri) === 0) {
      cache[[uri, path, exact]] = /^[#/?]?$/.test(path.substr(uri.length, 1));
    } else if (uri.includes('*') || uri.includes(':')) {
      cache[[uri, path, exact]] = Router.matches(uri, path);
    } else {
      cache[[uri, path, exact]] = path === uri;
    }
  }

  return cache[[uri, path, exact]];
}
