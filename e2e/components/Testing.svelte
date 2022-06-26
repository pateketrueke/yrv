<script>
  import {
    Router, Route, Link, navigateTo,
  } from 'yrv';

  export let router = null;

  let newKey = '';
  let newValue = '';

  function overrideQueryParams(key, value) {
    if (key) {
      navigateTo(router.path, { replace: true, queryParams: { ...router.query, [key]: value } });
    }
  }

  function addNewValue() {
    overrideQueryParams(newKey, newValue);

    newKey = '';
    newValue = '';
  }

  function rmValue(key) {
    overrideQueryParams(key);
  }
</script>

<h3>Injected parameters</h3>

<fieldset data-test="parameters">
  <legend>router</legend>
  <ul>
    <li>key: {JSON.stringify(router.key)}</li>
    <li>matches: {JSON.stringify(router.matches)}</li>
    <li>params: {JSON.stringify(router.params)}</li>
    <li>route: {JSON.stringify(router.route)}</li>
    <li>query: {JSON.stringify(router.query)}</li>
    <li>path: {JSON.stringify(router.path)}</li>
  </ul>

  <table>
    <caption>QueryParams</caption>
    <tr>
      <th>key</th>
      <th>value</th>
    </tr>
    {#each Object.entries(router.query) as [key, value]}
      <tr>
        <td>{key}</td>
        <td>{value}</td>
        <td><button on:click={() => rmValue(key)}>rm</button></td>
      </tr>
    {/each}
    <tr>
      <td><input data-test="key" bind:value={newKey} /></td>
      <td><input data-test="value" bind:value={newValue} /></td>
      <td><button data-test="append" on:click={addNewValue}>add</td>
    </tr>
  </table>

  <Link on:click={() => overrideQueryParams('truth', 42)}>Do not click!</Link>
  | <Link href="/test/props/Hello%20World.">Hello World.</Link>
</fieldset>

<Router>
  <Route key="test-info" path="/:value" let:router>
    <p>Value: {router.params.value}</p>
  </Route>
</Router>
