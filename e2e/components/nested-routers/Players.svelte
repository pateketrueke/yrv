<script>
  import Router from '../../../src/lib/Router.svelte';
  import Route from '../../../src/lib/Route.svelte';
  import Link from '../../../src/lib/Link.svelte';

  import List from './List.svelte';
  import NewTeam from './NewTeam.svelte';
</script>

<h1>This is Players</h1>

<Link exact href="/players">List</Link> |
<Link href="/players/team/new">New Team</Link>

<Router>
  <Route exact component="{List}" />
  <Route path="/team/new" exact component="{NewTeam}" />
</Router>
