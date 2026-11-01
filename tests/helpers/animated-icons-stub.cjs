const React = require("react");

/** Лёгкий stub именованных lucide-animated exports для существующих component tests. */
function createAnimatedIconsStub() {
  const cache = new Map();
  return new Proxy(
    {},
    {
      get: (_target, property) => {
        if (typeof property !== "string") return undefined;
        if (!cache.has(property)) {
          cache.set(
            property,
            React.forwardRef(function AnimatedIconStub(
              { children, ...props },
              ref,
            ) {
              delete props.animateOnHover;
              delete props.size;
              return React.createElement("div", { ...props, ref }, children);
            }),
          );
        }
        return cache.get(property);
      },
    },
  );
}

module.exports = { createAnimatedIconsStub };
