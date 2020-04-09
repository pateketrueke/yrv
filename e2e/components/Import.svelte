<script>
  import {
    Router, Route,
  } from '../../src';

  function delay(promise) {
    return new Promise(ok => setTimeout(() => ok(promise), 200));
  }
</script>

<div data-test="container">
  <Router>
    <Route fallback component={() => delay(import('./Example.svelte'))} pending="Loading..." />
  </Router>
</div>
