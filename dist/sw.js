/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "d466ed2d1827b320de0d736a5a960bb7"
  }, {
    "url": "FullLogo.png",
    "revision": "2e9ec400a367ac316e1b28c427932dde"
  }, {
    "url": "assets/workbox-window.prod.es5-9c8e3b02.js",
    "revision": null
  }, {
    "url": "assets/purify.es-982218f1.js",
    "revision": null
  }, {
    "url": "assets/index.es-6c5797f2.js",
    "revision": null
  }, {
    "url": "assets/index-cb75a577.css",
    "revision": null
  }, {
    "url": "assets/index-9c50d4b7.js",
    "revision": null
  }, {
    "url": "assets/html2canvas.esm-f16e60ff.js",
    "revision": null
  }, {
    "url": "admin/index.html",
    "revision": "2df7833584cc40e1ee380610fc90ae94"
  }, {
    "url": "admin/admin.js",
    "revision": "a2e5de662d4a26f8801bf4c2751f7ff4"
  }, {
    "url": "FullLogo.png",
    "revision": "2e9ec400a367ac316e1b28c427932dde"
  }, {
    "url": "manifest.webmanifest",
    "revision": "14ca408c604eb5801352395f34f09fd6"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
