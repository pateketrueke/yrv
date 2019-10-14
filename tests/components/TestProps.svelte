<script>
  import { Router, Route } from '../../src';

  export let router = null;
</script>

<h3>Injected parameters</h3>
<fieldset>
  <legend>router</legend>
  <ul>
    <li>key: {JSON.stringify(router.key)}</li>
    <li>matches: {JSON.stringify(router.matches)}</li>
    <li>params: {JSON.stringify(router.params)}</li>
    <li>route: {JSON.stringify(router.route)}</li>
    <li>path: {JSON.stringify(router.path)}</li>
  </ul>
</fieldset>

<Router>
  <Route path="/:value" let:router>
    <p>Value: {router.params.value}</p>
  </Route>
</Router>

