<script>
  import {
    Router, Route, Link, router,
  } from '../src';

  /* global USE_HASH_CHANGE */
  if (typeof USE_HASH_CHANGE !== 'undefined' && USE_HASH_CHANGE) {
    Router.hashchange = USE_HASH_CHANGE;
  }

  function delay(promise) {
    return new Promise(ok => setTimeout(() => ok(promise), 200));
  }

  import Testing from './components/Testing.svelte';

  let loggedIn;
  let myLink = '/';
</script>

<h1>
  Example page
  <small>{$router.path}</small>
</h1>

<p>This content is static, always shown.</p>

<Link exact href="/">Home</Link> | <Link href="/test">Test page</Link>
| <Link href="/sub">Anchor page</Link> | <Link href="/e">Error page</Link>
| <Link exact href="/example">Example page</Link> | <Link href="/import">Call import</Link>

<p>
  Links can open windows, and thay can set callbacks too:
  <Link open href="//google.com" on:close={() => /* eslint-disable no-alert */ alert('GREAT!')}>Open window</Link>
</p>

<div data-test="container">
  <Router>
    <Route path="/import" component={() => delay(import('./components/Example.svelte'))} pending="Loading..." />
  </Router>
</div>

<Router path="/example">
  <Link exact href="/example/a">Link</Link> | <Link exact href="/example/a/b">Broken link</Link>

  <p data-test="example">
    <Route exact>Hello World</Route>
    <Route fallback>Not found</Route>
    <Route exact path="/:name" let:router>Hello {router.params.name}</Route>
  </p>
</Router>

<p>
  Routes with exactly one segment are considered nested routes, e.g.

  <Link href="/top/foo/a">1</Link>
  | <Link href="/top/bar/b">2</Link>
  | <Link href="/top/bar/c">3</Link>
</p>

<p>
  Link's `href` can be changed as well, e.g.
  <Link data-test="customhref" href={myLink}>Change me!</Link>
  <input data-test="custominput" type="text" bind:value={myLink} />
</p>

<p data-test="nested">
  <Router path="/top">
    <Route path="/foo/a">a</Route>
    <Route path="/bar/b">b</Route>
    <Route path="/bar/c">c</Route>
  </Router>
</p>

<Router path="/test" nofallback>
  <Route>
    <h2>Testing features</h2>

    <p>This content is always mounted when the current URL starts-with <tt>/test</tt>.</p>

    <Link exact button go="-1" href="/test">Undo</Link> | <Link href="/test/props">Test props</Link>

    | <Link href="/test/static">Redirect</Link>
    | <Link href="/test/dynamic">Protected</Link>

    <p data-test="redirect">
      <Route path="/failed">Wrong!</Route>
      <Route path="/static" redirect="/test" />
      <Route path="/dynamic" redirect="/test/failed" condition={() => /* eslint-disable no-alert */ window.confirm('Are you sure?')}>Yay!</Route>
    </p>
  </Route>

  <Route path="/props" component={Testing} />

  <p data-test="routeless">Any <tt>Route</tt>-less content is always shown!</p>
</Router>

<div data-test="hashed">
  <Router path="/gist">
    <Route exact>GIST INFO</Route>
    <Router path="#:sha1" nofallback>
      <Route let:router>SHA1: {router.params.sha1 || 'N/A'}</Route>
      <Route exact path="/edit">(edit)</Route>
      <Route exact path="/save">(save)</Route>
    </Router>
  </Router>
</div>

<div data-test="logged">
  <label>
    <input type="checkbox" bind:checked={loggedIn} /> on/off
  </label>

  <Link exact href="/auth">&rarr;</Link>
  | <Link href="/auth/login">Login</Link>
  | <Link href="/auth/not_found">Not found</Link>
  | <Link href="/auth/protected">Protected page</Link>

  <Router path="/auth">
    {#if !loggedIn}
      <Route exact redirect="/auth/login" />
    {:else}
      <Route exact>Welcome back.</Route>
    {/if}

    <Route path="/protected" condition={() => loggedIn} redirect="/auth/login">O.K.</Route>
    <Route path="/login">Log-in</Route>
  </Router>
</div>

<Router disabled={!loggedIn}>
  <p data-test="secret">
    <Route>Shhhh! Top-secret</Route>
  </p>
</Router>

<Router path="/sub">
  <Route>
    <Link exact href="/sub#">Root</Link> | <Link href="/sub#/about">About page</Link> | <Link href="/sub#broken">Broken anchor</Link>
  </Route>

  <p data-test="anchored">
    <Route exact path="#">HOME</Route>
    <Route exact path="#/about">ABOUT</Route>
  </p>
</Router>

<Router path="/e">
  <Route exact>
    <h2>It works!</h2>
  </Route>

  <Route fallback>
    <h2 data-test="fallback">NOT FOUND</h2>
  </Route>
</Router>
