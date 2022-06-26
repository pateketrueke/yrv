<script>
  import {
    Router, Route, Link, router,
  } from 'yrv';

  import Testing from './Testing.svelte';

  export let hashchange = null;

  router.hashchange = hashchange;

  let loggedIn;
  let myLink = '/';
  let count = 0;

  router.subscribe(info => {
    if (!info.initial) count += 1;
  });
</script>

<h1 id="top">
  <span>Example page</span>
  <small>{$router.path}</small>
</h1>

<p>This content is static, always shown.</p>

<Link exact href="/">Home</Link> | <Link href="/test">Test page</Link>
| <Link href="/sub">Anchor page</Link> | <Link href="/e">Error page</Link>

<p>
  Links can open windows, and they can set callbacks too:
  <Link open href="//google.com" on:close={() => /* eslint-disable no-alert */ alert('GREAT!')}>Open window</Link>
</p>

<Router path="/example">
  <Link exact href="/example/a">Link</Link> | <Link exact href="/example/a/b">Broken link</Link>

  <p data-test="example">
    <Route key="not-found" fallback>Not found?</Route>
    <Route key="hello-world" exact>Hello World</Route>
    <Route key="hello-name" exact path="/:name" let:router>Hello {router.params.name}</Route>
  </p>
</Router>

<p>
  Routes with exactly one segment are considered nested routes, e.g.

  <Link href="/top/foo/a">1</Link>
  | <Link href="/top/bar/b">2</Link>
  | <Link href="/top/bar/c">3</Link>
  | <Link href="/top">?</Link>
</p>

<p>
  Link's `href` can be changed as well, e.g.
  <Link data-test="customhref" href={myLink}>Change me!</Link>
  <input data-test="custominput" type="text" bind:value={myLink} />
</p>

<p data-test="nested">
  <Router key="top" path="/top">
    <Route key="x" exact fallback>?</Route>
    <Route key="a" exact path="/foo/a">a</Route>
    <Route key="b" exact path="/bar/b">b</Route>
    <Route key="c" exact path="/bar/c">c</Route>
  </Router>
</p>

<Router path="/test" nofallback>
  <Route key="test-root">
    <h2>Testing features</h2>

    <p>This content is always mounted when the current URL starts-with <tt>/test</tt>.</p>

    <Link exact button go="-1" href="/test">Undo</Link> | <Link href="/test/props">Test props</Link>

    | <Link href="/test/static">Redirect</Link>
    | <Link href="/test/dynamic">Protected</Link>

    <p data-test="redirect">
      <Route key="failed" path="/failed">Wrong!</Route>
      <Route key="static" path="/static" redirect="/test" />
      <Route key="dynamic" path="/dynamic" redirect="/test/failed" condition={() => /* eslint-disable no-alert */ window.confirm('Are you sure?')}>Yay!</Route>
    </p>
  </Route>

  <Route key="props" path="/props" component={Testing} />

  <p data-test="routeless">Any <tt>Route</tt>-less content is always shown!</p>
</Router>

<div data-test="hashed">
  <Router key="gist" path="/gist">
    <Route key="main" exact>GIST INFO</Route>
    <Router path="#:sha1" nofallback>
      <Route key="show" let:router>SHA1: {router.params.sha1 || 'N/A'}</Route>
      <Route key="edit" exact path="/edit">(edit)</Route>
      <Route key="save" exact path="/save">(save)</Route>
    </Router>
  </Router>
</div>

<Link exact href="/gist">gists</Link>
| <Link href="/gist#x" exact>gshow</Link>
| <Link href="/gist#x/edit">gedit</Link>
| <Link href="/gist#x/save">gsave</Link>

<hr />

<div data-test="logged">
  <label>
    <input type="checkbox" bind:checked={loggedIn} /> on/off
  </label>

  <Link exact href="/auth">&rarr;</Link>
  | <Link href="/auth/login">Login</Link>
  | <Link href="/auth/not_found">Not found</Link>
  | <Link href="/auth/protected">Protected page</Link>

  <Router path="/auth">
    <Route key="secure" path="/protected" condition={() => loggedIn} redirect="/auth/login">O.K.</Route>
    <Route key="login" path="/login">Log-in</Route>

    <Route key="check" condition={() => loggedIn} exact redirect="/auth/login" />
    <Route key="welcome" disabled={!loggedIn} exact>Welcome back.</Route>
  </Router>
</div>

<Router disabled={!loggedIn}>
  <p data-test="secret">
    <Route key="sh">Shhhh! Top-secret</Route>
  </p>
</Router>

<Router path="/sub">
  <Route key="sub">
    <Link exact href="/sub#">Root</Link> | <Link href="/sub#/about">About page</Link> | <Link href="/sub#broken">Broken anchor</Link>
  </Route>

  <p data-test="anchored">
    <Route key="home" exact path="#">HOME</Route>
    <Route key="about" exact path="#/about">ABOUT</Route>
  </p>
</Router>

<Router path="/e">
  <Route key="err" exact>
    <h2>It works!</h2>
  </Route>

  <Route key="404" fallback>
    <h2 data-test="fallback">NOT FOUND</h2>
  </Route>
</Router>

<div>
  <p>You can also hook into the router's state with <code>`router.subscribe(...)`, e.g.</code></p>
  <p data-test="counter">Times router-info has been changed: {count}</p>
</div>

<p data-test="unordered">
  <Router path="/page">
    <Route key="i" path="/:x/:y">I</Route>
    <Route key="ii" path="/:x">II</Route>
    <Route key="iii" path="/">III</Route>
  </Router>
</p>

<Link href="/page">List</Link>
<Link href="/page/1">Show</Link>
<Link href="/page/1/edit">Edit</Link>

<a style="margin-top:1000px;display:block" href="#top">&uarr;</a>
