<script>
  import { Router, Route, Link } from 'yrv';

  import Home from './Home.svelte';
  import Players from './Players.svelte';
  import NotFound from './NotFound.svelte';
  import Login from './Login.svelte';

  let isLoggedIn = true;
</script>

<Link href="/">Home</Link> |
<Link href="/players">Players</Link> |
<Link href="/notfound">Not found</Link> |
<input type="checkbox" bind:checked={isLoggedIn}> isLoggedIn

<Router>
  {#if isLoggedIn}
    <Route key="home" exact component="{Home}" />
    <Route key="players" path="/players" component="{Players}" />
    <Route key="404" fallback component={NotFound} />
  {:else}
    <Route key="ask" fallback component={Login} />
  {/if}
</Router>
