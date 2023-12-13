import './chunks/astro_XkYl3yeM.mjs';

if (typeof process !== "undefined") {
  let proc = process;
  if ("argv" in proc && Array.isArray(proc.argv)) {
    if (proc.argv.includes("--verbose")) ; else if (proc.argv.includes("--silent")) ; else ;
  }
}

/**
 * Tokenize input string.
 */
function lexer(str) {
    var tokens = [];
    var i = 0;
    while (i < str.length) {
        var char = str[i];
        if (char === "*" || char === "+" || char === "?") {
            tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
            continue;
        }
        if (char === "\\") {
            tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
            continue;
        }
        if (char === "{") {
            tokens.push({ type: "OPEN", index: i, value: str[i++] });
            continue;
        }
        if (char === "}") {
            tokens.push({ type: "CLOSE", index: i, value: str[i++] });
            continue;
        }
        if (char === ":") {
            var name = "";
            var j = i + 1;
            while (j < str.length) {
                var code = str.charCodeAt(j);
                if (
                // `0-9`
                (code >= 48 && code <= 57) ||
                    // `A-Z`
                    (code >= 65 && code <= 90) ||
                    // `a-z`
                    (code >= 97 && code <= 122) ||
                    // `_`
                    code === 95) {
                    name += str[j++];
                    continue;
                }
                break;
            }
            if (!name)
                throw new TypeError("Missing parameter name at ".concat(i));
            tokens.push({ type: "NAME", index: i, value: name });
            i = j;
            continue;
        }
        if (char === "(") {
            var count = 1;
            var pattern = "";
            var j = i + 1;
            if (str[j] === "?") {
                throw new TypeError("Pattern cannot start with \"?\" at ".concat(j));
            }
            while (j < str.length) {
                if (str[j] === "\\") {
                    pattern += str[j++] + str[j++];
                    continue;
                }
                if (str[j] === ")") {
                    count--;
                    if (count === 0) {
                        j++;
                        break;
                    }
                }
                else if (str[j] === "(") {
                    count++;
                    if (str[j + 1] !== "?") {
                        throw new TypeError("Capturing groups are not allowed at ".concat(j));
                    }
                }
                pattern += str[j++];
            }
            if (count)
                throw new TypeError("Unbalanced pattern at ".concat(i));
            if (!pattern)
                throw new TypeError("Missing pattern at ".concat(i));
            tokens.push({ type: "PATTERN", index: i, value: pattern });
            i = j;
            continue;
        }
        tokens.push({ type: "CHAR", index: i, value: str[i++] });
    }
    tokens.push({ type: "END", index: i, value: "" });
    return tokens;
}
/**
 * Parse a string for the raw tokens.
 */
function parse(str, options) {
    if (options === void 0) { options = {}; }
    var tokens = lexer(str);
    var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a;
    var defaultPattern = "[^".concat(escapeString(options.delimiter || "/#?"), "]+?");
    var result = [];
    var key = 0;
    var i = 0;
    var path = "";
    var tryConsume = function (type) {
        if (i < tokens.length && tokens[i].type === type)
            return tokens[i++].value;
    };
    var mustConsume = function (type) {
        var value = tryConsume(type);
        if (value !== undefined)
            return value;
        var _a = tokens[i], nextType = _a.type, index = _a.index;
        throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
    };
    var consumeText = function () {
        var result = "";
        var value;
        while ((value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR"))) {
            result += value;
        }
        return result;
    };
    while (i < tokens.length) {
        var char = tryConsume("CHAR");
        var name = tryConsume("NAME");
        var pattern = tryConsume("PATTERN");
        if (name || pattern) {
            var prefix = char || "";
            if (prefixes.indexOf(prefix) === -1) {
                path += prefix;
                prefix = "";
            }
            if (path) {
                result.push(path);
                path = "";
            }
            result.push({
                name: name || key++,
                prefix: prefix,
                suffix: "",
                pattern: pattern || defaultPattern,
                modifier: tryConsume("MODIFIER") || "",
            });
            continue;
        }
        var value = char || tryConsume("ESCAPED_CHAR");
        if (value) {
            path += value;
            continue;
        }
        if (path) {
            result.push(path);
            path = "";
        }
        var open = tryConsume("OPEN");
        if (open) {
            var prefix = consumeText();
            var name_1 = tryConsume("NAME") || "";
            var pattern_1 = tryConsume("PATTERN") || "";
            var suffix = consumeText();
            mustConsume("CLOSE");
            result.push({
                name: name_1 || (pattern_1 ? key++ : ""),
                pattern: name_1 && !pattern_1 ? defaultPattern : pattern_1,
                prefix: prefix,
                suffix: suffix,
                modifier: tryConsume("MODIFIER") || "",
            });
            continue;
        }
        mustConsume("END");
    }
    return result;
}
/**
 * Compile a string to a template function for the path.
 */
function compile(str, options) {
    return tokensToFunction(parse(str, options), options);
}
/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction(tokens, options) {
    if (options === void 0) { options = {}; }
    var reFlags = flags(options);
    var _a = options.encode, encode = _a === void 0 ? function (x) { return x; } : _a, _b = options.validate, validate = _b === void 0 ? true : _b;
    // Compile all the tokens into regexps.
    var matches = tokens.map(function (token) {
        if (typeof token === "object") {
            return new RegExp("^(?:".concat(token.pattern, ")$"), reFlags);
        }
    });
    return function (data) {
        var path = "";
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            if (typeof token === "string") {
                path += token;
                continue;
            }
            var value = data ? data[token.name] : undefined;
            var optional = token.modifier === "?" || token.modifier === "*";
            var repeat = token.modifier === "*" || token.modifier === "+";
            if (Array.isArray(value)) {
                if (!repeat) {
                    throw new TypeError("Expected \"".concat(token.name, "\" to not repeat, but got an array"));
                }
                if (value.length === 0) {
                    if (optional)
                        continue;
                    throw new TypeError("Expected \"".concat(token.name, "\" to not be empty"));
                }
                for (var j = 0; j < value.length; j++) {
                    var segment = encode(value[j], token);
                    if (validate && !matches[i].test(segment)) {
                        throw new TypeError("Expected all \"".concat(token.name, "\" to match \"").concat(token.pattern, "\", but got \"").concat(segment, "\""));
                    }
                    path += token.prefix + segment + token.suffix;
                }
                continue;
            }
            if (typeof value === "string" || typeof value === "number") {
                var segment = encode(String(value), token);
                if (validate && !matches[i].test(segment)) {
                    throw new TypeError("Expected \"".concat(token.name, "\" to match \"").concat(token.pattern, "\", but got \"").concat(segment, "\""));
                }
                path += token.prefix + segment + token.suffix;
                continue;
            }
            if (optional)
                continue;
            var typeOfMessage = repeat ? "an array" : "a string";
            throw new TypeError("Expected \"".concat(token.name, "\" to be ").concat(typeOfMessage));
        }
        return path;
    };
}
/**
 * Escape a regular expression string.
 */
