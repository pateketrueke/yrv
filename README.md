<div align="center">

![yrv](Japan_road_sign_201-D.svg)

![Build status](https://github.com/pateketrueke/yrv/workflows/build/badge.svg)
[![NPM version](https://img.shields.io/npm/v/yrv)](https://www.npmjs.com/package/yrv)
[![Known Vulnerabilities](https://snyk.io/test/npm/yrv/badge.svg)](https://snyk.io/test/npm/yrv)
[![donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=8MXLRJ7QQXGYY)

</div>

> The `v` is for Svelte

Built on top of [abstract-nested-router](https://www.npmjs.com/package/abstract-nested-router), so you can use nested routers, also:

- Advanced parameters can be used, e.g. `/:id<\d+>` &mdash; [see docs](https://www.npmjs.com/package/abstract-nested-router#params)
- ARIA-compliant, sets `[aria-current="page"]` on active links
- Seamless `<base href="..." />` integration
- Conditionals and redirection through props
- Fallback `<Route />` handlers
- Hash and URI-based routes
- Support for [query-string](https://www.npmjs.com/package/query-string)
- [REPL ready!](https://svelte.dev/repl/0f07c6134b16432591a9a3a0095a80de?version=3.12.1)

> `yrv` will use any _base-href_ found on the current page to rewrite links and routes.

## Usage

Install `yrv` through NPM or Yarn:

```html
<script>
  import { Router, Route, Link } from 'yrv';
</script>

<Link href="/">Home</Link>
| <Link href="/World">Hello</Link>
| <Link href="/not/found">NotFound</Link>

<p>
  <Router>
    <Route exact>Hello World</Route>
    <Route fallback>Not found</Route>
    <Route exact path="/:name" let:router>Hey {router.params.name}!</Route>
  </Router>
</p>
```

> Notice `fallback` routes can’t be placed at the beginning, otherwise further routes will not be mounted. :bomb:

## Components

> You MUST declare at least, one top-level `Router` to setup the bindings.

### `<Router {path} {pending} {disabled} {condition} {nofallback} />`

This component will hold any given routes as children, `path` is always derived from parent routes.

Available props:

- `{path}` &mdash; Any segment to derive a fullpath from, defaults to `/`
- `{pending}` &mdash; Svelte-component or String; top-level `pending` support
- `{disabled}` &mdash; Boolean; Similar to condition, but for bound props
- `{condition}` &mdash; Function; if given, render only if evaluates to true
- `{nofallback}` &mdash; If set, non-matched routes will never raise a failure

> Nested routers does not need the same path to be declared inside, e.g. if the router for `/top` has a `/sub` router inside, inner router will use the route `/top/sub`, (the same as declaring `/top/sub` route outside the parent router).

### `<Route {key} {path} {exact} {pending} {fallback} {component} {disabled} {condition} {redirect} let:router />`

Main container for routing, they can hold any component or children.

Available props:

- `{key}` &mdash; The route identity, not its path; defaults to random pseudo-hash
- `{path}` &mdash; Any segment to derive a fullpath from, default to `/`
- `{exact}` &mdash; If set, the route will render only if the route exactly matches
- `{pending}` &mdash; Svelte-component or String; rendered during the loading of dynamic components
- `{fallback}` &mdash; If set, the route will render only if no more routes were matched
- `{component}` &mdash; Accepts either a valid svelte-component, a promise, or a dynamic import function
- `{disabled}` &mdash; Boolean; Similar to `condition`, but for bound props
- `{condition}` &mdash; Function; if given, the route will render only if evaluates to `true`
- `{redirect}` &mdash; Alternate redirection location, only if the previous condition was `true`
- `let:router` &mdash; Injects the `router` context, it also provides `failure` in case of errors

> If you omit `exact`, then `/x` would match both `/` and `/x` routes &mdash; [see docs](https://www.npmjs.com/package/abstract-nested-router#params)

When `yrv` adds a new route, it'll use any given `key` from its props &mdash; once routes are detached they're also removed from the router registry, due to that, the next time the same route is mounted a new key is generated (if isn't present already).

```html
<script>
  import SvelteComponent from 'path/to/svelte-component.svelte';
</script>

<Link href="/">Home</Link>
| <Link href="/svelte-component">Svelte component</Link>
| <Link href="/promise">Promised component</Link>
| <Link href="/lazy">Lazy component</Link>

<p>
  <Router>
    <Route exact>Hello World</Route>
    <Route exact path="/svelte-component" component={SvelteComponent}/>
    <Route exact path="/promise" component="{import('path/to/other-component.svelte')}"/>
    <Route exact path="/lazy" component="{() => import('path/to/another-component.svelte')}"/>
  </Router>
</p>
```

> Behind the scenes, for making dynamic-imports work, the bundler _should_ inline them or just write-out the required chunks to make it work natively (`<script type="module" />`) or through `shimport`, etc.

### `<Link {go} {href} {open} {title} {exact} {reload} {replace} {class} />`

In order to navigate, you can use `Link` components, or regular links, etc.

> All `href` values MUST be absolute, only links starting with `/` or `#` are allowed.

Available props:

- `{go}` &mdash; History shortcut (see below)
- `{href}` &mdash; New location, default to `/`
- `{open}` &mdash; Same behavior as `<a target="_blank">`
- `{title}` &mdash; HTML title-attribute value
- `{button}` &mdash; If set, will use button-tag instead
- `{exact}` &mdash; Determine if link should match exactly to be set as active
- `{reload}` &mdash; Use `location.href` instead
- `{replace}` &mdash; Use `history.replaceState()` instead
- `{class}` &mdash; Custom class-name for the mounted anchor

> The value for `open` can be a string including the window specs, e.g. `width=400,height=200` &mdash; a `on:close` event will be fired once the opened window is closed.

Normal `on:click` events are still allowed, so you can use:

```html
<Link on:click={() => location.reload()}>Reload</Link>
```

> Active _links_ will gain the `[aria-current]` attribute, and `[disabled]` if they're buttons.

Aditionally, you can setup  `go` to move around:

- `"back"` &mdash; String; if given, will invoke `history.back()`
- `"fwd"` &mdash; String; if given, will invoke `history.fwd()`
- `n` &mdash; Number; if given, it'll be used to invoke `history.go(n)`

> If navigating through `history` is not possible a normal redirection will run. :anchor:

## Public API

- `navigateTo(path[, options])` &mdash; Change the location, supported options are:
  - `reload` &mdash; If true, it will use `document.location.href` instead
  - `replace` &mdash; If true, it will use `history.replaceState()` instead
  - `params` &mdash; Used to replace `:placeholders` from given path
  - `queryParams` &mdash; Additional search-params for the new location
- `$router` &mdash; Store with shared routeInfo details, similar to `let:router`

> `yrv` gracefully degrades to `location.hash` on environments where `history` is not suitable, also it can be forced through `Router.hashchange = true`.

### Route Info

Route changes are propagated through stores, if you want to listen too just subscribe, e.g.

```js
import { router } from 'yrv';

router.subscribe(e => {
  if (!e.initial) console.log(e);
});
```

Using this technique you gain access to the same detail object as `let:router` does.

> Notice the `initial` property is present as soon the store is initialized, consecutive changes will not have it anymore.

### IE11 support

Support for IE11 is _granted_ if you include, at least, the following polyfills before your application:

```html
<script>if (!!window.MSInputMethodContext && !!document.documentMode)
  document.write('<script src="https://polyfill.io/v3/polyfill.min.js?features=default,Promise,Object.getOwnPropertyDescriptors"><\/script>');</script>
<script src="your-app.js"></script>
```

> `document.write()` is used because conditional comments were dropped in IE10, so this way you can conditionally load polyfills anyway.

Also, you MUST [enable either `buble` or `babel`](https://github.com/sveltejs/svelte/issues/2621) within your build pipeline to transpile down to ES5.

### Frequently Asked Questions

**How to conditionally render a `<Router />` component?**

Both Route/Router components support the `disabled` and `condition` props, but:

- Use `condition` to allow/disallow route-dispatching dynamically
- Use `disabled` to skip from rendering, it will add/remove the route

This new `disabled` prop would work as you're expecting:

```html
<Router disabled={!showNavBar}>
  ...
</Router>
```

**What means the `exact` property and how it works?**

Say you have three routes:

- `/a` (exact)
- `/a/b` (non-exact)
- `/a/b/c` (exact)

Now, you navigate from `/a` to `/a/b/c`:

- Since `/a` was active, and it was exact, `yrv` clears out the `routeInfo` for that route.
- Since `/a/b` is not exact, `yrv` activate this route because is half-way to the final route.

> If you plan to have more routes nested, then the route will never be `exact` (at least at top-levels).

This is also true for `<Link />` components &mdash; as soon as they match the `[aria-current]` attribute will be added on them to denote _active_ links.

If the link for `/a` were also `exact`, then it'll be _active_ if the matching route is `/a` only.

**Why `path` can't be an empty string like other routers does?**

Even if browsers treat `http://localhost:8080` and `http://localhost:8080/` as the same thing I wanted to keep paths clear as possible.

Internally `yrv` normalizes any given URI to keep a trailing slash, so `/foo` is `/foo/` for matching purposes.

Also, the default path is usually `/` so there's no point on having to declare anything else:

```html
<Route>OK</Route>
<Route path="/">OK</Route>
```

**What is `routeInfo` and how can I access it outside routes?**

This object is very similar to what you get with `let:router` inside components.

Use the `$router` store to access it, e.g.

```html
<script>
  import { router } from 'yrv';
</script>
<pre>{JSON.stringify($router, null, 2)}</pre>
```

**Why does Yrv not work with Parcel or webpack/snowpack?**

If you're getting any of the errors below:

- store.subscribe is not a function
- Class constructor SvelteComponent cannot be invoked without 'new'
- 'on_outro' is not exported by [...]
- 'target' is a required option

Make sure you're using the right settings:

1. Add mainFields into resolve config, e.g. `mainFields: ['svelte', 'browser', 'module', 'main']`
2. Remove `exclude: /node_modules/` from `svelte-loader` config

> If you're using an online tool that is not the official Svelte REPL the behavior is unexpected and no further support will be granted.

**Can I use hash-based routes _à la_ Gmail? e.g. `index.html#/profile`, `index.html#/book/42`?**

Yes, URIs like that are suitable for embedded apps like Electron, where normal URLs would fail.

Also this mode is the default used on the Svelte REPL, because is not an iframe, nor a regular webpage... it's a weird thing!

> If you enable `Router.hashchange = true` all your regular links will be automatically rewritten to hash-based URIs instead, see how it works in our test suite.

**Why I'm getting `<Component> was created with unknown prop 'router'` in the browser's console?**

If you're not using the `router` prop inside your route-components then just add:

```html
<script>
  export const router = null;
</script>
```

That will remove the warning and also will make `eslint-plugin-svelte3` in your workflow happy.

**Why `router.subscribe` is called two times when I first open the page?**

Any subscription to stores will fire twice as they have an initial value, once the router resolves (e.g. the initial route) then a second event is fired.

> In this case, and additional property `initial` is added to identify such event.

**Is there any method that allows me to detect route change?**

Yes, you can subscribe to the router store, e.g. `router.subscribe(...)` &mdash; [see above](#route-info).

**Is there a way to reduce the bundle size of yrv?**

Since `v0.0.46` you'll be getting the most reduced version we can ship, however it comes without development warnings.

> Consume it as `import { ... } from 'yrv/debug'` right away and you'll get a more complete version with included DEBUG information.
