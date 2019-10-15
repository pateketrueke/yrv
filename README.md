# yrv

[![NPM version](https://badge.fury.io/js/yrv.png)](http://badge.fury.io/js/yrv)
[![travis-ci](https://api.travis-ci.org/pateketrueke/yrv.svg)](https://travis-ci.org/pateketrueke/yrv)
[![Known Vulnerabilities](https://snyk.io/test/npm/yrv/badge.svg)](https://snyk.io/test/npm/yrv)

> The `v` is for Svelte

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

...

### `<Router {path} {nofallback} />`

...

Available props:

- `{path}` &mdash;
- `{nofallback}` &mdash;

### `<Route {key} {path} {props} {exact} {fallback} {component} {condition} {redirect} />`

...

Available props:

- `{key}` &mdash;
- `{path}` &mdash;
- `{props}` &mdash;
- `{exact}` &mdash;
- `{fallback}` &mdash;
- `{component}` &mdash;
- `{condition}` &mdash;
- `{redirect}` &mdash;

### `<Link {href} {title} {exact} {reload} {replace} {class|className} />`

...

Available props:

- `{href}` &mdash;
- `{title}` &mdash;
- `{exact}` &mdash;
- `{reload}` &mdash;
- `{replace}` &mdash;
- `{class|className}` &mdash;

> Active links will gain the `[aria-current]` attribute, no other classes/attributes are set.

## Public API

- `navigateTo(path[, options])` &mdash; Change the location, supported options are:
  - `reload` &mdash; If true, it will use `document.location.href` instead
  - `replace` &mdash; If true, it will use `replaceState` instead
  - `params` &mdash; Used to replace `:placeholders` from given path
  - `queryParams` &mdash; Additional search-params for the new location
- `$router` &mdash; Store with shared routeInfo details, similar to `let:router`
