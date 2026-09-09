// Public assets and plain anchors also need the GitHub Pages project prefix.
export function appUrl(path: `/${string}`): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;
}
