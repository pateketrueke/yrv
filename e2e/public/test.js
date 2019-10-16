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
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
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
    function add_binding_callback(fn) {
        binding_callbacks.push(fn);
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

    var strictUriEncode = str => encodeURIComponent(str).replace(/[!'()*]/g, x => `%${x.charCodeAt(0).toString(16).toUpperCase()}`);

    var token = '%[a-f0-9]{2}';
    var singleMatcher = new RegExp(token, 'gi');
    var multiMatcher = new RegExp('(' + token + ')+', 'gi');

    function decodeComponents(components, split) {
    	try {
    		// Try to decode the entire string first
    		return decodeURIComponent(components.join(''));
    	} catch (err) {
    		// Do nothing
    	}

    	if (components.length === 1) {
    		return components;
    	}

    	split = split || 1;

    	// Split the array in 2 parts
    	var left = components.slice(0, split);
    	var right = components.slice(split);

    	return Array.prototype.concat.call([], decodeComponents(left), decodeComponents(right));
    }

    function decode(input) {
    	try {
    		return decodeURIComponent(input);
    	} catch (err) {
    		var tokens = input.match(singleMatcher);

    		for (var i = 1; i < tokens.length; i++) {
    			input = decodeComponents(tokens, i).join('');

    			tokens = input.match(singleMatcher);
    		}

    		return input;
    	}
    }

    function customDecodeURIComponent(input) {
    	// Keep track of all the replacements and prefill the map with the `BOM`
    	var replaceMap = {
    		'%FE%FF': '\uFFFD\uFFFD',
    		'%FF%FE': '\uFFFD\uFFFD'
    	};

    	var match = multiMatcher.exec(input);
    	while (match) {
    		try {
    			// Decode as big chunks as possible
    			replaceMap[match[0]] = decodeURIComponent(match[0]);
    		} catch (err) {
    			var result = decode(match[0]);

    			if (result !== match[0]) {
    				replaceMap[match[0]] = result;
    			}
    		}

    		match = multiMatcher.exec(input);
    	}

    	// Add `%C2` at the end of the map to make sure it does not replace the combinator before everything else
    	replaceMap['%C2'] = '\uFFFD';

    	var entries = Object.keys(replaceMap);

    	for (var i = 0; i < entries.length; i++) {
    		// Replace all decoded components
    		var key = entries[i];
    		input = input.replace(new RegExp(key, 'g'), replaceMap[key]);
    	}

    	return input;
    }

    var decodeUriComponent = function (encodedURI) {
    	if (typeof encodedURI !== 'string') {
    		throw new TypeError('Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`');
    	}

    	try {
    		encodedURI = encodedURI.replace(/\+/g, ' ');

    		// Try the built in decoder first
    		return decodeURIComponent(encodedURI);
    	} catch (err) {
    		// Fallback to a more advanced decoder
    		return customDecodeURIComponent(encodedURI);
    	}
    };

    var splitOnFirst = (string, separator) => {
    	if (!(typeof string === 'string' && typeof separator === 'string')) {
    		throw new TypeError('Expected the arguments to be of type `string`');
    	}

    	if (separator === '') {
    		return [string];
    	}

    	const separatorIndex = string.indexOf(separator);

    	if (separatorIndex === -1) {
    		return [string];
    	}

    	return [
    		string.slice(0, separatorIndex),
    		string.slice(separatorIndex + separator.length)
    	];
    };

    function encoderForArrayFormat(options) {
    	switch (options.arrayFormat) {
    		case 'index':
    			return key => (result, value) => {
    				const index = result.length;
    				if (value === undefined) {
    					return result;
    				}

    				if (value === null) {
    					return [...result, [encode(key, options), '[', index, ']'].join('')];
    				}

    				return [
    					...result,
    					[encode(key, options), '[', encode(index, options), ']=', encode(value, options)].join('')
    				];
    			};

    		case 'bracket':
    			return key => (result, value) => {
    				if (value === undefined) {
    					return result;
    				}

    				if (value === null) {
    					return [...result, [encode(key, options), '[]'].join('')];
    				}

    				return [...result, [encode(key, options), '[]=', encode(value, options)].join('')];
    			};

    		case 'comma':
    			return key => (result, value, index) => {
    				if (value === null || value === undefined || value.length === 0) {
    					return result;
    				}

    				if (index === 0) {
    					return [[encode(key, options), '=', encode(value, options)].join('')];
    				}

    				return [[result, encode(value, options)].join(',')];
    			};

    		default:
    			return key => (result, value) => {
    				if (value === undefined) {
    					return result;
    				}

    				if (value === null) {
    					return [...result, encode(key, options)];
    				}

    				return [...result, [encode(key, options), '=', encode(value, options)].join('')];
    			};
    	}
    }

    function parserForArrayFormat(options) {
    	let result;

    	switch (options.arrayFormat) {
    		case 'index':
    			return (key, value, accumulator) => {
    				result = /\[(\d*)\]$/.exec(key);

    				key = key.replace(/\[\d*\]$/, '');

    				if (!result) {
    					accumulator[key] = value;
    					return;
    				}

    				if (accumulator[key] === undefined) {
    					accumulator[key] = {};
    				}

    				accumulator[key][result[1]] = value;
    			};

    		case 'bracket':
    			return (key, value, accumulator) => {
    				result = /(\[\])$/.exec(key);
    				key = key.replace(/\[\]$/, '');

    				if (!result) {
    					accumulator[key] = value;
    					return;
    				}

    				if (accumulator[key] === undefined) {
    					accumulator[key] = [value];
    					return;
    				}

    				accumulator[key] = [].concat(accumulator[key], value);
    			};

    		case 'comma':
    			return (key, value, accumulator) => {
    				const isArray = typeof value === 'string' && value.split('').indexOf(',') > -1;
    				const newValue = isArray ? value.split(',') : value;
    				accumulator[key] = newValue;
    			};

    		default:
    			return (key, value, accumulator) => {
    				if (accumulator[key] === undefined) {
    					accumulator[key] = value;
    					return;
    				}

    				accumulator[key] = [].concat(accumulator[key], value);
    			};
    	}
    }

    function encode(value, options) {
    	if (options.encode) {
    		return options.strict ? strictUriEncode(value) : encodeURIComponent(value);
    	}

    	return value;
    }

    function decode$1(value, options) {
    	if (options.decode) {
    		return decodeUriComponent(value);
    	}

    	return value;
    }

    function keysSorter(input) {
    	if (Array.isArray(input)) {
    		return input.sort();
    	}

    	if (typeof input === 'object') {
    		return keysSorter(Object.keys(input))
    			.sort((a, b) => Number(a) - Number(b))
    			.map(key => input[key]);
    	}

    	return input;
    }

    function removeHash(input) {
    	const hashStart = input.indexOf('#');
    	if (hashStart !== -1) {
    		input = input.slice(0, hashStart);
    	}

    	return input;
    }

    function extract(input) {
    	input = removeHash(input);
    	const queryStart = input.indexOf('?');
    	if (queryStart === -1) {
    		return '';
    	}

    	return input.slice(queryStart + 1);
    }

    function parseValue(value, options) {
    	if (options.parseNumbers && !Number.isNaN(Number(value)) && (typeof value === 'string' && value.trim() !== '')) {
    		value = Number(value);
    	} else if (options.parseBooleans && value !== null && (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')) {
    		value = value.toLowerCase() === 'true';
    	}

    	return value;
    }

    function parse(input, options) {
    	options = Object.assign({
    		decode: true,
    		sort: true,
    		arrayFormat: 'none',
    		parseNumbers: false,
    		parseBooleans: false
    	}, options);

    	const formatter = parserForArrayFormat(options);

    	// Create an object with no prototype
    	const ret = Object.create(null);

    	if (typeof input !== 'string') {
    		return ret;
    	}

    	input = input.trim().replace(/^[?#&]/, '');

    	if (!input) {
    		return ret;
    	}

    	for (const param of input.split('&')) {
    		let [key, value] = splitOnFirst(param.replace(/\+/g, ' '), '=');

    		// Missing `=` should be `null`:
    		// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
    		value = value === undefined ? null : decode$1(value, options);
    		formatter(decode$1(key, options), value, ret);
    	}

    	for (const key of Object.keys(ret)) {
    		const value = ret[key];
    		if (typeof value === 'object' && value !== null) {
    			for (const k of Object.keys(value)) {
    				value[k] = parseValue(value[k], options);
    			}
    		} else {
    			ret[key] = parseValue(value, options);
    		}
    	}

    	if (options.sort === false) {
    		return ret;
    	}

    	return (options.sort === true ? Object.keys(ret).sort() : Object.keys(ret).sort(options.sort)).reduce((result, key) => {
    		const value = ret[key];
    		if (Boolean(value) && typeof value === 'object' && !Array.isArray(value)) {
    			// Sort object keys, not values
    			result[key] = keysSorter(value);
    		} else {
    			result[key] = value;
    		}

    		return result;
    	}, Object.create(null));
    }

    var extract_1 = extract;
    var parse_1 = parse;

    var stringify = (object, options) => {
    	if (!object) {
    		return '';
    	}

    	options = Object.assign({
    		encode: true,
    		strict: true,
    		arrayFormat: 'none'
    	}, options);

    	const formatter = encoderForArrayFormat(options);
    	const keys = Object.keys(object);

    	if (options.sort !== false) {
    		keys.sort(options.sort);
    	}

    	return keys.map(key => {
    		const value = object[key];

    		if (value === undefined) {
    			return '';
    		}

    		if (value === null) {
    			return encode(key, options);
    		}

    		if (Array.isArray(value)) {
    			return value
    				.reduce(formatter(key), [])
    				.join('&');
    		}

    		return encode(key, options) + '=' + encode(value, options);
    	}).filter(x => x.length > 0).join('&');
    };

    var parseUrl = (input, options) => {
    	return {
    		url: removeHash(input).split('?')[0] || '',
    		query: parse(extract(input), options)
    	};
    };

    var queryString = {
    	extract: extract_1,
    	parse: parse_1,
    	stringify: stringify,
    	parseUrl: parseUrl
    };

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
          return ("((?!#)" + (expr || '[^#/]+?') + ")");
        }

        _isSplat = true;
        _priority += 500;
        return ("((?!#)" + (expr || '[^#]+?') + ")");
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
              var routeInfo = Object.assign({}, root[k].info); // properly handle exact-routes!

              var hasMatch = false;

              if (routeInfo.exact && extra === null || !routeInfo.exact && (x === leaf || _isSplat || !extra)) {
                hasMatch = true;
              }

              routeInfo.matches = hasMatch;
              routeInfo.params = Object.assign({}, params);
              routeInfo.route = root[k].route;
              routeInfo.path = _isSplat ? extra : leaf || x;
              out.push(routeInfo);
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
        resolve: function (path, cb) {
          var ref = path.split(/(?=[#?])/);
          var uri = ref[0];
          var hash = ref[1];
          var query = ref[2];
          var segments = uri.substr(1).split('/');
          var prefix = [];
          var seen = [];
          segments.some(function (key) {
            var sub = prefix.concat(("/" + key)).join('');
            if (key.length) { prefix.push(("/" + key)); }

            try {
              var next = find(sub, routes, 1);
              cb(null, next.filter(function (x) {
                if (!seen.includes(x.route)) {
                  seen.push(x.route);
                  return true;
                }

                return false;
              }));
            } catch (e) {
              cb(e, []);
              return true;
            }

            return false;
          });

          if (hash) {
            cb(null, find(("" + uri + hash), routes, 1));
          }
        },
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

    const router = writable({});

    const CTX_ROUTER = {};
    const CTX_ROUTE = {};

    function navigateTo(path, options) {
      const {
        reload, replace,
        params, queryParams,
      } = options || {};

      // If path empty or no string, throws error
      if (!path || typeof path !== 'string') {
        throw new Error(`yrv expects navigateTo() to have a string parameter. The parameter provided was: ${path} of type ${typeof path} instead.`);
      }

      if (path[0] !== '/' && path[0] !== '#') {
        throw new Error(`yrv expects navigateTo() param to start with slash or hash, e.g. "/${path}" or "#${path}" instead of "${path}".`);
      }

      if (params) {
        path = path.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, (_, key) => params[key]);
      }

      if (queryParams) {
        const qs = queryString.stringify(queryParams);

        if (qs) {
          path += `?${qs}`;
        }
      }

      // If no History API support, fallbacks to URL redirect
      if (reload || !history.pushState || !dispatchEvent) {
        location.href = path;
        return;
      }

      // make sure we're not invoking events from same page twice!
      if ((location.pathname + location.search) !== path) {
        // If has History API support, uses it
        history[replace ? 'replaceState' : 'pushState'](null, '', path);
        dispatchEvent(new Event('popstate'));
      }
    }

    /* src/Router.svelte generated by Svelte v3.4.4 */

    const file = "src/Router.svelte";

    // (154:0) {#if failure && !fallback}
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
    			add_location(legend, file, 155, 4, 3703);
    			add_location(pre, file, 156, 4, 3747);
    			add_location(fieldset, file, 154, 2, 3688);
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
    	var t, if_block_anchor, current, dispose;

    	const default_slot_1 = ctx.$$slots.default;
    	const default_slot = create_slot(default_slot_1, ctx, null);

    	var if_block = (ctx.failure && !ctx.fallback) && create_if_block(ctx);

    	return {
    		c: function create() {
    			if (default_slot) default_slot.c();
    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();

    			dispose = listen(window, "popstate", ctx.resolveRoutes);
    		},

    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			insert(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (default_slot && default_slot.p && changed.$$scope) {
    				default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
    			}

    			if (ctx.failure && !ctx.fallback) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
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

    			if (detaching) {
    				detach(t);
    			}

    			if (if_block) if_block.d(detaching);

    			if (detaching) {
    				detach(if_block_anchor);
    			}

    			dispose();
    		}
    	};
    }



    const baseRouter = new Router();

    function fixPath(route) {
      if (route === '/#*' || route === '#*') return '#*_';
      if (route === '/*' || route === '*') return '/*_';
      return route;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $routeInfo, $router, $basePath;

    	validate_store(router, 'router');
    	subscribe($$self, router, $$value => { $router = $$value; $$invalidate('$router', $router); });

    	let failure;
      let fallback;

      let { path = '/', exact = null, nofallback = false } = $$props;

      const isExact = exact;
      const routerContext = getContext(CTX_ROUTER);
      const routeInfo = routerContext ? routerContext.routeInfo : writable({}); validate_store(routeInfo, 'routeInfo'); subscribe($$self, routeInfo, $$value => { $routeInfo = $$value; $$invalidate('$routeInfo', $routeInfo); });
      const basePath = routerContext ? routerContext.basePath : writable(path); validate_store(basePath, 'basePath'); subscribe($$self, basePath, $$value => { $basePath = $$value; $$invalidate('$basePath', $basePath); });

      function doFallback(e, _path, queryParams) {
        $routeInfo = {
          [fallback]: {
            failure: e,
            query: queryParams,
            params: { _: _path.substr(1) || undefined },
          },
        }; routeInfo.set($routeInfo);
      }

      function handleRoutes(map, _path, _query, _shared) {
        const _params = map.reduce((prev, cur) => {
          if (cur.key) {
            Object.assign(_shared, cur.params);

            prev[cur.key] = Object.assign(prev[cur.key] || {}, cur.params);
          }

          return prev;
        }, {});

        map.some(x => {
          if (x.key && x.matches && !$routeInfo[x.key]) {
            if (typeof x.condition === 'boolean' || typeof x.condition === 'function') {
              const ok = typeof x.condition === 'function' ? x.condition($router) : x.condition;

              if (ok !== true && x.redirect) {
                navigateTo(x.redirect);
                return true;
              }
            }

            if (x.redirect && !x.condition) {
              navigateTo(x.redirect);
              return true;
            }

            $routeInfo[x.key] = {
              ...x,
              query: _query,
              params: _params[x.key],
            }; routeInfo.set($routeInfo);
          }

          return false;
        });
      }

      function resolveRoutes() {
        clearTimeout(resolveRoutes.t);

        resolveRoutes.t = setTimeout(() => {
          $$invalidate('failure', failure = null);
          $routeInfo = {}; routeInfo.set($routeInfo);

          const [baseUri, searchQuery] = location.href.split('?');
          const fullpath = `/${baseUri.split('/').slice(3).join('/')}`;
          const query = queryString.parse(searchQuery);
          const ctx = {};

          try {
            if (fullpath.indexOf($basePath) === 0) {
              baseRouter.resolve(fullpath, (err, result) => {
                if (err) {
                  $$invalidate('failure', failure = err);
                  return;
                }

                handleRoutes(result, fullpath, query, ctx);
              });

              if (failure && fallback) {
                doFallback(failure, fullpath, query);
              }
            }
          } catch (e) {
            $$invalidate('failure', failure = e);
          } finally {
            $router.path = fullpath; router.set($router);
            $router.query = query; router.set($router);
            $router.params = ctx; router.set($router);
          }
        }, 50); $$invalidate('resolveRoutes', resolveRoutes);
      }

      function assignRoute(key, route, detail) {
        key = key || Math.random().toString(36).substr(2);

        const fixedRoot = $basePath !== path && $basePath !== '/'
          ? `${$basePath}${path !== '/' ? path : ''}`
          : path;

        const handler = { key, ...detail };

        let fullpath;

        baseRouter.mount(fixedRoot, () => {
          fullpath = baseRouter.add(route !== '/' ? fixPath(route) : '', handler);
          $$invalidate('fallback', fallback = (handler.fallback && key) || fallback);
        });

        resolveRoutes();

        return [key, fullpath];
      }

      function unassignRoute(route) {
        baseRouter.rm(fixPath(route));
        resolveRoutes();
      }

      setContext(CTX_ROUTER, {
        isExact,
        basePath,
        routeInfo,
        assignRoute,
        unassignRoute,
      });

    	const writable_props = ['path', 'exact', 'nofallback'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	$$self.$set = $$props => {
    		if ('path' in $$props) $$invalidate('path', path = $$props.path);
    		if ('exact' in $$props) $$invalidate('exact', exact = $$props.exact);
    		if ('nofallback' in $$props) $$invalidate('nofallback', nofallback = $$props.nofallback);
    		if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
    	};

    	return {
    		failure,
    		fallback,
    		path,
    		exact,
    		nofallback,
    		routeInfo,
    		basePath,
    		resolveRoutes,
    		$$slots,
    		$$scope
    	};
    }

    class Router_1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["path", "exact", "nofallback"]);
    	}

    	get path() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exact() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exact(value) {
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

    // (68:0) {#if activeRouter}
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

    // (71:2) {:else}
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

    // (69:2) {#if component}
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
      const { props: sub, ...others } = given;

      // prune all declared props from this component
      required.forEach(k => {
        delete others[k];
      });

      return {
        ...sub,
        ...others,
      };
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $routePath, $routeInfo;

    	

      let { key = null, path = '', props = null, exact = null, fallback = null, component = null, condition = null, redirect = null } = $$props;

      const routeContext = getContext(CTX_ROUTE);
      const routePath = routeContext ? routeContext.routePath : writable(path); validate_store(routePath, 'routePath'); subscribe($$self, routePath, $$value => { $routePath = $$value; $$invalidate('$routePath', $routePath); });

      const {
        assignRoute, unassignRoute, routeInfo, isExact,
      } = getContext(CTX_ROUTER); validate_store(routeInfo, 'routeInfo'); subscribe($$self, routeInfo, $$value => { $routeInfo = $$value; $$invalidate('$routeInfo', $routeInfo); });

      // inherit exact from parent Router
      if (isExact) $$invalidate('exact', exact = true);

      let activeRouter = null;
      let activeProps = {};
      let fullpath;

      const fixedRoot = $routePath !== path && $routePath !== '/'
        ? `${$routePath}${path !== '/' ? path : ''}`
        : path;

      [key, fullpath] = assignRoute(key, fixedRoot, {
        condition, redirect, fallback, exact,
      }); $$invalidate('key', key);
      onDestroy(() => {
        unassignRoute(fullpath);
      });

      setContext(CTX_ROUTE, {
        routePath,
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
            $$invalidate('activeProps', activeProps = getProps($$props, arguments[0].$$.props));
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
    		routePath,
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

    // (72:0) {:else}
    function create_else_block$1(ctx) {
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
    			add_location(a, file$1, 72, 2, 1787);
    			dispose = listen(a, "click", prevent_default(ctx.onClick));
    		},

    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(a_nodes);
    		},

    		m: function mount(target, anchor) {
    			insert(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			add_binding_callback(() => ctx.a_binding(a, null));
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (default_slot && default_slot.p && changed.$$scope) {
    				default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
    			}

    			if (changed.items) {
    				ctx.a_binding(null, a);
    				ctx.a_binding(a, null);
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
    			ctx.a_binding(null, a);
    			dispose();
    		}
    	};
    }

    // (68:0) {#if button}
    function create_if_block$2(ctx) {
    	var button_1, current, dispose;

    	const default_slot_1 = ctx.$$slots.default;
    	const default_slot = create_slot(default_slot_1, ctx, null);

    	return {
    		c: function create() {
    			button_1 = element("button");

    			if (default_slot) default_slot.c();

    			button_1.className = ctx.className;
    			button_1.title = ctx.title;
    			add_location(button_1, file$1, 68, 2, 1667);
    			dispose = listen(button_1, "click", prevent_default(ctx.onClick));
    		},

    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(button_1_nodes);
    		},

    		m: function mount(target, anchor) {
    			insert(target, button_1, anchor);

    			if (default_slot) {
    				default_slot.m(button_1, null);
    			}

    			add_binding_callback(() => ctx.button_1_binding(button_1, null));
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			if (default_slot && default_slot.p && changed.$$scope) {
    				default_slot.p(get_slot_changes(default_slot_1, ctx, changed, null), get_slot_context(default_slot_1, ctx, null));
    			}

    			if (changed.items) {
    				ctx.button_1_binding(null, button_1);
    				ctx.button_1_binding(button_1, null);
    			}

    			if (!current || changed.className) {
    				button_1.className = ctx.className;
    			}

    			if (!current || changed.title) {
    				button_1.title = ctx.title;
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
    				detach(button_1);
    			}

    			if (default_slot) default_slot.d(detaching);
    			ctx.button_1_binding(null, button_1);
    			dispose();
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	var current_block_type_index, if_block, if_block_anchor, current;

    	var if_block_creators = [
    		create_if_block$2,
    		create_else_block$1
    	];

    	var if_blocks = [];

    	function select_block_type(ctx) {
    		if (ctx.button) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
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

    function instance$2($$self, $$props, $$invalidate) {
    	let $router;

    	validate_store(router, 'router');
    	subscribe($$self, router, $$value => { $router = $$value; $$invalidate('$router', $router); });

    	

      let ref;
      let active;
      let { class: cssClass = '', go = null, href = '/', title = '', button = false, exact = false, reload = false, replace = false, className = '' } = $$props;

      onMount(() => {
        $$invalidate('className', className = className || cssClass);
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

    	const writable_props = ['class', 'go', 'href', 'title', 'button', 'exact', 'reload', 'replace', 'className'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Link> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;

    	function button_1_binding($$node, check) {
    		ref = $$node;
    		$$invalidate('ref', ref);
    	}

    	function a_binding($$node, check) {
    		ref = $$node;
    		$$invalidate('ref', ref);
    	}

    	$$self.$set = $$props => {
    		if ('class' in $$props) $$invalidate('cssClass', cssClass = $$props.class);
    		if ('go' in $$props) $$invalidate('go', go = $$props.go);
    		if ('href' in $$props) $$invalidate('href', href = $$props.href);
    		if ('title' in $$props) $$invalidate('title', title = $$props.title);
    		if ('button' in $$props) $$invalidate('button', button = $$props.button);
    		if ('exact' in $$props) $$invalidate('exact', exact = $$props.exact);
    		if ('reload' in $$props) $$invalidate('reload', reload = $$props.reload);
    		if ('replace' in $$props) $$invalidate('replace', replace = $$props.replace);
    		if ('className' in $$props) $$invalidate('className', className = $$props.className);
    		if ('$$scope' in $$props) $$invalidate('$$scope', $$scope = $$props.$$scope);
    	};

    	$$self.$$.update = ($$dirty = { ref: 1, $router: 1, exact: 1, href: 1, active: 1, button: 1 }) => {
    		if ($$dirty.ref || $$dirty.$router || $$dirty.exact || $$dirty.href || $$dirty.active || $$dirty.button) { if (ref && $router.path) {
            const isActive = (exact !== true && $router.path.indexOf(href) === 0) || ($router.path === href);
        
            if (isActive && !active) {
              $$invalidate('active', active = true);
              ref.setAttribute('aria-current', 'page');
        
              if (button) {
                ref.setAttribute('disabled', true);
              }
            }
        
            if (!isActive && active) {
              $$invalidate('active', active = false);
              ref.removeAttribute('disabled');
              ref.removeAttribute('aria-current');
            }
          } }
    	};

    	return {
    		ref,
    		cssClass,
    		go,
    		href,
    		title,
    		button,
    		exact,
    		reload,
    		replace,
    		className,
    		onClick,
    		button_1_binding,
    		a_binding,
    		$$slots,
    		$$scope
    	};
    }

    class Link extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, ["class", "go", "href", "title", "button", "exact", "reload", "replace", "className"]);
    	}

    	get class() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get go() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set go(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get href() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set href(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get title() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get button() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set button(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get exact() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set exact(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get reload() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set reload(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get replace() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replace(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get className() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set className(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* e2e/components/Testing.svelte generated by Svelte v3.4.4 */

    const file$2 = "e2e/components/Testing.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = Object.create(ctx);
    	child_ctx.key = list[i][0];
    	child_ctx.value = list[i][1];
    	return child_ctx;
    }

    // (47:4) {#each Object.entries(router.query) as [key, value]}
    function create_each_block(ctx) {
    	var tr, td0, t0_value = ctx.key, t0, t1, td1, t2_value = ctx.value, t2, t3, td2, button, dispose;

    	function click_handler() {
    		return ctx.click_handler(ctx);
    	}

    	return {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			button = element("button");
    			button.textContent = "rm";
    			add_location(td0, file$2, 48, 8, 1093);
    			add_location(td1, file$2, 49, 8, 1116);
    			add_location(button, file$2, 50, 12, 1145);
    			add_location(td2, file$2, 50, 8, 1141);
    			add_location(tr, file$2, 47, 6, 1080);
    			dispose = listen(button, "click", click_handler);
    		},

    		m: function mount(target, anchor) {
    			insert(target, tr, anchor);
    			append(tr, td0);
    			append(td0, t0);
    			append(tr, t1);
    			append(tr, td1);
    			append(td1, t2);
    			append(tr, t3);
    			append(tr, td2);
    			append(td2, button);
    		},

    		p: function update(changed, new_ctx) {
    			ctx = new_ctx;
    			if ((changed.router) && t0_value !== (t0_value = ctx.key)) {
    				set_data(t0, t0_value);
    			}

    			if ((changed.router) && t2_value !== (t2_value = ctx.value)) {
    				set_data(t2, t2_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(tr);
    			}

    			dispose();
    		}
    	};
    }

    // (61:2) <Link on:click={() => overrideQueryParams('truth', 42)}>
    function create_default_slot_2(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Do not click!");
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

    // (65:2) <Route path="/:value" let:router>
    function create_default_slot_1(ctx) {
    	var p, t0, t1_value = ctx.router.params.value, t1;

    	return {
    		c: function create() {
    			p = element("p");
    			t0 = text("Value: ");
    			t1 = text(t1_value);
    			add_location(p, file$2, 65, 4, 1538);
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

    // (64:0) <Router>
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
    	var h3, t1, fieldset, legend, t3, ul, li0, t4, t5_value = JSON.stringify(ctx.router.key), t5, t6, li1, t7, t8_value = JSON.stringify(ctx.router.matches), t8, t9, li2, t10, t11_value = JSON.stringify(ctx.router.params), t11, t12, li3, t13, t14_value = JSON.stringify(ctx.router.route), t14, t15, li4, t16, t17_value = JSON.stringify(ctx.router.query), t17, t18, li5, t19, t20_value = JSON.stringify(ctx.router.path), t20, t21, table, caption, t23, tr0, th0, t25, th1, t27, t28, tr1, td0, input0, t29, td1, input1, t30, td2, button, t32, t33, current, dispose;

    	var each_value = Object.entries(ctx.router.query);

    	var each_blocks = [];

    	for (var i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	var link = new Link({
    		props: {
    		$$slots: { default: [create_default_slot_2] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});
    	link.$on("click", ctx.click_handler_1);

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
    			t16 = text("query: ");
    			t17 = text(t17_value);
    			t18 = space();
    			li5 = element("li");
    			t19 = text("path: ");
    			t20 = text(t20_value);
    			t21 = space();
    			table = element("table");
    			caption = element("caption");
    			caption.textContent = "QueryParams";
    			t23 = space();
    			tr0 = element("tr");
    			th0 = element("th");
    			th0.textContent = "key";
    			t25 = space();
    			th1 = element("th");
    			th1.textContent = "value";
    			t27 = space();

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t28 = space();
    			tr1 = element("tr");
    			td0 = element("td");
    			input0 = element("input");
    			t29 = space();
    			td1 = element("td");
    			input1 = element("input");
    			t30 = space();
    			td2 = element("td");
    			button = element("button");
    			button.textContent = "add";
    			t32 = space();
    			link.$$.fragment.c();
    			t33 = space();
    			router_1.$$.fragment.c();
    			add_location(h3, file$2, 28, 0, 502);
    			add_location(legend, file$2, 30, 2, 567);
    			add_location(li0, file$2, 32, 4, 602);
    			add_location(li1, file$2, 33, 4, 649);
    			add_location(li2, file$2, 34, 4, 704);
    			add_location(li3, file$2, 35, 4, 757);
    			add_location(li4, file$2, 36, 4, 808);
    			add_location(li5, file$2, 37, 4, 859);
    			add_location(ul, file$2, 31, 2, 593);
    			add_location(caption, file$2, 41, 4, 927);
    			add_location(th0, file$2, 43, 6, 973);
    			add_location(th1, file$2, 44, 6, 992);
    			add_location(tr0, file$2, 42, 4, 962);
    			add_location(input0, file$2, 54, 10, 1243);
    			add_location(td0, file$2, 54, 6, 1239);
    			add_location(input1, file$2, 55, 10, 1288);
    			add_location(td1, file$2, 55, 6, 1284);
    			add_location(button, file$2, 56, 10, 1335);
    			add_location(td2, file$2, 56, 6, 1331);
    			add_location(tr1, file$2, 53, 4, 1228);
    			add_location(table, file$2, 40, 2, 915);
    			fieldset.dataset.test = "parameters";
    			add_location(fieldset, file$2, 29, 0, 531);

    			dispose = [
    				listen(input0, "input", ctx.input0_input_handler),
    				listen(input1, "input", ctx.input1_input_handler),
    				listen(button, "click", ctx.addNewValue)
    			];
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
    			append(ul, t18);
    			append(ul, li5);
    			append(li5, t19);
    			append(li5, t20);
    			append(fieldset, t21);
    			append(fieldset, table);
    			append(table, caption);
    			append(table, t23);
    			append(table, tr0);
    			append(tr0, th0);
    			append(tr0, t25);
    			append(tr0, th1);
    			append(table, t27);

    			for (var i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}

    			append(table, t28);
    			append(table, tr1);
    			append(tr1, td0);
    			append(td0, input0);

    			input0.value = ctx.newKey;

    			append(tr1, t29);
    			append(tr1, td1);
    			append(td1, input1);

    			input1.value = ctx.newValue;

    			append(tr1, t30);
    			append(tr1, td2);
    			append(td2, button);
    			append(fieldset, t32);
    			mount_component(link, fieldset, null);
    			insert(target, t33, anchor);
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

    			if ((!current || changed.router) && t17_value !== (t17_value = JSON.stringify(ctx.router.query))) {
    				set_data(t17, t17_value);
    			}

    			if ((!current || changed.router) && t20_value !== (t20_value = JSON.stringify(ctx.router.path))) {
    				set_data(t20, t20_value);
    			}

    			if (changed.router) {
    				each_value = Object.entries(ctx.router.query);

    				for (var i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(changed, child_ctx);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(table, t28);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}
    				each_blocks.length = each_value.length;
    			}

    			if (changed.newKey && (input0.value !== ctx.newKey)) input0.value = ctx.newKey;
    			if (changed.newValue && (input1.value !== ctx.newValue)) input1.value = ctx.newValue;

    			var link_changes = {};
    			if (changed.$$scope) link_changes.$$scope = { changed, ctx };
    			link.$set(link_changes);

    			var router_1_changes = {};
    			if (changed.$$scope) router_1_changes.$$scope = { changed, ctx };
    			router_1.$set(router_1_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			link.$$.fragment.i(local);

    			router_1.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			link.$$.fragment.o(local);
    			router_1.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(h3);
    				detach(t1);
    				detach(fieldset);
    			}

    			destroy_each(each_blocks, detaching);

    			link.$destroy();

    			if (detaching) {
    				detach(t33);
    			}

    			router_1.$destroy(detaching);

    			run_all(dispose);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { router = null } = $$props;

      let newKey = '';
      let newValue = '';

      function overrideQueryParams(key, value) {
        if (key) {
          navigateTo(router.path, { replace: true, queryParams: { ...router.query, [key]: value } });
        }
      }

      function addNewValue() {
        overrideQueryParams(newKey, newValue);

        $$invalidate('newKey', newKey = '');
        $$invalidate('newValue', newValue = '');
      }

      function rmValue(key) {
        overrideQueryParams(key);
      }

    	const writable_props = ['router'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Testing> was created with unknown prop '${key}'`);
    	});

    	function click_handler({ key }) {
    		return rmValue(key);
    	}

    	function input0_input_handler() {
    		newKey = this.value;
    		$$invalidate('newKey', newKey);
    	}

    	function input1_input_handler() {
    		newValue = this.value;
    		$$invalidate('newValue', newValue);
    	}

    	function click_handler_1() {
    		return overrideQueryParams('truth', 42);
    	}

    	$$self.$set = $$props => {
    		if ('router' in $$props) $$invalidate('router', router = $$props.router);
    	};

    	return {
    		router,
    		newKey,
    		newValue,
    		overrideQueryParams,
    		addNewValue,
    		rmValue,
    		click_handler,
    		input0_input_handler,
    		input1_input_handler,
    		click_handler_1
    	};
    }

    class Testing extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, ["router"]);
    	}

    	get router() {
    		throw new Error("<Testing>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set router(value) {
    		throw new Error("<Testing>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* e2e/App.svelte generated by Svelte v3.4.4 */

    const file$3 = "e2e/App.svelte";

    // (13:0) <Link exact href="/">
    function create_default_slot_21(ctx) {
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

    // (13:35) <Link href="/test">
    function create_default_slot_20(ctx) {
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

    // (13:73) <Link href="/sub">
    function create_default_slot_19(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Anchor page");
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

    // (13:112) <Link href="/e">
    function create_default_slot_18(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Error page");
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

    // (21:4) <Link exact button go="-1" href="/test">
    function create_default_slot_17(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Undo");
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

    // (21:58) <Link href="/test/props">
    function create_default_slot_16(ctx) {
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

    // (23:6) <Link href="/test/static">
    function create_default_slot_15(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Redirect");
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

    // (24:6) <Link href="/test/dynamic">
    function create_default_slot_14(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Protected");
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

    // (27:6) <Route path="/failed">
    function create_default_slot_13(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Wrong!");
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

    // (29:6) <Route path="/dynamic" redirect="/test/failed" condition={() => confirm('Are you sure?')}>
    function create_default_slot_12(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Yay!");
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

    // (16:2) <Route path="/">
    function create_default_slot_11(ctx) {
    	var h2, t1, p0, t2, tt, t4, t5, t6, t7, t8, t9, p1, t10, t11, current;

    	var link0 = new Link({
    		props: {
    		exact: true,
    		button: true,
    		go: "-1",
    		href: "/test",
    		$$slots: { default: [create_default_slot_17] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var link1 = new Link({
    		props: {
    		href: "/test/props",
    		$$slots: { default: [create_default_slot_16] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var link2 = new Link({
    		props: {
    		href: "/test/static",
    		$$slots: { default: [create_default_slot_15] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var link3 = new Link({
    		props: {
    		href: "/test/dynamic",
    		$$slots: { default: [create_default_slot_14] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var route0 = new Route({
    		props: {
    		path: "/failed",
    		$$slots: { default: [create_default_slot_13] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var route1 = new Route({
    		props: { path: "/static", redirect: "/test" },
    		$$inline: true
    	});

    	var route2 = new Route({
    		props: {
    		path: "/dynamic",
    		redirect: "/test/failed",
    		condition: func,
    		$$slots: { default: [create_default_slot_12] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Testing features";
    			t1 = space();
    			p0 = element("p");
    			t2 = text("This content is always mounted when the current URL starts-with ");
    			tt = element("tt");
    			tt.textContent = "/test";
    			t4 = text(".");
    			t5 = space();
    			link0.$$.fragment.c();
    			t6 = text(" | ");
    			link1.$$.fragment.c();
    			t7 = text("\n\n    | ");
    			link2.$$.fragment.c();
    			t8 = text("\n    | ");
    			link3.$$.fragment.c();
    			t9 = space();
    			p1 = element("p");
    			route0.$$.fragment.c();
    			t10 = space();
    			route1.$$.fragment.c();
    			t11 = space();
    			route2.$$.fragment.c();
    			add_location(h2, file$3, 16, 4, 421);
    			add_location(tt, file$3, 18, 71, 519);
    			add_location(p0, file$3, 18, 4, 452);
    			add_location(p1, file$3, 25, 4, 745);
    		},

    		m: function mount(target, anchor) {
    			insert(target, h2, anchor);
    			insert(target, t1, anchor);
    			insert(target, p0, anchor);
    			append(p0, t2);
    			append(p0, tt);
    			append(p0, t4);
    			insert(target, t5, anchor);
    			mount_component(link0, target, anchor);
    			insert(target, t6, anchor);
    			mount_component(link1, target, anchor);
    			insert(target, t7, anchor);
    			mount_component(link2, target, anchor);
    			insert(target, t8, anchor);
    			mount_component(link3, target, anchor);
    			insert(target, t9, anchor);
    			insert(target, p1, anchor);
    			mount_component(route0, p1, null);
    			append(p1, t10);
    			mount_component(route1, p1, null);
    			append(p1, t11);
    			mount_component(route2, p1, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var link0_changes = {};
    			if (changed.$$scope) link0_changes.$$scope = { changed, ctx };
    			link0.$set(link0_changes);

    			var link1_changes = {};
    			if (changed.$$scope) link1_changes.$$scope = { changed, ctx };
    			link1.$set(link1_changes);

    			var link2_changes = {};
    			if (changed.$$scope) link2_changes.$$scope = { changed, ctx };
    			link2.$set(link2_changes);

    			var link3_changes = {};
    			if (changed.$$scope) link3_changes.$$scope = { changed, ctx };
    			link3.$set(link3_changes);

    			var route0_changes = {};
    			if (changed.$$scope) route0_changes.$$scope = { changed, ctx };
    			route0.$set(route0_changes);

    			var route2_changes = {};
    			if (changed.$$scope) route2_changes.$$scope = { changed, ctx };
    			route2.$set(route2_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			link0.$$.fragment.i(local);

    			link1.$$.fragment.i(local);

    			link2.$$.fragment.i(local);

    			link3.$$.fragment.i(local);

    			route0.$$.fragment.i(local);

    			route1.$$.fragment.i(local);

    			route2.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			link0.$$.fragment.o(local);
    			link1.$$.fragment.o(local);
    			link2.$$.fragment.o(local);
    			link3.$$.fragment.o(local);
    			route0.$$.fragment.o(local);
    			route1.$$.fragment.o(local);
    			route2.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(h2);
    				detach(t1);
    				detach(p0);
    				detach(t5);
    			}

    			link0.$destroy(detaching);

    			if (detaching) {
    				detach(t6);
    			}

    			link1.$destroy(detaching);

    			if (detaching) {
    				detach(t7);
    			}

    			link2.$destroy(detaching);

    			if (detaching) {
    				detach(t8);
    			}

    			link3.$destroy(detaching);

    			if (detaching) {
    				detach(t9);
    				detach(p1);
    			}

    			route0.$destroy();

    			route1.$destroy();

    			route2.$destroy();
    		}
    	};
    }

    // (15:0) <Router path="/test" nofallback>
    function create_default_slot_10(ctx) {
    	var t0, t1, p, t2, tt, t4, current;

    	var route0 = new Route({
    		props: {
    		path: "/",
    		$$slots: { default: [create_default_slot_11] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var route1 = new Route({
    		props: { path: "/props", component: Testing },
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
    			add_location(tt, file$3, 34, 31, 1048);
    			p.dataset.test = "routeless";
    			add_location(p, file$3, 34, 2, 1019);
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
    			if (changed.Testing) route1_changes.component = Testing;
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

    // (40:4) <Link exact href="/sub#">
    function create_default_slot_9(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Root");
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

    // (40:43) <Link href="/sub#/about">
    function create_default_slot_8(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("About page");
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

    // (40:88) <Link href="/sub#broken">
    function create_default_slot_7(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("Broken anchor");
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

    // (39:2) <Route>
    function create_default_slot_6(ctx) {
    	var t0, t1, current;

    	var link0 = new Link({
    		props: {
    		exact: true,
    		href: "/sub#",
    		$$slots: { default: [create_default_slot_9] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var link1 = new Link({
    		props: {
    		href: "/sub#/about",
    		$$slots: { default: [create_default_slot_8] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var link2 = new Link({
    		props: {
    		href: "/sub#broken",
    		$$slots: { default: [create_default_slot_7] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			link0.$$.fragment.c();
    			t0 = text(" | ");
    			link1.$$.fragment.c();
    			t1 = text(" | ");
    			link2.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(link0, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(link1, target, anchor);
    			insert(target, t1, anchor);
    			mount_component(link2, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var link0_changes = {};
    			if (changed.$$scope) link0_changes.$$scope = { changed, ctx };
    			link0.$set(link0_changes);

    			var link1_changes = {};
    			if (changed.$$scope) link1_changes.$$scope = { changed, ctx };
    			link1.$set(link1_changes);

    			var link2_changes = {};
    			if (changed.$$scope) link2_changes.$$scope = { changed, ctx };
    			link2.$set(link2_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			link0.$$.fragment.i(local);

    			link1.$$.fragment.i(local);

    			link2.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			link0.$$.fragment.o(local);
    			link1.$$.fragment.o(local);
    			link2.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			link0.$destroy(detaching);

    			if (detaching) {
    				detach(t0);
    			}

    			link1.$destroy(detaching);

    			if (detaching) {
    				detach(t1);
    			}

    			link2.$destroy(detaching);
    		}
    	};
    }

    // (44:4) <Route path="#">
    function create_default_slot_5(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("HOME");
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

    // (45:4) <Route path="#/about">
    function create_default_slot_4(ctx) {
    	var t;

    	return {
    		c: function create() {
    			t = text("ABOUT");
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

    // (38:0) <Router exact path="/sub">
    function create_default_slot_3(ctx) {
    	var t0, p, t1, current;

    	var route0 = new Route({
    		props: {
    		$$slots: { default: [create_default_slot_6] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var route1 = new Route({
    		props: {
    		path: "#",
    		$$slots: { default: [create_default_slot_5] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var route2 = new Route({
    		props: {
    		path: "#/about",
    		$$slots: { default: [create_default_slot_4] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			route0.$$.fragment.c();
    			t0 = space();
    			p = element("p");
    			route1.$$.fragment.c();
    			t1 = space();
    			route2.$$.fragment.c();
    			p.dataset.test = "anchored";
    			add_location(p, file$3, 42, 2, 1293);
    		},

    		m: function mount(target, anchor) {
    			mount_component(route0, target, anchor);
    			insert(target, t0, anchor);
    			insert(target, p, anchor);
    			mount_component(route1, p, null);
    			append(p, t1);
    			mount_component(route2, p, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var route0_changes = {};
    			if (changed.$$scope) route0_changes.$$scope = { changed, ctx };
    			route0.$set(route0_changes);

    			var route1_changes = {};
    			if (changed.$$scope) route1_changes.$$scope = { changed, ctx };
    			route1.$set(route1_changes);

    			var route2_changes = {};
    			if (changed.$$scope) route2_changes.$$scope = { changed, ctx };
    			route2.$set(route2_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			route0.$$.fragment.i(local);

    			route1.$$.fragment.i(local);

    			route2.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			route0.$$.fragment.o(local);
    			route1.$$.fragment.o(local);
    			route2.$$.fragment.o(local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			route0.$destroy(detaching);

    			if (detaching) {
    				detach(t0);
    				detach(p);
    			}

    			route1.$destroy();

    			route2.$destroy();
    		}
    	};
    }

    // (50:2) <Route exact>
    function create_default_slot_2$1(ctx) {
    	var h2;

    	return {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "It works!";
    			add_location(h2, file$3, 50, 4, 1448);
    		},

    		m: function mount(target, anchor) {
    			insert(target, h2, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(h2);
    			}
    		}
    	};
    }

    // (54:2) <Route fallback>
    function create_default_slot_1$1(ctx) {
    	var h2;

    	return {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "NOT FOUND";
    			h2.dataset.test = "fallback";
    			add_location(h2, file$3, 54, 4, 1502);
    		},

    		m: function mount(target, anchor) {
    			insert(target, h2, anchor);
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach(h2);
    			}
    		}
    	};
    }

    // (49:0) <Router path="/e">
    function create_default_slot$1(ctx) {
    	var t, current;

    	var route0 = new Route({
    		props: {
    		exact: true,
    		$$slots: { default: [create_default_slot_2$1] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var route1 = new Route({
    		props: {
    		fallback: true,
    		$$slots: { default: [create_default_slot_1$1] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	return {
    		c: function create() {
    			route0.$$.fragment.c();
    			t = space();
    			route1.$$.fragment.c();
    		},

    		m: function mount(target, anchor) {
    			mount_component(route0, target, anchor);
    			insert(target, t, anchor);
    			mount_component(route1, target, anchor);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var route0_changes = {};
    			if (changed.$$scope) route0_changes.$$scope = { changed, ctx };
    			route0.$set(route0_changes);

    			var route1_changes = {};
    			if (changed.$$scope) route1_changes.$$scope = { changed, ctx };
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
    				detach(t);
    			}

    			route1.$destroy(detaching);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	var h1, t1, p, t3, t4, t5, t6, t7, t8, t9, t10, h4, t12, pre, t13_value = JSON.stringify(ctx.$router, null, 2), t13, current;

    	var link0 = new Link({
    		props: {
    		exact: true,
    		href: "/",
    		$$slots: { default: [create_default_slot_21] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var link1 = new Link({
    		props: {
    		href: "/test",
    		$$slots: { default: [create_default_slot_20] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var link2 = new Link({
    		props: {
    		href: "/sub",
    		$$slots: { default: [create_default_slot_19] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var link3 = new Link({
    		props: {
    		href: "/e",
    		$$slots: { default: [create_default_slot_18] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var router0 = new Router_1({
    		props: {
    		path: "/test",
    		nofallback: true,
    		$$slots: { default: [create_default_slot_10] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var router1 = new Router_1({
    		props: {
    		exact: true,
    		path: "/sub",
    		$$slots: { default: [create_default_slot_3] },
    		$$scope: { ctx }
    	},
    		$$inline: true
    	});

    	var router2 = new Router_1({
    		props: {
    		path: "/e",
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
    			t5 = text(" | ");
    			link2.$$.fragment.c();
    			t6 = text(" | ");
    			link3.$$.fragment.c();
    			t7 = space();
    			router0.$$.fragment.c();
    			t8 = space();
    			router1.$$.fragment.c();
    			t9 = space();
    			router2.$$.fragment.c();
    			t10 = space();
    			h4 = element("h4");
    			h4.textContent = "Route info";
    			t12 = space();
    			pre = element("pre");
    			t13 = text(t13_value);
    			add_location(h1, file$3, 8, 0, 149);
    			add_location(p, file$3, 10, 0, 172);
    			add_location(h4, file$3, 58, 0, 1564);
    			add_location(pre, file$3, 59, 0, 1584);
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
    			mount_component(link2, target, anchor);
    			insert(target, t6, anchor);
    			mount_component(link3, target, anchor);
    			insert(target, t7, anchor);
    			mount_component(router0, target, anchor);
    			insert(target, t8, anchor);
    			mount_component(router1, target, anchor);
    			insert(target, t9, anchor);
    			mount_component(router2, target, anchor);
    			insert(target, t10, anchor);
    			insert(target, h4, anchor);
    			insert(target, t12, anchor);
    			insert(target, pre, anchor);
    			append(pre, t13);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var link0_changes = {};
    			if (changed.$$scope) link0_changes.$$scope = { changed, ctx };
    			link0.$set(link0_changes);

    			var link1_changes = {};
    			if (changed.$$scope) link1_changes.$$scope = { changed, ctx };
    			link1.$set(link1_changes);

    			var link2_changes = {};
    			if (changed.$$scope) link2_changes.$$scope = { changed, ctx };
    			link2.$set(link2_changes);

    			var link3_changes = {};
    			if (changed.$$scope) link3_changes.$$scope = { changed, ctx };
    			link3.$set(link3_changes);

    			var router0_changes = {};
    			if (changed.$$scope) router0_changes.$$scope = { changed, ctx };
    			router0.$set(router0_changes);

    			var router1_changes = {};
    			if (changed.$$scope) router1_changes.$$scope = { changed, ctx };
    			router1.$set(router1_changes);

    			var router2_changes = {};
    			if (changed.$$scope) router2_changes.$$scope = { changed, ctx };
    			router2.$set(router2_changes);

    			if ((!current || changed.$router) && t13_value !== (t13_value = JSON.stringify(ctx.$router, null, 2))) {
    				set_data(t13, t13_value);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			link0.$$.fragment.i(local);

    			link1.$$.fragment.i(local);

    			link2.$$.fragment.i(local);

    			link3.$$.fragment.i(local);

    			router0.$$.fragment.i(local);

    			router1.$$.fragment.i(local);

    			router2.$$.fragment.i(local);

    			current = true;
    		},

    		o: function outro(local) {
    			link0.$$.fragment.o(local);
    			link1.$$.fragment.o(local);
    			link2.$$.fragment.o(local);
    			link3.$$.fragment.o(local);
    			router0.$$.fragment.o(local);
    			router1.$$.fragment.o(local);
    			router2.$$.fragment.o(local);
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

    			link2.$destroy(detaching);

    			if (detaching) {
    				detach(t6);
    			}

    			link3.$destroy(detaching);

    			if (detaching) {
    				detach(t7);
    			}

    			router0.$destroy(detaching);

    			if (detaching) {
    				detach(t8);
    			}

    			router1.$destroy(detaching);

    			if (detaching) {
    				detach(t9);
    			}

    			router2.$destroy(detaching);

    			if (detaching) {
    				detach(t10);
    				detach(h4);
    				detach(t12);
    				detach(pre);
    			}
    		}
    	};
    }

    function func() {
    	return confirm('Are you sure?');
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $router;

    	validate_store(router, 'router');
    	subscribe($$self, router, $$value => { $router = $$value; $$invalidate('$router', $router); });

    	return { $router };
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, []);
    	}
    }

    document.addEventListener('DOMContentLoaded', () => {
      new App({ target: document.body }); // eslint-disable-line
    });

}());
