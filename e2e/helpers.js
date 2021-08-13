const prefix = process.env.BASE_URL || 'http://localhost:8080';

export function url(x, y) {
  if (!y && process.env.HASHCHANGE) {
    return `${prefix}#${x}`;
  }

  return prefix + x;
}

export function href(x) {
  if (process.env.HASHCHANGE) {
    return `#${x !== '/' ? x : ''}`;
  }
  return x;
}
