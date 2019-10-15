<script>
  import { Router, Route, Link } from '../src';
  import TestProps from './components/TestProps.svelte';
</script>

<h1>Example page</h1>

<p>This content is static, always shown.</p>

<Link href="/">Home</Link> | <Link href="/test">Test page</Link> | <Link href="/sub">Anchor page</Link> | <Link href="/e">Error page</Link>


<Router path="/test" nofallback>
  <Route path="/">
    <h2>Testing features</h2>

    <p>This content is always mounted when the current URL starts-with <tt>/test</tt>.</p>

    <Link href="/test">Back</Link> | <Link href="/test/props">Test props</Link>
  </Route>

  <Route path="/props" component={TestProps} />

  <p data-test="routeless">Any <tt>Route</tt>-less content is always shown!</p>
</Router>

<Router path="/sub">
  <Route>
    <Link href="/sub#">Root</Link> | <Link href="/sub#/about">About page</Link> | <Link href="/sub#broken">Broken anchor</Link>
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

  <Route fallback path="*">
    <h2 data-test="fallback">NOT FOUND</h2>
  </Route>
</Router>
