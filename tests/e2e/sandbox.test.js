import { Selector } from 'testcafe';

/* global fixture, test */

function url(x = '') {
  return process.env.BASE_URL + x;
}

fixture('yrv /')
  .page(url());

test('it just loads!', async t => {
  await t.expect(Selector('h1').withText('Example page').visible).ok();
});

test('it would mount Route-less content', async t => {
  await t.expect(Selector('p[data-test=routeless]').visible).ok();
});

test('it should mount from slot-content nodes', async t => {
  await t.click(Selector('a').withText('Test page'));
  await t.expect(Selector('h2').withText('Testing features').visible).ok();
});

fixture('yrv (params)')
  .page(url('/test'));

test('it should mount from component-based nodes', async t => {
  await t.click(Selector('a').withText('Test props'));
  await t.expect(Selector('h3').withText('Injected parameters').visible).ok();
});

fixture('yrv (nested params)')
  .page(url('/test/props/Hello%20World'));

test('it should inject params from resolved routes', async t => {
  await t.expect(Selector('p').withText('Value: Hello World').visible).ok();
});
