import { writable } from 'svelte/store';
import queryString from 'query-string';

export const router = writable({});

export const CTX_ROUTER = {};
export const CTX_ROUTE = {};

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
    path = path.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, (_, key) => params[key]);
  }

  if (queryParams) {
    const qs = queryString.stringify(queryParams);

    if (qs) {
      path += `?${qs}`;
    }
  }

  // if (window.location.pathname !== path) {
    // If no History API support, fallbacks to URL redirect
    if (reload || !history.pushState || !window.dispatchEvent) {
      window.location.href = path;
      return;
    }

    // If has History API support, uses it
    history[replace ? 'replaceState' : 'pushState'](null, '', path);
    window.dispatchEvent(new Event('popstate'));
  // }
}
