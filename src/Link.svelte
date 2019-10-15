<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { navigateTo, router } from './utils';

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
    const isActive = (exact !== true && $router.path.indexOf(href) === 0) || ($router.path === href);

    if (isActive && !active) {
      active = true;
      ref.setAttribute('aria-current', 'page');

      if (button) {
        ref.setAttribute('disabled', true);
      }
    }

    if (!isActive && active) {
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
    if (typeof go === 'string') {
      if (go === 'back') history.back();
      else if (go === 'fwd') history.forward();
      else history.go(parseInt(go, 10));
      return;
    }

    let fixedHref = href;

    // this will rebase anchors to avoid location changes
    if (fixedHref.charAt() !== '/') {
      fixedHref = window.location.pathname + fixedHref;
    }

    if (window.location.pathname !== fixedHref) {
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
