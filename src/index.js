import Router from './lib/Router.svelte';

import { hashchangeEnable } from './lib/utils';

export { default as Router } from './lib/Router.svelte';
export { default as Route } from './lib/Route.svelte';
export { default as Link } from './lib/Link.svelte';

export { navigateTo, router } from './lib/utils';

Object.defineProperty(Router, 'hashchange', {
  set: value => hashchangeEnable(value),
  get: () => hashchangeEnable(),
  configurable: false,
  enumerable: false,
});
