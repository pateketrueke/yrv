<script>
  import { createEventDispatcher } from 'svelte';

  import {
    ROOT_URL, fixedLocation, navigateTo, isActive, getProps, router,
  } from './utils';

  let ref;
  let active;
  let cssClass = '';
  let fixedHref = null;

  export let go = null;
  export let open = null;
  export let href = '/';
  export let title = '';
  export let button = false;
  export let exact = false;
  export let reload = false;
  export let replace = false;
  export { cssClass as class };

  // rebase active URL
  $: if (!/^(\w+:)?\/\//.test(href)) {
    fixedHref = ROOT_URL + href;
  }

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

  // extract additional props
  /* global arguments */
  $: fixedProps = getProps($$props, arguments[0].$$.props);

  const dispatch = createEventDispatcher();

  // this will enable `<Link on:click={...} />` calls
  function onClick(e) {
    if (typeof go === 'string' && window.history.length > 1) {
      if (go === 'back') window.history.back();
      else if (go === 'fwd') window.history.forward();
      else window.history.go(parseInt(go, 10));
      return;
    }

    if (!fixedHref) {
      if (open) window.open(href);
      else window.location.href = href;
      return;
    }

    fixedLocation(href, nextURL => {
      navigateTo(nextURL, { reload, replace });
      dispatch('click', e);
    });
  }
</script>

{#if button}
  <button {...fixedProps} bind:this={ref} class={cssClass} {title} on:click|preventDefault={onClick}>
    <slot />
  </button>
{:else}
  <a {...fixedProps} href={fixedHref || href} bind:this={ref} class={cssClass} {title} on:click|preventDefault={onClick}>
    <slot />
  </a>
{/if}
