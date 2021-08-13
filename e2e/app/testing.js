import App from '../components/Main.svelte';

/* global USE_HASH_CHANGE */
let hashchange;
if (typeof USE_HASH_CHANGE !== 'undefined' && USE_HASH_CHANGE) {
  hashchange = USE_HASH_CHANGE;
}

new App({ target: document.body, props: { hashchange } }); // eslint-disable-line
