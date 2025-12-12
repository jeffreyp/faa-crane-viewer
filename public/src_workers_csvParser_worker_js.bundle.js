/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/workers/csvParser.worker.js":
/*!*****************************************!*\
  !*** ./src/workers/csvParser.worker.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var papaparse__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! papaparse */ \"./node_modules/papaparse/papaparse.min.js\");\n/* harmony import */ var papaparse__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(papaparse__WEBPACK_IMPORTED_MODULE_0__);\nfunction _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = \"function\" == typeof Symbol ? Symbol : {}, n = r.iterator || \"@@iterator\", o = r.toStringTag || \"@@toStringTag\"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, \"_invoke\", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError(\"Generator is already running\"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = \"next\"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError(\"iterator result is not an object\"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i[\"return\"]) && t.call(i), c < 2 && (u = TypeError(\"The iterator does not provide a '\" + o + \"' method\"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, \"GeneratorFunction\")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, \"constructor\", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, \"constructor\", GeneratorFunction), GeneratorFunction.displayName = \"GeneratorFunction\", _regeneratorDefine2(GeneratorFunctionPrototype, o, \"GeneratorFunction\"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, \"Generator\"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, \"toString\", function () { return \"[object Generator]\"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }\nfunction _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, \"\", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { if (r) i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n;else { var o = function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); }; o(\"next\", 0), o(\"throw\", 1), o(\"return\", 2); } }, _regeneratorDefine2(e, r, n, t); }\nfunction asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }\nfunction _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, \"next\", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, \"throw\", n); } _next(void 0); }); }; }\nfunction _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }\nfunction _nonIterableRest() { throw new TypeError(\"Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.\"); }\nfunction _unsupportedIterableToArray(r, a) { if (r) { if (\"string\" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return \"Object\" === t && r.constructor && (t = r.constructor.name), \"Map\" === t || \"Set\" === t ? Array.from(r) : \"Arguments\" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }\nfunction _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }\nfunction _iterableToArrayLimit(r, l) { var t = null == r ? null : \"undefined\" != typeof Symbol && r[Symbol.iterator] || r[\"@@iterator\"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t[\"return\"] && (u = t[\"return\"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }\nfunction _arrayWithHoles(r) { if (Array.isArray(r)) return r; }\n// Web Worker for CSV parsing to prevent UI blocking\n\n\n// Convert DMS (Degrees-Minutes-Seconds) to decimal degrees or return decimal if already in decimal format\nvar coordinateToDecimal = function coordinateToDecimal(coordStr) {\n  if (!coordStr) return null;\n\n  // Check if it's already a decimal number (Part77 format)\n  var decimal = parseFloat(coordStr);\n  if (!isNaN(decimal) && (coordStr.match(/^-?\\d+(\\.\\d+)?$/) || coordStr.match(/^-?\\d+$/))) {\n    return decimal;\n  }\n\n  // Handle DMS format: \"33 - 27 - 28.73 N\"\n  var parts = coordStr.split('-').map(function (part) {\n    return part.trim();\n  });\n  if (parts.length !== 3) return null;\n  var degrees = parseFloat(parts[0]);\n  var minutes = parseFloat(parts[1]);\n\n  // Last part contains seconds and direction (N/S/E/W)\n  var secondsParts = parts[2].split(' ');\n  var seconds = parseFloat(secondsParts[0]);\n  var direction = secondsParts[1];\n\n  // Calculate decimal degrees\n  var result = degrees + minutes / 60 + seconds / 3600;\n\n  // Adjust sign based on direction\n  if (direction === 'S' || direction === 'W') {\n    result = -result;\n  }\n  return result;\n};\n\n/**\n * Parse CSV date format (YYYY-MM-DD) to JavaScript Date object\n * @param {string} dateStr - Date string in CSV format\n * @returns {Date|null} Parsed Date object or null if invalid\n */\nvar parseCSVDate = function parseCSVDate(dateStr) {\n  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {\n    return null;\n  }\n\n  // CSV format: \"YYYY-MM-DD\"\n  var match = dateStr.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);\n  if (!match) {\n    return null;\n  }\n  var _match = _slicedToArray(match, 4),\n    year = _match[1],\n    month = _match[2],\n    day = _match[3];\n\n  // Create date in UTC to avoid timezone issues\n  // Note: month is 0-indexed in JavaScript Date constructor\n  var date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1,\n  // Convert to 0-indexed month\n  parseInt(day), 0, 0, 0, 0));\n\n  // Validate the date is valid\n  if (isNaN(date.getTime())) {\n    return null;\n  }\n  return date;\n};\n\n/**\n * Parse CSV data and return crane data\n * Runs in Web Worker to prevent UI blocking\n */\nvar parseCSVData = function parseCSVData(csvData, dataSource) {\n  return new Promise(function (resolve, reject) {\n    papaparse__WEBPACK_IMPORTED_MODULE_0___default().parse(csvData, {\n      header: true,\n      complete: function complete(results) {\n        try {\n          var totalRows = results.data.length;\n\n          // Report progress: parsing complete\n          self.postMessage({\n            type: 'progress',\n            message: \"CSV parsed, processing \".concat(totalRows, \" rows...\"),\n            dataSource: dataSource\n          });\n          var now = new Date();\n\n          // Filter for crane entries - handle both DOF and Part77 formats\n          var craneData = results.data.filter(function (entry) {\n            // DOF format: Look for entries with \"CRANE\" in the STRUCTURE TYPE field\n            if (entry['STRUCTURE TYPE'] && entry['STRUCTURE TYPE'].toUpperCase().includes('CRANE')) {\n              return true;\n            }\n\n            // Part77 format: Look for entries with \"CRANE\" in the STRUCTURE TYPE field\n            // Part77 data also has crane data marked differently sometimes\n            if (entry['STRUCTURE TYPE'] && entry['STRUCTURE TYPE'].includes('CRANE')) {\n              return true;\n            }\n\n            // Additional check for Part77 format that might have CRANE in other fields\n            if (entry['PROPOSAL DESCRIPTION'] && entry['PROPOSAL DESCRIPTION'].toUpperCase().includes('CRANE') || entry['STRUCTURE NAME'] && entry['STRUCTURE NAME'].toUpperCase().includes('CRANE')) {\n              return true;\n            }\n            return false;\n          });\n\n          // Report progress: filtering complete\n          self.postMessage({\n            type: 'progress',\n            message: \"Found \".concat(craneData.length, \" crane entries\"),\n            dataSource: dataSource\n          });\n\n          // Transform data to the expected format\n          var transformedData = craneData.map(function (entry) {\n            // Parse dates (assuming format YYYY-MM-DD)\n            var startDate = entry['WORK SCHEDULE BEGINNING DATE'] || entry['ENTERED DATE'] || '';\n            var endDate = entry['WORK SCHEDULE ENDING DATE'] || entry['EXPIRATION DATE'] || '';\n\n            // Parse coordinates - handle both DMS and decimal formats from both data sources\n            var latitude = coordinateToDecimal(entry['LATITUDE']);\n            // Use LONGITUDE column (header was corrected from typo \"LONGITUTDE\")\n            var longitude = coordinateToDecimal(entry['LONGITUDE']);\n\n            // Skip entries with invalid coordinates\n            if (latitude === null || longitude === null) {\n              return null;\n            }\n\n            // Get height from either AGL HEIGHT PROPOSED or AGL HEIGHT DET\n            var height = parseInt(entry['AGL HEIGHT PROPOSED'] || entry['AGL HEIGHT DET'] || '0');\n\n            // Identify data source\n            var source = entry['DATA_SOURCE'] || dataSource || 'Unknown';\n\n            // Create a unique ID combining ASN and data source to avoid collisions\n            var asn = entry['STUDY (ASN)'] || '';\n            var uniqueId = asn ? \"\".concat(asn, \"-\").concat(source) : \"\".concat(latitude, \"-\").concat(longitude, \"-\").concat(height, \"-\").concat(source);\n            return {\n              id: asn,\n              // Keep original ID for display\n              uniqueId: uniqueId,\n              // Use for internal tracking\n              structureType: 'Crane',\n              latitude: latitude,\n              longitude: longitude,\n              height: height,\n              heightUnit: 'ft AGL',\n              status: entry['STATUS'] || 'Unknown',\n              startDate: startDate,\n              endDate: endDate,\n              sponsor: entry['SPONSOR NAME'] || '',\n              city: entry['STRUCTURE CITY'] || '',\n              state: entry['STRUCTURE STATE'] || '',\n              dataSource: source\n            };\n          }).filter(function (entry) {\n            return entry !== null;\n          }); // Remove entries with invalid coordinates\n\n          // Report progress: transformation complete\n          self.postMessage({\n            type: 'progress',\n            message: \"Transformed \".concat(transformedData.length, \" crane entries\"),\n            dataSource: dataSource\n          });\n\n          // Filter out inactive cranes based on end date\n          var activeCranes = transformedData.filter(function (crane) {\n            // If no end date, assume it's still active\n            if (!crane.endDate) {\n              return true;\n            }\n\n            // Parse the end date\n            var endDate = parseCSVDate(crane.endDate);\n\n            // If we can't parse the end date, keep the crane (fail safe)\n            if (!endDate) {\n              return true;\n            }\n\n            // Filter out cranes whose end date has passed\n            if (endDate < now) {\n              return false;\n            }\n            return true;\n          });\n\n          // Report progress: date filtering complete\n          self.postMessage({\n            type: 'progress',\n            message: \"After date filtering: \".concat(activeCranes.length, \" active cranes\"),\n            dataSource: dataSource\n          });\n          resolve(activeCranes);\n        } catch (error) {\n          reject(error);\n        }\n      },\n      error: function error(_error) {\n        reject(_error);\n      }\n    });\n  });\n};\n\n// Listen for messages from the main thread\nself.addEventListener('message', /*#__PURE__*/function () {\n  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(event) {\n    var _event$data, id, csvData, dataSource, craneData, _t;\n    return _regenerator().w(function (_context) {\n      while (1) switch (_context.n) {\n        case 0:\n          _event$data = event.data, id = _event$data.id, csvData = _event$data.csvData, dataSource = _event$data.dataSource;\n          _context.p = 1;\n          // Report that we started parsing\n          self.postMessage({\n            type: 'progress',\n            message: \"Starting CSV parse for \".concat(dataSource, \"...\"),\n            dataSource: dataSource\n          });\n\n          // Parse the CSV data\n          _context.n = 2;\n          return parseCSVData(csvData, dataSource);\n        case 2:\n          craneData = _context.v;\n          // Send the result back to the main thread\n          self.postMessage({\n            type: 'complete',\n            id: id,\n            dataSource: dataSource,\n            data: craneData\n          });\n          _context.n = 4;\n          break;\n        case 3:\n          _context.p = 3;\n          _t = _context.v;\n          // Send error back to the main thread\n          self.postMessage({\n            type: 'error',\n            id: id,\n            dataSource: dataSource,\n            error: _t.message || 'Failed to parse CSV'\n          });\n        case 4:\n          return _context.a(2);\n      }\n    }, _callee, null, [[1, 3]]);\n  }));\n  return function (_x) {\n    return _ref.apply(this, arguments);\n  };\n}());\n\n//# sourceURL=webpack://faa-crane-viewer/./src/workers/csvParser.worker.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/******/ 	// the startup function
