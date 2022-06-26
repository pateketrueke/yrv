<script>
  import { Router, Route, Link } from 'yrv';

  import List from './List.svelte';
  import NewTeam from './NewTeam.svelte';
</script>

<h1>This is Players</h1>

<Link exact href="/players">List</Link> |
<Link href="/players/team/new">New Team</Link>

<Router>
  <Route key="list" exact component="{List}" />
  <Route key="new" path="/team/new" exact component="{NewTeam}" />
</Router>
