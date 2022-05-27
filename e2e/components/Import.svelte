<script>
  import Router from '../../src/lib/Router.svelte';
  import Route from '../../src/lib/Route.svelte';

  function delay(promise) {
    return new Promise(ok => setTimeout(() => ok(promise), 500));
  }
</script>

<div data-test="container">
  <Router pending="Loading...">
    <Route fallback component={() => delay(import('./Example.svelte'))} />
  </Router>
</div>
