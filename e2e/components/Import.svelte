<script>
  import {
    Router, Route,
  } from 'yrv';

  function delay(promise) {
    return new Promise(ok => setTimeout(() => ok(promise), 500));
  }
</script>

<div data-test="container">
  <Router>
    <Route fallback component={() => delay(import('./Example.svelte'))} pending="Loading..." />
  </Router>
</div>
