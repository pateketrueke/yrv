# yrv

[![NPM version](https://badge.fury.io/js/yrv.png)](http://badge.fury.io/js/yrv)
[![travis-ci](https://api.travis-ci.org/pateketrueke/yrv.svg)](https://travis-ci.org/pateketrueke/yrv)
[![Known Vulnerabilities](https://snyk.io/test/npm/yrv/badge.svg)](https://snyk.io/test/npm/yrv)

> The `v` is for Svelte

Built on top of [abstract-nested-router](https://www.npmjs.com/package/abstract-nested-router), so you can use nested routers, also:

- Advanced parameters can be used, e.g. `/:id<\d+>` &mdash; [see docs](https://www.npmjs.com/package/abstract-nested-router#params)
- Conditionals and redirection through props
- Fallback `<Route />` handlers
- Hash and URI-based routes
- Support for [query-string](https://www.npmjs.com/package/query-string)

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
    <Route exact path="/">Hello World</Route>
    <Route exact path="/:name" let:router>Hey {router.params.name}!</Route>
    <Route fallback>Not found</Route>
  </Router>
</p>
```

> In order to declare a catch-all route, the **Not found** handler, it should have a `fallback` attribute and it MUST be placed last. :bomb:

## Components

> You MUST declare at least, one top-level `Router` to setup the bindings.

### `<Router {path} {exact} {nofallback} />`

This component will hold any given routes as children, path is always derived from parent ones.

Available props:

- `{path}` &mdash; Any segment to derive a fullpath from, default to `/`
- `{exact}` &mdash; If set, all routes (but no routers) will inherit `exact`
- `{nofallback}` &mdash; If set, non-matched routes will never raise a failure

### `<Route {key} {path} {props} {exact} {fallback} {component} {condition} {redirect} let:router />`

Main container for routing, they can hold any component or children.

Available props:

- `{key}` &mdash; The route identity, not its path; default to random pseudo-hash
- `{path}` &mdash; Any segment to derive a fullpath from, default to `/`
- `{props}` &mdash; Additional properties for rendered component
- `{exact}` &mdash; If set, the route will render only if the route exactly matches
- `{fallback}` &mdash; If set, the route will render only if no more routes were matched
- `{component}` &mdash; A valid svelte-component to render if the route matches
- `{condition}` &mdash; Function; if given, the route will render only if evaluates to true
- `{redirect}` &mdash; Alternate redirection location, only if the previous condition was true
- `let:router` &mdash; Injects the `router` context, it also provides `failure` in case of errors

> If you omit `exact`, then `/x` would match both `/` and `/x` routes &mdash; [see docs](https://www.npmjs.com/package/abstract-nested-router#params)

### `<Link {href} {title} {exact} {reload} {replace} {class|className} />`

In order to navigate, you can use `Link` components, or regular links, etc.

> All `href` values MUST be absolute, only links starting with `/` or `#` are allowed.

Available props:

- `{href}` &mdash; New location, default to `/`
- `{title}` &mdash; HTML title-attribute value
- `{button}` &mdash; If set, will use button-tag instead
- `{exact}` &mdash; Determine if link should match exactly to be set as active
- `{reload}` &mdash; Use `location.href` instead
- `{replace}` &mdash; Use `history.replaceState()` instead
- `{class|className}` &mdash; Custom class-name for the mounted anchor

Normal `on:click` events are still allowed, so you can use:

```html
<Link on:click={() => navigateTo('/')}>Back to home</Link>
```

> Active _links_ will gain the `[aria-current]` attribute, and `[disabled]` if they're buttons.

## Public API

- `navigateTo(path[, options])` &mdash; Change the location, supported options are:
  - `reload` &mdash; If true, it will use `document.location.href` instead
  - `replace` &mdash; If true, it will use `history.replaceState()` instead
  - `params` &mdash; Used to replace `:placeholders` from given path
  - `queryParams` &mdash; Additional search-params for the new location
- `$router` &mdash; Store with shared routeInfo details, similar to `let:router`

> `yrv` gracefully degrades to `location.hash` on environments where `history` is not suitable, also it can be forced through `Router.hashchange = true`.
