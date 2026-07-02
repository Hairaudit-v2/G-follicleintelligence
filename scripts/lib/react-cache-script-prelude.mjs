import Module from "node:module";

const originalLoad = Module._load;
if (!Module._load.__fiReactCachePatched) {
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "react") {
      const real = originalLoad.call(this, request, parent, isMain);
      return { ...real, cache: (fn) => fn };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  Module._load.__fiReactCachePatched = true;
}