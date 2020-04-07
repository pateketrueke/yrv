<script>
  import {
    Router, Route, router,
  } from '../src';

  function delay(promise) {
    return new Promise(ok => setTimeout(() => ok(promise), 200));
  }
</script>

<h1>
  Example page
  <small>{$router.path}</small>
</h1>

<div data-test="container">
  <Router>
    <Route path="/" component={() => delay(import('./components/Example.svelte'))} pending="Loading..." />
  </Router>
</div>
