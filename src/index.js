import Router from './Router.svelte';
import Route from './Route.svelte';
import Link from './Link.svelte';

import { hashchangeEnable, navigateTo, router } from './utils';

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
