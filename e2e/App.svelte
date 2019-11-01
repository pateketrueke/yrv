<script>
  import {
    Router, Route, Link, router, navigateTo,
  } from '../src';

  if (typeof USE_HASH_CHANGE !== 'undefined' && USE_HASH_CHANGE) {
    Router.hashchange = USE_HASH_CHANGE;
  }

  import Testing from './components/Testing.svelte';
</script>

<h1>
  Example page
  <small>{$router.path}</small>
</h1>

<p>This content is static, always shown.</p>

<Link exact href="/">Home</Link> | <Link href="/test">Test page</Link>
| <Link href="/sub">Anchor page</Link> | <Link href="/e">Error page</Link>
| <Link exact href="/example">Example page</Link>

<Router path="/example">
  | <Link exact href="/example/a">Link</Link> | <Link exact href="/example/a/b">Broken link</Link>

  <p data-test="example">
    <Route exact>Hello World</Route>
    <Route path="/:name" let:router>Hello {router.params.name}</Route>
    <Route fallback>Not found</Route>
  </p>
</Router>

<p>
  Routes with exactly one segment are considered nested routes, e.g.

  <Link href="/top/foo/a">1</Link>
  | <Link href="/top/bar/b">2</Link>
  | <Link href="/top/bar/c">3</Link>
</p>

<p data-test="nested">
  <Router path="/top">
    <Route path="/foo/a">a</Route>
    <Route path="/bar/b">b</Route>
    <Route path="/bar/c">c</Route>
  </Router>
</p>

<Router path="/test" nofallback>
  <Route path="/">
    <h2>Testing features</h2>

    <p>This content is always mounted when the current URL starts-with <tt>/test</tt>.</p>

    <Link exact button go="-1" href="/test">Undo</Link> | <Link href="/test/props">Test props</Link>

    | <Link href="/test/static">Redirect</Link>
    | <Link href="/test/dynamic">Protected</Link>

    <p data-test="redirect">
      <Route path="/failed">Wrong!</Route>
      <Route path="/static" redirect="/test" />
      <Route path="/dynamic" redirect="/test/failed" condition={() => confirm('Are you sure?')}>Yay!</Route>
    </p>
  </Route>

  <Route path="/props" component={Testing} />

  <p data-test="routeless">Any <tt>Route</tt>-less content is always shown!</p>
</Router>

<Router exact path="/sub">
  <Route>
    <Link exact href="/sub#">Root</Link> | <Link href="/sub#/about">About page</Link> | <Link href="/sub#broken">Broken anchor</Link>
  </Route>

  <p data-test="anchored">
    <Route path="#">HOME</Route>
    <Route path="#/about">ABOUT</Route>
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
