<script>
  import { Router, Route, Link } from '../src';
  import TestProps from './components/TestProps.svelte';
</script>

<h1>Example page</h1>

<p>This content is static, always shown.</p>

<Link href="/">Home</Link> | <Link href="/test">Test page</Link>

<Router path="/test">
  <Route path="/">
    <h2>Testing features</h2>

    <p>This content is always mounted when the current URL starts-with <tt>/test</tt>.</p>

    <Link href="/test">Back</Link> | <Link href="/test/props">Test props</Link>
  </Route>

  <Route path="/props" component={TestProps} />

  <p data-test="routeless">Any <tt>Route</tt>-less content is always shown!</p>
</Router>
