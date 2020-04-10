import { Selector } from 'testcafe';
import { url } from '../helpers';

/* global fixture, test */

fixture('yrv (nested routers)')
  .page(url('/routers', true));

test('should keep working as expected when isLoggedIn is unchecked', async t => {
  await t
    .click(Selector('input[type=checkbox]'))
    .click(Selector('input[type=checkbox]'));

  await t
    .expect(Selector('h1').innerText).contains('This is Home')
    .expect(Selector('a').withText('Home').hasAttribute('aria-current')).ok();

  await t
    .click(Selector('a').withText('Players'))
    .expect(Selector('h1').innerText).contains('This is Players');

  await t.expect(Selector('h2').innerText).contains('This is List');

  await t
    .expect(Selector('a').withText('Players').hasAttribute('aria-current')).ok()
    .expect(Selector('a').withText('List').hasAttribute('aria-current')).ok();

  await t
    .click(Selector('a').withText('New Team'))
    .expect(Selector('h2').innerText).contains('This is New Team');

  await t.expect(Selector('a').withText('New Team').hasAttribute('aria-current')).ok();

  await t
    .click(Selector('a').withText('Not found'))
    .expect(Selector('h1').innerText).contains('This is NotFound');

  await t.expect(Selector('a').withText('Not found').hasAttribute('aria-current')).ok();
});

test('should fallback to <Login /> when isLoggedIn is unchecked', async t => {
  await t
    .click(Selector('input[type=checkbox]'));

  await t
    .expect(Selector('a').withText('Home').exists).ok()
    .expect(Selector('h1').innerText).contains('This is Login');

  await t
    .click(Selector('a').withText('Players'))
    .expect(Selector('h1').innerText).contains('This is Login');

  await t
    .click(Selector('a').withText('Not found'))
    .expect(Selector('h1').innerText).contains('This is Login');
});
