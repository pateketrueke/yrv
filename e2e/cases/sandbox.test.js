import { Selector } from 'testcafe';

/* global fixture, test */

function url(x = '') {
  if (process.env.HASHCHANGE) {
    return `${process.env.BASE_URL}#${x}`;
  }

  return process.env.BASE_URL + x;
}

fixture('yrv (dsl)')
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

fixture('yrv (example)')
  .page(url('/example'));

test('it should mount "Hello World"', async t => {
  await t.expect(Selector('[data-test=example]').withText('Hello World').visible).ok();
});

test('it should mount nested content', async t => {
  await t.click(Selector('a').withText('Link'));
  await t.expect(Selector('[data-test=example]').withText('Hello a').visible).ok();
});

test('it should fallback on unmatched routes', async t => {
  await t.click(Selector('a').withText('Broken link'));
  await t.expect(Selector('[data-test=example]').withText('Not found').visible).ok();
});

fixture('yrv (fallback)')
  .page(url('/e'));

test('should not mount any fallback et all', async t => {
  await t.expect(Selector('h2[data-test=fallback]').exists).notOk();
});

test.page(url('/e/im_not_exists'))('should handle non-matched routes as fallback', async t => {
  await t.expect(Selector('h2').withText('NOT FOUND').visible).ok();
});

fixture('yrv (buttons)')
  .page(url('/test'));

test('it should disable Link buttons if they are active', async t => {
  const UndoButton = Selector('button').withText('Undo');
  const Parameters = Selector('[data-test=parameters]');

  await t.expect(UndoButton.visible).ok();
  await t.expect(UndoButton.hasAttribute('disabled')).ok();
  await t.click(Selector('a').withText('Test props'));

  await t.expect(Parameters.visible).ok();
  await t.expect(UndoButton.hasAttribute('disabled')).notOk();

  await t.click(UndoButton);
  await t.expect(Parameters.exists).notOk();
  await t.expect(UndoButton.hasAttribute('disabled')).ok();
});

fixture('yrv (query params)')
  .page(url('/test/props'));

test('it should parse from location.search', async t => {
  await t.expect(Selector('li').withText('query: {}').exists).ok();
});

test('it should take queryParams from navigateTo()', async t => {
  await t.click(Selector('a').withText('Do not click!'));
  await t.expect(Selector('li').withText('query: {"truth":"42"}').exists).ok();

  await t.typeText(Selector('[data-test=key]'), 'x');
  await t.typeText(Selector('[data-test=value]'), 'y');
  await t.click(Selector('[data-test=append]'));

  await t.expect(Selector('li').withText('query: {"truth":"42","x":"y"}').exists).ok();
});

fixture('yrv (middleware)')
  .page(url('/test/props'));

test('it should redirect if the given route matches', async t => {
  await t.click(Selector('a').withText('Redirect'));
  await t.expect(Selector('button').withText('Undo').hasAttribute('disabled')).ok();
});

test('it should mount or redirect based on given condition', async t => {
  await t.setNativeDialogHandler(() => false);
  await t.click(Selector('a').withText('Protected'));
  await t.expect(Selector('[data-test=redirect]').innerText).contains('Wrong!');

  await t.setNativeDialogHandler(() => true);
  await t.click(Selector('a').withText('Protected'));
  await t.expect(Selector('[data-test=redirect]').innerText).contains('Yay!');
});

fixture('yrv (nested params)')
  .page(url('/test/props/Hello%20World'));

test('it should inject params from resolved routes', async t => {
  await t.expect(Selector('p').withText('Value: Hello World').visible).ok();
});

fixture('yrv (anchored routes)')
  .page(url('/sub'));

test('it should inject params from resolved routes', async t => {
  await t.click(Selector('a').withText('Root'));
  await t.expect(Selector('p[data-test=anchored]').innerText).contains('HOME');
  await t.expect(Selector('p[data-test=anchored]').innerText).notContains('ABOUT');
});

test('it should skip non-exact routes from matched ones', async t => {
  await t.click(Selector('a').withText('About page'));
  await t.expect(Selector('p[data-test=anchored]').innerText).contains('ABOUT');
  await t.expect(Selector('p[data-test=anchored]').innerText).notContains('HOME');
});