/******/ 	__webpack_require__.x = () => {
/******/ 		// Load entry module and return exports
/******/ 		// This entry module depends on other loaded chunks and execution need to be delayed
/******/ 		var __webpack_exports__ = __webpack_require__.O(undefined, ["vendors-node_modules_papaparse_papaparse_min_js"], () => (__webpack_require__("./src/workers/csvParser.worker.js")))
/******/ 		__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
/******/ 		return __webpack_exports__;
/******/ 	};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/chunk loaded */
/******/ 	(() => {
/******/ 		var deferred = [];
/******/ 		__webpack_require__.O = (result, chunkIds, fn, priority) => {
/******/ 			if(chunkIds) {
/******/ 				priority = priority || 0;
/******/ 				for(var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--) deferred[i] = deferred[i - 1];
/******/ 				deferred[i] = [chunkIds, fn, priority];
/******/ 				return;
/******/ 			}
/******/ 			var notFulfilled = Infinity;
/******/ 			for (var i = 0; i < deferred.length; i++) {
/******/ 				var [chunkIds, fn, priority] = deferred[i];
/******/ 				var fulfilled = true;
/******/ 				for (var j = 0; j < chunkIds.length; j++) {
/******/ 					if ((priority & 1 === 0 || notFulfilled >= priority) && Object.keys(__webpack_require__.O).every((key) => (__webpack_require__.O[key](chunkIds[j])))) {
/******/ 						chunkIds.splice(j--, 1);
/******/ 					} else {
/******/ 						fulfilled = false;
/******/ 						if(priority < notFulfilled) notFulfilled = priority;
/******/ 					}
/******/ 				}
/******/ 				if(fulfilled) {
/******/ 					deferred.splice(i--, 1)
/******/ 					var r = fn();
/******/ 					if (r !== undefined) result = r;
/******/ 				}
/******/ 			}
/******/ 			return result;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks and sibling chunks for the entrypoint
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".bundle.js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		__webpack_require__.p = "";
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/importScripts chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded chunks
/******/ 		// "1" means "already loaded"
/******/ 		var installedChunks = {
/******/ 			"src_workers_csvParser_worker_js": 1
/******/ 		};
/******/ 		
/******/ 		// importScripts chunk loading
/******/ 		var installChunk = (data) => {
/******/ 			var [chunkIds, moreModules, runtime] = data;
/******/ 			for(var moduleId in moreModules) {
/******/ 				if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 					__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 				}
/******/ 			}
/******/ 			if(runtime) runtime(__webpack_require__);
/******/ 			while(chunkIds.length)
/******/ 				installedChunks[chunkIds.pop()] = 1;
/******/ 			parentChunkLoadingFunction(data);
/******/ 		};
/******/ 		__webpack_require__.f.i = (chunkId, promises) => {
/******/ 			// "1" is the signal for "already loaded"
/******/ 			if(!installedChunks[chunkId]) {
/******/ 				if(true) { // all chunks have JS
/******/ 					importScripts(__webpack_require__.p + __webpack_require__.u(chunkId));
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 		
/******/ 		var chunkLoadingGlobal = self["webpackChunkfaa_crane_viewer"] = self["webpackChunkfaa_crane_viewer"] || [];
/******/ 		var parentChunkLoadingFunction = chunkLoadingGlobal.push.bind(chunkLoadingGlobal);
/******/ 		chunkLoadingGlobal.push = installChunk;
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/startup chunk dependencies */
/******/ 	(() => {
/******/ 		var next = __webpack_require__.x;
/******/ 		__webpack_require__.x = () => {
/******/ 			return __webpack_require__.e("vendors-node_modules_papaparse_papaparse_min_js").then(next);
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// run startup
/******/ 	var __webpack_exports__ = __webpack_require__.x();
/******/ 	
/******/ })()
;