<script>
  import { createEventDispatcher } from 'svelte';

  import {
    ROOT_URL, fixedLocation, navigateTo, cleanPath, isActive, getProps, router,
  } from './utils';

  let ref;
  let active;
  let cssClass = '';
  let fixedHref = null;

  export let go = null;
  export let open = null;
  export let href = '';
  export let title = '';
  export let button = false;
  export let exact = false;
  export let reload = false;
  export let replace = false;
  export { cssClass as class };

  // replacement for `Object.keys(arguments[0].$$.props)`
  const thisProps = ['go', 'open', 'href', 'class', 'title', 'button', 'exact', 'reload', 'replace'];

  // rebase active URL
  $: if (!/^(\w+:)?\/\//.test(href)) {
    fixedHref = cleanPath(ROOT_URL, true) + cleanPath(router.hashchange ? `#${href}` : href);
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
  $: fixedProps = getProps($$props, thisProps);

  const dispatch = createEventDispatcher();

  // this will enable `<Link on:click={...} />` calls
  function handleOnClick(e) {
    e.preventDefault();

    if (typeof go === 'string' && window.history.length > 1) {
      if (go === 'back') window.history.back();
      else if (go === 'fwd') window.history.forward();
      else window.history.go(parseInt(go, 10));
      return;
    }

    if (!fixedHref && href !== '') {
      if (open) {
        let specs = typeof open === 'string' ? open : '';

        const wmatch = specs.match(/width=(\d+)/);
        const hmatch = specs.match(/height=(\d+)/);

        if (wmatch) specs += `,left=${(window.screen.width - wmatch[1]) / 2}`;
        if (hmatch) specs += `,top=${(window.screen.height - hmatch[1]) / 2}`;

        if (wmatch && !hmatch) {
          specs += `,height=${wmatch[1]},top=${(window.screen.height - wmatch[1]) / 2}`;
        }

        const w = window.open(href, '', specs);
        const t = setInterval(() => {
          if (w.closed) {
            dispatch('close');
            clearInterval(t);
          }
        }, 120);
      } else window.location.href = href;
      return;
    }

    fixedLocation(href, () => {
      navigateTo(fixedHref || '/', { reload, replace });
    }, () => dispatch('click', e));
  }

  function handleAnchorOnClick(e) {
    // user used a keyboard shortcut to force open link in a new tab
    if (e.metaKey || e.ctrlKey || e.button !== 0) {
      return;
    }
  
    handleOnClick(e);
  }
</script>

{#if button}
  <button {...fixedProps} bind:this={ref} class={cssClass} {title} on:click={handleOnClick}>
    <slot />
  </button>
{:else}
  <a {...fixedProps} href={cleanPath(fixedHref || href)} bind:this={ref} class={cssClass} {title} on:click={handleAnchorOnClick}>
    <slot />
  </a>
{/if}
