# yrv

[![NPM version](https://badge.fury.io/js/yrv.png)](http://badge.fury.io/js/yrv)
[![travis-ci](https://api.travis-ci.org/pateketrueke/yrv.svg)](https://travis-ci.org/pateketrueke/yrv)
[![Known Vulnerabilities](https://snyk.io/test/npm/yrv/badge.svg)](https://snyk.io/test/npm/yrv)

> The `v` is for Svelte

Built on top of [abstract-nested-router](https://www.npmjs.com/package/abstract-nested-router), so you can use nested routers, also:

- Advanced parameters can be used, e.g. `/:id<\d+>` &mdash; [see docs](https://www.npmjs.com/package/abstract-nested-router#params)
- Conditional montage and redirection through props
- Cascade montage of matched routes
- Fallback `<Route />` handlers
- Hash and URI-based routes
- Support for [query-string](https://www.npmjs.com/package/query-string)

## Usage

Install `yrv` through NPM or Yarn, and then:

```html
<script>
  import { Router, Route } from 'yrv';
</script>

<Router>
  <Route exact path="/">Hello World</Route>
  <Route exact path="/:name" let:router>Hello {router.params.name}</Route>
</Router>
```

## Components

> You MUST declare at least, one top-level `Router` to setup the bindings.

### `<Router {path} {nofallback} />`

This component will hold any given routes as children, path is always derived from parent ones.

Available props:

- `{path}` &mdash; Any segment to derive a fullpath from, default to `/`
- `{nofallback}` &mdash; If set, non-matched routes will never raise a failure

### `<Route {key} {path} {props} {exact} {fallback} {component} {condition} {redirect} />`

Main container for routing, they can hold any component or children.

Available props:

- `{key}` &mdash; The route identity, not its path; default to random pseudo-hash
- `{path}` &mdash; Any segment to derive a fullpath from, default to `/`
- `{props}` &mdash; Additional properties for rendered component
- `{exact}` &mdash; If given, the route will render only if the route exactly matches
- `{fallback}` &mdash; If given, the route will render only if no more routes were matched
- `{component}` &mdash; A valid svelte-component to render if the route matches
- `{condition}` &mdash; Function; if given, the route will render only if evaluates to true
- `{redirect}` &mdash; Alternate redirection location, only if the previous condition was true

> If you omit `exact`, then `/x` would match both `/` and `/x` routes &mdash; [see docs](https://www.npmjs.com/package/abstract-nested-router#params)

### `<Link {href} {title} {exact} {reload} {replace} {class|className} />`

In order to navigate, you can use `Link` components, or regular links, etc.

Available props:

- `{href}` &mdash; New location, default to '/'
- `{title}` &mdash; HTML title-attribute value
- `{exact}` &mdash; Determine if link should match exactly to be set as active
- `{reload}` &mdash; Use `location.href` instead
- `{replace}` &mdash; Use `history.replaceState()` instead
- `{class|className}` &mdash; Custom class-name for the mounted anchor

Normal `on:click` events are still allowed, so you can use:

```html
<Link on:click={() => navigateTo('/')}>Back to home</Link>
```

> Active links will gain the `[aria-current]` attribute, no other classes/attributes are set.

## Public API

- `navigateTo(path[, options])` &mdash; Change the location, supported options are:
  - `reload` &mdash; If true, it will use `document.location.href` instead
  - `replace` &mdash; If true, it will use `history.replaceState()` instead
  - `params` &mdash; Used to replace `:placeholders` from given path
  - `queryParams` &mdash; Additional search-params for the new location
- `$router` &mdash; Store with shared routeInfo details, similar to `let:router`