test('it should handle non-matched routes as fallback', async t => {
  await t.click(Selector('a').withText('Broken anchor'));
  await t.expect(Selector('h2[data-test=fallback]').exists).notOk();
  await t.expect(Selector('fieldset').innerText).contains("Unreachable '/sub#broken'");
});

fixture('yrv (nested routes)')
  .page(url('/top'));

test('it should nothing at top-level', async t => {
  await t.expect(Selector('p[data-test=nested]').innerText).notContains('a');
  await t.expect(Selector('p[data-test=nested]').innerText).notContains('b');
  await t.expect(Selector('p[data-test=nested]').innerText).notContains('c');

  await t.click(Selector('a').withText('1'));
  await t.expect(Selector('p[data-test=nested]').innerText).contains('a');
  await t.expect(Selector('p[data-test=nested]').innerText).notContains('b');
  await t.expect(Selector('p[data-test=nested]').innerText).notContains('c');

  await t.click(Selector('a').withText('2'));
  await t.expect(Selector('p[data-test=nested]').innerText).notContains('a');
  await t.expect(Selector('p[data-test=nested]').innerText).contains('b');
  await t.expect(Selector('p[data-test=nested]').innerText).notContains('c');

  await t.click(Selector('a').withText('3'));
  await t.expect(Selector('p[data-test=nested]').innerText).notContains('a');
  await t.expect(Selector('p[data-test=nested]').innerText).notContains('b');
  await t.expect(Selector('p[data-test=nested]').innerText).contains('c');
});

fixture('yrv (hashed routes)')
  .page(url('/gist'));

test('it should load root-handlers', async t => {
  await t.expect(Selector('[data-test=hashed]').innerText).contains('GIST INFO');
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('SHA1');
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('(edit)');
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('(save)');
});

test.page(url('/gist#test'))('it should load sub-handlers', async t => {
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('GIST INFO');
  await t.expect(Selector('[data-test=hashed]').innerText).contains('SHA1: test');
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('(edit)');
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('(save)');
});

test.page(url('/gist#test/edit'))('it should load nested sub-handlers (/edit)', async t => {
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('GIST INFO');
  await t.expect(Selector('[data-test=hashed]').innerText).contains('SHA1: test');
  await t.expect(Selector('[data-test=hashed]').innerText).contains('(edit)');
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('(save)');
});

test.page(url('/gist#test/save'))('it should load nsted root-handlers (/save)', async t => {
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('GIST INFO');
  await t.expect(Selector('[data-test=hashed]').innerText).contains('SHA1: test');
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('(edit)');
  await t.expect(Selector('[data-test=hashed]').innerText).contains('(save)');
});

test.page(url('/gist#test/not_found'))('it should fail on unreachable routes', async t => {
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('GIST INFO');
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('SHA1');
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('(edit)');
  await t.expect(Selector('[data-test=hashed]').innerText).notContains('(save)');
  await t.expect(Selector('[data-test=hashed]').innerText).contains('Unreachable');
});

if (!process.env.HASHCHANGE) {
  fixture('yrv (base-href)')
    .page(url('/folder'));

  test('it should handle <base href="..." /> on all routes and links', async t => {
    await t.click(Selector('a').withText('Test page'));
    await t.expect(Selector('h2').withText('Testing features').visible).ok();
    await t.expect(Selector('a').withText('Home').getAttribute('href')).contains('/folder/');

    await t.click(Selector('a').withText('Test props'));
    await t.click(Selector('a').withText('Do not click!'));
    await t.expect(Selector('li').withText('query: {"truth":"42"}').exists).ok();

    await t.click(Selector('a').withText('Anchor page'));
    await t.click(Selector('a').withText('Root'));
    await t.expect(Selector('p[data-test=anchored]').innerText).contains('HOME');
    await t.expect(Selector('p[data-test=anchored]').innerText).notContains('ABOUT');

    await t.click(Selector('a').withText('Link'));
    await t.expect(Selector('p[data-test=example').innerText).contains('Hello a');
  });
}
