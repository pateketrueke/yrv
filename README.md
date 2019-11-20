<div align="center">

![yrv](yrv.png)

![Build status](https://github.com/pateketrueke/yrv/workflows/build/badge.svg)
[![NPM version](https://img.shields.io/npm/v/yrv)](https://www.npmjs.com/package/yrv)
[![Known Vulnerabilities](https://snyk.io/test/npm/yrv/badge.svg)](https://snyk.io/test/npm/yrv)

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

### `<Router {path} {disabled} {condition} {nofallback} />`

This component will hold any given routes as children, path is always derived from parent ones.

Available props:

- `{path}` &mdash; Any segment to derive a fullpath from, default to `/`
- `{disabled}` &mdash; Boolean; Similar to condition, but for bound props
- `{condition}` &mdash; Function; if given, render only if evaluates to true
- `{nofallback}` &mdash; If set, non-matched routes will never raise a failure

### `<Route {key} {path} {props} {exact} {fallback} {component} {disabled} {condition} {redirect} let:router />`

Main container for routing, they can hold any component or children.

Available props:

- `{key}` &mdash; The route identity, not its path; default to random pseudo-hash
- `{path}` &mdash; Any segment to derive a fullpath from, default to `/`
- `{props}` &mdash; Additional properties for rendered component
- `{exact}` &mdash; If set, the route will render only if the route exactly matches
- `{fallback}` &mdash; If set, the route will render only if no more routes were matched
- `{component}` &mdash; A valid svelte-component to render if the route matches
- `{disabled}` &mdash; Boolean; Similar to condition, but for bound props
- `{condition}` &mdash; Function; if given, the route will render only if evaluates to true
- `{redirect}` &mdash; Alternate redirection location, only if the previous condition was true
- `let:router` &mdash; Injects the `router` context, it also provides `failure` in case of errors

> If you omit `exact`, then `/x` would match both `/` and `/x` routes &mdash; [see docs](https://www.npmjs.com/package/abstract-nested-router#params)

### `<Link {go} {href} {title} {exact} {reload} {replace} {class|className} />`

In order to navigate, you can use `Link` components, or regular links, etc.

> All `href` values MUST be absolute, only links starting with `/` or `#` are allowed.

Available props:

- `{go}` &mdash; History shortcut (see below)
- `{href}` &mdash; New location, default to `/`
- `{title}` &mdash; HTML title-attribute value
- `{button}` &mdash; If set, will use button-tag instead
- `{exact}` &mdash; Determine if link should match exactly to be set as active
- `{reload}` &mdash; Use `location.href` instead
- `{replace}` &mdash; Use `history.replaceState()` instead
- `{class|className}` &mdash; Custom class-name for the mounted anchor

Normal `on:click` events are still allowed, so you can use:

```html
<Link on:click={() => location.reload()}>Reload</Link>
```

> Active _links_ will gain the `[aria-current]` attribute, and `[disabled]` if they're buttons.

Aditionally, you can setup  `go` to moving around:

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
