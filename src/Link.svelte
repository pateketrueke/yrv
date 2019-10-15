<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { navigateTo, router } from './utils';

  let ref;
  let active;
  let cssClass = '';

  export let href = '/';
  export let exact = false;
  export let reload = false;
  export let replace = false;
  export let className = '';
  export let title = '';
  export { cssClass as class };

  $: if (ref && $router.path) {
    const isActive = (exact !== true && $router.path.indexOf(href) === 0) || ($router.path === href);

    if (isActive && !active) {
      active = true;
      ref.setAttribute('aria-current', 'page');
    }

    if (!isActive && active) {
      active = false;
      ref.removeAttribute('aria-current');
    }
  }

  onMount(() => {
    className = className || cssClass;
  });

  const dispatch = createEventDispatcher();

  // this will enable `<Link on:click={...} />` calls
  function onClick(e) {
    let fixedHref = href;

    // this will rebase anchors to avoid location changes
    if (fixedHref.charAt() !== '/') {
      fixedHref = window.location.pathname + fixedHref;
    }

    navigateTo(fixedHref, { reload, replace });
    dispatch('click', e);
  }
</script>

<a {href} bind:this={ref} class={className} {title} on:click|preventDefault={onClick}><slot /></a>
