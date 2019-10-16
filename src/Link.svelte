<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { navigateTo, isActive, router } from './utils';

  let ref;
  let active;
  let cssClass = '';

  export let go = null;
  export let href = '/';
  export let title = '';
  export let button = false;
  export let exact = false;
  export let reload = false;
  export let replace = false;
  export let className = '';
  export { cssClass as class };

  $: if (ref && $router.path) {
    if (isActive(href, $router.path, exact)) {
      if (!active) {
        active = true;
        ref.setAttribute('aria-current', 'page');

        if (button) {
          ref.setAttribute('disabled', true);
        }
      }
    } else if (active) {
      active = false;
      ref.removeAttribute('disabled');
      ref.removeAttribute('aria-current');
    }
  }

  onMount(() => {
    className = className || cssClass;
  });

  const dispatch = createEventDispatcher();

  // this will enable `<Link on:click={...} />` calls
  function onClick(e) {
    if (typeof go === 'string' && history.length > 1) {
      if (go === 'back') history.back();
      else if (go === 'fwd') history.forward();
      else history.go(parseInt(go, 10));
      return;
    }

    let fixedHref = href;

    // this will rebase anchors to avoid location changes
    if (fixedHref.charAt() !== '/') {
      fixedHref = location.pathname + fixedHref;
    }

    // do not change location et all...
    if ((location.pathname + location.search) !== fixedHref) {
      navigateTo(fixedHref, { reload, replace });
      dispatch('click', e);
    }
  }
</script>

{#if button}
  <button bind:this={ref} class={className} {title} on:click|preventDefault={onClick}>
    <slot />
  </button>
{:else}
  <a {href} bind:this={ref} class={className} {title} on:click|preventDefault={onClick}>
    <slot />
  </a>
{/if}
