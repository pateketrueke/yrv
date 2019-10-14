(function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function validate_store(store, name) {
        if (!store || typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(component, store, callback) {
        const unsub = store.subscribe(callback);
        component.$$.on_destroy.push(unsub.unsubscribe
            ? () => unsub.unsubscribe()
            : unsub);
    }
    function create_slot(definition, ctx, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, fn) {
        return definition[1]
            ? assign({}, assign(ctx.$$scope.ctx, definition[1](fn ? fn(ctx) : {})))
            : ctx.$$scope.ctx;
    }
    function get_slot_changes(definition, ctx, changed, fn) {
        return definition[1]
            ? assign({}, assign(ctx.$$scope.changed || {}, definition[1](fn ? fn(changed) : {})))
            : ctx.$$scope.changed || {};
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = current_component;
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.shift()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            while (render_callbacks.length) {
                const callback = render_callbacks.pop();
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_render);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_render.forEach(add_render_callback);
        }
    }
    let outros;
    function group_outros() {
        outros = {
            remaining: 0,
            callbacks: []
        };
    }
    function check_outros() {
        if (!outros.remaining) {
            run_all(outros.callbacks);
        }
    }
    function on_outro(callback) {
        outros.callbacks.push(callback);
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_render } = component.$$;
        fragment.m(target, anchor);
        // onMount happens after the initial afterUpdate. Because
        // afterUpdate callbacks happen in reverse order (inner first)
        // we schedule onMount callbacks before afterUpdate callbacks
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_render.forEach(add_render_callback);
    }
    function destroy(component, detaching) {
        if (component.$$) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal$$1, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal: not_equal$$1,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_render: [],
            after_render: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, value) => {
                if ($$.ctx && not_equal$$1($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_render);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                $$.fragment.l(children(options.target));
            }
            else {
                $$.fragment.c();
            }
            if (options.intro && component.$$.fragment.i)
                component.$$.fragment.i();
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy(this, true);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    var defaultExport = /*@__PURE__*/(function (Error) {
      function defaultExport(route, path) {
        var message = "Unreachable '" + route + "', segment '" + path + "' is not defined";
        Error.call(this, message);
        this.message = message;
      }

      if ( Error ) defaultExport.__proto__ = Error;
      defaultExport.prototype = Object.create( Error && Error.prototype );
      defaultExport.prototype.constructor = defaultExport;

      return defaultExport;
    }(Error));

    function buildMatcher(path, parent) {
      var regex;

      var _isSplat;

      var _priority = -100;

      var keys = [];
      regex = path.replace(/[-$.]/g, '\\$&').replace(/\(/g, '(?:').replace(/\)/g, ')?').replace(/([:*]\w+)(?:<([^<>]+?)>)?/g, function (_, key, expr) {
        keys.push(key.substr(1));

        if (key.charAt() === ':') {
          _priority += 100;
          return ("((?!#)" + (expr || '[^/]+?') + ")");
        }

        _isSplat = true;
        _priority += 500;
        return ("((?!#)" + (expr || '.+?') + ")");
      });

      try {
        regex = new RegExp(("^" + regex + "$"));
      } catch (e) {
        throw new TypeError(("Invalid route expression, given '" + parent + "'"));
      }

      var _hashed = path.includes('#') ? 0.5 : 1;

      var _depth = path.length * _priority * _hashed;

      return {
        keys: keys,
        regex: regex,
        _depth: _depth,
        _isSplat: _isSplat
      };
    }
    var PathMatcher = function PathMatcher(path, parent) {
      var ref = buildMatcher(path, parent);
      var keys = ref.keys;
      var regex = ref.regex;
      var _depth = ref._depth;
      var _isSplat = ref._isSplat;
      return {
        _isSplat: _isSplat,
        _depth: _depth,
        match: function (value) {
          var matches = value.match(regex);

          if (matches) {
            return keys.reduce(function (prev, cur, i) {
              prev[cur] = typeof matches[i + 1] === 'string' ? decodeURIComponent(matches[i + 1]) : null;
              return prev;
            }, {});
          }
        }
      };
    };

    PathMatcher.push = function push (key, prev, leaf, parent) {
      var root = prev[key] || (prev[key] = {});

      if (!root.pattern) {
        root.pattern = new PathMatcher(key, parent);
        root.route = leaf || '/';
      }

      prev.keys = prev.keys || [];

      if (!prev.keys.includes(key)) {
        prev.keys.push(key);
        PathMatcher.sort(prev);
      }

      return root;
    };

    PathMatcher.sort = function sort (root) {
      root.keys.sort(function (a, b) {
        return root[a].pattern._depth - root[b].pattern._depth;
      });
    };

    function merge(path, parent) {
      return ("" + (parent && parent !== '/' ? parent : '') + (path || ''));
    }
    function walk(path, cb) {
      var matches = path.match(/<[^<>]*\/[^<>]*>/);

      if (matches) {
        throw new TypeError(("RegExp cannot contain slashes, given '" + matches + "'"));
      }

      var parts = path !== '/' ? path.split('/') : [''];
      var root = [];
      parts.some(function (x, i) {
        var parent = root.concat(x).join('/') || null;
        var segment = parts.slice(i + 1).join('/') || null;
        var retval = cb(("/" + x), parent, segment ? ((x ? ("/" + x) : '') + "/" + segment) : null);
        root.push(x);
        return retval;
      });
    }
    function reduce(key, root, _seen) {
      var params = {};
      var out = [];
      var splat;
      walk(key, function (x, leaf, extra) {
        var found;

        if (!root.keys) {
          throw new defaultExport(key, x);
        }

        root.keys.some(function (k) {
          if (_seen.includes(k)) { return false; }
          var ref = root[k].pattern;
          var match = ref.match;
          var _isSplat = ref._isSplat;
          var matches = match(_isSplat ? extra || x : x);

          if (matches) {
            Object.assign(params, matches);

            if (root[k].route) {
              out.push(Object.assign({}, root[k].info, {
                matches: x === leaf || _isSplat || !extra,
                params: Object.assign({}, params),
                route: root[k].route,
                path: _isSplat ? extra : leaf || x
              }));
            }

            if (extra === null && !root[k].keys) {
              return true;
            }

            if (k !== '/') { _seen.push(k); }
            splat = _isSplat;
            root = root[k];
            found = true;
            return true;
          }

          return false;
        });

        if (!(found || root.keys.some(function (k) { return root[k].pattern.match(x); }))) {
          throw new defaultExport(key, x);
        }

        return splat || !found;
      });
      return out;
    }
    function find(path, routes, retries) {
      var get = reduce.bind(null, path, routes);
      var set = [];

      while (retries > 0) {
        retries -= 1;

        try {
          return get(set);
        } catch (e) {
          if (retries > 0) {
            return get(set);
          }

          throw e;
        }
      }
    }
    function add(path, routes, parent, routeInfo) {
      var fullpath = merge(path, parent);
      var root = routes;
      walk(fullpath, function (x, leaf) {
        root = PathMatcher.push(x, root, leaf, fullpath);

        if (x !== '/') {
          root.info = root.info || Object.assign({}, routeInfo);
        }
      });
      root.info = root.info || Object.assign({}, routeInfo);
      return fullpath;
    }
    function rm(path, routes, parent) {
      var fullpath = merge(path, parent);
      var root = routes;
      var leaf = null;
      var key = null;
      walk(fullpath, function (x) {
        if (!root) {
          leaf = null;
          return true;
        }

        key = x;
        leaf = x === '/' ? routes['/'] : root;

        if (!leaf.keys) {
          throw new defaultExport(path, x);
        }

        root = root[x];
      });

      if (!(leaf && key)) {
        throw new defaultExport(path, key);
      }

      delete leaf[key];

      if (key === '/') {
        delete leaf.info;
        delete leaf.route;
      }

      var offset = leaf.keys.indexOf(key);

      if (offset !== -1) {
        leaf.keys.splice(leaf.keys.indexOf(key), 1);
        PathMatcher.sort(leaf);
      }
    }

    var Router = function Router() {
      var routes = {};
      var stack = [];
      return {
        mount: function (path, cb) {
          if (path !== '/') {
            stack.push(path);
          }

          cb();
          stack.pop();
        },
        find: function (path, retries) { return find(path, routes, retries === true ? 2 : retries || 1); },
        add: function (path, routeInfo) { return add(path, routes, stack.join(''), routeInfo); },
        rm: function (path) { return rm(path, routes, stack.join('')); }
      };
    };

    const CTX_ROUTER = {};

    function navigateTo(path) {
      // If path empty or no string, throws error
      if (!path || typeof path !== 'string') {
        throw new Error(`yrv expects navigateTo() to have a string parameter. The parameter provided was: ${path} of type ${typeof path} instead.`);
      }

      if (path[0] !== '/' && path[0] !== '#') {
        throw new Error(`yrv expects navigateTo() param to start with slash or hash, e.g. "/${path}" or "#${path}" instead of "${path}".`);
      }

      // If no History API support, fallbacks to URL redirect
      if (!history.pushState || !window.dispatchEvent) {
        window.location.href = path;
        return;
      }

      // If has History API support, uses it
      history.pushState({}, '', path);
      window.dispatchEvent(new Event('popstate'));
    }

    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (!stop) {
                    return; // not ready
                }
                subscribers.forEach((s) => s[1]());
                subscribers.forEach((s) => s[0](value));
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                }
            };
        }
        return { set, update, subscribe };
    }

    /* src/Router.svelte generated by Svelte v3.4.4 */

    const file = "src/Router.svelte";

    // (165:0) {#if failure && !nofallback}
    function create_if_block(ctx) {
    	var fieldset, legend, t0, t1, t2, pre, t3;

    	return {
    		c: function create() {
    			fieldset = element("fieldset");
    			legend = element("legend");
    			t0 = text("Router failure: ");
    			t1 = text(ctx.path);
    			t2 = space();
    			pre = element("pre");
    			t3 = text(ctx.failure);
    			add_location(legend, file, 166, 4, 3851);
    			add_location(pre, file, 167, 4, 3895);
    			add_location(fieldset, file, 165, 2, 3836);
    		},

    		m: function mount(target, anchor) {
    			insert(target, fieldset, anchor);
    			append(fieldset, legend);
    			append(legend, t0);
    			append(legend, t1);
    			append(fieldset, t2);
    			append(fieldset, pre);
    			append(pre, t3);
    		},

    		p: function update(changed, ctx) {
    			if (changed.path) {
    				set_data(t1, ctx.path);
    			}

    			if (changed.failure) {
    				set_data(t3, ctx.failure);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(fieldset);
    			}
    		}
    	};
    }

    function create_fragment(ctx) {
    	var t_1, current, dispose;

    	var if_block = (ctx.failure && !ctx.nofallback) && create_if_block(ctx);

    	const default_slot_1 = ctx.$$slots.default;
    	const default_slot = create_slot(default_slot_1, ctx, null);

    	return {
    		c: function create() {
    			if (if_block) if_block.c();
    			t_1 = space();

    			if (default_slot) default_slot.c();

    			dispose = listen(window, "popstate", ctx.handlePopState);
    		},

    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, t_1, anchor);

    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (ctx.failure && !ctx.nofallback) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(t_1.parentNode, t_1);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (default_slot && default_slot.p && changed.$$scope) {
    				default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			if (default_slot && default_slot.i) default_slot.i(local);
    			current = true;
    		},

    		o: function outro(local) {
    			if (default_slot && default_slot.o) default_slot.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);

    			if (detaching) {
    				detach(t_1);
    			}

    			if (default_slot) default_slot.d(detaching);
    			dispose();
    		}
    	};
    }



    const router = new Router();

    function cleanPath(route) {
      return route.replace(/\?[^#]*/, '').replace(/(?!^)\/#/, '#').replace('/#', '#').replace(/\/$/, '');
    }

    function fixPath(route) {
      if (route === '/#*' || route === '#*') return '#*_';
      if (route === '/*' || route === '*') return '/*_';
      return route;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $routeInfo, $basePath;

    	

      let t;
      let failure;
      let fallback;

      let { path = '/', nofallback = null } = $$props;

      const routeInfo = writable({}); validate_store(routeInfo, 'routeInfo'); subscribe($$self, routeInfo, $$value => { $routeInfo = $$value; $$invalidate('$routeInfo', $routeInfo); });
      const routerContext = getContext(CTX_ROUTER);
      const basePath = routerContext ? routerContext.basePath : writable(path); validate_store(basePath, 'basePath'); subscribe($$self, basePath, $$value => { $basePath = $$value; $$invalidate('$basePath', $basePath); });

      function handleRoutes(map) {
        const params = map.reduce((prev, cur) => {
          prev[cur.key] = Object.assign(prev[cur.key] || {}, cur.params);
          return prev;
        }, {});

        let skip;
        let routes = {};

        map.some(x => {
          if (typeof x.condition === 'boolean' || typeof x.condition === 'function') {
            const ok = typeof x.condition === 'function' ? x.condition() : x.condition;

            if (ok === false && x.redirect) {
              navigateTo(x.redirect);
              skip = true;
              return true;
            }
          }

          if (x.key && !routes[x.key]) {
            if (x.exact && !x.matches) return false;
            routes[x.key] = { ...x, params: params[x.key] };
          }

          return false;
        });

        if (!skip) {
          $routeInfo = routes; routeInfo.set($routeInfo);
        }
      }

      function doFallback(e, path) {
        $routeInfo[fallback] = { failure: e, params: { _: path.substr(1) || undefined } }; routeInfo.set($routeInfo);
      }

      function resolveRoutes(path) {
        const segments = path.split('#')[0].split('/');
        const prefix = [];
        const map = [];

        segments.forEach(key => {
          const sub = prefix.concat(`/${key}`).join('');

          if (key) prefix.push(`/${key}`);

          try {
            const next = router.find(sub);

            handleRoutes(next);
            map.push(...next);
          } catch (e_) {
            doFallback(e_, path);
          }
        });

        return map;
      }

      function handlePopState() {
        const fullpath = cleanPath(`/${location.href.split('/').slice(3).join('/')}`);

        try {
          const found = resolveRoutes(fullpath);

          if (fullpath.includes('#')) {
            const next = router.find(fullpath);
            const keys = {};

            // override previous routes to avoid non-exact matches
            handleRoutes(found.concat(next).reduce((prev, cur) => {
              if (typeof keys[cur.key] === 'undefined') {
                keys[cur.key] = prev.length;
              }

              prev[keys[cur.key]] = cur;

              return prev;
            }, []));
          }
        } catch (e) {
          if (!fallback) {
            $$invalidate('failure', failure = e);
            return;
          }

          doFallback(e, fullpath);
        }
      }

      function _handlePopState() {
        clearTimeout(t);
        t = setTimeout(handlePopState, 100);
      }

      function assignRoute(key, route, detail) {
        key = key || Math.random().toString(36).substr(2);

        const fixedRoot = $basePath !== path && $basePath !== '/'
          ? `${$basePath}${path !== '/' ? path : ''}`
          : path;

        const handler = { key, ...detail };

        let fullpath;

        router.mount(fixedRoot, () => {
          fullpath = router.add(route !== '/' ? fixPath(route) : '', handler);
          fallback = (handler.fallback && key) || fallback;
        });

        _handlePopState();

        return [key, fullpath];
      }

      function unassignRoute(route) {
        router.rm(fixPath(route));
        _handlePopState();
      }

      setContext(CTX_ROUTER, {
        basePath,
        routeInfo,
        assignRoute,
        unassignRoute,
      });

    	const writable_props = ['path', 'nofallback'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$props => {
    		if ('path' in $$props) $$invalidate('path', path = $$props.path);
    		if ('nofallback' in $$props) $$invalidate('nofallback', nofallback = $$props.nofallback);
    		if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
    	};

    	return {
    		failure,
    		path,
    		nofallback,
    		routeInfo,
    		basePath,
    		handlePopState,
    		$$slots,
    		$$scope
    	};
    }

    class Router_1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["path", "nofallback"]);
    	}

    	get path() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nofallback() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nofallback(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Route.svelte generated by Svelte v3.4.4 */

    const get_default_slot_changes = ({ activeRouter, activeProps }) => ({ router: activeRouter, props: activeProps });
    const get_default_slot_context = ({ activeRouter, activeProps }) => ({
    	router: activeRouter,
    	props: activeProps
    });

    // (46:0) {#if activeRouter}
    function create_if_block$1(ctx) {
    	var current_block_type_index, if_block, if_block_anchor, current;

    	var if_block_creators = [
    		create_if_block_1,
    		create_else_block
    	];

    	var if_blocks = [];

    	function select_block_type(ctx) {
    		if (ctx.component) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},

    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);
    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(changed, ctx);
    			} else {
    				group_outros();
    				on_outro(() => {
    					if_blocks[previous_block_index].d(1);
    					if_blocks[previous_block_index] = null;
    				});
    				if_block.o(1);
    				check_outros();

    				if_block = if_blocks[current_block_type_index];
    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}
    				if_block.i(1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			if (if_block) if_block.i();
    			current = true;
    		},

    		o: function outro(local) {
    			if (if_block) if_block.o();
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);

    			if (detaching) {
    				detach(if_block_anchor);
    			}
    		}
    	};
    }

    // (49:2) {:else}
    function create_else_block(ctx) {
    	var current;

    	const default_slot_1 = ctx.$$slots.default;
    	const default_slot = create_slot(default_slot_1, ctx, get_default_slot_context);

    	return {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},

    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},

    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (default_slot && default_slot.p && (changed.$$scope || changed.activeRouter || changed.activeProps)) {
    				default_slot.p(get_slot_changes(default_slot_1, ctx, changed, get_default_slot_changes), get_slot_context(default_slot_1, ctx, get_default_slot_context));
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			if (default_slot && default_slot.i) default_slot.i(local);
    			current = true;
    		},

    		o: function outro(local) {
    			if (default_slot && default_slot.o) default_slot.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    // (47:2) {#if component}
    function create_if_block_1(ctx) {
    	var switch_instance_anchor, current;

    	var switch_instance_spread_levels = [
    		{ router: ctx.activeRouter },
    		ctx.activeProps
    	];

    	var switch_value = ctx.component;

    	function switch_props(ctx) {
    		let switch_instance_props = {};
    		for (var i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}
    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		var switch_instance = new switch_value(switch_props());
    	}

    	return {
    		c: function create() {
    			if (switch_instance) switch_instance.$$.fragment.c();
    			switch_instance_anchor = empty();
    		},

    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert(target, switch_instance_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var switch_instance_changes = (changed.activeRouter || changed.activeProps) ? get_spread_update(switch_instance_spread_levels, [
    				(changed.activeRouter) && { router: ctx.activeRouter },
    				(changed.activeProps) && ctx.activeProps
    			]) : {};

    			if (switch_value !== (switch_value = ctx.component)) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;
    					on_outro(() => {
    						old_component.$destroy();
    					});
    					old_component.$$.fragment.o(1);
    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());

    					switch_instance.$$.fragment.c();
    					switch_instance.$$.fragment.i(1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}

    			else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) switch_instance.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			if (switch_instance) switch_instance.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(switch_instance_anchor);
    			}

    			if (switch_instance) switch_instance.$destroy(detaching);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	var if_block_anchor, current;

    	var if_block = (ctx.activeRouter) && create_if_block$1(ctx);

    	return {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (ctx.activeRouter) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    					if_block.i(1);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.i(1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();
    				on_outro(() => {
    					if_block.d(1);
    					if_block = null;
    				});

    				if_block.o(1);
    				check_outros();
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			if (if_block) if_block.i();
    			current = true;
    		},

    		o: function outro(local) {
    			if (if_block) if_block.o();
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);

    			if (detaching) {
    				detach(if_block_anchor);
    			}
    		}
    	};
    }

    function getProps(given, required) {
      const { props, ...others } = given;

      // prune all declared props from this component
      required.forEach(k => {
        delete others[k];
      });

      return {
        ...props,
        ...others,
      };
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $routeInfo;

    	

      let { key = null, path = '', props = null, exact = undefined, fallback = undefined, component = undefined, condition = undefined, redirect = undefined } = $$props;

      const { assignRoute, unassignRoute, routeInfo } = getContext(CTX_ROUTER); validate_store(routeInfo, 'routeInfo'); subscribe($$self, routeInfo, $$value => { $routeInfo = $$value; $$invalidate('$routeInfo', $routeInfo); });

      let activeRouter = null;
      let activeProps = {};
      let fullpath;

      [key, fullpath] = assignRoute(key, path, { condition, redirect, fallback, exact }); $$invalidate('key', key);
      onDestroy(() => {
        unassignRoute(fullpath);
      });

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$new_props => {
    		$$invalidate('$$props', $$props = assign(assign({}, $$props), $$new_props));
    		if ('key' in $$props) $$invalidate('key', key = $$props.key);
    		if ('path' in $$props) $$invalidate('path', path = $$props.path);
    		if ('props' in $$props) $$invalidate('props', props = $$props.props);
    		if ('exact' in $$props) $$invalidate('exact', exact = $$props.exact);
    		if ('fallback' in $$props) $$invalidate('fallback', fallback = $$props.fallback);
    		if ('component' in $$props) $$invalidate('component', component = $$props.component);
    		if ('condition' in $$props) $$invalidate('condition', condition = $$props.condition);
    		if ('redirect' in $$props) $$invalidate('redirect', redirect = $$props.redirect);
    		if ('$$scope' in $$new_props) $$invalidate('$$scope', $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = ($$dirty = { $routeInfo: 1, key: 1, $$props: 1 }) => {
    		if ($$dirty.$routeInfo || $$dirty.key) { {
            $$invalidate('activeRouter', activeRouter = $routeInfo[key]);
            $$invalidate('activeProps', activeProps = getProps($$props, arguments[0]['$$'].props));
          } }
    	};

    	return {
    		key,
    		path,
    		props,
    		exact,
    		fallback,
    		component,
    		condition,
    		redirect,
    		routeInfo,
    		activeRouter,
    		activeProps,
    		$$props: $$props = exclude_internal_props($$props),
    		$$slots,
    		$$scope
    	};
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, ["key", "path", "props", "exact", "fallback", "component", "condition", "redirect"]);
    	}

    	get key() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get path() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get props() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set props(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exact() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exact(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get fallback() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fallback(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get component() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set component(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get condition() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set condition(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get redirect() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set redirect(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Link.svelte generated by Svelte v3.4.4 */

    const file$1 = "src/Link.svelte";

    function create_fragment$2(ctx) {
    	var a, current, dispose;

    	const default_slot_1 = ctx.$$slots.default;
    	const default_slot = create_slot(default_slot_1, ctx, null);

    	return {
    		c: function create() {
    			a = element("a");

    			if (default_slot) default_slot.c();

    			a.href = ctx.href;
    			a.className = ctx.className;
    			a.title = ctx.title;
    			add_location(a, file$1, 31, 0, 684);
    			dispose = listen(a, "click", prevent_default(ctx.onClick));
    		},

    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(a_nodes);
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (default_slot && default_slot.p && changed.$$scope) {
    				default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
    			}

    			if (!current || changed.href) {
    				a.href = ctx.href;
    			}

    			if (!current || changed.className) {
    				a.className = ctx.className;
    			}

    			if (!current || changed.title) {
    				a.title = ctx.title;
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			if (default_slot && default_slot.i) default_slot.i(local);
    			current = true;
    		},

    		o: function outro(local) {
    			if (default_slot && default_slot.o) default_slot.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(a);
    			}

    			if (default_slot) default_slot.d(detaching);
    			dispose();
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	

      let { class: cssClass = '', href = '/', className = '', title = '' } = $$props;

      onMount(() => {
        $$invalidate('className', className = className || cssClass);
      });

      const dispatch = createEventDispatcher();

      // this will enable `<Link on:click={...} />` calls
      function onClick(e) {
        let fixedHref = href;

        // this will rebase anchors to avoid location changes
        if (fixedHref.charAt() !== '/') {
          fixedHref = window.location.pathname + fixedHref;
        }

        navigateTo(fixedHref);
        dispatch('click', e);
      }

    	const writable_props = ['class', 'href', 'className', 'title'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Link> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$props => {
    		if ('class' in $$props) $$invalidate('cssClass', cssClass = $$props.class);
    		if ('href' in $$props) $$invalidate('href', href = $$props.href);
    		if ('className' in $$props) $$invalidate('className', className = $$props.className);
    		if ('title' in $$props) $$invalidate('title', title = $$props.title);
    		if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
    	};

    	return {
    		cssClass,
    		href,
    		className,
    		title,
    		onClick,
    		$$slots,
    		$$scope
    	};
    }

    class Link extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, ["class", "href", "className", "title"]);
    	}

    	get class() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get href() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set href(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get className() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set className(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get title() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* tests/components/TestProps.svelte generated by Svelte v3.4.4 */

    const file$2 = "tests/components/TestProps.svelte";

    // (20:2) <Route path="/:value" let:router>
    function create_default_slot_1(ctx) {
    	var p, t0, t1_value = ctx.router.params.value, t1;

    	return {
    		c: function create() {
    			p = element("p");
    			t0 = text("Value: ");
    			t1 = text(t1_value);
    			add_location(p, file$2, 20, 4, 492);
    		},

    		m: function mount(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);
    		},

    		p: function update(changed, ctx) {
    			if ((changed.router) && t1_value !== (t1_value = ctx.router.params.value)) {
    				set_data(t1, t1_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(p);
    			}
    		}
    	};
    }

    // (19:0) <Router>
    function create_default_slot(ctx) {
    	var current;

    	var route = new Route({
    		props: {
    		path: "/:value",
    		$$slots: {
    		default: [create_default_slot_1, ({ router }) => ({ router })]
    	},
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			route.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(route, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var route_changes = {};
    			if (changed.$$scope) route_changes.$$scope = { changed, ctx };
    			route.$set(route_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			route.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			route.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			route.$destroy(detaching);
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	var h3, t1, fieldset, legend, t3, ul, li0, t4, t5_value = JSON.stringify(ctx.router.key), t5, t6, li1, t7, t8_value = JSON.stringify(ctx.router.matches), t8, t9, li2, t10, t11_value = JSON.stringify(ctx.router.params), t11, t12, li3, t13, t14_value = JSON.stringify(ctx.router.route), t14, t15, li4, t16, t17_value = JSON.stringify(ctx.router.path), t17, t18, current;

    	var router_1 = new Router_1({
    		props: {
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			h3 = element("h3");
    			h3.textContent = "Injected parameters";
    			t1 = space();
    			fieldset = element("fieldset");
    			legend = element("legend");
    			legend.textContent = "router";
    			t3 = space();
    			ul = element("ul");
    			li0 = element("li");
    			t4 = text("key: ");
    			t5 = text(t5_value);
    			t6 = space();
    			li1 = element("li");
    			t7 = text("matches: ");
    			t8 = text(t8_value);
    			t9 = space();
    			li2 = element("li");
    			t10 = text("params: ");
    			t11 = text(t11_value);
    			t12 = space();
    			li3 = element("li");
    			t13 = text("route: ");
    			t14 = text(t14_value);
    			t15 = space();
    			li4 = element("li");
    			t16 = text("path: ");
    			t17 = text(t17_value);
    			t18 = space();
    			router_1.$$.fragment.c();
    			add_location(h3, file$2, 6, 0, 94);
    			add_location(legend, file$2, 8, 2, 136);
    			add_location(li0, file$2, 10, 4, 171);
    			add_location(li1, file$2, 11, 4, 218);
    			add_location(li2, file$2, 12, 4, 273);
    			add_location(li3, file$2, 13, 4, 326);
    			add_location(li4, file$2, 14, 4, 377);
    			add_location(ul, file$2, 9, 2, 162);
    			add_location(fieldset, file$2, 7, 0, 123);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, h3, anchor);
    			insert(target, t1, anchor);
    			insert(target, fieldset, anchor);
    			append(fieldset, legend);
    			append(fieldset, t3);
    			append(fieldset, ul);
    			append(ul, li0);
    			append(li0, t4);
    			append(li0, t5);
    			append(ul, t6);
    			append(ul, li1);
    			append(li1, t7);
    			append(li1, t8);
    			append(ul, t9);
    			append(ul, li2);
    			append(li2, t10);
    			append(li2, t11);
    			append(ul, t12);
    			append(ul, li3);
    			append(li3, t13);
    			append(li3, t14);
    			append(ul, t15);
    			append(ul, li4);
    			append(li4, t16);
    			append(li4, t17);
    			insert(target, t18, anchor);
    			mount_component(router_1, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if ((!current || changed.router) && t5_value !== (t5_value = JSON.stringify(ctx.router.key))) {
    				set_data(t5, t5_value);
    			}

    			if ((!current || changed.router) && t8_value !== (t8_value = JSON.stringify(ctx.router.matches))) {
    				set_data(t8, t8_value);
    			}

    			if ((!current || changed.router) && t11_value !== (t11_value = JSON.stringify(ctx.router.params))) {
    				set_data(t11, t11_value);
    			}

    			if ((!current || changed.router) && t14_value !== (t14_value = JSON.stringify(ctx.router.route))) {
    				set_data(t14, t14_value);
    			}

    			if ((!current || changed.router) && t17_value !== (t17_value = JSON.stringify(ctx.router.path))) {
    				set_data(t17, t17_value);
    			}

    			var router_1_changes = {};
    			if (changed.$$scope) router_1_changes.$$scope = { changed, ctx };
    			router_1.$set(router_1_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			router_1.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			router_1.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(h3);
    				detach(t1);
    				detach(fieldset);
    				detach(t18);
    			}

    			router_1.$destroy(detaching);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { router = null } = $$props;

    	const writable_props = ['router'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<TestProps> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('router' in $$props) $$invalidate('router', router = $$props.router);
    	};

    	return { router };
    }

    class TestProps extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, ["router"]);
    	}

    	get router() {
    		throw new Error("<TestProps>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set router(value) {
    		throw new Error("<TestProps>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* tests/App.svelte generated by Svelte v3.4.4 */

    const file$3 = "tests/App.svelte";

    // (10:0) <Link href="/">
    function create_default_slot_5(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Home");
    		},

    		m: function mount(target, anchor) {
    			insert(target, t, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(t);
    			}
    		}
    	};
    }

    // (10:29) <Link href="/test">
    function create_default_slot_4(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Test page");
    		},

    		m: function mount(target, anchor) {
    			insert(target, t, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(t);
    			}
    		}
    	};
    }

    // (18:4) <Link href="/test">
    function create_default_slot_3(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Back");
    		},

    		m: function mount(target, anchor) {
    			insert(target, t, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(t);
    			}
    		}
    	};
    }

    // (18:37) <Link href="/test/props">
    function create_default_slot_2(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Test props");
    		},

    		m: function mount(target, anchor) {
    			insert(target, t, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(t);
    			}
    		}
    	};
    }

    // (13:2) <Route path="/">
    function create_default_slot_1$1(ctx) {
    	var h2, t1, p, t2, tt, t4, t5, t6, current;

    	var link0 = new Link({
    		props: {
    		href: "/test",
    		$$slots: { default: [create_default_slot_3] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var link1 = new Link({
    		props: {
    		href: "/test/props",
    		$$slots: { default: [create_default_slot_2] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Testing features";
    			t1 = space();
    			p = element("p");
    			t2 = text("This content is always mounted when the current URL starts-with ");
    			tt = element("tt");
    			tt.textContent = "/test";
    			t4 = text(".");
    			t5 = space();
    			link0.$$.fragment.c();
    			t6 = text(" | ");
    			link1.$$.fragment.c();
    			add_location(h2, file$3, 13, 4, 305);
    			add_location(tt, file$3, 15, 71, 403);
    			add_location(p, file$3, 15, 4, 336);
    		},

    		m: function mount(target, anchor) {
    			insert(target, h2, anchor);
    			insert(target, t1, anchor);
    			insert(target, p, anchor);
    			append(p, t2);
    			append(p, tt);
    			append(p, t4);
    			insert(target, t5, anchor);
    			mount_component(link0, target, anchor);
    			insert(target, t6, anchor);
    			mount_component(link1, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var link0_changes = {};
    			if (changed.$$scope) link0_changes.$$scope = { changed, ctx };
    			link0.$set(link0_changes);

    			var link1_changes = {};
    			if (changed.$$scope) link1_changes.$$scope = { changed, ctx };
    			link1.$set(link1_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			link0.$$.fragment.i(local);

    			link1.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			link0.$$.fragment.o(local);
    			link1.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(h2);
    				detach(t1);
    				detach(p);
    				detach(t5);
    			}

    			link0.$destroy(detaching);

    			if (detaching) {
    				detach(t6);
    			}

    			link1.$destroy(detaching);
    		}
    	};
    }

    // (12:0) <Router path="/test">
    function create_default_slot$1(ctx) {
    	var t0, t1, p, t2, tt, t4, current;

    	var route0 = new Route({
    		props: {
    		path: "/",
    		$$slots: { default: [create_default_slot_1$1] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var route1 = new Route({
    		props: { path: "/props", component: TestProps },
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			route0.$$.fragment.c();
    			t0 = space();
    			route1.$$.fragment.c();
    			t1 = space();
    			p = element("p");
    			t2 = text("Any ");
    			tt = element("tt");
    			tt.textContent = "Route";
    			t4 = text("-less content is always shown!");
    			add_location(tt, file$3, 22, 31, 596);
    			p.dataset.test = "routeless";
    			add_location(p, file$3, 22, 2, 567);
    		},

    		m: function mount(target, anchor) {
    			mount_component(route0, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(route1, target, anchor);
    			insert(target, t1, anchor);
    			insert(target, p, anchor);
    			append(p, t2);
    			append(p, tt);
    			append(p, t4);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var route0_changes = {};
    			if (changed.$$scope) route0_changes.$$scope = { changed, ctx };
    			route0.$set(route0_changes);

    			var route1_changes = {};
    			if (changed.TestProps) route1_changes.component = TestProps;
    			route1.$set(route1_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			route0.$$.fragment.i(local);

    			route1.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			route0.$$.fragment.o(local);
    			route1.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			route0.$destroy(detaching);

    			if (detaching) {
    				detach(t0);
    			}

    			route1.$destroy(detaching);

    			if (detaching) {
    				detach(t1);
    				detach(p);
    			}
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	var h1, t1, p, t3, t4, t5, current;

    	var link0 = new Link({
    		props: {
    		href: "/",
    		$$slots: { default: [create_default_slot_5] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var link1 = new Link({
    		props: {
    		href: "/test",
    		$$slots: { default: [create_default_slot_4] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var router = new Router_1({
    		props: {
    		path: "/test",
    		$$slots: { default: [create_default_slot$1] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Example page";
    			t1 = space();
    			p = element("p");
    			p.textContent = "This content is static, always shown.";
    			t3 = space();
    			link0.$$.fragment.c();
    			t4 = text(" | ");
    			link1.$$.fragment.c();
    			t5 = space();
    			router.$$.fragment.c();
    			add_location(h1, file$3, 5, 0, 125);
    			add_location(p, file$3, 7, 0, 148);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert(target, h1, anchor);
    			insert(target, t1, anchor);
    			insert(target, p, anchor);
    			insert(target, t3, anchor);
    			mount_component(link0, target, anchor);
    			insert(target, t4, anchor);
    			mount_component(link1, target, anchor);
    			insert(target, t5, anchor);
    			mount_component(router, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var link0_changes = {};
    			if (changed.$$scope) link0_changes.$$scope = { changed, ctx };
    			link0.$set(link0_changes);

    			var link1_changes = {};
    			if (changed.$$scope) link1_changes.$$scope = { changed, ctx };
    			link1.$set(link1_changes);

    			var router_changes = {};
    			if (changed.$$scope) router_changes.$$scope = { changed, ctx };
    			router.$set(router_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			link0.$$.fragment.i(local);

    			link1.$$.fragment.i(local);

    			router.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			link0.$$.fragment.o(local);
    			link1.$$.fragment.o(local);
    			router.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(h1);
    				detach(t1);
    				detach(p);
    				detach(t3);
    			}

    			link0.$destroy(detaching);

    			if (detaching) {
    				detach(t4);
    			}

    			link1.$destroy(detaching);

    			if (detaching) {
    				detach(t5);
    			}

    			router.$destroy(detaching);
    		}
    	};
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$4, safe_not_equal, []);
    	}
    }

    document.addEventListener('DOMContentLoaded', () => {
      new App({
        target: document.body,
      });
    });

}());
