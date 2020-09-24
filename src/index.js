import Router from './lib/Router.svelte';
import Route from './lib/Route.svelte';
import Link from './lib/Link.svelte';

import { hashchangeEnable, navigateTo, router } from './lib/utils';

Object.defineProperty(Router, 'hashchange', {
  set: value => hashchangeEnable(value),
  get: () => hashchangeEnable(),
  configurable: false,
  enumerable: false,
});

export {
  Router,
  Route,
  Link,
  router,
  navigateTo,
};
