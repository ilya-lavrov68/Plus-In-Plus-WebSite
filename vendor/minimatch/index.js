"use strict";

// minimatch 11 provides named CommonJS exports. ESLint 8 and several of its
// plugins still expect the legacy callable export, so keep that boundary in
// one small facade instead of forcing an unsupported ESLint/plugin upgrade.
const upstream = require("minimatch-upstream");

function minimatch(path, pattern, options) {
  return upstream.minimatch(path, pattern, options);
}

Object.assign(minimatch, upstream);

module.exports = minimatch;
module.exports.minimatch = upstream.minimatch;
module.exports.Minimatch = upstream.Minimatch;
module.exports.match = upstream.match;
module.exports.filter = upstream.filter;
module.exports.defaults = upstream.defaults;
module.exports.braceExpand = upstream.braceExpand;
module.exports.GLOBSTAR = upstream.GLOBSTAR;
module.exports.sep = upstream.sep;
module.exports.escape = upstream.escape;
module.exports.unescape = upstream.unescape;
