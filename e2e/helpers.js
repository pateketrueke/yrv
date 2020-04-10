export function url(x, y) {
  if (!y && process.env.HASHCHANGE) {
    return `${process.env.BASE_URL}#${x}`;
  }

  return process.env.BASE_URL + x;
}

export function href(x) {
  if (process.env.HASHCHANGE) {
    return `#${x !== '/' ? x : ''}`;
  }
  return x;
}