function escapeString(str) {
    return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
/**
 * Get the flags for a regexp from the options.
 */
function flags(options) {
    return options && options.sensitive ? "" : "i";
}

function getRouteGenerator(segments, addTrailingSlash) {
  const template = segments.map((segment) => {
    return "/" + segment.map((part) => {
      if (part.spread) {
        return `:${part.content.slice(3)}(.*)?`;
      } else if (part.dynamic) {
        return `:${part.content}`;
      } else {
        return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    }).join("");
  }).join("");
  let trailing = "";
  if (addTrailingSlash === "always" && segments.length) {
    trailing = "/";
  }
  const toPath = compile(template + trailing);
  return toPath;
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    })
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  return {
    ...serializedManifest,
    assets,
    componentMetadata,
    clientDirectives,
    routes
  };
}

const manifest = deserializeManifest({"adapterName":"","routes":[{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/page.36aCzv65.js"}],"styles":[],"routeData":{"type":"endpoint","route":"/_astro/ec.0epgx.css","pattern":"^\\/_astro\\/ec\\.0epgx\\.css$","segments":[[{"content":"_astro","dynamic":false,"spread":false}],[{"content":"ec.0epgx.css","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/.pnpm/astro-expressive-code@0.29.4_astro@4.0.4/node_modules/astro-expressive-code/routes/styles.ts","pathname":"/_astro/ec.0epgx.css","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/page.36aCzv65.js"}],"styles":[],"routeData":{"type":"endpoint","route":"/_astro/ec.sgewm.js","pattern":"^\\/_astro\\/ec\\.sgewm\\.js$","segments":[[{"content":"_astro","dynamic":false,"spread":false}],[{"content":"ec.sgewm.js","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/.pnpm/astro-expressive-code@0.29.4_astro@4.0.4/node_modules/astro-expressive-code/routes/scripts.ts","pathname":"/_astro/ec.sgewm.js","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.dSDs6aBR.js"},{"type":"external","value":"/_astro/page.36aCzv65.js"}],"styles":[{"type":"external","src":"/_astro/index.YklkvuvG.css"}],"routeData":{"type":"page","route":"/404","pattern":"^\\/404\\/?$","segments":[[{"content":"404","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/404.astro","pathname":"/404","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[{"type":"external","value":"/_astro/hoisted.dSDs6aBR.js"},{"type":"external","value":"/_astro/page.36aCzv65.js"}],"styles":[{"type":"external","src":"/_astro/index.YklkvuvG.css"}],"routeData":{"type":"page","route":"/[...slug]","pattern":"^(?:\\/(.*?))?\\/?$","segments":[[{"content":"...slug","dynamic":true,"spread":true}]],"params":["...slug"],"component":"node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/index.astro","prerender":false,"fallbackRoutes":[],"_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["\u0000astro:content",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/404.astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/404@_@astro",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/utils/routing.ts",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/index.astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/index@_@astro",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/utils/navigation.ts",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/components/SidebarSublist.astro",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/components/Sidebar.astro",{"propagation":"in-tree","containsHead":false}],["\u0000virtual:starlight/components",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/components/Footer.astro",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/components/Header.astro",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/components/MobileMenuFooter.astro",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/components/Page.astro",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/components/PageFrame.astro",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/components/PageSidebar.astro",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/utils/route-data.ts",{"propagation":"in-tree","containsHead":false}],["C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/utils/translations.ts",{"propagation":"in-tree","containsHead":false}]],"renderers":[],"clientDirectives":[["idle","(()=>{var i=t=>{let e=async()=>{await(await t())()};\"requestIdleCallback\"in window?window.requestIdleCallback(e):setTimeout(e,200)};(self.Astro||(self.Astro={})).idle=i;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var s=(i,t)=>{let a=async()=>{await(await i())()};if(t.value){let e=matchMedia(t.value);e.matches?a():e.addEventListener(\"change\",a,{once:!0})}};(self.Astro||(self.Astro={})).media=s;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var r=(i,c,s)=>{let n=async()=>{await(await i())()},t=new IntersectionObserver(e=>{for(let o of e)if(o.isIntersecting){t.disconnect(),n();break}});for(let e of s.children)t.observe(e)};(self.Astro||(self.Astro={})).visible=r;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000@astro-page:node_modules/.pnpm/astro-expressive-code@0.29.4_astro@4.0.4/node_modules/astro-expressive-code/routes/styles@_@ts":"pages/_astro/ec.0epgx.css.astro.mjs","\u0000@astro-page:node_modules/.pnpm/astro-expressive-code@0.29.4_astro@4.0.4/node_modules/astro-expressive-code/routes/scripts@_@ts":"pages/_astro/ec.sgewm.js.astro.mjs","\u0000@astro-page:node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/404@_@astro":"pages/404.astro.mjs","\u0000@astro-page:node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/index@_@astro":"pages/_---slug_.astro.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000empty-middleware":"_empty-middleware.mjs","/node_modules/.pnpm/@astrojs+starlight@0.15.0_astro@4.0.4/node_modules/@astrojs/starlight/index.astro":"chunks/pages/index_oEI7tV3b.mjs","/node_modules/.pnpm/astro-expressive-code@0.29.4_astro@4.0.4/node_modules/astro-expressive-code/routes/scripts.ts":"chunks/pages/scripts_jLHlqVOJ.mjs","/node_modules/.pnpm/astro-expressive-code@0.29.4_astro@4.0.4/node_modules/astro-expressive-code/routes/styles.ts":"chunks/pages/styles__c75eoeA.mjs","\u0000@astrojs-manifest":"manifest_VveSlspp.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/index.mdx?astroContentCollectionEntry=true":"chunks/index_CO1uQleS.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/أحاديث مختارة.md?astroContentCollectionEntry=true":"chunks/أحاديث مختارة_8d_R8h5B.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/صحيح البخاري/المجلد الأول.md?astroContentCollectionEntry=true":"chunks/المجلد الأول_QbwZ6Etg.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/صحيح البخاري/المجلد الثالث.md?astroContentCollectionEntry=true":"chunks/المجلد الثالث_hQWgLc6Y.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/صحيح البخاري/المجلد الثاني.md?astroContentCollectionEntry=true":"chunks/المجلد الثاني_whnWki6p.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/index.mdx?astroPropagatedAssets":"chunks/index_KAmr2iKb.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/أحاديث مختارة.md?astroPropagatedAssets":"chunks/أحاديث مختارة_SI_wh6BN.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/صحيح البخاري/المجلد الأول.md?astroPropagatedAssets":"chunks/المجلد الأول_7jZo_1Ud.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/صحيح البخاري/المجلد الثالث.md?astroPropagatedAssets":"chunks/المجلد الثالث_rmkHHQFf.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/صحيح البخاري/المجلد الثاني.md?astroPropagatedAssets":"chunks/المجلد الثاني_OXPWNjMu.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/index.mdx":"chunks/index_WO1Vty2n.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/أحاديث مختارة.md":"chunks/أحاديث مختارة_juH_RTnq.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/صحيح البخاري/المجلد الأول.md":"chunks/المجلد الأول_sVjVq2IA.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/صحيح البخاري/المجلد الثالث.md":"chunks/المجلد الثالث_ZPx8mYAP.mjs","C:/coding/Astro/rahiq-al-sunnah/src/content/docs/كتب الحديث/صحيح البخاري/المجلد الثاني.md":"chunks/المجلد الثاني_Rf6aJgWp.mjs","astro:scripts/page.js":"_astro/page.36aCzv65.js","/astro/hoisted.js?q=0":"_astro/hoisted.dSDs6aBR.js","C:/coding/Astro/rahiq-al-sunnah/node_modules/.pnpm/@pagefind+default-ui@1.0.4/node_modules/@pagefind/default-ui/npm_dist/mjs/ui-core.mjs":"_astro/ui-core.JvLvHP02.js","astro:scripts/before-hydration.js":""},"assets":["/_astro/page.36aCzv65.js"]});

export { manifest };
