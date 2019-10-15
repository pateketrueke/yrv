# yrv

[![NPM version](https://badge.fury.io/js/yrv.png)](http://badge.fury.io/js/yrv)
[![travis-ci](https://api.travis-ci.org/pateketrueke/yrv.svg)](https://travis-ci.org/pateketrueke/yrv)

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
