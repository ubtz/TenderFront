export const fullReloadTo = (path) => {
  const target = new URL(path, window.location.origin);
  target.searchParams.set("sessionRefresh", Date.now().toString());
  window.location.replace(`${target.pathname}${target.search}${target.hash}`);
};
