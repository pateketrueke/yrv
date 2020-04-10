<script>
  import {
    Router, Route, Link,
  } from '../../../src';
  import Home from './Home.svelte';
  import Players from './Players.svelte';
  import NotFound from './NotFound.svelte';
  import Login from './Login.svelte';

  let isLoggedIn = true;
</script>

<Link>Home</Link> |
<Link href="/players">Players</Link> |
<Link href="/notfound">Not found</Link> |
<input type="checkbox" bind:checked={isLoggedIn}> isLoggedIn

<Router>
  {#if isLoggedIn}
    <Route exact component="{Home}" />
    <Route path="/players" component="{Players}" />
    <Route fallback component={NotFound} />
  {:else}
    <Route fallback component={Login} />
  {/if}
</Router>
