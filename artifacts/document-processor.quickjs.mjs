var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key2, value) => key2 in obj ? __defProp(obj, key2, { enumerable: true, configurable: true, writable: true, value }) : obj[key2] = value;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key2, value) => __defNormalProp(obj, typeof key2 !== "symbol" ? key2 + "" : key2, value);

// node_modules/canonicalize/lib/canonicalize.js
var require_canonicalize = __commonJS({
  "node_modules/canonicalize/lib/canonicalize.js"(exports, module) {
    "use strict";
    module.exports = function serialize(object) {
      if (typeof object === "number" && isNaN(object)) {
        throw new Error("NaN is not allowed");
      }
      if (typeof object === "number" && !isFinite(object)) {
        throw new Error("Infinity is not allowed");
      }
      if (object === null || typeof object !== "object") {
        return JSON.stringify(object);
      }
      if (object.toJSON instanceof Function) {
        return serialize(object.toJSON());
      }
      if (Array.isArray(object)) {
        const values2 = object.reduce((t3, cv, ci) => {
          const comma = ci === 0 ? "" : ",";
          const value = cv === void 0 || typeof cv === "symbol" ? null : cv;
          return `${t3}${comma}${serialize(value)}`;
        }, "");
        return `[${values2}]`;
      }
      const values = Object.keys(object).sort().reduce((t3, cv) => {
        if (object[cv] === void 0 || typeof object[cv] === "symbol") {
          return t3;
        }
        const comma = t3.length === 0 ? "" : ",";
        return `${t3}${comma}${serialize(cv)}:${serialize(object[cv])}`;
      }, "");
      return `{${values}}`;
    };
  }
});

// libs/document-processor/src/quickjs/stubs/crypto.js
var require_crypto = __commonJS({
  "libs/document-processor/src/quickjs/stubs/crypto.js"(exports, module) {
    module.exports = {};
  }
});

// libs/document-processor/src/quickjs/stubs/buffer.js
var require_buffer = __commonJS({
  "libs/document-processor/src/quickjs/stubs/buffer.js"(exports, module) {
    module.exports = { Buffer: class Buffer {
    } };
  }
});

// node_modules/js-sha256/src/sha256.js
var require_sha256 = __commonJS({
  "node_modules/js-sha256/src/sha256.js"(exports, module) {
    (function() {
      "use strict";
      var ERROR = "input is invalid type";
      var WINDOW = typeof window === "object";
      var root = WINDOW ? window : {};
      if (root.JS_SHA256_NO_WINDOW) {
        WINDOW = false;
      }
      var WEB_WORKER = !WINDOW && typeof self === "object";
      var NODE_JS = !root.JS_SHA256_NO_NODE_JS && false;
      if (NODE_JS) {
        root = global;
      } else if (WEB_WORKER) {
        root = self;
      }
      var COMMON_JS = !root.JS_SHA256_NO_COMMON_JS && typeof module === "object" && module.exports;
      var AMD = typeof define === "function" && define.amd;
      var ARRAY_BUFFER = !root.JS_SHA256_NO_ARRAY_BUFFER && typeof ArrayBuffer !== "undefined";
      var HEX_CHARS = "0123456789abcdef".split("");
      var EXTRA = [-2147483648, 8388608, 32768, 128];
      var SHIFT = [24, 16, 8, 0];
      var K3 = [
        1116352408,
        1899447441,
        3049323471,
        3921009573,
        961987163,
        1508970993,
        2453635748,
        2870763221,
        3624381080,
        310598401,
        607225278,
        1426881987,
        1925078388,
        2162078206,
        2614888103,
        3248222580,
        3835390401,
        4022224774,
        264347078,
        604807628,
        770255983,
        1249150122,
        1555081692,
        1996064986,
        2554220882,
        2821834349,
        2952996808,
        3210313671,
        3336571891,
        3584528711,
        113926993,
        338241895,
        666307205,
        773529912,
        1294757372,
        1396182291,
        1695183700,
        1986661051,
        2177026350,
        2456956037,
        2730485921,
        2820302411,
        3259730800,
        3345764771,
        3516065817,
        3600352804,
        4094571909,
        275423344,
        430227734,
        506948616,
        659060556,
        883997877,
        958139571,
        1322822218,
        1537002063,
        1747873779,
        1955562222,
        2024104815,
        2227730452,
        2361852424,
        2428436474,
        2756734187,
        3204031479,
        3329325298
      ];
      var OUTPUT_TYPES = ["hex", "array", "digest", "arrayBuffer"];
      var blocks = [];
      if (root.JS_SHA256_NO_NODE_JS || !Array.isArray) {
        Array.isArray = function(obj) {
          return Object.prototype.toString.call(obj) === "[object Array]";
        };
      }
      if (ARRAY_BUFFER && (root.JS_SHA256_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
        ArrayBuffer.isView = function(obj) {
          return typeof obj === "object" && obj.buffer && obj.buffer.constructor === ArrayBuffer;
        };
      }
      var createOutputMethod = function(outputType, is224) {
        return function(message) {
          return new Sha256(is224, true).update(message)[outputType]();
        };
      };
      var createMethod = function(is224) {
        var method = createOutputMethod("hex", is224);
        if (NODE_JS) {
          method = nodeWrap(method, is224);
        }
        method.create = function() {
          return new Sha256(is224);
        };
        method.update = function(message) {
          return method.create().update(message);
        };
        for (var i2 = 0; i2 < OUTPUT_TYPES.length; ++i2) {
          var type2 = OUTPUT_TYPES[i2];
          method[type2] = createOutputMethod(type2, is224);
        }
        return method;
      };
      var nodeWrap = function(method, is224) {
        var crypto = require_crypto();
        var Buffer2 = require_buffer().Buffer;
        var algorithm = is224 ? "sha224" : "sha256";
        var bufferFrom;
        if (Buffer2.from && !root.JS_SHA256_NO_BUFFER_FROM) {
          bufferFrom = Buffer2.from;
        } else {
          bufferFrom = function(message) {
            return new Buffer2(message);
          };
        }
        var nodeMethod = function(message) {
          if (typeof message === "string") {
            return crypto.createHash(algorithm).update(message, "utf8").digest("hex");
          } else {
            if (message === null || message === void 0) {
              throw new Error(ERROR);
            } else if (message.constructor === ArrayBuffer) {
              message = new Uint8Array(message);
            }
          }
          if (Array.isArray(message) || ArrayBuffer.isView(message) || message.constructor === Buffer2) {
            return crypto.createHash(algorithm).update(bufferFrom(message)).digest("hex");
          } else {
            return method(message);
          }
        };
        return nodeMethod;
      };
      var createHmacOutputMethod = function(outputType, is224) {
        return function(key2, message) {
          return new HmacSha256(key2, is224, true).update(message)[outputType]();
        };
      };
      var createHmacMethod = function(is224) {
        var method = createHmacOutputMethod("hex", is224);
        method.create = function(key2) {
          return new HmacSha256(key2, is224);
        };
        method.update = function(key2, message) {
          return method.create(key2).update(message);
        };
        for (var i2 = 0; i2 < OUTPUT_TYPES.length; ++i2) {
          var type2 = OUTPUT_TYPES[i2];
          method[type2] = createHmacOutputMethod(type2, is224);
        }
        return method;
      };
      function Sha256(is224, sharedMemory) {
        if (sharedMemory) {
          blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
          this.blocks = blocks;
        } else {
          this.blocks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }
        if (is224) {
          this.h0 = 3238371032;
          this.h1 = 914150663;
          this.h2 = 812702999;
          this.h3 = 4144912697;
          this.h4 = 4290775857;
          this.h5 = 1750603025;
          this.h6 = 1694076839;
          this.h7 = 3204075428;
        } else {
          this.h0 = 1779033703;
          this.h1 = 3144134277;
          this.h2 = 1013904242;
          this.h3 = 2773480762;
          this.h4 = 1359893119;
          this.h5 = 2600822924;
          this.h6 = 528734635;
          this.h7 = 1541459225;
        }
        this.block = this.start = this.bytes = this.hBytes = 0;
        this.finalized = this.hashed = false;
        this.first = true;
        this.is224 = is224;
      }
      Sha256.prototype.update = function(message) {
        if (this.finalized) {
          return;
        }
        var notString, type2 = typeof message;
        if (type2 !== "string") {
          if (type2 === "object") {
            if (message === null) {
              throw new Error(ERROR);
            } else if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
              message = new Uint8Array(message);
            } else if (!Array.isArray(message)) {
              if (!ARRAY_BUFFER || !ArrayBuffer.isView(message)) {
                throw new Error(ERROR);
              }
            }
          } else {
            throw new Error(ERROR);
          }
          notString = true;
        }
        var code, index = 0, i2, length = message.length, blocks2 = this.blocks;
        while (index < length) {
          if (this.hashed) {
            this.hashed = false;
            blocks2[0] = this.block;
            this.block = blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
          }
          if (notString) {
            for (i2 = this.start; index < length && i2 < 64; ++index) {
              blocks2[i2 >>> 2] |= message[index] << SHIFT[i2++ & 3];
            }
          } else {
            for (i2 = this.start; index < length && i2 < 64; ++index) {
              code = message.charCodeAt(index);
              if (code < 128) {
                blocks2[i2 >>> 2] |= code << SHIFT[i2++ & 3];
              } else if (code < 2048) {
                blocks2[i2 >>> 2] |= (192 | code >>> 6) << SHIFT[i2++ & 3];
                blocks2[i2 >>> 2] |= (128 | code & 63) << SHIFT[i2++ & 3];
              } else if (code < 55296 || code >= 57344) {
                blocks2[i2 >>> 2] |= (224 | code >>> 12) << SHIFT[i2++ & 3];
                blocks2[i2 >>> 2] |= (128 | code >>> 6 & 63) << SHIFT[i2++ & 3];
                blocks2[i2 >>> 2] |= (128 | code & 63) << SHIFT[i2++ & 3];
              } else {
                code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
                blocks2[i2 >>> 2] |= (240 | code >>> 18) << SHIFT[i2++ & 3];
                blocks2[i2 >>> 2] |= (128 | code >>> 12 & 63) << SHIFT[i2++ & 3];
                blocks2[i2 >>> 2] |= (128 | code >>> 6 & 63) << SHIFT[i2++ & 3];
                blocks2[i2 >>> 2] |= (128 | code & 63) << SHIFT[i2++ & 3];
              }
            }
          }
          this.lastByteIndex = i2;
          this.bytes += i2 - this.start;
          if (i2 >= 64) {
            this.block = blocks2[16];
            this.start = i2 - 64;
            this.hash();
            this.hashed = true;
          } else {
            this.start = i2;
          }
        }
        if (this.bytes > 4294967295) {
          this.hBytes += this.bytes / 4294967296 << 0;
          this.bytes = this.bytes % 4294967296;
        }
        return this;
      };
      Sha256.prototype.finalize = function() {
        if (this.finalized) {
          return;
        }
        this.finalized = true;
        var blocks2 = this.blocks, i2 = this.lastByteIndex;
        blocks2[16] = this.block;
        blocks2[i2 >>> 2] |= EXTRA[i2 & 3];
        this.block = blocks2[16];
        if (i2 >= 56) {
          if (!this.hashed) {
            this.hash();
          }
          blocks2[0] = this.block;
          blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
        }
        blocks2[14] = this.hBytes << 3 | this.bytes >>> 29;
        blocks2[15] = this.bytes << 3;
        this.hash();
      };
      Sha256.prototype.hash = function() {
        var a4 = this.h0, b3 = this.h1, c4 = this.h2, d3 = this.h3, e = this.h4, f3 = this.h5, g3 = this.h6, h3 = this.h7, blocks2 = this.blocks, j4, s0, s1, maj, t1, t22, ch, ab, da, cd, bc;
        for (j4 = 16; j4 < 64; ++j4) {
          t1 = blocks2[j4 - 15];
          s0 = (t1 >>> 7 | t1 << 25) ^ (t1 >>> 18 | t1 << 14) ^ t1 >>> 3;
          t1 = blocks2[j4 - 2];
          s1 = (t1 >>> 17 | t1 << 15) ^ (t1 >>> 19 | t1 << 13) ^ t1 >>> 10;
          blocks2[j4] = blocks2[j4 - 16] + s0 + blocks2[j4 - 7] + s1 << 0;
        }
        bc = b3 & c4;
        for (j4 = 0; j4 < 64; j4 += 4) {
          if (this.first) {
            if (this.is224) {
              ab = 300032;
              t1 = blocks2[0] - 1413257819;
              h3 = t1 - 150054599 << 0;
              d3 = t1 + 24177077 << 0;
            } else {
              ab = 704751109;
              t1 = blocks2[0] - 210244248;
              h3 = t1 - 1521486534 << 0;
              d3 = t1 + 143694565 << 0;
            }
            this.first = false;
          } else {
            s0 = (a4 >>> 2 | a4 << 30) ^ (a4 >>> 13 | a4 << 19) ^ (a4 >>> 22 | a4 << 10);
            s1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
            ab = a4 & b3;
            maj = ab ^ a4 & c4 ^ bc;
            ch = e & f3 ^ ~e & g3;
            t1 = h3 + s1 + ch + K3[j4] + blocks2[j4];
            t22 = s0 + maj;
            h3 = d3 + t1 << 0;
            d3 = t1 + t22 << 0;
          }
          s0 = (d3 >>> 2 | d3 << 30) ^ (d3 >>> 13 | d3 << 19) ^ (d3 >>> 22 | d3 << 10);
          s1 = (h3 >>> 6 | h3 << 26) ^ (h3 >>> 11 | h3 << 21) ^ (h3 >>> 25 | h3 << 7);
          da = d3 & a4;
          maj = da ^ d3 & b3 ^ ab;
          ch = h3 & e ^ ~h3 & f3;
          t1 = g3 + s1 + ch + K3[j4 + 1] + blocks2[j4 + 1];
          t22 = s0 + maj;
          g3 = c4 + t1 << 0;
          c4 = t1 + t22 << 0;
          s0 = (c4 >>> 2 | c4 << 30) ^ (c4 >>> 13 | c4 << 19) ^ (c4 >>> 22 | c4 << 10);
          s1 = (g3 >>> 6 | g3 << 26) ^ (g3 >>> 11 | g3 << 21) ^ (g3 >>> 25 | g3 << 7);
          cd = c4 & d3;
          maj = cd ^ c4 & a4 ^ da;
          ch = g3 & h3 ^ ~g3 & e;
          t1 = f3 + s1 + ch + K3[j4 + 2] + blocks2[j4 + 2];
          t22 = s0 + maj;
          f3 = b3 + t1 << 0;
          b3 = t1 + t22 << 0;
          s0 = (b3 >>> 2 | b3 << 30) ^ (b3 >>> 13 | b3 << 19) ^ (b3 >>> 22 | b3 << 10);
          s1 = (f3 >>> 6 | f3 << 26) ^ (f3 >>> 11 | f3 << 21) ^ (f3 >>> 25 | f3 << 7);
          bc = b3 & c4;
          maj = bc ^ b3 & d3 ^ cd;
          ch = f3 & g3 ^ ~f3 & h3;
          t1 = e + s1 + ch + K3[j4 + 3] + blocks2[j4 + 3];
          t22 = s0 + maj;
          e = a4 + t1 << 0;
          a4 = t1 + t22 << 0;
          this.chromeBugWorkAround = true;
        }
        this.h0 = this.h0 + a4 << 0;
        this.h1 = this.h1 + b3 << 0;
        this.h2 = this.h2 + c4 << 0;
        this.h3 = this.h3 + d3 << 0;
        this.h4 = this.h4 + e << 0;
        this.h5 = this.h5 + f3 << 0;
        this.h6 = this.h6 + g3 << 0;
        this.h7 = this.h7 + h3 << 0;
      };
      Sha256.prototype.hex = function() {
        this.finalize();
        var h0 = this.h0, h1 = this.h1, h22 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5, h6 = this.h6, h7 = this.h7;
        var hex = HEX_CHARS[h0 >>> 28 & 15] + HEX_CHARS[h0 >>> 24 & 15] + HEX_CHARS[h0 >>> 20 & 15] + HEX_CHARS[h0 >>> 16 & 15] + HEX_CHARS[h0 >>> 12 & 15] + HEX_CHARS[h0 >>> 8 & 15] + HEX_CHARS[h0 >>> 4 & 15] + HEX_CHARS[h0 & 15] + HEX_CHARS[h1 >>> 28 & 15] + HEX_CHARS[h1 >>> 24 & 15] + HEX_CHARS[h1 >>> 20 & 15] + HEX_CHARS[h1 >>> 16 & 15] + HEX_CHARS[h1 >>> 12 & 15] + HEX_CHARS[h1 >>> 8 & 15] + HEX_CHARS[h1 >>> 4 & 15] + HEX_CHARS[h1 & 15] + HEX_CHARS[h22 >>> 28 & 15] + HEX_CHARS[h22 >>> 24 & 15] + HEX_CHARS[h22 >>> 20 & 15] + HEX_CHARS[h22 >>> 16 & 15] + HEX_CHARS[h22 >>> 12 & 15] + HEX_CHARS[h22 >>> 8 & 15] + HEX_CHARS[h22 >>> 4 & 15] + HEX_CHARS[h22 & 15] + HEX_CHARS[h3 >>> 28 & 15] + HEX_CHARS[h3 >>> 24 & 15] + HEX_CHARS[h3 >>> 20 & 15] + HEX_CHARS[h3 >>> 16 & 15] + HEX_CHARS[h3 >>> 12 & 15] + HEX_CHARS[h3 >>> 8 & 15] + HEX_CHARS[h3 >>> 4 & 15] + HEX_CHARS[h3 & 15] + HEX_CHARS[h4 >>> 28 & 15] + HEX_CHARS[h4 >>> 24 & 15] + HEX_CHARS[h4 >>> 20 & 15] + HEX_CHARS[h4 >>> 16 & 15] + HEX_CHARS[h4 >>> 12 & 15] + HEX_CHARS[h4 >>> 8 & 15] + HEX_CHARS[h4 >>> 4 & 15] + HEX_CHARS[h4 & 15] + HEX_CHARS[h5 >>> 28 & 15] + HEX_CHARS[h5 >>> 24 & 15] + HEX_CHARS[h5 >>> 20 & 15] + HEX_CHARS[h5 >>> 16 & 15] + HEX_CHARS[h5 >>> 12 & 15] + HEX_CHARS[h5 >>> 8 & 15] + HEX_CHARS[h5 >>> 4 & 15] + HEX_CHARS[h5 & 15] + HEX_CHARS[h6 >>> 28 & 15] + HEX_CHARS[h6 >>> 24 & 15] + HEX_CHARS[h6 >>> 20 & 15] + HEX_CHARS[h6 >>> 16 & 15] + HEX_CHARS[h6 >>> 12 & 15] + HEX_CHARS[h6 >>> 8 & 15] + HEX_CHARS[h6 >>> 4 & 15] + HEX_CHARS[h6 & 15];
        if (!this.is224) {
          hex += HEX_CHARS[h7 >>> 28 & 15] + HEX_CHARS[h7 >>> 24 & 15] + HEX_CHARS[h7 >>> 20 & 15] + HEX_CHARS[h7 >>> 16 & 15] + HEX_CHARS[h7 >>> 12 & 15] + HEX_CHARS[h7 >>> 8 & 15] + HEX_CHARS[h7 >>> 4 & 15] + HEX_CHARS[h7 & 15];
        }
        return hex;
      };
      Sha256.prototype.toString = Sha256.prototype.hex;
      Sha256.prototype.digest = function() {
        this.finalize();
        var h0 = this.h0, h1 = this.h1, h22 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5, h6 = this.h6, h7 = this.h7;
        var arr = [
          h0 >>> 24 & 255,
          h0 >>> 16 & 255,
          h0 >>> 8 & 255,
          h0 & 255,
          h1 >>> 24 & 255,
          h1 >>> 16 & 255,
          h1 >>> 8 & 255,
          h1 & 255,
          h22 >>> 24 & 255,
          h22 >>> 16 & 255,
          h22 >>> 8 & 255,
          h22 & 255,
          h3 >>> 24 & 255,
          h3 >>> 16 & 255,
          h3 >>> 8 & 255,
          h3 & 255,
          h4 >>> 24 & 255,
          h4 >>> 16 & 255,
          h4 >>> 8 & 255,
          h4 & 255,
          h5 >>> 24 & 255,
          h5 >>> 16 & 255,
          h5 >>> 8 & 255,
          h5 & 255,
          h6 >>> 24 & 255,
          h6 >>> 16 & 255,
          h6 >>> 8 & 255,
          h6 & 255
        ];
        if (!this.is224) {
          arr.push(h7 >>> 24 & 255, h7 >>> 16 & 255, h7 >>> 8 & 255, h7 & 255);
        }
        return arr;
      };
      Sha256.prototype.array = Sha256.prototype.digest;
      Sha256.prototype.arrayBuffer = function() {
        this.finalize();
        var buffer = new ArrayBuffer(this.is224 ? 28 : 32);
        var dataView = new DataView(buffer);
        dataView.setUint32(0, this.h0);
        dataView.setUint32(4, this.h1);
        dataView.setUint32(8, this.h2);
        dataView.setUint32(12, this.h3);
        dataView.setUint32(16, this.h4);
        dataView.setUint32(20, this.h5);
        dataView.setUint32(24, this.h6);
        if (!this.is224) {
          dataView.setUint32(28, this.h7);
        }
        return buffer;
      };
      function HmacSha256(key2, is224, sharedMemory) {
        var i2, type2 = typeof key2;
        if (type2 === "string") {
          var bytes = [], length = key2.length, index = 0, code;
          for (i2 = 0; i2 < length; ++i2) {
            code = key2.charCodeAt(i2);
            if (code < 128) {
              bytes[index++] = code;
            } else if (code < 2048) {
              bytes[index++] = 192 | code >>> 6;
              bytes[index++] = 128 | code & 63;
            } else if (code < 55296 || code >= 57344) {
              bytes[index++] = 224 | code >>> 12;
              bytes[index++] = 128 | code >>> 6 & 63;
              bytes[index++] = 128 | code & 63;
            } else {
              code = 65536 + ((code & 1023) << 10 | key2.charCodeAt(++i2) & 1023);
              bytes[index++] = 240 | code >>> 18;
              bytes[index++] = 128 | code >>> 12 & 63;
              bytes[index++] = 128 | code >>> 6 & 63;
              bytes[index++] = 128 | code & 63;
            }
          }
          key2 = bytes;
        } else {
          if (type2 === "object") {
            if (key2 === null) {
              throw new Error(ERROR);
            } else if (ARRAY_BUFFER && key2.constructor === ArrayBuffer) {
              key2 = new Uint8Array(key2);
            } else if (!Array.isArray(key2)) {
              if (!ARRAY_BUFFER || !ArrayBuffer.isView(key2)) {
                throw new Error(ERROR);
              }
            }
          } else {
            throw new Error(ERROR);
          }
        }
        if (key2.length > 64) {
          key2 = new Sha256(is224, true).update(key2).array();
        }
        var oKeyPad = [], iKeyPad = [];
        for (i2 = 0; i2 < 64; ++i2) {
          var b3 = key2[i2] || 0;
          oKeyPad[i2] = 92 ^ b3;
          iKeyPad[i2] = 54 ^ b3;
        }
        Sha256.call(this, is224, sharedMemory);
        this.update(iKeyPad);
        this.oKeyPad = oKeyPad;
        this.inner = true;
        this.sharedMemory = sharedMemory;
      }
      HmacSha256.prototype = new Sha256();
      HmacSha256.prototype.finalize = function() {
        Sha256.prototype.finalize.call(this);
        if (this.inner) {
          this.inner = false;
          var innerHash = this.array();
          Sha256.call(this, this.is224, this.sharedMemory);
          this.update(this.oKeyPad);
          this.update(innerHash);
          Sha256.prototype.finalize.call(this);
        }
      };
      var exports2 = createMethod();
      exports2.sha256 = exports2;
      exports2.sha224 = createMethod(true);
      exports2.sha256.hmac = createHmacMethod();
      exports2.sha224.hmac = createHmacMethod(true);
      if (COMMON_JS) {
        module.exports = exports2;
      } else {
        root.sha256 = exports2.sha256;
        root.sha224 = exports2.sha224;
        if (AMD) {
          define(function() {
            return exports2;
          });
        }
      }
    })();
  }
});

// node_modules/base32.js/base32.js
var require_base32 = __commonJS({
  "node_modules/base32.js/base32.js"(exports) {
    "use strict";
    var charmap = function(alphabet, mappings) {
      mappings || (mappings = {});
      alphabet.split("").forEach(function(c4, i2) {
        if (!(c4 in mappings)) mappings[c4] = i2;
      });
      return mappings;
    };
    var rfc4648 = {
      alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
      charmap: {
        0: 14,
        1: 8
      }
    };
    rfc4648.charmap = charmap(rfc4648.alphabet, rfc4648.charmap);
    var crockford = {
      alphabet: "0123456789ABCDEFGHJKMNPQRSTVWXYZ",
      charmap: {
        O: 0,
        I: 1,
        L: 1
      }
    };
    crockford.charmap = charmap(crockford.alphabet, crockford.charmap);
    var base32hex = {
      alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV",
      charmap: {}
    };
    base32hex.charmap = charmap(base32hex.alphabet, base32hex.charmap);
    function Decoder(options3) {
      this.buf = [];
      this.shift = 8;
      this.carry = 0;
      if (options3) {
        switch (options3.type) {
          case "rfc4648":
            this.charmap = exports.rfc4648.charmap;
            break;
          case "crockford":
            this.charmap = exports.crockford.charmap;
            break;
          case "base32hex":
            this.charmap = exports.base32hex.charmap;
            break;
          default:
            throw new Error("invalid type");
        }
        if (options3.charmap) this.charmap = options3.charmap;
      }
    }
    Decoder.prototype.charmap = rfc4648.charmap;
    Decoder.prototype.write = function(str2) {
      var charmap2 = this.charmap;
      var buf = this.buf;
      var shift = this.shift;
      var carry = this.carry;
      str2.toUpperCase().split("").forEach(function(char) {
        if (char == "=") return;
        var symbol = charmap2[char] & 255;
        shift -= 5;
        if (shift > 0) {
          carry |= symbol << shift;
        } else if (shift < 0) {
          buf.push(carry | symbol >> -shift);
          shift += 8;
          carry = symbol << shift & 255;
        } else {
          buf.push(carry | symbol);
          shift = 8;
          carry = 0;
        }
      });
      this.shift = shift;
      this.carry = carry;
      return this;
    };
    Decoder.prototype.finalize = function(str2) {
      if (str2) {
        this.write(str2);
      }
      if (this.shift !== 8 && this.carry !== 0) {
        this.buf.push(this.carry);
        this.shift = 8;
        this.carry = 0;
      }
      return this.buf;
    };
    function Encoder(options3) {
      this.buf = "";
      this.shift = 3;
      this.carry = 0;
      if (options3) {
        switch (options3.type) {
          case "rfc4648":
            this.alphabet = exports.rfc4648.alphabet;
            break;
          case "crockford":
            this.alphabet = exports.crockford.alphabet;
            break;
          case "base32hex":
            this.alphabet = exports.base32hex.alphabet;
            break;
          default:
            throw new Error("invalid type");
        }
        if (options3.alphabet) this.alphabet = options3.alphabet;
        else if (options3.lc) this.alphabet = this.alphabet.toLowerCase();
      }
    }
    Encoder.prototype.alphabet = rfc4648.alphabet;
    Encoder.prototype.write = function(buf) {
      var shift = this.shift;
      var carry = this.carry;
      var symbol;
      var byte;
      var i2;
      for (i2 = 0; i2 < buf.length; i2++) {
        byte = buf[i2];
        symbol = carry | byte >> shift;
        this.buf += this.alphabet[symbol & 31];
        if (shift > 5) {
          shift -= 5;
          symbol = byte >> shift;
          this.buf += this.alphabet[symbol & 31];
        }
        shift = 5 - shift;
        carry = byte << shift;
        shift = 8 - shift;
      }
      this.shift = shift;
      this.carry = carry;
      return this;
    };
    Encoder.prototype.finalize = function(buf) {
      if (buf) {
        this.write(buf);
      }
      if (this.shift !== 3) {
        this.buf += this.alphabet[this.carry & 31];
        this.shift = 3;
        this.carry = 0;
      }
      return this.buf;
    };
    exports.encode = function(buf, options3) {
      return new Encoder(options3).finalize(buf);
    };
    exports.decode = function(str2, options3) {
      return new Decoder(options3).finalize(str2);
    };
    exports.Decoder = Decoder;
    exports.Encoder = Encoder;
    exports.charmap = charmap;
    exports.crockford = crockford;
    exports.rfc4648 = rfc4648;
    exports.base32hex = base32hex;
  }
});

// node_modules/base32.js/index.js
var require_base322 = __commonJS({
  "node_modules/base32.js/index.js"(exports, module) {
    "use strict";
    var base322 = require_base32();
    var finalizeDecode = base322.Decoder.prototype.finalize;
    base322.Decoder.prototype.finalize = function(buf) {
      var bytes = finalizeDecode.call(this, buf);
      return new Buffer(bytes);
    };
    module.exports = base322;
  }
});

// node_modules/big.js/big.mjs
var DP = 20;
var RM = 1;
var MAX_DP = 1e6;
var MAX_POWER = 1e6;
var NE = -7;
var PE = 21;
var STRICT = false;
var NAME = "[big.js] ";
var INVALID = NAME + "Invalid ";
var INVALID_DP = INVALID + "decimal places";
var INVALID_RM = INVALID + "rounding mode";
var DIV_BY_ZERO = NAME + "Division by zero";
var P = {};
var UNDEFINED = void 0;
var NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
function _Big_() {
  function Big2(n) {
    var x3 = this;
    if (!(x3 instanceof Big2)) return n === UNDEFINED ? _Big_() : new Big2(n);
    if (n instanceof Big2) {
      x3.s = n.s;
      x3.e = n.e;
      x3.c = n.c.slice();
    } else {
      if (typeof n !== "string") {
        if (Big2.strict === true && typeof n !== "bigint") {
          throw TypeError(INVALID + "value");
        }
        n = n === 0 && 1 / n < 0 ? "-0" : String(n);
      }
      parse(x3, n);
    }
    x3.constructor = Big2;
  }
  Big2.prototype = P;
  Big2.DP = DP;
  Big2.RM = RM;
  Big2.NE = NE;
  Big2.PE = PE;
  Big2.strict = STRICT;
  Big2.roundDown = 0;
  Big2.roundHalfUp = 1;
  Big2.roundHalfEven = 2;
  Big2.roundUp = 3;
  return Big2;
}
function parse(x3, n) {
  var e, i2, nl;
  if (!NUMERIC.test(n)) {
    throw Error(INVALID + "number");
  }
  x3.s = n.charAt(0) == "-" ? (n = n.slice(1), -1) : 1;
  if ((e = n.indexOf(".")) > -1) n = n.replace(".", "");
  if ((i2 = n.search(/e/i)) > 0) {
    if (e < 0) e = i2;
    e += +n.slice(i2 + 1);
    n = n.substring(0, i2);
  } else if (e < 0) {
    e = n.length;
  }
  nl = n.length;
  for (i2 = 0; i2 < nl && n.charAt(i2) == "0"; ) ++i2;
  if (i2 == nl) {
    x3.c = [x3.e = 0];
  } else {
    for (; nl > 0 && n.charAt(--nl) == "0"; ) ;
    x3.e = e - i2 - 1;
    x3.c = [];
    for (e = 0; i2 <= nl; ) x3.c[e++] = +n.charAt(i2++);
  }
  return x3;
}
function round(x3, sd, rm, more) {
  var xc = x3.c;
  if (rm === UNDEFINED) rm = x3.constructor.RM;
  if (rm !== 0 && rm !== 1 && rm !== 2 && rm !== 3) {
    throw Error(INVALID_RM);
  }
  if (sd < 1) {
    more = rm === 3 && (more || !!xc[0]) || sd === 0 && (rm === 1 && xc[0] >= 5 || rm === 2 && (xc[0] > 5 || xc[0] === 5 && (more || xc[1] !== UNDEFINED)));
    xc.length = 1;
    if (more) {
      x3.e = x3.e - sd + 1;
      xc[0] = 1;
    } else {
      xc[0] = x3.e = 0;
    }
  } else if (sd < xc.length) {
    more = rm === 1 && xc[sd] >= 5 || rm === 2 && (xc[sd] > 5 || xc[sd] === 5 && (more || xc[sd + 1] !== UNDEFINED || xc[sd - 1] & 1)) || rm === 3 && (more || !!xc[0]);
    xc.length = sd;
    if (more) {
      for (; ++xc[--sd] > 9; ) {
        xc[sd] = 0;
        if (sd === 0) {
          ++x3.e;
          xc.unshift(1);
          break;
        }
      }
    }
    for (sd = xc.length; !xc[--sd]; ) xc.pop();
  }
  return x3;
}
function stringify(x3, doExponential, isNonzero) {
  var e = x3.e, s3 = x3.c.join(""), n = s3.length;
  if (doExponential) {
    s3 = s3.charAt(0) + (n > 1 ? "." + s3.slice(1) : "") + (e < 0 ? "e" : "e+") + e;
  } else if (e < 0) {
    for (; ++e; ) s3 = "0" + s3;
    s3 = "0." + s3;
  } else if (e > 0) {
    if (++e > n) {
      for (e -= n; e--; ) s3 += "0";
    } else if (e < n) {
      s3 = s3.slice(0, e) + "." + s3.slice(e);
    }
  } else if (n > 1) {
    s3 = s3.charAt(0) + "." + s3.slice(1);
  }
  return x3.s < 0 && isNonzero ? "-" + s3 : s3;
}
P.abs = function() {
  var x3 = new this.constructor(this);
  x3.s = 1;
  return x3;
};
P.cmp = function(y3) {
  var isneg, x3 = this, xc = x3.c, yc = (y3 = new x3.constructor(y3)).c, i2 = x3.s, j4 = y3.s, k3 = x3.e, l4 = y3.e;
  if (!xc[0] || !yc[0]) return !xc[0] ? !yc[0] ? 0 : -j4 : i2;
  if (i2 != j4) return i2;
  isneg = i2 < 0;
  if (k3 != l4) return k3 > l4 ^ isneg ? 1 : -1;
  j4 = (k3 = xc.length) < (l4 = yc.length) ? k3 : l4;
  for (i2 = -1; ++i2 < j4; ) {
    if (xc[i2] != yc[i2]) return xc[i2] > yc[i2] ^ isneg ? 1 : -1;
  }
  return k3 == l4 ? 0 : k3 > l4 ^ isneg ? 1 : -1;
};
P.div = function(y3) {
  var x3 = this, Big2 = x3.constructor, a4 = x3.c, b3 = (y3 = new Big2(y3)).c, k3 = x3.s == y3.s ? 1 : -1, dp = Big2.DP;
  if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
    throw Error(INVALID_DP);
  }
  if (!b3[0]) {
    throw Error(DIV_BY_ZERO);
  }
  if (!a4[0]) {
    y3.s = k3;
    y3.c = [y3.e = 0];
    return y3;
  }
  var bl, bt, n, cmp, ri, bz = b3.slice(), ai = bl = b3.length, al = a4.length, r3 = a4.slice(0, bl), rl = r3.length, q4 = y3, qc = q4.c = [], qi = 0, p4 = dp + (q4.e = x3.e - y3.e) + 1;
  q4.s = k3;
  k3 = p4 < 0 ? 0 : p4;
  bz.unshift(0);
  for (; rl++ < bl; ) r3.push(0);
  do {
    for (n = 0; n < 10; n++) {
      if (bl != (rl = r3.length)) {
        cmp = bl > rl ? 1 : -1;
      } else {
        for (ri = -1, cmp = 0; ++ri < bl; ) {
          if (b3[ri] != r3[ri]) {
            cmp = b3[ri] > r3[ri] ? 1 : -1;
            break;
          }
        }
      }
      if (cmp < 0) {
        for (bt = rl == bl ? b3 : bz; rl; ) {
          if (r3[--rl] < bt[rl]) {
            ri = rl;
            for (; ri && !r3[--ri]; ) r3[ri] = 9;
            --r3[ri];
            r3[rl] += 10;
          }
          r3[rl] -= bt[rl];
        }
        for (; !r3[0]; ) r3.shift();
      } else {
        break;
      }
    }
    qc[qi++] = cmp ? n : ++n;
    if (r3[0] && cmp) r3[rl] = a4[ai] || 0;
    else r3 = [a4[ai]];
  } while ((ai++ < al || r3[0] !== UNDEFINED) && k3--);
  if (!qc[0] && qi != 1) {
    qc.shift();
    q4.e--;
    p4--;
  }
  if (qi > p4) round(q4, p4, Big2.RM, r3[0] !== UNDEFINED);
  return q4;
};
P.eq = function(y3) {
  return this.cmp(y3) === 0;
};
P.gt = function(y3) {
  return this.cmp(y3) > 0;
};
P.gte = function(y3) {
  return this.cmp(y3) > -1;
};
P.lt = function(y3) {
  return this.cmp(y3) < 0;
};
P.lte = function(y3) {
  return this.cmp(y3) < 1;
};
P.minus = P.sub = function(y3) {
  var i2, j4, t3, xlty, x3 = this, Big2 = x3.constructor, a4 = x3.s, b3 = (y3 = new Big2(y3)).s;
  if (a4 != b3) {
    y3.s = -b3;
    return x3.plus(y3);
  }
  var xc = x3.c.slice(), xe = x3.e, yc = y3.c, ye2 = y3.e;
  if (!xc[0] || !yc[0]) {
    if (yc[0]) {
      y3.s = -b3;
    } else if (xc[0]) {
      y3 = new Big2(x3);
    } else {
      y3.s = 1;
    }
    return y3;
  }
  if (a4 = xe - ye2) {
    if (xlty = a4 < 0) {
      a4 = -a4;
      t3 = xc;
    } else {
      ye2 = xe;
      t3 = yc;
    }
    t3.reverse();
    for (b3 = a4; b3--; ) t3.push(0);
    t3.reverse();
  } else {
    j4 = ((xlty = xc.length < yc.length) ? xc : yc).length;
    for (a4 = b3 = 0; b3 < j4; b3++) {
      if (xc[b3] != yc[b3]) {
        xlty = xc[b3] < yc[b3];
        break;
      }
    }
  }
  if (xlty) {
    t3 = xc;
    xc = yc;
    yc = t3;
    y3.s = -y3.s;
  }
  if ((b3 = (j4 = yc.length) - (i2 = xc.length)) > 0) for (; b3--; ) xc[i2++] = 0;
  for (b3 = i2; j4 > a4; ) {
    if (xc[--j4] < yc[j4]) {
      for (i2 = j4; i2 && !xc[--i2]; ) xc[i2] = 9;
      --xc[i2];
      xc[j4] += 10;
    }
    xc[j4] -= yc[j4];
  }
  for (; xc[--b3] === 0; ) xc.pop();
  for (; xc[0] === 0; ) {
    xc.shift();
    --ye2;
  }
  if (!xc[0]) {
    y3.s = 1;
    xc = [ye2 = 0];
  }
  y3.c = xc;
  y3.e = ye2;
  return y3;
};
P.mod = function(y3) {
  var ygtx, x3 = this, Big2 = x3.constructor, a4 = x3.s, b3 = (y3 = new Big2(y3)).s;
  if (!y3.c[0]) {
    throw Error(DIV_BY_ZERO);
  }
  x3.s = y3.s = 1;
  ygtx = y3.cmp(x3) == 1;
  x3.s = a4;
  y3.s = b3;
  if (ygtx) return new Big2(x3);
  a4 = Big2.DP;
  b3 = Big2.RM;
  Big2.DP = Big2.RM = 0;
  x3 = x3.div(y3);
  Big2.DP = a4;
  Big2.RM = b3;
  return this.minus(x3.times(y3));
};
P.neg = function() {
  var x3 = new this.constructor(this);
  x3.s = -x3.s;
  return x3;
};
P.plus = P.add = function(y3) {
  var e, k3, t3, x3 = this, Big2 = x3.constructor;
  y3 = new Big2(y3);
  if (x3.s != y3.s) {
    y3.s = -y3.s;
    return x3.minus(y3);
  }
  var xe = x3.e, xc = x3.c, ye2 = y3.e, yc = y3.c;
  if (!xc[0] || !yc[0]) {
    if (!yc[0]) {
      if (xc[0]) {
        y3 = new Big2(x3);
      } else {
        y3.s = x3.s;
      }
    }
    return y3;
  }
  xc = xc.slice();
  if (e = xe - ye2) {
    if (e > 0) {
      ye2 = xe;
      t3 = yc;
    } else {
      e = -e;
      t3 = xc;
    }
    t3.reverse();
    for (; e--; ) t3.push(0);
    t3.reverse();
  }
  if (xc.length - yc.length < 0) {
    t3 = yc;
    yc = xc;
    xc = t3;
  }
  e = yc.length;
  for (k3 = 0; e; xc[e] %= 10) k3 = (xc[--e] = xc[e] + yc[e] + k3) / 10 | 0;
  if (k3) {
    xc.unshift(k3);
    ++ye2;
  }
  for (e = xc.length; xc[--e] === 0; ) xc.pop();
  y3.c = xc;
  y3.e = ye2;
  return y3;
};
P.pow = function(n) {
  var x3 = this, one = new x3.constructor("1"), y3 = one, isneg = n < 0;
  if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) {
    throw Error(INVALID + "exponent");
  }
  if (isneg) n = -n;
  for (; ; ) {
    if (n & 1) y3 = y3.times(x3);
    n >>= 1;
    if (!n) break;
    x3 = x3.times(x3);
  }
  return isneg ? one.div(y3) : y3;
};
P.prec = function(sd, rm) {
  if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
    throw Error(INVALID + "precision");
  }
  return round(new this.constructor(this), sd, rm);
};
P.round = function(dp, rm) {
  if (dp === UNDEFINED) dp = 0;
  else if (dp !== ~~dp || dp < -MAX_DP || dp > MAX_DP) {
    throw Error(INVALID_DP);
  }
  return round(new this.constructor(this), dp + this.e + 1, rm);
};
P.sqrt = function() {
  var r3, c4, t3, x3 = this, Big2 = x3.constructor, s3 = x3.s, e = x3.e, half = new Big2("0.5");
  if (!x3.c[0]) return new Big2(x3);
  if (s3 < 0) {
    throw Error(NAME + "No square root");
  }
  s3 = Math.sqrt(x3 + "");
  if (s3 === 0 || s3 === 1 / 0) {
    c4 = x3.c.join("");
    if (!(c4.length + e & 1)) c4 += "0";
    s3 = Math.sqrt(c4);
    e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
    r3 = new Big2((s3 == 1 / 0 ? "5e" : (s3 = s3.toExponential()).slice(0, s3.indexOf("e") + 1)) + e);
  } else {
    r3 = new Big2(s3 + "");
  }
  e = r3.e + (Big2.DP += 4);
  do {
    t3 = r3;
    r3 = half.times(t3.plus(x3.div(t3)));
  } while (t3.c.slice(0, e).join("") !== r3.c.slice(0, e).join(""));
  return round(r3, (Big2.DP -= 4) + r3.e + 1, Big2.RM);
};
P.times = P.mul = function(y3) {
  var c4, x3 = this, Big2 = x3.constructor, xc = x3.c, yc = (y3 = new Big2(y3)).c, a4 = xc.length, b3 = yc.length, i2 = x3.e, j4 = y3.e;
  y3.s = x3.s == y3.s ? 1 : -1;
  if (!xc[0] || !yc[0]) {
    y3.c = [y3.e = 0];
    return y3;
  }
  y3.e = i2 + j4;
  if (a4 < b3) {
    c4 = xc;
    xc = yc;
    yc = c4;
    j4 = a4;
    a4 = b3;
    b3 = j4;
  }
  for (c4 = new Array(j4 = a4 + b3); j4--; ) c4[j4] = 0;
  for (i2 = b3; i2--; ) {
    b3 = 0;
    for (j4 = a4 + i2; j4 > i2; ) {
      b3 = c4[j4] + yc[i2] * xc[j4 - i2 - 1] + b3;
      c4[j4--] = b3 % 10;
      b3 = b3 / 10 | 0;
    }
    c4[j4] = b3;
  }
  if (b3) ++y3.e;
  else c4.shift();
  for (i2 = c4.length; !c4[--i2]; ) c4.pop();
  y3.c = c4;
  return y3;
};
P.toExponential = function(dp, rm) {
  var x3 = this, n = x3.c[0];
  if (dp !== UNDEFINED) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
      throw Error(INVALID_DP);
    }
    x3 = round(new x3.constructor(x3), ++dp, rm);
    for (; x3.c.length < dp; ) x3.c.push(0);
  }
  return stringify(x3, true, !!n);
};
P.toFixed = function(dp, rm) {
  var x3 = this, n = x3.c[0];
  if (dp !== UNDEFINED) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
      throw Error(INVALID_DP);
    }
    x3 = round(new x3.constructor(x3), dp + x3.e + 1, rm);
    for (dp = dp + x3.e + 1; x3.c.length < dp; ) x3.c.push(0);
  }
  return stringify(x3, false, !!n);
};
P[Symbol.for("nodejs.util.inspect.custom")] = P.toJSON = P.toString = function() {
  var x3 = this, Big2 = x3.constructor;
  return stringify(x3, x3.e <= Big2.NE || x3.e >= Big2.PE, !!x3.c[0]);
};
P.toNumber = function() {
  var n = Number(stringify(this, true, true));
  if (this.constructor.strict === true && !this.eq(n.toString())) {
    throw Error(NAME + "Imprecise conversion");
  }
  return n;
};
P.toPrecision = function(sd, rm) {
  var x3 = this, Big2 = x3.constructor, n = x3.c[0];
  if (sd !== UNDEFINED) {
    if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
      throw Error(INVALID + "precision");
    }
    x3 = round(new Big2(x3), sd, rm);
    for (; x3.c.length < sd; ) x3.c.push(0);
  }
  return stringify(x3, sd <= x3.e || x3.e <= Big2.NE || x3.e >= Big2.PE, !!n);
};
P.valueOf = function() {
  var x3 = this, Big2 = x3.constructor;
  if (Big2.strict === true) {
    throw Error(NAME + "valueOf disallowed");
  }
  return stringify(x3, x3.e <= Big2.NE || x3.e >= Big2.PE, true);
};
var Big = _Big_();
var big_default = Big;

// libs/language/src/lib/model/BigDecimalNumber.ts
var BigDecimalNumber = class extends big_default {
  constructor(value) {
    super(value);
  }
};

// libs/language/src/lib/model/BigIntegerNumber.ts
var BigIntegerNumber = class extends big_default {
  constructor(value) {
    super(value);
  }
};

// node_modules/zod/lib/index.mjs
var util;
(function(util2) {
  util2.assertEqual = (val) => val;
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k3) => typeof obj[obj[k3]] !== "number");
    const filtered = {};
    for (const k3 of validKeys) {
      filtered[k3] = obj[k3];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key2 in object) {
      if (Object.prototype.hasOwnProperty.call(object, key2)) {
        keys.push(key2);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_3, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t3 = typeof data;
  switch (t3) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json2 = JSON.stringify(obj, null, 2);
  return json2.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  get errors() {
    return this.issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i2 = 0;
          while (i2 < issue.path.length) {
            const el = issue.path[i2];
            const terminal = i2 === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i2++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
        fieldErrors[sub.path[0]].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var overrideErrorMap = errorMap;
function setErrorMap(map2) {
  overrideErrorMap = map2;
}
function getErrorMap() {
  return overrideErrorMap;
}
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m3) => !!m3).slice().reverse();
  for (const map2 of maps) {
    errorMessage = map2(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      ctx.schemaErrorMap,
      overrideMap,
      overrideMap === errorMap ? void 0 : errorMap
      // then global default map
    ].filter((x3) => !!x3)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s3 of results) {
      if (s3.status === "aborted")
        return INVALID2;
      if (s3.status === "dirty")
        status.dirty();
      arrayValue.push(s3.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs2) {
    const syncPairs = [];
    for (const pair of pairs2) {
      const key2 = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key: key2,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs2) {
    const finalObject = {};
    for (const pair of pairs2) {
      const { key: key2, value } = pair;
      if (key2.status === "aborted")
        return INVALID2;
      if (value.status === "aborted")
        return INVALID2;
      if (key2.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key2.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key2.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID2 = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x3) => x3.status === "aborted";
var isDirty = (x3) => x3.status === "dirty";
var isValid = (x3) => x3.status === "valid";
var isAsync = (x3) => typeof Promise !== "undefined" && x3 instanceof Promise;
function __classPrivateFieldGet(receiver, state, kind, f3) {
  if (kind === "a" && !f3) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f3 : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f3 : kind === "a" ? f3.call(receiver) : f3 ? f3.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f3) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f3) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f3 : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f3.call(receiver, value) : f3 ? f3.value = value : state.set(receiver, value), value;
}
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message === null || message === void 0 ? void 0 : message.message;
})(errorUtil || (errorUtil = {}));
var _ZodEnum_cache;
var _ZodNativeEnum_cache;
var ParseInputLazyPath = class {
  constructor(parent, value, path, key2) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key2;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (this._key instanceof Array) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    var _a, _b;
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message !== null && message !== void 0 ? message : ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: (_a = message !== null && message !== void 0 ? message : required_error) !== null && _a !== void 0 ? _a : ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: (_b = message !== null && message !== void 0 ? message : invalid_type_error) !== null && _b !== void 0 ? _b : ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
  }
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    var _a;
    const ctx = {
      common: {
        issues: [],
        async: (_a = params === null || params === void 0 ? void 0 : params.async) !== null && _a !== void 0 ? _a : false,
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
        async: true
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this, this._def);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6Regex = /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let regex = `([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d`;
  if (args.precision) {
    regex = `${regex}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    regex = `${regex}(\\.\\d+)?`;
  }
  return regex;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch (_a) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  ip(options3) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options3) });
  }
  datetime(options3) {
    var _a, _b;
    if (typeof options3 === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options3
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof (options3 === null || options3 === void 0 ? void 0 : options3.precision) === "undefined" ? null : options3 === null || options3 === void 0 ? void 0 : options3.precision,
      offset: (_a = options3 === null || options3 === void 0 ? void 0 : options3.offset) !== null && _a !== void 0 ? _a : false,
      local: (_b = options3 === null || options3 === void 0 ? void 0 : options3.local) !== null && _b !== void 0 ? _b : false,
      ...errorUtil.errToObj(options3 === null || options3 === void 0 ? void 0 : options3.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options3) {
    if (typeof options3 === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options3
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof (options3 === null || options3 === void 0 ? void 0 : options3.precision) === "undefined" ? null : options3 === null || options3 === void 0 ? void 0 : options3.precision,
      ...errorUtil.errToObj(options3 === null || options3 === void 0 ? void 0 : options3.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options3) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options3 === null || options3 === void 0 ? void 0 : options3.position,
      ...errorUtil.errToObj(options3 === null || options3 === void 0 ? void 0 : options3.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * @deprecated Use z.string().min(1) instead.
   * @see {@link ZodString.min}
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  var _a;
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step2) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step2.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = parseInt(step2.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / Math.pow(10, decCount);
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null, min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = BigInt(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.bigint,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  var _a;
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    if (isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID2;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID2;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i2) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i2));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i2) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i2));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema2, params) => {
  return new ZodArray({
    type: schema2,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema2) {
  if (schema2 instanceof ZodObject) {
    const newShape = {};
    for (const key2 in schema2.shape) {
      const fieldSchema = schema2.shape[key2];
      newShape[key2] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema2._def,
      shape: () => newShape
    });
  } else if (schema2 instanceof ZodArray) {
    return new ZodArray({
      ...schema2._def,
      type: deepPartialify(schema2.element)
    });
  } else if (schema2 instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema2.unwrap()));
  } else if (schema2 instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema2.unwrap()));
  } else if (schema2 instanceof ZodTuple) {
    return ZodTuple.create(schema2.items.map((item) => deepPartialify(item)));
  } else {
    return schema2;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    return this._cached = { shape, keys };
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID2;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key2 in ctx.data) {
        if (!shapeKeys.includes(key2)) {
          extraKeys.push(key2);
        }
      }
    }
    const pairs2 = [];
    for (const key2 of shapeKeys) {
      const keyValidator = shape[key2];
      const value = ctx.data[key2];
      pairs2.push({
        key: { status: "valid", value: key2 },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key2)),
        alwaysSet: key2 in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key2 of extraKeys) {
          pairs2.push({
            key: { status: "valid", value: key2 },
            value: { status: "valid", value: ctx.data[key2] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key2 of extraKeys) {
        const value = ctx.data[key2];
        pairs2.push({
          key: { status: "valid", value: key2 },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key2)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key2 in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs2) {
          const key2 = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key: key2,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs2);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          var _a, _b, _c, _d;
          const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === void 0 ? void 0 : _b.call(_a, issue, ctx).message) !== null && _c !== void 0 ? _c : ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: (_d = errorUtil.errToObj(message).message) !== null && _d !== void 0 ? _d : defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key2, schema2) {
    return this.augment({ [key2]: schema2 });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    util.objectKeys(mask).forEach((key2) => {
      if (mask[key2] && this.shape[key2]) {
        shape[key2] = this.shape[key2];
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    util.objectKeys(this.shape).forEach((key2) => {
      if (!mask[key2]) {
        shape[key2] = this.shape[key2];
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key2) => {
      const fieldSchema = this.shape[key2];
      if (mask && !mask[key2]) {
        newShape[key2] = fieldSchema;
      } else {
        newShape[key2] = fieldSchema.optional();
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key2) => {
      if (mask && !mask[key2]) {
        newShape[key2] = this.shape[key2];
      } else {
        const fieldSchema = this.shape[key2];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key2] = newField;
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options3 = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID2;
    }
    if (ctx.common.async) {
      return Promise.all(options3.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options3) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID2;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types2, params) => {
  return new ZodUnion({
    options: types2,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type2) => {
  if (type2 instanceof ZodLazy) {
    return getDiscriminator(type2.schema);
  } else if (type2 instanceof ZodEffects) {
    return getDiscriminator(type2.innerType());
  } else if (type2 instanceof ZodLiteral) {
    return [type2.value];
  } else if (type2 instanceof ZodEnum) {
    return type2.options;
  } else if (type2 instanceof ZodNativeEnum) {
    return util.objectValues(type2.enum);
  } else if (type2 instanceof ZodDefault) {
    return getDiscriminator(type2._def.innerType);
  } else if (type2 instanceof ZodUndefined) {
    return [void 0];
  } else if (type2 instanceof ZodNull) {
    return [null];
  } else if (type2 instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type2.unwrap())];
  } else if (type2 instanceof ZodNullable) {
    return [null, ...getDiscriminator(type2.unwrap())];
  } else if (type2 instanceof ZodBranded) {
    return getDiscriminator(type2.unwrap());
  } else if (type2 instanceof ZodReadonly) {
    return getDiscriminator(type2.unwrap());
  } else if (type2 instanceof ZodCatch) {
    return getDiscriminator(type2._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID2;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options3, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type2 of options3) {
      const discriminatorValues = getDiscriminator(type2.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type2);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options: options3,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a4, b3) {
  const aType = getParsedType(a4);
  const bType = getParsedType(b3);
  if (a4 === b3) {
    return { valid: true, data: a4 };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b3);
    const sharedKeys = util.objectKeys(a4).filter((key2) => bKeys.indexOf(key2) !== -1);
    const newObj = { ...a4, ...b3 };
    for (const key2 of sharedKeys) {
      const sharedValue = mergeValues(a4[key2], b3[key2]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key2] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a4.length !== b3.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a4.length; index++) {
      const itemA = a4[index];
      const itemB = b3[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a4 === +b3) {
    return { valid: true, data: a4 };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID2;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID2;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID2;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema2 = this._def.items[itemIndex] || this._def.rest;
      if (!schema2)
        return null;
      return schema2._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x3) => !!x3);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const pairs2 = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key2 in ctx.data) {
      pairs2.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key2, ctx.path, key2)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key2], ctx.path, key2)),
        alwaysSet: key2 in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs2);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs2);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs2 = [...ctx.data.entries()].map(([key2, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key2, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs2) {
          const key2 = await pair.key;
          const value = await pair.value;
          if (key2.status === "aborted" || value.status === "aborted") {
            return INVALID2;
          }
          if (key2.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key2.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs2) {
        const key2 = pair.key;
        const value = pair.value;
        if (key2.status === "aborted" || value.status === "aborted") {
          return INVALID2;
        }
        if (key2.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key2.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID2;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i2) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i2)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x3) => !!x3),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x3) => !!x3),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me2 = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me2._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me2._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me2 = this;
      return OK(function(...args) {
        const parsedArgs = me2._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me2._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID2;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  constructor() {
    super(...arguments);
    _ZodEnum_cache.set(this, void 0);
  }
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID2;
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f")) {
      __classPrivateFieldSet(this, _ZodEnum_cache, new Set(this._def.values), "f");
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f").has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID2;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
_ZodEnum_cache = /* @__PURE__ */ new WeakMap();
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  constructor() {
    super(...arguments);
    _ZodNativeEnum_cache.set(this, void 0);
  }
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID2;
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f")) {
      __classPrivateFieldSet(this, _ZodNativeEnum_cache, new Set(util.getValidEnumValues(this._def.values)), "f");
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f").has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID2;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
_ZodNativeEnum_cache = /* @__PURE__ */ new WeakMap();
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema2, params) => {
  return new ZodPromise({
    type: schema2,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID2;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID2;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID2;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID2;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID2;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID2;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base2 = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base2))
          return base2;
        const result = effect.transform(base2.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base2) => {
          if (!isValid(base2))
            return base2;
          return Promise.resolve(effect.transform(base2.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema2, effect, params) => {
  return new ZodEffects({
    schema: schema2,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema2, params) => {
  return new ZodEffects({
    schema: schema2,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type2, params) => {
  return new ZodOptional({
    innerType: type2,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type2, params) => {
  return new ZodNullable({
    innerType: type2,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type2, params) => {
  return new ZodDefault({
    innerType: type2,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type2, params) => {
  return new ZodCatch({
    innerType: type2,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID2;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID2;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID2;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a4, b3) {
    return new _ZodPipeline({
      in: a4,
      out: b3,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze2 = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze2(data)) : freeze2(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type2, params) => {
  return new ZodReadonly({
    innerType: type2,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function custom(check, params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      var _a, _b;
      if (!check(data)) {
        const p4 = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
        const _fatal = (_b = (_a = p4.fatal) !== null && _a !== void 0 ? _a : fatal) !== null && _b !== void 0 ? _b : true;
        const p22 = typeof p4 === "string" ? { message: p4 } : p4;
        ctx.addIssue({ code: "custom", ...p22, fatal: _fatal });
      }
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID2;
var z = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  defaultErrorMap: errorMap,
  setErrorMap,
  getErrorMap,
  makeIssue,
  EMPTY_PATH,
  addIssueToContext,
  ParseStatus,
  INVALID: INVALID2,
  DIRTY,
  OK,
  isAborted,
  isDirty,
  isValid,
  isAsync,
  get util() {
    return util;
  },
  get objectUtil() {
    return objectUtil;
  },
  ZodParsedType,
  getParsedType,
  ZodType,
  datetimeRegex,
  ZodString,
  ZodNumber,
  ZodBigInt,
  ZodBoolean,
  ZodDate,
  ZodSymbol,
  ZodUndefined,
  ZodNull,
  ZodAny,
  ZodUnknown,
  ZodNever,
  ZodVoid,
  ZodArray,
  ZodObject,
  ZodUnion,
  ZodDiscriminatedUnion,
  ZodIntersection,
  ZodTuple,
  ZodRecord,
  ZodMap,
  ZodSet,
  ZodFunction,
  ZodLazy,
  ZodLiteral,
  ZodEnum,
  ZodNativeEnum,
  ZodPromise,
  ZodEffects,
  ZodTransformer: ZodEffects,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodCatch,
  ZodNaN,
  BRAND,
  ZodBranded,
  ZodPipeline,
  ZodReadonly,
  custom,
  Schema: ZodType,
  ZodSchema: ZodType,
  late,
  get ZodFirstPartyTypeKind() {
    return ZodFirstPartyTypeKind;
  },
  coerce,
  any: anyType,
  array: arrayType,
  bigint: bigIntType,
  boolean: booleanType,
  date: dateType,
  discriminatedUnion: discriminatedUnionType,
  effect: effectsType,
  "enum": enumType,
  "function": functionType,
  "instanceof": instanceOfType,
  intersection: intersectionType,
  lazy: lazyType,
  literal: literalType,
  map: mapType,
  nan: nanType,
  nativeEnum: nativeEnumType,
  never: neverType,
  "null": nullType,
  nullable: nullableType,
  number: numberType,
  object: objectType,
  oboolean,
  onumber,
  optional: optionalType,
  ostring,
  pipeline: pipelineType,
  preprocess: preprocessType,
  promise: promiseType,
  record: recordType,
  set: setType,
  strictObject: strictObjectType,
  string: stringType,
  symbol: symbolType,
  transformer: effectsType,
  tuple: tupleType,
  "undefined": undefinedType,
  union: unionType,
  unknown: unknownType,
  "void": voidType,
  NEVER,
  ZodIssueCode,
  quotelessJson,
  ZodError
});

// libs/shared/utils/dist/index.mjs
function j(r3) {
  return r3 && r3.__esModule && Object.prototype.hasOwnProperty.call(r3, "default") ? r3.default : r3;
}
var u;
var l;
function m() {
  return l || (l = 1, u = function r3(e, t3) {
    if (e === t3) return true;
    if (e && t3 && typeof e == "object" && typeof t3 == "object") {
      if (e.constructor !== t3.constructor) return false;
      var s3, n, f3;
      if (Array.isArray(e)) {
        if (s3 = e.length, s3 != t3.length) return false;
        for (n = s3; n-- !== 0; )
          if (!r3(e[n], t3[n])) return false;
        return true;
      }
      if (e instanceof Map && t3 instanceof Map) {
        if (e.size !== t3.size) return false;
        for (n of e.entries())
          if (!t3.has(n[0])) return false;
        for (n of e.entries())
          if (!r3(n[1], t3.get(n[0]))) return false;
        return true;
      }
      if (e instanceof Set && t3 instanceof Set) {
        if (e.size !== t3.size) return false;
        for (n of e.entries())
          if (!t3.has(n[0])) return false;
        return true;
      }
      if (ArrayBuffer.isView(e) && ArrayBuffer.isView(t3)) {
        if (s3 = e.length, s3 != t3.length) return false;
        for (n = s3; n-- !== 0; )
          if (e[n] !== t3[n]) return false;
        return true;
      }
      if (e.constructor === RegExp) return e.source === t3.source && e.flags === t3.flags;
      if (e.valueOf !== Object.prototype.valueOf) return e.valueOf() === t3.valueOf();
      if (e.toString !== Object.prototype.toString) return e.toString() === t3.toString();
      if (f3 = Object.keys(e), s3 = f3.length, s3 !== Object.keys(t3).length) return false;
      for (n = s3; n-- !== 0; )
        if (!Object.prototype.hasOwnProperty.call(t3, f3[n])) return false;
      for (n = s3; n-- !== 0; ) {
        var i2 = f3[n];
        if (!r3(e[i2], t3[i2])) return false;
      }
      return true;
    }
    return e !== e && t3 !== t3;
  }), u;
}
var O = m();
var A = /* @__PURE__ */ j(O);
function a(r3, e) {
  if (e === null || typeof e != "object" || e instanceof Date || e instanceof RegExp)
    return A(r3, e);
  if (e instanceof Set) {
    if (!(r3 instanceof Set)) return false;
    for (const s3 of e) if (!r3.has(s3)) return false;
    return true;
  }
  if (e instanceof Map) {
    if (!(r3 instanceof Map)) return false;
    for (const [s3, n] of e)
      if (!r3.has(s3) || !a(r3.get(s3), n)) return false;
    return true;
  }
  if (Array.isArray(e))
    return Array.isArray(r3) ? e.every(
      (s3) => r3.some((n) => a(n, s3))
    ) : false;
  if (r3 === null || typeof r3 != "object" || Array.isArray(r3))
    return false;
  const t3 = r3;
  return Object.entries(e).every(
    ([s3, n]) => s3 in t3 && a(t3[s3], n)
  );
}
var g = (r3) => r3 != null;
var R = (r3) => r3 == null;
var S = (r3) => Array.isArray(r3);
function P2(r3) {
  if (Object.isFrozen(r3))
    return r3;
  Object.freeze(r3);
  for (const e of Object.getOwnPropertyNames(r3)) {
    const t3 = r3[e];
    g(t3) && typeof t3 == "object" && P2(t3);
  }
  return r3;
}
var z2 = [z.string(), z.number(), z.boolean(), z.null()];
var N = z.union(z2);
var y = z.lazy(
  () => z.record(c)
);
var p = z.lazy(
  () => z.union([z.array(c), z.array(c).readonly()])
);
var c = z.lazy(
  () => z.union([N, y, p])
);
var w = (r3) => typeof r3 == "string" || typeof r3 == "number" || typeof r3 == "boolean" || r3 === null;
var v = (r3) => !isNaN(Number(r3)) && isFinite(Number(r3));
var q = (r3) => v(r3) ? Number(r3).toString() === r3 : false;

// libs/language/src/lib/utils/NodePathAccessor.ts
var NodePathAccessor = class {
  static get(node, path, linkingProvider, resolveFinalLink = true) {
    if (R(path) || !path.startsWith("/")) {
      throw new Error(`Invalid path: ${path}`);
    }
    if (path === "/") {
      const value = node.getValue();
      return resolveFinalLink && value !== void 0 ? value : node;
    }
    const segments = path.substring(1).split("/");
    return this.getRecursive(
      node,
      segments,
      0,
      linkingProvider,
      resolveFinalLink
    );
  }
  static getRecursive(node, segments, index, linkingProvider, resolveFinalLink) {
    if (index === segments.length - 1 && !resolveFinalLink) {
      return this.getNodeForSegment(
        node,
        segments[index],
        linkingProvider,
        false
      );
    }
    if (index === segments.length) {
      const value = node.getValue();
      if (resolveFinalLink) {
        return value !== void 0 ? value : node;
      } else {
        return node;
      }
    }
    const segment = segments[index];
    const nextNode = this.getNodeForSegment(
      node,
      segment,
      linkingProvider,
      true
    );
    if (!nextNode) {
      return void 0;
    }
    return this.getRecursive(
      nextNode,
      segments,
      index + 1,
      linkingProvider,
      resolveFinalLink
    );
  }
  static getNodeForSegment(node, segment, linkingProvider, resolveLink) {
    let resultNode;
    const userProperties = node.getProperties();
    if (userProperties && segment in userProperties) {
      resultNode = userProperties[segment];
    } else {
      switch (segment) {
        case "name": {
          const name = node.getName();
          resultNode = new BlueNode().setValue(name ?? null);
          break;
        }
        case "description": {
          const description = node.getDescription();
          resultNode = new BlueNode().setValue(description ?? null);
          break;
        }
        case "type":
          resultNode = node.getType();
          break;
        case "itemType":
          resultNode = node.getItemType();
          break;
        case "keyType":
          resultNode = node.getKeyType();
          break;
        case "valueType":
          resultNode = node.getValueType();
          break;
        case "value": {
          const val = node.getValue();
          resultNode = new BlueNode().setValue(val ?? null);
          break;
        }
        case "blueId": {
          const blueId = node.getBlueId();
          resultNode = new BlueNode().setValue(blueId ?? null);
          break;
        }
        case "blue":
          resultNode = node.getBlue();
          break;
        case "items": {
          const directItems = node.getItems();
          resultNode = new BlueNode().setItems(directItems);
          break;
        }
        case "properties": {
          const directProps = node.getProperties();
          resultNode = new BlueNode().setProperties(directProps);
          break;
        }
        case "contracts": {
          const directContracts = node.getContracts();
          resultNode = new BlueNode().setContracts(directContracts);
          break;
        }
        default: {
          if (/^\d+$/.test(segment)) {
            const itemIndex = parseInt(segment, 10);
            const itemsArray = node.getItems();
            if (itemsArray && itemIndex >= 0 && itemIndex < itemsArray.length) {
              resultNode = itemsArray[itemIndex];
            } else {
              resultNode = void 0;
            }
          } else {
            resultNode = void 0;
          }
          break;
        }
      }
    }
    if (!resultNode) {
      return void 0;
    }
    return resolveLink && linkingProvider ? this.link(resultNode, linkingProvider) : resultNode;
  }
  static link(node, linkingProvider) {
    const linked = linkingProvider(node);
    return g(linked) ? linked : node;
  }
};

// libs/language/src/lib/utils/Properties.ts
var OBJECT_NAME = "name";
var OBJECT_DESCRIPTION = "description";
var OBJECT_TYPE = "type";
var OBJECT_ITEM_TYPE = "itemType";
var OBJECT_KEY_TYPE = "keyType";
var OBJECT_VALUE_TYPE = "valueType";
var OBJECT_VALUE = "value";
var OBJECT_ITEMS = "items";
var OBJECT_BLUE_ID = "blueId";
var OBJECT_BLUE = "blue";
var TEXT_TYPE = "Text";
var DOUBLE_TYPE = "Double";
var INTEGER_TYPE = "Integer";
var BOOLEAN_TYPE = "Boolean";
var LIST_TYPE = "List";
var DICTIONARY_TYPE = "Dictionary";
var BASIC_TYPES = [
  TEXT_TYPE,
  DOUBLE_TYPE,
  INTEGER_TYPE,
  BOOLEAN_TYPE
];
var CORE_TYPES = [...BASIC_TYPES, LIST_TYPE, DICTIONARY_TYPE];
var TEXT_TYPE_BLUE_ID = "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP";
var DOUBLE_TYPE_BLUE_ID = "68ryJtnmui4j5rCZWUnkZ3DChtmEb7Z9F8atn1mBSM3L";
var INTEGER_TYPE_BLUE_ID = "DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8";
var BOOLEAN_TYPE_BLUE_ID = "EL6AjrbJsxTWRTPzY8WR8Y2zAMXRbydQj83PcZwuAHbo";
var LIST_TYPE_BLUE_ID = "G8wmfjEqugPEEXByMYWJXiEdbLToPRWNQEekNxrxfQWB";
var DICTIONARY_TYPE_BLUE_ID = "294NBTj2mFRL3RB4kDRUSckwGg7Kzj6T8CTAFeR1kcSA";
var BASIC_TYPE_BLUE_IDS = [
  TEXT_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  BOOLEAN_TYPE_BLUE_ID
];
var CORE_TYPE_BLUE_IDS = [
  ...BASIC_TYPE_BLUE_IDS,
  LIST_TYPE_BLUE_ID,
  DICTIONARY_TYPE_BLUE_ID
];
var CORE_TYPE_NAME_TO_BLUE_ID_MAP = Object.fromEntries(
  CORE_TYPES.map((type2, index) => [type2, CORE_TYPE_BLUE_IDS[index]])
);
var CORE_TYPE_BLUE_ID_TO_NAME_MAP = Object.fromEntries(
  CORE_TYPE_BLUE_IDS.map((blueId, index) => [blueId, CORE_TYPES[index]])
);

// libs/language/src/lib/model/Node.ts
var _BlueNode = class _BlueNode {
  constructor(name) {
    __publicField(this, "name");
    __publicField(this, "description");
    __publicField(this, "type");
    __publicField(this, "itemType");
    __publicField(this, "keyType");
    __publicField(this, "valueType");
    __publicField(this, "value");
    __publicField(this, "items");
    __publicField(this, "properties");
    __publicField(this, "blueId");
    __publicField(this, "blue");
    __publicField(this, "inlineValue", false);
    this.name = name;
  }
  getName() {
    return this.name;
  }
  setName(name) {
    this.name = name;
    return this;
  }
  getDescription() {
    return this.description;
  }
  setDescription(description) {
    this.description = description;
    return this;
  }
  getType() {
    return this.type;
  }
  setType(type2) {
    if (typeof type2 === "string") {
      this.type = new _BlueNode().setValue(type2).setInlineValue(true);
    } else {
      this.type = type2;
    }
    return this;
  }
  getItemType() {
    return this.itemType;
  }
  setItemType(itemType) {
    if (typeof itemType === "string") {
      this.itemType = new _BlueNode().setValue(itemType).setInlineValue(true);
    } else {
      this.itemType = itemType;
    }
    return this;
  }
  getKeyType() {
    return this.keyType;
  }
  setKeyType(keyType) {
    if (typeof keyType === "string") {
      this.keyType = new _BlueNode().setValue(keyType).setInlineValue(true);
    } else {
      this.keyType = keyType;
    }
    return this;
  }
  getValueType() {
    return this.valueType;
  }
  setValueType(valueType) {
    if (typeof valueType === "string") {
      this.valueType = new _BlueNode().setValue(valueType).setInlineValue(true);
    } else {
      this.valueType = valueType;
    }
    return this;
  }
  getValue() {
    const typeBlueId = this.type?.getBlueId();
    if (g(typeBlueId) && g(this.value)) {
      if (typeBlueId === INTEGER_TYPE_BLUE_ID && typeof this.value === "string") {
        return new BigIntegerNumber(this.value);
      } else if (typeBlueId === DOUBLE_TYPE_BLUE_ID && typeof this.value === "string") {
        const parsed = new BigDecimalNumber(this.value);
        const doubleValue = parseFloat(parsed.toString());
        return new BigDecimalNumber(doubleValue.toString());
      } else if (typeBlueId === BOOLEAN_TYPE_BLUE_ID && typeof this.value === "string") {
        return this.value.toLowerCase() === "true";
      }
    }
    return this.value;
  }
  setValue(value) {
    if (typeof value === "number") {
      if (value % 1 === 0) {
        this.value = new BigIntegerNumber(value.toString());
      } else {
        this.value = new BigDecimalNumber(value.toString());
      }
    } else {
      this.value = value;
    }
    return this;
  }
  getItems() {
    return this.items;
  }
  setItems(items) {
    this.items = items;
    return this;
  }
  addItems(...items) {
    if (!this.items) {
      this.items = [];
    }
    this.items.push(...items);
    return this;
  }
  getProperties() {
    return this.properties;
  }
  setProperties(properties) {
    this.properties = properties;
    return this;
  }
  addProperty(key2, value) {
    if (!this.properties) {
      this.properties = {};
    }
    this.properties[key2] = value;
    return this;
  }
  removeProperty(key2) {
    if (this.properties) {
      delete this.properties[key2];
    }
    return this;
  }
  getContractsProperty() {
    return this.properties?.["contracts"];
  }
  getContracts() {
    return this.getContractsProperty()?.getProperties();
  }
  setContracts(contracts) {
    if (R(contracts)) {
      this.removeProperty("contracts");
    } else {
      this.addProperty("contracts", new _BlueNode().setProperties(contracts));
    }
    return this;
  }
  addContract(key2, value) {
    const contractsProperty = this.getContractsProperty();
    if (R(contractsProperty)) {
      this.addProperty("contracts", new _BlueNode().addProperty(key2, value));
    } else {
      contractsProperty.addProperty(key2, value);
    }
    return this;
  }
  removeContract(key2) {
    const contractsProperty = this.getContractsProperty();
    if (contractsProperty) {
      contractsProperty.removeProperty(key2);
      const remainingProperties = contractsProperty.getProperties();
      if (remainingProperties && Object.keys(remainingProperties).length === 0) {
        this.removeProperty("contracts");
      }
    }
    return this;
  }
  getBlueId() {
    return this.blueId;
  }
  setBlueId(blueId) {
    this.blueId = blueId;
    return this;
  }
  getBlue() {
    return this.blue;
  }
  setBlue(blue2) {
    this.blue = blue2;
    return this;
  }
  isInlineValue() {
    return this.inlineValue;
  }
  setInlineValue(inlineValue) {
    this.inlineValue = inlineValue;
    return this;
  }
  /**
   * Checks if this is a resolved node
   * @returns false for regular BlueNode, true for ResolvedBlueNode
   */
  isResolved() {
    return false;
  }
  get(path, linkingProvider) {
    return NodePathAccessor.get(this, path, linkingProvider);
  }
  getAsNode(path) {
    const value = this.get(path);
    if (value instanceof _BlueNode) {
      return value;
    }
    throw new Error(`Value at path ${path} is not a BlueNode: ${value}`);
  }
  getAsInteger(path) {
    const value = this.get(path);
    if (value instanceof BigIntegerNumber || value instanceof BigDecimalNumber) {
      return value.toNumber();
    }
    throw new Error(
      `Value at path ${path} is not a BigInteger or BigDecimal: ${value}`
    );
  }
  clone() {
    const cloned = new _BlueNode(this.name);
    cloned.description = this.description;
    cloned.type = this.type?.clone();
    cloned.itemType = this.itemType?.clone();
    cloned.keyType = this.keyType?.clone();
    cloned.valueType = this.valueType?.clone();
    cloned.value = this.value;
    cloned.items = this.items?.map((item) => item.clone());
    if (this.properties) {
      cloned.properties = Object.fromEntries(
        Object.entries(this.properties).map(([k3, v4]) => [k3, v4.clone()])
      );
    }
    cloned.blueId = this.blueId;
    cloned.blue = this.blue?.clone();
    cloned.inlineValue = this.inlineValue;
    return cloned;
  }
  toString() {
    return `BlueNode{name='${this.name}', description='${this.description}', type=${this.type}, itemType=${this.itemType}, keyType=${this.keyType}, valueType=${this.valueType}, value=${this.value}, items=${this.items}, properties=${this.properties}, blueId='${this.blueId}', blue=${this.blue}, inlineValue=${this.inlineValue}}`;
  }
};
__publicField(_BlueNode, "INTEGER", new _BlueNode("Integer"));
var BlueNode = _BlueNode;

// node_modules/base-x/src/esm/index.js
function base(ALPHABET2) {
  if (ALPHABET2.length >= 255) {
    throw new TypeError("Alphabet too long");
  }
  const BASE_MAP = new Uint8Array(256);
  for (let j4 = 0; j4 < BASE_MAP.length; j4++) {
    BASE_MAP[j4] = 255;
  }
  for (let i2 = 0; i2 < ALPHABET2.length; i2++) {
    const x3 = ALPHABET2.charAt(i2);
    const xc = x3.charCodeAt(0);
    if (BASE_MAP[xc] !== 255) {
      throw new TypeError(x3 + " is ambiguous");
    }
    BASE_MAP[xc] = i2;
  }
  const BASE = ALPHABET2.length;
  const LEADER = ALPHABET2.charAt(0);
  const FACTOR = Math.log(BASE) / Math.log(256);
  const iFACTOR = Math.log(256) / Math.log(BASE);
  function encode(source) {
    if (source instanceof Uint8Array) {
    } else if (ArrayBuffer.isView(source)) {
      source = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    } else if (Array.isArray(source)) {
      source = Uint8Array.from(source);
    }
    if (!(source instanceof Uint8Array)) {
      throw new TypeError("Expected Uint8Array");
    }
    if (source.length === 0) {
      return "";
    }
    let zeroes = 0;
    let length = 0;
    let pbegin = 0;
    const pend = source.length;
    while (pbegin !== pend && source[pbegin] === 0) {
      pbegin++;
      zeroes++;
    }
    const size = (pend - pbegin) * iFACTOR + 1 >>> 0;
    const b58 = new Uint8Array(size);
    while (pbegin !== pend) {
      let carry = source[pbegin];
      let i2 = 0;
      for (let it1 = size - 1; (carry !== 0 || i2 < length) && it1 !== -1; it1--, i2++) {
        carry += 256 * b58[it1] >>> 0;
        b58[it1] = carry % BASE >>> 0;
        carry = carry / BASE >>> 0;
      }
      if (carry !== 0) {
        throw new Error("Non-zero carry");
      }
      length = i2;
      pbegin++;
    }
    let it2 = size - length;
    while (it2 !== size && b58[it2] === 0) {
      it2++;
    }
    let str2 = LEADER.repeat(zeroes);
    for (; it2 < size; ++it2) {
      str2 += ALPHABET2.charAt(b58[it2]);
    }
    return str2;
  }
  function decodeUnsafe(source) {
    if (typeof source !== "string") {
      throw new TypeError("Expected String");
    }
    if (source.length === 0) {
      return new Uint8Array();
    }
    let psz = 0;
    let zeroes = 0;
    let length = 0;
    while (source[psz] === LEADER) {
      zeroes++;
      psz++;
    }
    const size = (source.length - psz) * FACTOR + 1 >>> 0;
    const b256 = new Uint8Array(size);
    while (psz < source.length) {
      const charCode = source.charCodeAt(psz);
      if (charCode > 255) {
        return;
      }
      let carry = BASE_MAP[charCode];
      if (carry === 255) {
        return;
      }
      let i2 = 0;
      for (let it3 = size - 1; (carry !== 0 || i2 < length) && it3 !== -1; it3--, i2++) {
        carry += BASE * b256[it3] >>> 0;
        b256[it3] = carry % 256 >>> 0;
        carry = carry / 256 >>> 0;
      }
      if (carry !== 0) {
        throw new Error("Non-zero carry");
      }
      length = i2;
      psz++;
    }
    let it4 = size - length;
    while (it4 !== size && b256[it4] === 0) {
      it4++;
    }
    const vch = new Uint8Array(zeroes + (size - it4));
    let j4 = zeroes;
    while (it4 !== size) {
      vch[j4++] = b256[it4++];
    }
    return vch;
  }
  function decode2(string) {
    const buffer = decodeUnsafe(string);
    if (buffer) {
      return buffer;
    }
    throw new Error("Non-base" + BASE + " character");
  }
  return {
    encode,
    decodeUnsafe,
    decode: decode2
  };
}
var esm_default = base;

// node_modules/bs58/src/esm/index.js
var ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
var esm_default2 = esm_default(ALPHABET);

// libs/language/src/lib/utils/BlueIds.ts
var BlueIds = class {
  static isPotentialBlueId(value) {
    if (!value || value.length === 0) {
      return false;
    }
    if (!this.BLUE_ID_PATTERN.test(value)) {
      return false;
    }
    const parts = value.split("#");
    const blueIdPart = parts[0];
    const blueIdLength = blueIdPart.length;
    if (blueIdLength < this.MIN_BLUE_ID_LENGTH || blueIdLength > this.MAX_BLUE_ID_LENGTH) {
      return false;
    }
    try {
      const decoded = esm_default2.decode(blueIdPart);
      if (decoded.length !== 32) {
        return false;
      }
    } catch {
      return false;
    }
    if (parts.length > 1) {
      try {
        const index = Number(parts[1]);
        if (index < 0) {
          return false;
        }
      } catch {
        return false;
      }
    }
    return true;
  }
};
__publicField(BlueIds, "MIN_BLUE_ID_LENGTH", 41);
__publicField(BlueIds, "MAX_BLUE_ID_LENGTH", 45);
__publicField(BlueIds, "BLUE_ID_PATTERN", /^[1-9A-HJ-NP-Za-km-z]{41,45}(?:#\d+)?$/);

// libs/language/src/schema/blueId.ts
var blueIdSchema = z.string().max(BlueIds.MAX_BLUE_ID_LENGTH, {
  message: "Blue Id has a maximum length of 45 characters"
}).min(BlueIds.MIN_BLUE_ID_LENGTH, {
  message: "Blue Id has a minimum length of 41 characters"
}).refine(
  (data) => {
    try {
      esm_default2.decode(data);
      return true;
    } catch {
      return false;
    }
  },
  {
    message: "Blue Id must be a valid Base58 string"
  }
);

// libs/language/src/schema/generated/blueObject.zod.ts
var blueObjectSchema = z.lazy(
  () => z.record(z.unknown()).and(
    z.object({
      blueId: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      type: blueObjectSchema.optional(),
      value: z.union([z.string(), z.number(), z.boolean()]).optional().nullable(),
      items: z.array(blueObjectSchema).optional()
    })
  )
);
var baseBlueObjectSchema = z.object({
  blueId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  type: blueObjectSchema.optional()
});
var blueObjectStringValueSchema = baseBlueObjectSchema.extend({
  value: z.string().optional()
});
var blueObjectNumberValueSchema = baseBlueObjectSchema.extend({
  value: z.number().optional()
});
var blueObjectBooleanValueSchema = baseBlueObjectSchema.extend({
  value: z.boolean().optional()
});
var blueObjectStringListItemsSchema = baseBlueObjectSchema.extend({
  items: z.array(z.string()).optional()
});

// node_modules/radash/dist/esm/typed.mjs
var isArray = Array.isArray;
var isObject = (value) => {
  return !!value && value.constructor === Object;
};
var isString = (value) => {
  return typeof value === "string" || value instanceof String;
};

// libs/language/src/utils/typeGuards/isBigNumber.ts
var isBigNumber = (value) => value instanceof big_default;
var isBigIntegerNumber = (value) => isBigNumber(value) && value instanceof BigIntegerNumber;
var isBigDecimalNumber = (value) => isBigNumber(value) && value instanceof BigDecimalNumber;

// libs/language/src/schema/jsonBlue.ts
var jsonBlueObjectSchema = z.lazy(
  () => z.record(jsonBlueValueSchema)
);
var jsonBlueArraySchema = z.lazy(
  () => z.union([
    z.array(jsonBlueValueSchema),
    z.array(jsonBlueValueSchema).readonly()
  ])
);
var jsonBlueValueSchema = z.lazy(
  () => z.union([
    N,
    jsonBlueObjectSchema,
    jsonBlueArraySchema,
    z.instanceof(big_default)
  ])
);
var isJsonBlueObject = (value) => {
  return isObject(value) && !isArray(value) && !S(value) && !isBigNumber(value);
};
var isJsonBlueArray = (value) => {
  return isArray(value) || S(value);
};

// libs/language/src/lib/model/NodeDeserializer.ts
var NodeDeserializer = class _NodeDeserializer {
  static deserialize(json2) {
    return _NodeDeserializer.handleNode(json2);
  }
  static handleNode(node) {
    if (node === void 0) {
      throw new Error(
        "This is not a valid JSON-like value. Found 'undefined' as a value."
      );
    } else if (isJsonBlueObject(node)) {
      const obj = new BlueNode();
      const properties = {};
      Object.entries(node).forEach(([key2, value]) => {
        switch (key2) {
          case OBJECT_NAME:
            if (value === null || value === void 0) {
              obj.setName(void 0);
            } else if (typeof value !== "string") {
              throw new Error(`The ${OBJECT_NAME} field must be a string.`);
            } else {
              obj.setName(value);
            }
            break;
          case OBJECT_DESCRIPTION:
            if (value === null || value === void 0) {
              obj.setDescription(void 0);
            } else if (typeof value !== "string") {
              throw new Error(
                `The ${OBJECT_DESCRIPTION} field must be a string.`
              );
            } else {
              obj.setDescription(value);
            }
            break;
          case OBJECT_TYPE:
            obj.setType(_NodeDeserializer.handleNode(value));
            break;
          case OBJECT_ITEM_TYPE:
            obj.setItemType(_NodeDeserializer.handleNode(value));
            break;
          case OBJECT_KEY_TYPE:
            obj.setKeyType(_NodeDeserializer.handleNode(value));
            break;
          case OBJECT_VALUE_TYPE:
            obj.setValueType(_NodeDeserializer.handleNode(value));
            break;
          case OBJECT_VALUE:
            obj.setValue(_NodeDeserializer.handleValue(value));
            break;
          case OBJECT_BLUE_ID:
            if (typeof value !== "string") {
              throw new Error(`The ${OBJECT_BLUE_ID} field must be a string.`);
            }
            obj.setBlueId(value);
            break;
          case OBJECT_ITEMS:
            obj.setItems(_NodeDeserializer.handleArray(value));
            break;
          case OBJECT_BLUE:
            obj.setBlue(_NodeDeserializer.handleNode(value));
            break;
          default:
            properties[key2] = _NodeDeserializer.handleNode(value);
            break;
        }
      });
      if (Object.keys(properties).length > 0) {
        obj.setProperties(properties);
      }
      return obj;
    } else if (isJsonBlueArray(node)) {
      return new BlueNode().setItems(_NodeDeserializer.handleArray(node));
    } else {
      const nodeValue = node;
      return new BlueNode().setValue(_NodeDeserializer.handleValue(nodeValue)).setInlineValue(true);
    }
  }
  static handleValue(node) {
    if (node === null || node === void 0) {
      return null;
    } else if (typeof node === "string") {
      return node;
    } else if (typeof node === "number" || isBigNumber(node)) {
      if (isBigIntegerNumber(node) || Number.isSafeInteger(node)) {
        const bigInt = new BigIntegerNumber(node.toString());
        const lowerBound = Number.MIN_SAFE_INTEGER;
        const upperBound = Number.MAX_SAFE_INTEGER;
        if (bigInt.lt(lowerBound)) {
          return new BigIntegerNumber(lowerBound.toString());
        } else if (bigInt.gt(upperBound)) {
          return new BigIntegerNumber(upperBound.toString());
        } else {
          return bigInt;
        }
      } else {
        const doubleValue = parseFloat(node.toString());
        return new BigDecimalNumber(doubleValue.toString());
      }
    } else if (typeof node === "boolean") {
      return node;
    }
    throw new Error(`Can't handle node: ${JSON.stringify(node)}`);
  }
  static handleArray(value) {
    if (value === null || value === void 0) {
      return void 0;
    } else if (isObject(value) && !Array.isArray(value)) {
      const singleItemList = [_NodeDeserializer.handleNode(value)];
      return singleItemList;
    } else if (Array.isArray(value)) {
      return value.map(_NodeDeserializer.handleNode);
    } else {
      throw new Error("Expected an array node");
    }
  }
};

// libs/language/src/lib/utils/JsonCanonicalizer.ts
var import_canonicalize = __toESM(require_canonicalize());
var JsonCanonicalizer = class {
  static canonicalize(input) {
    return (0, import_canonicalize.default)(input);
  }
};

// libs/language/src/lib/utils/Base58Sha256Provider.ts
var import_js_sha256 = __toESM(require_sha256());
var Base58Sha256Provider = class {
  applySync(object) {
    const canonized = this.canonicalizeInput(object);
    const hashBytes = this.sha256Bytes(canonized);
    return esm_default2.encode(hashBytes);
  }
  async apply(object) {
    const canonized = this.canonicalizeInput(object);
    const hashBytes = this.sha256Bytes(canonized);
    return esm_default2.encode(hashBytes);
  }
  canonicalizeInput(object) {
    const canonized = JsonCanonicalizer.canonicalize(object);
    if (typeof canonized !== "string") {
      throw new Error("Canonized value must be a string");
    }
    return canonized;
  }
  sha256Bytes(input) {
    const hash = import_js_sha256.sha256.create();
    hash.update(input);
    return Uint8Array.from(hash.array());
  }
};

// libs/language/src/lib/utils/NodeToMapListOrValue.ts
var NodeToMapListOrValue = class _NodeToMapListOrValue {
  /**
   * Converts a BlueNode to a JSON representation based on the specified strategy.
   *
   * @param node - The BlueNode to convert.
   * @param strategy - The conversion strategy to use. Defaults to 'official'.
   *   - `'official'`: Always returns complete objects with type information and metadata
   *   - `'simple'`: Returns unwrapped values/arrays when possible, objects when metadata exists
   *   - `'original'`: Returns simple values when no name/description, otherwise full objects
   * @returns A JSON representation of the node.
   */
  static get(node, strategy = "official") {
    const value = node.getValue();
    const handledValue = this.handleValue(value);
    if (handledValue !== void 0 && strategy === "simple") {
      return handledValue;
    }
    const items = node.getItems()?.map((item) => _NodeToMapListOrValue.get(item, strategy));
    if (items !== void 0 && strategy === "simple") {
      return items;
    }
    const name = node.getName();
    const description = node.getDescription();
    if (strategy === "original" && name === void 0 && description === void 0) {
      if (handledValue !== void 0) {
        return handledValue;
      }
      if (items !== void 0) {
        return items;
      }
    }
    const result = {};
    if (name !== void 0) {
      result[OBJECT_NAME] = name;
    }
    if (description !== void 0) {
      result[OBJECT_DESCRIPTION] = description;
    }
    const type2 = node.getType();
    if (strategy === "official" && value !== void 0 && type2 === void 0) {
      const inferredTypeBlueId = this.inferTypeBlueId(value);
      if (inferredTypeBlueId !== null) {
        result[OBJECT_TYPE] = { [OBJECT_BLUE_ID]: inferredTypeBlueId };
      }
    } else if (type2 !== void 0) {
      result[OBJECT_TYPE] = _NodeToMapListOrValue.get(type2, strategy);
    }
    const itemType = node.getItemType();
    if (itemType !== void 0) {
      result[OBJECT_ITEM_TYPE] = _NodeToMapListOrValue.get(itemType, strategy);
    }
    const keyType = node.getKeyType();
    if (keyType !== void 0) {
      result[OBJECT_KEY_TYPE] = _NodeToMapListOrValue.get(keyType, strategy);
    }
    const valueType = node.getValueType();
    if (valueType !== void 0) {
      result[OBJECT_VALUE_TYPE] = _NodeToMapListOrValue.get(valueType, strategy);
    }
    if (handledValue !== void 0) {
      result[OBJECT_VALUE] = handledValue;
    }
    if (items !== void 0) {
      result[OBJECT_ITEMS] = items;
    }
    const blueId = node.getBlueId();
    if (blueId !== void 0) {
      result[OBJECT_BLUE_ID] = blueId;
    }
    const blue2 = node.getBlue();
    if (blue2 !== void 0) {
      result[OBJECT_BLUE] = blue2;
    }
    const properties = node.getProperties();
    if (properties !== void 0) {
      Object.entries(properties).forEach(([key2, value2]) => {
        result[key2] = _NodeToMapListOrValue.get(value2, strategy);
      });
    }
    return result;
  }
  static handleValue(value) {
    if (isBigNumber(value)) {
      if (isBigIntegerNumber(value)) {
        const lowerBound = new big_default(Number.MIN_SAFE_INTEGER.toString());
        const upperBound = new big_default(Number.MAX_SAFE_INTEGER.toString());
        if (value.lt(lowerBound) || value.gt(upperBound)) {
          return value.toString();
        }
      }
      return value.toNumber();
    }
    return value;
  }
  static inferTypeBlueId(value) {
    if (typeof value === "string") {
      return TEXT_TYPE_BLUE_ID;
    } else if (isBigNumber(value)) {
      return isBigIntegerNumber(value) ? INTEGER_TYPE_BLUE_ID : DOUBLE_TYPE_BLUE_ID;
    } else if (typeof value === "boolean") {
      return BOOLEAN_TYPE_BLUE_ID;
    }
    return null;
  }
};

// libs/language/src/lib/utils/BlueIdCalculator.ts
var isNonNullableJsonPrimitive = (value) => {
  return w(value) && g(value);
};
var _BlueIdCalculator = class _BlueIdCalculator {
  constructor(hashProvider) {
    __publicField(this, "hashProvider");
    this.hashProvider = hashProvider;
  }
  static calculateBlueId(node) {
    if (Array.isArray(node)) {
      const nodes = node.map((n) => NodeToMapListOrValue.get(n));
      return _BlueIdCalculator.INSTANCE.calculate(nodes);
    }
    const object = NodeToMapListOrValue.get(node);
    return _BlueIdCalculator.INSTANCE.calculate(object);
  }
  static calculateBlueIdSync(node) {
    if (Array.isArray(node)) {
      const nodes = node.map((n) => NodeToMapListOrValue.get(n));
      return _BlueIdCalculator.INSTANCE.calculateSync(nodes);
    }
    const object = NodeToMapListOrValue.get(node);
    return _BlueIdCalculator.INSTANCE.calculateSync(object);
  }
  calculate(object) {
    const cleanedObject = this.cleanStructure(object);
    if (cleanedObject === void 0) {
      throw new Error(`Object after cleaning cannot be null or undefined.`);
    }
    return this.internalCalculate(cleanedObject, false);
  }
  calculateSync(object) {
    const cleanedObject = this.cleanStructure(object);
    if (cleanedObject === void 0) {
      throw new Error(`Object after cleaning cannot be null or undefined.`);
    }
    return this.internalCalculate(cleanedObject, true);
  }
  // Internal method to calculate BlueId recursively
  internalCalculate(cleanedObject, isSync) {
    if (isNonNullableJsonPrimitive(cleanedObject) || isBigNumber(cleanedObject)) {
      return this.applyHash(cleanedObject.toString(), isSync);
    } else if (Array.isArray(cleanedObject) || S(cleanedObject)) {
      return this.calculateList(cleanedObject, isSync);
    } else {
      return this.calculateMap(cleanedObject, isSync);
    }
  }
  calculateMap(map2, isSync) {
    if (map2[OBJECT_BLUE_ID] !== void 0) {
      return map2[OBJECT_BLUE_ID];
    }
    const keys = Object.keys(map2);
    const hashPromises = keys.map((key2) => {
      const value = map2[key2];
      if ([OBJECT_NAME, OBJECT_VALUE, OBJECT_DESCRIPTION].includes(key2)) {
        return isSync ? [key2, value] : Promise.resolve([key2, value]);
      } else {
        const hashedValue = this.internalCalculate(value, isSync);
        if (isSync) {
          return [key2, { blueId: hashedValue }];
        } else {
          return Promise.resolve(hashedValue).then((hv) => [
            key2,
            { blueId: hv }
          ]);
        }
      }
    });
    const processHashes = (entries) => {
      const hashes = {};
      for (const [key2, hashValue] of entries) {
        hashes[key2] = hashValue;
      }
      return this.applyHash(hashes, isSync);
    };
    if (isSync) {
      return processHashes(hashPromises);
    } else {
      return Promise.all(hashPromises).then(processHashes);
    }
  }
  calculateList(list, isSync) {
    if (list.length === 0) {
      throw new Error("Cannot calculate BlueId for an empty list.");
    }
    let accumulatedHash = this.internalCalculate(
      list[0],
      isSync
    );
    const combineTwoHashes = (hash1, hash2) => {
      if (isSync) {
        return this.applyHash(
          [{ blueId: hash1 }, { blueId: hash2 }],
          true
        );
      } else {
        return Promise.all([hash1, hash2]).then(
          ([h1, h22]) => this.applyHash([{ blueId: h1 }, { blueId: h22 }], false)
        );
      }
    };
    for (let i2 = 1; i2 < list.length; i2++) {
      const elementHash = this.internalCalculate(list[i2], isSync);
      accumulatedHash = combineTwoHashes(accumulatedHash, elementHash);
    }
    return accumulatedHash;
  }
  // Method to apply the hash provider to a value
  applyHash(value, isSync) {
    return isSync ? this.hashProvider.applySync(value) : this.hashProvider.apply(value);
  }
  // Method to clean the input structure by removing null or undefined values
  cleanStructure(obj) {
    if (obj === null || obj === void 0) {
      return void 0;
    } else if (w(obj) || isBigNumber(obj)) {
      return obj;
    } else if (Array.isArray(obj) || S(obj)) {
      const cleanedList = obj.map((item) => this.cleanStructure(item)).filter(g);
      return cleanedList.length > 0 ? cleanedList : void 0;
    } else if (typeof obj === "object") {
      const cleanedMap = {};
      for (const key2 in obj) {
        const cleanedValue = this.cleanStructure(obj[key2]);
        if (cleanedValue !== null && cleanedValue !== void 0) {
          cleanedMap[key2] = cleanedValue;
        }
      }
      return Object.keys(cleanedMap).length > 0 ? cleanedMap : void 0;
    } else {
      return obj;
    }
  }
};
__publicField(_BlueIdCalculator, "INSTANCE", new _BlueIdCalculator(new Base58Sha256Provider()));
var BlueIdCalculator = _BlueIdCalculator;

// libs/language/src/lib/utils/BlueIdToCid.ts
var import_base32 = __toESM(require_base322());

// libs/language/src/lib/utils/NodeTransformer.ts
var NodeTransformer = class _NodeTransformer {
  /**
   * Transforms a node and all its child nodes using the provided transformer function
   * @param node - The node to transform
   * @param transformer - The transformer function to apply to each node
   * @returns The transformed node
   */
  static transform(node, transformer) {
    const transformedNode = transformer(node.clone());
    const type2 = transformedNode.getType();
    if (type2 !== void 0) {
      transformedNode.setType(_NodeTransformer.transform(type2, transformer));
    }
    const itemType = transformedNode.getItemType();
    if (itemType !== void 0) {
      transformedNode.setItemType(
        _NodeTransformer.transform(itemType, transformer)
      );
    }
    const keyType = transformedNode.getKeyType();
    if (keyType !== void 0) {
      transformedNode.setKeyType(
        _NodeTransformer.transform(keyType, transformer)
      );
    }
    const valueType = transformedNode.getValueType();
    if (valueType !== void 0) {
      transformedNode.setValueType(
        _NodeTransformer.transform(valueType, transformer)
      );
    }
    const items = transformedNode.getItems();
    if (items !== void 0) {
      const transformedItems = items.map(
        (item) => _NodeTransformer.transform(item, transformer)
      );
      transformedNode.setItems(transformedItems);
    }
    const properties = transformedNode.getProperties();
    if (properties !== void 0) {
      const transformedProperties = Object.keys(properties).reduce(
        (acc, key2) => {
          acc[key2] = _NodeTransformer.transform(properties[key2], transformer);
          return acc;
        },
        {}
      );
      transformedNode.setProperties(transformedProperties);
    }
    return transformedNode;
  }
};

// libs/language/src/lib/utils/NodePatch/patch-utils.ts
var isDict = (v4) => !!v4 && typeof v4 === "object" && !Array.isArray(v4) && !(v4 instanceof BlueNode);
var isNumeric = (v4) => v4 instanceof BigIntegerNumber || v4 instanceof BigDecimalNumber;
var decode = (s3) => s3.replace(/~1/g, "/").replace(/~0/g, "~");
function split(path) {
  if (path === "/") return [];
  if (!path.startsWith("/"))
    throw new Error(`Path must start with '/': ${path}`);
  return path.split("/").slice(1).map(decode);
}
function asIndex(t3) {
  if (t3 === "-") return -1;
  const n = typeof t3 === "number" ? t3 : parseInt(t3, 10);
  if (isNaN(n)) {
    throw new Error(`Invalid array index (NaN) from '${t3}'`);
  }
  if (!Number.isFinite(n)) {
    throw new Error(
      `Invalid array index '${t3}' results in non-finite number ${n}`
    );
  }
  return n;
}
function _getBlueNodeSpecialProperty(node, key2, forStepContext, allowStepIntoBlueNodeValue = true) {
  switch (key2) {
    case "name":
      return forStepContext ? allowStepIntoBlueNodeValue ? node.getName() ?? null : node : node.getName();
    case "description":
      return forStepContext ? allowStepIntoBlueNodeValue ? node.getDescription() : node : node.getDescription();
    case "type":
      return node.getType();
    case "itemType":
      return node.getItemType();
    case "keyType":
      return node.getKeyType();
    case "valueType":
      return node.getValueType();
    case "value":
      return forStepContext ? allowStepIntoBlueNodeValue ? node.getValue() ?? null : node : node.getValue();
    case "blueId":
      return forStepContext ? allowStepIntoBlueNodeValue ? node.getBlueId() ?? null : node : node.getBlueId();
    case "blue":
      return node.getBlue();
    case "items":
      return node.getItems();
    case "properties":
      return node.getProperties();
    case "contracts":
      return node.getContracts();
    default:
      return void 0;
  }
}
function step(container, tok, allowStepIntoBlueNodeValue = true) {
  if (container instanceof BlueNode) {
    const specialProp = _getBlueNodeSpecialProperty(
      container,
      tok,
      true,
      allowStepIntoBlueNodeValue
    );
    if (specialProp !== void 0 || [
      "name",
      "description",
      "type",
      "itemType",
      "keyType",
      "valueType",
      "value",
      "blueId",
      "blue",
      "items",
      "properties",
      "contracts"
    ].includes(tok)) {
      return specialProp;
    }
    if (/^-?\d+$/.test(tok) && tok !== "-") {
      const items = container.getItems();
      const idx = parseInt(tok, 10);
      if (items && idx >= 0 && idx < items.length) return items[idx];
      return void 0;
    }
    const props = container.getProperties();
    if (props && tok in props) return props[tok];
    if (tok === "-") return void 0;
    return void 0;
  }
  if (Array.isArray(container)) {
    if (tok === "-") return void 0;
    const idx = asIndex(tok);
    if (idx >= 0 && idx < container.length) return container[idx];
    return void 0;
  }
  if (isDict(container)) return container[tok];
  return void 0;
}
function resolve(root, tokens) {
  if (tokens.length === 0) {
    return {
      parent: root,
      key: "value",
      actualTarget: root.getValue() ?? root
    };
  }
  let cursor = root;
  for (let i2 = 0; i2 < tokens.length - 1; ++i2) {
    const currentToken = tokens[i2];
    const nextCursor = step(cursor, currentToken);
    if (nextCursor === void 0) {
      throw new Error(`Cannot resolve '/${tokens.slice(0, i2 + 1).join("/")}'`);
    }
    cursor = nextCursor;
  }
  const lastToken = tokens[tokens.length - 1];
  if (cursor instanceof BlueNode) {
    const potentialPrimitive = step(cursor, lastToken, false);
    if ((typeof potentialPrimitive !== "object" || potentialPrimitive === null || isNumeric(potentialPrimitive)) && !(potentialPrimitive instanceof BlueNode) && !Array.isArray(potentialPrimitive) && ["name", "description", "value", "blueId"].includes(lastToken)) {
      return {
        parent: cursor,
        key: lastToken,
        actualTarget: potentialPrimitive
      };
    }
  }
  if (Array.isArray(cursor) && lastToken === "-")
    return { parent: cursor, key: "-" };
  if (cursor instanceof BlueNode && cursor.getItems() && lastToken === "-")
    return { parent: cursor, key: "-" };
  return {
    parent: cursor,
    key: Array.isArray(cursor) ? asIndex(lastToken) : lastToken
  };
}
function read(parent, key2) {
  if (parent instanceof BlueNode) {
    const k3 = key2;
    const specialProp = _getBlueNodeSpecialProperty(parent, k3, false);
    if (specialProp !== void 0 || [
      "name",
      "description",
      "type",
      "itemType",
      "keyType",
      "valueType",
      "value",
      "blueId",
      "blue",
      "items",
      "properties",
      "contracts"
    ].includes(k3)) {
      return specialProp;
    }
    if (typeof key2 === "number" || typeof key2 === "string" && /^\d+$/.test(key2)) {
      const items = parent.getItems();
      const idx = typeof key2 === "number" ? key2 : parseInt(key2, 10);
      if (items && idx >= 0 && idx < items.length) return items[idx];
    }
    return parent.getProperties()?.[k3];
  }
  if (Array.isArray(parent)) return parent[key2];
  if (isDict(parent)) return parent[key2];
  return parent;
}
function nodeify(v4) {
  if (v4 instanceof BlueNode) return v4;
  if (v4 === null || typeof v4 === "string" || typeof v4 === "number" || typeof v4 === "boolean" || isNumeric(v4)) {
    return NodeDeserializer.deserialize(v4);
  }
  const cleanValue = cleanUndefinedValues(v4);
  return NodeDeserializer.deserialize(cleanValue);
}
function cleanUndefinedValues(obj) {
  if (obj === void 0) return null;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefinedValues);
  const cleaned = {};
  for (const [k3, val] of Object.entries(obj)) {
    cleaned[k3] = cleanUndefinedValues(val);
  }
  return cleaned;
}
function write(parent, key2, raw) {
  if (parent instanceof BlueNode) {
    const k3 = key2;
    switch (k3) {
      case "name":
        parent.setName(raw);
        return;
      case "description":
        parent.setDescription(raw);
        return;
      case "type":
        parent.setType(
          raw instanceof BlueNode || typeof raw === "string" || raw === void 0 ? raw : nodeify(raw)
        );
        return;
      case "itemType":
        parent.setItemType(
          raw instanceof BlueNode || typeof raw === "string" || raw === void 0 ? raw : nodeify(raw)
        );
        return;
      case "keyType":
        parent.setKeyType(
          raw instanceof BlueNode || typeof raw === "string" || raw === void 0 ? raw : nodeify(raw)
        );
        return;
      case "valueType":
        parent.setValueType(
          raw instanceof BlueNode || typeof raw === "string" || raw === void 0 ? raw : nodeify(raw)
        );
        return;
      case "value": {
        const prim = raw;
        parent.setValue(prim === void 0 ? null : prim);
        return;
      }
      case "blueId":
        parent.setBlueId(raw);
        return;
      case "blue":
        parent.setBlue(
          raw instanceof BlueNode || raw === void 0 ? raw : nodeify(raw)
        );
        return;
      case "items":
        parent.setItems(raw);
        return;
      case "properties":
        parent.setProperties(raw);
        return;
      case "contracts":
        parent.setContracts(raw);
        return;
      default: {
        if (raw === void 0) {
          const props = parent.getProperties();
          if (props && k3 in props) delete props[k3];
        } else {
          if (!parent.getProperties()) parent.setProperties({});
          parent.addProperty(k3, raw instanceof BlueNode ? raw : nodeify(raw));
        }
        return;
      }
    }
  }
  if (Array.isArray(parent)) {
    parent.splice(asIndex(key2), 1);
  } else if (isDict(parent)) {
    if (raw === void 0) delete parent[key2];
    else parent[key2] = raw;
  }
}
function _insertOrReplaceBlueNodeItem(blueNodeParent, key2, valueNode, overwrite) {
  let numKey = -1;
  if (key2 !== "-") {
    numKey = typeof key2 === "number" ? key2 : parseInt(key2, 10);
    if (isNaN(numKey))
      throw new Error(
        `Invalid numeric key for BlueNode item operation: ${key2}`
      );
  }
  if (numKey < -1)
    throw new Error(`Invalid array index for BlueNode items: ${numKey}`);
  let items = blueNodeParent.getItems();
  if (!items) {
    items = [];
    blueNodeParent.setItems(items);
  }
  if (!overwrite && numKey !== -1 && numKey > items.length) {
    throw new Error(
      `ADD operation failed: Target array index '${numKey}' is greater than array length ${items.length}.`
    );
  }
  if (key2 === "-") {
    items.push(valueNode);
  } else if (overwrite) {
    if (numKey >= 0) {
      if (numKey < items.length) items[numKey] = valueNode;
      else {
        for (let i2 = items.length; i2 < numKey; i2++)
          items.push(NodeDeserializer.deserialize(null));
        items.push(valueNode);
      }
    }
  } else {
    items.splice(numKey, 0, valueNode);
  }
}
function insert(parent, key2, rawVal, overwrite) {
  if (Array.isArray(parent)) {
    const idx = key2 === "-" ? parent.length : asIndex(key2);
    if (!overwrite && idx > parent.length) {
      throw new Error(
        `ADD operation failed: Target array index '${idx}' is greater than array length ${parent.length}. Path involving key '${key2}'.`
      );
    }
    if (idx < 0 && key2 !== "-")
      throw new Error(`Invalid negative array index: ${key2}`);
    const newNode = nodeify(rawVal);
    if (overwrite) {
      if (idx >= 0 && idx < parent.length) parent[idx] = newNode;
      else if (idx >= parent.length) {
        for (let i2 = parent.length; i2 < idx; i2++)
          parent.push(NodeDeserializer.deserialize(null));
        parent.push(newNode);
      }
    } else {
      parent.splice(idx, 0, newNode);
    }
    return;
  }
  if (parent instanceof BlueNode) {
    if (key2 === "-" || typeof key2 === "number" && !isNaN(key2) || typeof key2 === "string" && /^\d+$/.test(key2)) {
      _insertOrReplaceBlueNodeItem(parent, key2, nodeify(rawVal), overwrite);
    } else {
      write(parent, key2, rawVal);
    }
    return;
  }
  if (isDict(parent)) {
    parent[key2] = nodeify(rawVal);
    return;
  }
  throw new Error(`Cannot insert into parent of type ${typeof parent}`);
}
function remove(parent, key2) {
  if (Array.isArray(parent)) {
    const idx = asIndex(key2);
    if (idx === -1 && key2 === "-") {
      if (parent.length > 0) parent.pop();
    } else if (idx >= 0 && idx < parent.length) parent.splice(idx, 1);
    return;
  }
  if (parent instanceof BlueNode) {
    if (typeof key2 === "number" || typeof key2 === "string" && /^-?\d+$/.test(key2)) {
      const items = parent.getItems();
      if (items) {
        const idx = asIndex(key2);
        if (idx === -1 && key2 === "-") {
          if (items.length > 0) items.pop();
        } else if (idx >= 0 && idx < items.length) items.splice(idx, 1);
        if (items.length === 0) parent.setItems(void 0);
        return;
      }
    }
    write(parent, key2, void 0);
  } else if (isDict(parent)) {
    delete parent[key2];
  }
}
function deepClone(v4) {
  if (v4 instanceof BlueNode) return v4.clone();
  if (Array.isArray(v4)) {
    const arr = v4.map((item) => deepClone(item));
    return arr;
  }
  if (isDict(v4)) {
    const out = {};
    Object.keys(v4).forEach((k3) => {
      out[k3] = deepClone(v4[k3]);
    });
    return out;
  }
  return v4;
}
function deepEqual(a4, b3) {
  if (a4 === b3) return true;
  if (a4 instanceof BlueNode && (a4.isInlineValue() || a4.getValue() !== void 0)) {
    if (deepEqual(a4.getValue() ?? null, b3)) return true;
  }
  if (b3 instanceof BlueNode && (b3.isInlineValue() || b3.getValue() !== void 0)) {
    if (deepEqual(a4, b3.getValue() ?? null)) return true;
  }
  if (a4 instanceof BlueNode && b3 instanceof BlueNode) {
    return a4.toString() === b3.toString();
  }
  if (isNumeric(a4) && isNumeric(b3)) return a4.toString() === b3.toString();
  if (isNumeric(a4) && typeof b3 === "number")
    return a4.toString() === b3.toString();
  if (typeof a4 === "number" && isNumeric(b3))
    return a4.toString() === b3.toString();
  if (Array.isArray(a4) && Array.isArray(b3)) {
    return a4.length === b3.length && a4.every((e, i2) => deepEqual(e, b3[i2]));
  }
  if (isDict(a4) && isDict(b3)) {
    const ka = Object.keys(a4);
    const kb = Object.keys(b3);
    return ka.length === kb.length && ka.every((k3) => deepEqual(a4[k3], b3[k3]));
  }
  return false;
}
function readPath(root, path) {
  const { parent, key: key2 } = resolve(root, split(path));
  return read(parent, key2);
}
function writePath(root, path, raw) {
  const tokens = split(path);
  if (tokens.length === 0 && path === "/") {
    const newNode = nodeify(raw);
    root.setValue(newNode.getValue() ?? null);
    if (newNode.getItems()) {
      root.setItems(newNode.getItems());
    } else {
      root.setItems(void 0);
    }
    return;
  }
  const { parent, key: key2 } = resolve(root, tokens);
  insert(parent, key2, raw, true);
}

// libs/language/src/lib/utils/NodePatch/patch-operations.ts
function opAdd(root, path, raw) {
  const tokens = split(path);
  if (tokens.length === 0 && path === "/") {
    if (root.getItems() && Array.isArray(raw)) {
      const newRootContent = nodeify(raw);
      if (newRootContent.getItems()) {
        root.setItems(newRootContent.getItems());
        root.setValue(null);
      } else {
        root.setValue(newRootContent.getValue() ?? null);
        root.setItems(void 0);
      }
    } else {
      const newNode = nodeify(raw);
      root.setValue(newNode.getValue() ?? null);
      if (newNode.getItems()) root.setItems(newNode.getItems());
      else if (!(raw === null || typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" || isNumeric(raw))) {
      }
    }
    return true;
  }
  const { parent, key: key2 } = resolve(root, tokens);
  insert(parent, key2, raw, false);
  return true;
}
function opReplace(root, path, raw) {
  const tokens = split(path);
  if (tokens.length === 0 && path === "/") {
    const newNode = nodeify(raw);
    root.setValue(newNode.getValue() ?? null);
    if (newNode.getItems()) {
      root.setItems(newNode.getItems());
    } else {
      root.setItems(void 0);
    }
    return true;
  }
  const { parent, key: key2, actualTarget } = resolve(root, tokens);
  if (actualTarget !== void 0 && parent instanceof BlueNode) {
    write(parent, key2, raw);
  } else {
    const currentValue = read(parent, key2);
    const isArrayTarget = Array.isArray(parent) || parent instanceof BlueNode && parent.getItems() && (typeof key2 === "number" || typeof key2 === "string" && /^\d+$/.test(key2));
    if (currentValue === void 0) {
      if (isArrayTarget) {
        throw new Error(
          `REPLACE failed: Target array index '${key2.toString()}' is out of bounds or does not exist at path '${path}'.`
        );
      } else {
        insert(parent, key2, raw, true);
      }
    } else {
      insert(parent, key2, raw, true);
    }
  }
  return true;
}
function opRemove(root, path) {
  const tokens = split(path);
  if (tokens.length === 0 && path === "/") {
    root.setValue(null);
    root.setItems(void 0);
    root.setProperties(void 0);
    return true;
  }
  const { parent, key: key2 } = resolve(root, tokens);
  remove(parent, key2);
  return true;
}
function opCopy(root, from, to) {
  const cloned = deepClone(readPath(root, from));
  writePath(root, to, cloned);
  return true;
}
function opMove(root, from, to) {
  const fromTokens = split(from);
  const { parent: fromParent, key: fromKey } = resolve(root, fromTokens);
  const valueAtFrom = read(fromParent, fromKey);
  if (valueAtFrom === void 0) {
    throw new Error(`MOVE failed: 'from' location '${from}' does not exist.`);
  }
  if (opRemove(root, from)) {
    writePath(root, to, valueAtFrom);
    return true;
  }
  return false;
}
function opTest(root, path, expected) {
  const actual = readPath(root, path);
  let expectedToCompare = expected;
  if (actual instanceof BlueNode) {
    if ((expected === null || typeof expected === "string" || typeof expected === "number" || typeof expected === "boolean" || isNumeric(expected)) && (actual.isInlineValue() || actual.getValue() !== void 0)) {
      if (!deepEqual(actual.getValue() ?? null, expected)) {
        throw new Error(
          `TEST failed at '${path}': Expected ${JSON.stringify(
            expected
          )}, got ${JSON.stringify(actual.getValue() ?? null)}`
        );
      }
      return true;
    } else if (typeof expected === "object" && !(expected instanceof BlueNode)) {
      expectedToCompare = nodeify(expected);
    }
  } else if (isNumeric(actual) && typeof expected === "number") {
    if (actual instanceof BigIntegerNumber)
      expectedToCompare = new BigIntegerNumber(expected.toString());
    else if (actual instanceof BigDecimalNumber)
      expectedToCompare = new BigDecimalNumber(expected.toString());
  } else if ((actual === null || typeof actual === "string" || typeof actual === "number" || typeof actual === "boolean") && isNumeric(expected)) {
    const expectedNum = expected;
    if (!deepEqual(actual, expectedNum.toString()) && !(typeof actual === "number" && actual === parseFloat(expectedNum.toString()))) {
    }
  }
  if (!deepEqual(actual, expectedToCompare)) {
    const actualJson = actual instanceof BlueNode ? actual.toString() : JSON.stringify(actual);
    const expectedJson = expectedToCompare instanceof BlueNode ? expectedToCompare.toString() : JSON.stringify(expectedToCompare);
    throw new Error(
      `TEST failed at '${path}': Expected ${expectedJson}, got ${actualJson}`
    );
  }
  return true;
}

// libs/language/src/lib/utils/NodePatch/NodePatch.ts
function applySingle(root, p4) {
  switch (p4.op) {
    case "add":
      return opAdd(root, p4.path, p4.val);
    case "replace":
      return opReplace(root, p4.path, p4.val);
    case "remove":
      return opRemove(root, p4.path);
    case "copy":
      return opCopy(root, p4.from, p4.path);
    case "move":
      return opMove(root, p4.from, p4.path);
    case "test":
      return opTest(root, p4.path, p4.val);
  }
}
function applyBlueNodePatch(root, patch, mutateOriginal = false) {
  const base2 = mutateOriginal ? root : root.clone();
  applySingle(base2, patch);
  return base2;
}

// libs/language/src/schema/annotations/annotations.ts
var SCHEMA_ANNOTATIONS_KEY = Symbol.for("zod-schema-annotations");
function getGlobalObject() {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof global !== "undefined") return global;
  if (typeof window !== "undefined") return window;
  if (typeof self !== "undefined") return self;
  throw new Error("Unable to locate global object");
}
function getGlobalSchemaAnnotations() {
  const globalObj = getGlobalObject();
  if (!(SCHEMA_ANNOTATIONS_KEY in globalObj)) {
    globalObj[SCHEMA_ANNOTATIONS_KEY] = /* @__PURE__ */ new WeakMap();
  }
  return globalObj[SCHEMA_ANNOTATIONS_KEY];
}
function setAnnotations(schema2, annotations) {
  const annotationsMap = getGlobalSchemaAnnotations();
  const existing = annotationsMap.get(schema2) || {};
  annotationsMap.set(schema2, { ...existing, ...annotations });
  return schema2;
}
var getAnnotations = (schema2) => {
  return getGlobalSchemaAnnotations().get(schema2);
};

// libs/language/src/schema/annotations/blueDescription.ts
var getBlueDescriptionAnnotation = (schema2) => {
  const annotations = getAnnotations(schema2);
  if (g(annotations) && isString(annotations.blueDescription)) {
    return annotations.blueDescription;
  }
  return null;
};

// libs/language/src/schema/annotations/blueId.ts
var blueIdAnnotation = z.union([z.string(), z.boolean()]);
var getBlueIdAnnotation = (schema2) => {
  const annotations = getAnnotations(schema2);
  const result = blueIdAnnotation.safeParse(annotations?.blueId);
  if (result.success) {
    return result.data;
  }
  return null;
};

// libs/language/src/schema/annotations/blueName.ts
var getBlueNameAnnotation = (schema2) => {
  const annotations = getAnnotations(schema2);
  if (g(annotations) && isString(annotations.blueName)) {
    return annotations.blueName;
  }
  return null;
};

// libs/language/src/schema/annotations/blueNode.ts
var withBlueNode = () => (schema2) => {
  const annotations = getAnnotations(schema2);
  return setAnnotations(schema2, {
    ...annotations,
    blueNode: true
  });
};
var getBlueNodeAnnotation = (schema2) => {
  const annotations = getAnnotations(schema2);
  if (g(annotations) && g(annotations.blueNode) && annotations.blueNode === true) {
    return annotations.blueNode;
  }
  return null;
};
var isBlueNodeSchema = (schema2) => {
  return !!getBlueNodeAnnotation(schema2);
};
var blueNodeField = () => {
  const blueNodeFieldSchema = z.instanceof(BlueNode);
  return withBlueNode()(blueNodeFieldSchema);
};

// libs/language/src/schema/annotations/extends.ts
var key = "extendedFrom";
var withExtendedFromSchema = ({
  schema: schema2,
  baseSchema
}) => {
  const currentAnnotations = getAnnotations(schema2) || {};
  return setAnnotations(schema2, {
    ...currentAnnotations,
    [key]: baseSchema
  });
};
var getExtendedFromSchemaAnnotation = (schema2) => {
  const annotations = getAnnotations(schema2);
  if (g(annotations) && annotations[key]) {
    return annotations[key];
  }
  return null;
};
var isSchemaExtendedFrom = (schema2, baseSchema) => {
  const extendedFrom = getExtendedFromSchemaAnnotation(schema2);
  if (R(extendedFrom)) {
    return false;
  }
  if (extendedFrom?._def === baseSchema?._def) {
    return true;
  }
  return isSchemaExtendedFrom(extendedFrom, baseSchema);
};

// libs/language/src/schema/annotations/typeBlueId/proxySchema.ts
var proxySchema = (schema2) => {
  return new Proxy(schema2, {
    get(target, prop, receiver) {
      if (prop === "extend") {
        return function(...args) {
          const extendedSchema = target.extend(...args);
          return withExtendedFromSchema({
            schema: extendedSchema,
            baseSchema: target
          });
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  });
};

// libs/language/src/schema/annotations/typeBlueId/typeBlueId.ts
var typeBlueIdAnnotation = z.object({
  value: z.array(z.string()).optional(),
  defaultValue: z.string().optional()
});
var getTypeBlueIdAnnotation = (schema2) => {
  const annotations = getAnnotations(schema2);
  const result = typeBlueIdAnnotation.passthrough().safeParse(annotations?.typeBlueId);
  if (!result.success) {
    return null;
  }
  return result.data;
};
var withTypeBlueId = (value) => (schema2) => {
  const annotations = getAnnotations(schema2);
  const typeBlueIdAnnotation2 = typeof value === "string" ? { value: [value] } : value;
  const proxiedSchema = proxySchema(schema2);
  return setAnnotations(proxiedSchema, {
    ...annotations,
    typeBlueId: {
      ...annotations?.typeBlueId || {},
      ...typeBlueIdAnnotation2
    }
  });
};

// libs/language/src/lib/utils/BlueIdResolver.ts
var BlueIdResolver = class _BlueIdResolver {
  static resolveBlueId(schema2) {
    const typeBlueIdAnnotation2 = getTypeBlueIdAnnotation(schema2);
    if (R(typeBlueIdAnnotation2)) {
      return null;
    }
    const defaultValue = typeBlueIdAnnotation2.defaultValue;
    if (g(defaultValue)) {
      return defaultValue;
    }
    const value = typeBlueIdAnnotation2.value?.[0];
    if (g(value)) {
      return value;
    }
    return _BlueIdResolver.getRepositoryBlueId(typeBlueIdAnnotation2, schema2);
  }
  static getRepositoryBlueId(annotation, schema2) {
    throw new Error("Not implemented");
    return null;
  }
};

// libs/language/src/lib/utils/TypeSchema.ts
var BlueNodeTypeSchema = class _BlueNodeTypeSchema {
  // TODO: Enhance to support schemas associated with multiple blueIds
  static isTypeOf(node, schema2, options3) {
    const schemaBlueId = BlueIdResolver.resolveBlueId(schema2);
    const nodeTypeBlueId = node.getType()?.getBlueId();
    if (R(schemaBlueId) || R(nodeTypeBlueId)) {
      return false;
    }
    if (schemaBlueId === nodeTypeBlueId) {
      return true;
    }
    if (options3?.checkSchemaExtensions && g(options3.typeSchemaResolver)) {
      const resolvedSchema = options3.typeSchemaResolver.resolveSchema(node);
      return _BlueNodeTypeSchema.checkSchemaExtension(resolvedSchema, schema2);
    }
    return false;
  }
  /**
   * Checks if a schema extends a base schema.
   */
  static checkSchemaExtension(extendedSchema, baseSchema) {
    if (!g(extendedSchema)) {
      return false;
    }
    const unwrappedExtendedSchema = _BlueNodeTypeSchema.unwrapSchema(extendedSchema);
    const unwrappedBaseSchema = _BlueNodeTypeSchema.unwrapSchema(baseSchema);
    return isSchemaExtendedFrom(unwrappedExtendedSchema, unwrappedBaseSchema);
  }
  static isWrapperType(schema2) {
    return schema2 instanceof ZodOptional || schema2 instanceof ZodNullable || schema2 instanceof ZodReadonly || schema2 instanceof ZodBranded || schema2 instanceof ZodEffects || schema2 instanceof ZodLazy;
  }
  static unwrapSchema(schema2) {
    if (isBlueNodeSchema(schema2)) {
      return schema2;
    }
    if (_BlueNodeTypeSchema.isWrapperType(schema2)) {
      if (schema2 instanceof ZodEffects) {
        return _BlueNodeTypeSchema.unwrapSchema(schema2.innerType());
      }
      if (schema2 instanceof ZodLazy) {
        return _BlueNodeTypeSchema.unwrapSchema(schema2.schema);
      }
      return _BlueNodeTypeSchema.unwrapSchema(schema2.unwrap());
    }
    return schema2;
  }
};

// libs/language/src/lib/utils/TypeSchemaResolver.ts
var TypeSchemaResolver = class {
  constructor(schemas) {
    __publicField(this, "blueIdMap", /* @__PURE__ */ new Map());
    this.registerSchemas(schemas);
  }
  registerSchemas(schemas) {
    for (const schema2 of schemas) {
      this.registerSchema(schema2);
    }
  }
  registerSchema(schema2) {
    const blueId = BlueIdResolver.resolveBlueId(schema2);
    if (g(blueId)) {
      if (this.blueIdMap.has(blueId)) {
        throw new Error(`Duplicate BlueId value: ${blueId}`);
      }
      this.blueIdMap.set(blueId, schema2);
    }
  }
  resolveSchema(node) {
    const blueId = this.getEffectiveBlueId(node);
    if (R(blueId)) {
      return null;
    }
    return this.blueIdMap.get(blueId);
  }
  getEffectiveBlueId(node) {
    const nodeType = node.getType();
    if (g(nodeType) && g(nodeType.getBlueId())) {
      return nodeType.getBlueId();
    } else if (g(nodeType)) {
      return BlueIdCalculator.calculateBlueIdSync(nodeType);
    }
    return null;
  }
  getBlueIdMap() {
    return new Map(this.blueIdMap);
  }
};

// libs/language/src/lib/utils/Nodes.ts
var NODE_FIELDS = {
  NAME: "name",
  DESCRIPTION: "description",
  TYPE: "type",
  BLUE_ID: "blue_id",
  KEY_TYPE: "key_type",
  VALUE_TYPE: "value_type",
  ITEM_TYPE: "item_type",
  VALUE: "value",
  PROPERTIES: "properties",
  BLUE: "blue",
  ITEMS: "items"
};
var Nodes = class {
  /**
   * Check if a node is empty (has no fields set)
   */
  static isEmptyNode(node) {
    return this.hasFieldsAndMayHaveFields(node);
  }
  /**
   * Check if a node has only a Blue ID
   */
  static hasBlueIdOnly(node) {
    return this.hasFieldsAndMayHaveFields(node, /* @__PURE__ */ new Set([NODE_FIELDS.BLUE_ID]));
  }
  /**
   * Check if a node has only items
   */
  static hasItemsOnly(node) {
    return this.hasFieldsAndMayHaveFields(node, /* @__PURE__ */ new Set([NODE_FIELDS.ITEMS]));
  }
  /**
   * Check if a node is a valid value node (has a value, no properties, no items)
   * @param node - The node to check
   * @returns true if the node is a valid value node
   */
  static isValidValueNode(node) {
    const value = node.getValue();
    const properties = node.getProperties();
    const items = node.getItems();
    return g(value) && R(properties) && R(items);
  }
  /**
   * Create a text node
   */
  static textNode(text) {
    return new BlueNode().setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID)).setValue(text);
  }
  /**
   * Create an integer node
   */
  static integerNode(number) {
    const value = number instanceof BigIntegerNumber ? number : new BigIntegerNumber(number.toString());
    return new BlueNode().setType(new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID)).setValue(value);
  }
  /**
   * Create a double node
   */
  static doubleNode(number) {
    const value = number instanceof BigDecimalNumber ? number : new BigDecimalNumber(number.toString());
    return new BlueNode().setType(new BlueNode().setBlueId(DOUBLE_TYPE_BLUE_ID)).setValue(value);
  }
  /**
   * Create a boolean node
   */
  static booleanNode(booleanValue) {
    return new BlueNode().setType(new BlueNode().setBlueId(BOOLEAN_TYPE_BLUE_ID)).setValue(booleanValue);
  }
  /**
   * Check if a node has exactly the specified fields
   * @param node - The node to check
   * @param mustHaveFields - Fields that must be present
   * @param mayHaveFields - Fields that may be present
   * @returns true if the node matches the field requirements
   */
  static hasFieldsAndMayHaveFields(node, mustHaveFields = /* @__PURE__ */ new Set(), mayHaveFields = /* @__PURE__ */ new Set()) {
    for (const field of Object.values(NODE_FIELDS)) {
      const fieldIsPresent = g(this.getFieldValue(node, field));
      if (mustHaveFields.has(field)) {
        if (!fieldIsPresent) return false;
      } else if (mayHaveFields.has(field)) {
      } else {
        if (fieldIsPresent) return false;
      }
    }
    return true;
  }
  /**
   * Get the value of a field from a node
   */
  static getFieldValue(node, field) {
    switch (field) {
      case NODE_FIELDS.NAME:
        return node.getName();
      case NODE_FIELDS.TYPE:
        return node.getType();
      case NODE_FIELDS.VALUE:
        return node.getValue();
      case NODE_FIELDS.DESCRIPTION:
        return node.getDescription();
      case NODE_FIELDS.PROPERTIES:
        return node.getProperties();
      case NODE_FIELDS.BLUE:
        return node.getBlue();
      case NODE_FIELDS.ITEMS:
        return node.getItems();
      case NODE_FIELDS.KEY_TYPE:
        return node.getKeyType();
      case NODE_FIELDS.VALUE_TYPE:
        return node.getValueType();
      case NODE_FIELDS.ITEM_TYPE:
        return node.getItemType();
      case NODE_FIELDS.BLUE_ID:
        return node.getBlueId();
      default:
        throw new Error(`Unknown field: ${field}`);
    }
  }
};

// libs/language/src/lib/utils/limits/Limits.ts
var Limits = class {
};

// libs/language/src/lib/utils/limits/NodeToPathLimitsConverter.ts
var NodeToPathLimitsConverter = class _NodeToPathLimitsConverter {
  static convert(node) {
    const builder = new PathLimitsBuilder();
    _NodeToPathLimitsConverter.traverseNode(node, "", builder);
    return builder.build();
  }
  static traverseNode(node, currentPath, builder) {
    if (!node) {
      return;
    }
    const props = node.getProperties();
    const items = node.getItems();
    const hasProps = props !== void 0 && Object.keys(props).length > 0;
    const hasItems = items !== void 0 && items.length > 0;
    if (!hasProps && !hasItems) {
      builder.addPath(currentPath === "" ? "/" : currentPath);
      return;
    }
    if (props) {
      for (const [key2, value] of Object.entries(props)) {
        const newPath = `${currentPath}/${key2}`;
        _NodeToPathLimitsConverter.traverseNode(value, newPath, builder);
      }
    }
    if (items) {
      for (let i2 = 0; i2 < items.length; i2++) {
        const newPath = `${currentPath}/${i2}`;
        _NodeToPathLimitsConverter.traverseNode(items[i2], newPath, builder);
      }
    }
  }
};

// libs/language/src/lib/utils/limits/PathLimits.ts
function javaLikeSplit(input, delimiter) {
  const parts = input.split(delimiter);
  const reversedIndex = [...parts].reverse().findIndex((part) => part !== "");
  const cutoff = reversedIndex === -1 ? 0 : parts.length - reversedIndex;
  return parts.slice(0, cutoff);
}
var PathLimits2 = class extends Limits {
  /**
   * Creates path limits with the specified paths and max depth
   * @param allowedPaths - The paths to limit extension to
   * @param maxDepth - The maximum depth of paths to allow
   */
  constructor(allowedPaths, maxDepth) {
    super();
    __publicField(this, "allowedPaths");
    __publicField(this, "maxDepth");
    __publicField(this, "currentPath", []);
    this.allowedPaths = allowedPaths;
    this.maxDepth = maxDepth;
  }
  /**
   * Determines if a path segment should be extended
   * @param pathSegment - The path segment
   * @returns True if the segment should be extended, false otherwise
   */
  shouldExtendPathSegment(pathSegment) {
    if (this.currentPath.length >= this.maxDepth) {
      return false;
    }
    const potentialPath = this.normalizePath(
      this.getCurrentFullPath() + "/" + pathSegment
    );
    return this.isAllowedPath(potentialPath);
  }
  /**
   * Determines if a path segment should be merged
   * @param pathSegment - The path segment
   * @returns True if the segment should be merged, false otherwise
   */
  shouldMergePathSegment(pathSegment) {
    return this.shouldExtendPathSegment(pathSegment);
  }
  /**
   * Checks if a path is allowed
   * @param path - The path to check
   * @returns True if the path is allowed, false otherwise
   */
  isAllowedPath(path) {
    for (const allowedPath of this.allowedPaths) {
      if (this.matchesAllowedPath(allowedPath, path)) {
        return true;
      }
    }
    return false;
  }
  /**
   * Checks if a path matches an allowed path pattern
   * @param allowedPath - The allowed path pattern
   * @param path - The path to check
   * @returns True if the path matches the allowed path pattern, false otherwise
   */
  matchesAllowedPath(allowedPath, path) {
    const allowedParts = javaLikeSplit(allowedPath, "/");
    const pathParts = javaLikeSplit(path, "/");
    if (pathParts.length > allowedParts.length) {
      return false;
    }
    for (let i2 = 1; i2 < pathParts.length; i2++) {
      if (allowedParts[i2] !== "*" && allowedParts[i2] !== pathParts[i2]) {
        return false;
      }
    }
    return true;
  }
  /**
   * Enters a path segment
   * @param pathSegment - The path segment
   */
  enterPathSegment(pathSegment) {
    this.currentPath.push(pathSegment);
  }
  /**
   * Exits a path segment
   */
  exitPathSegment() {
    if (this.currentPath.length > 0) {
      this.currentPath.pop();
    }
  }
  /**
   * Gets the current full path
   * @returns The current full path
   */
  getCurrentFullPath() {
    return "/" + this.currentPath.join("/");
  }
  /**
   * Normalizes a path
   * @param path - The path to normalize
   * @returns The normalized path
   */
  normalizePath(path) {
    return "/" + path.split("/").filter((s3) => s3 !== "").join("/");
  }
  /**
   * Creates path limits with a maximum depth
   * @param maxDepth - The maximum depth
   * @returns The path limits
   */
  static withMaxDepth(maxDepth) {
    const builder = new PathLimitsBuilder().setMaxDepth(maxDepth);
    for (let i2 = 1; i2 <= maxDepth; i2++) {
      const pattern = "/" + Array(i2).fill("*").join("/");
      builder.addPath(pattern);
    }
    return builder.build();
  }
  /**
   * Creates path limits with a single path
   * @param path - The path to limit extension to
   * @returns The path limits
   */
  static withSinglePath(path) {
    return new PathLimitsBuilder().addPath(path).build();
  }
  /**
   * Creates path limits by analyzing the structure of a node.
   * Leaf paths (no properties and no items) are added as allowed paths.
   */
  static fromNode(node) {
    return NodeToPathLimitsConverter.convert(node);
  }
};
var PathLimitsBuilder = class {
  constructor() {
    __publicField(this, "allowedPaths", /* @__PURE__ */ new Set());
    __publicField(this, "maxDepth", Number.MAX_SAFE_INTEGER);
  }
  /**
   * Adds a path to the allowed paths
   * @param path - The path to add
   * @returns The builder
   */
  addPath(path) {
    this.allowedPaths.add(path);
    return this;
  }
  /**
   * Sets the maximum depth
   * @param maxDepth - The maximum depth
   * @returns The builder
   */
  setMaxDepth(maxDepth) {
    this.maxDepth = maxDepth;
    return this;
  }
  /**
   * Builds the PathLimits
   * @returns The built PathLimits
   */
  build() {
    return new PathLimits2(this.allowedPaths, this.maxDepth);
  }
};

// libs/language/src/lib/utils/limits/NoLimits.ts
var NoLimits = class extends Limits {
  /**
   * Determines if a path segment should be extended - always returns true
   * @returns Always true
   */
  shouldExtendPathSegment() {
    return true;
  }
  /**
   * Determines if a path segment should be merged - always returns true
   * @returns Always true
   */
  shouldMergePathSegment() {
    return true;
  }
  /**
   * Enters a path segment - no-op
   */
  enterPathSegment() {
  }
  /**
   * Exits a path segment - no-op
   */
  exitPathSegment() {
  }
};

// libs/language/src/lib/utils/limits/CompositeLimits.ts
var CompositeLimits = class _CompositeLimits extends Limits {
  /**
   * Creates a composite limits with the specified limit strategies
   * @param limits - Array of Limits implementations to combine
   */
  constructor(limits) {
    super();
    __publicField(this, "limits");
    this.limits = limits;
  }
  /**
   * Determines if a path segment should be extended
   * All limits must return true for the extension to be allowed
   * @param pathSegment - The path segment
   * @param currentNode - The current node
   * @returns True if all limits allow extension, false otherwise
   */
  shouldExtendPathSegment(pathSegment, currentNode) {
    return this.limits.every(
      (limit) => limit.shouldExtendPathSegment(pathSegment, currentNode)
    );
  }
  /**
   * Determines if a path segment should be merged
   * All limits must return true for the merge to be allowed
   * @param pathSegment - The path segment
   * @param currentNode - The current node
   * @returns True if all limits allow merging, false otherwise
   */
  shouldMergePathSegment(pathSegment, currentNode) {
    return this.limits.every(
      (limit) => limit.shouldMergePathSegment(pathSegment, currentNode)
    );
  }
  /**
   * Enters a path segment for all limits
   * @param pathSegment - The path segment
   * @param currentNode - The current node (optional)
   */
  enterPathSegment(pathSegment, currentNode) {
    this.limits.forEach((limit) => {
      limit.enterPathSegment(pathSegment, currentNode);
    });
  }
  /**
   * Exits a path segment for all limits
   */
  exitPathSegment() {
    this.limits.forEach((limit) => {
      limit.exitPathSegment();
    });
  }
  /**
   * Creates a composite limits from multiple limit instances
   * @param limits - The limits to combine
   * @returns A new CompositeLimits instance
   */
  static of(...limits) {
    return new _CompositeLimits(limits);
  }
};

// libs/language/src/lib/utils/limits/index.ts
var NO_LIMITS = new NoLimits();

// libs/language/src/lib/utils/NodeTypes.ts
var NodeTypes_exports = {};
__export(NodeTypes_exports, {
  findBasicTypeName: () => findBasicTypeName,
  isBasicType: () => isBasicType,
  isBooleanType: () => isBooleanType,
  isDictionaryType: () => isDictionaryType,
  isIntegerType: () => isIntegerType,
  isListType: () => isListType,
  isNumberType: () => isNumberType,
  isSubtype: () => isSubtype,
  isSubtypeOfBasicType: () => isSubtypeOfBasicType,
  isTextType: () => isTextType
});
function getType(node, nodeProvider) {
  const type2 = node.getType();
  if (type2 === void 0) {
    return void 0;
  }
  const typeBlueId = type2.getBlueId();
  if (typeBlueId !== void 0) {
    if (CORE_TYPE_BLUE_IDS.includes(
      typeBlueId
    )) {
      const typeName = CORE_TYPE_BLUE_ID_TO_NAME_MAP[typeBlueId];
      return new BlueNode().setBlueId(typeBlueId).setName(typeName);
    }
    const typeNodes = nodeProvider.fetchByBlueId(typeBlueId);
    if (!typeNodes || typeNodes.length === 0) {
      return void 0;
    }
    if (typeNodes.length > 1) {
      throw new Error(
        `Expected a single node for type with blueId '${typeBlueId}', but found multiple.`
      );
    }
    return typeNodes[0];
  }
  return type2;
}
function isSubtype(subtype, supertype, nodeProvider) {
  const subtypeBlueId = BlueIdCalculator.calculateBlueIdSync(subtype);
  const supertypeBlueId = BlueIdCalculator.calculateBlueIdSync(supertype);
  if (subtypeBlueId === supertypeBlueId) {
    return true;
  }
  if (subtypeBlueId && CORE_TYPE_BLUE_IDS.includes(
    subtypeBlueId
  )) {
    let current2 = supertype;
    while (current2 !== void 0) {
      const currentBlueId = BlueIdCalculator.calculateBlueIdSync(current2);
      if (currentBlueId === subtypeBlueId) {
        return true;
      }
      current2 = getType(current2, nodeProvider);
    }
    return false;
  }
  let current = getType(subtype, nodeProvider);
  while (current !== void 0) {
    const blueId = BlueIdCalculator.calculateBlueIdSync(current);
    if (blueId === supertypeBlueId) {
      return true;
    }
    current = getType(current, nodeProvider);
  }
  return false;
}
function isBasicType(type2, nodeProvider) {
  return BASIC_TYPE_BLUE_IDS.some((blueId) => {
    const basicTypeNode = new BlueNode().setBlueId(blueId);
    return isSubtype(type2, basicTypeNode, nodeProvider);
  });
}
function isTextType(type2, nodeProvider) {
  const textTypeNode = new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID);
  return isSubtype(type2, textTypeNode, nodeProvider);
}
function isIntegerType(type2, nodeProvider) {
  const integerTypeNode = new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID);
  return isSubtype(type2, integerTypeNode, nodeProvider);
}
function isNumberType(type2, nodeProvider) {
  const numberTypeNode = new BlueNode().setBlueId(DOUBLE_TYPE_BLUE_ID);
  return isSubtype(type2, numberTypeNode, nodeProvider);
}
function isBooleanType(type2, nodeProvider) {
  const booleanTypeNode = new BlueNode().setBlueId(BOOLEAN_TYPE_BLUE_ID);
  return isSubtype(type2, booleanTypeNode, nodeProvider);
}
function isListType(type2) {
  return type2?.getBlueId() === LIST_TYPE_BLUE_ID;
}
function isDictionaryType(type2) {
  return type2?.getBlueId() === DICTIONARY_TYPE_BLUE_ID;
}
function isSubtypeOfBasicType(type2, nodeProvider) {
  return BASIC_TYPES.some((basicTypeName) => {
    const basicTypeNode = new BlueNode().setName(basicTypeName);
    return isSubtype(type2, basicTypeNode, nodeProvider);
  });
}
function findBasicTypeName(type2, nodeProvider) {
  for (const basicTypeName of BASIC_TYPES) {
    const basicTypeNode = new BlueNode().setName(basicTypeName);
    if (isSubtype(type2, basicTypeNode, nodeProvider)) {
      return basicTypeName;
    }
  }
  throw new Error(
    `Cannot determine the basic type for node of type "${type2.getName() || "unknown"}".`
  );
}

// libs/language/src/lib/utils/NodeTypeMatcher.ts
var NodeTypeMatcher = class {
  constructor(blue2) {
    __publicField(this, "blue");
    this.blue = blue2;
  }
  matchesType(node, targetType, globalLimits = NO_LIMITS) {
    const quickTargetType = targetType.getType();
    if (this.matchesImplicitStructure(node, quickTargetType)) {
      return true;
    }
    const pathLimits = PathLimits2.fromNode(targetType);
    const compositeLimits = CompositeLimits.of(globalLimits, pathLimits);
    const resolvedNode = this.extendAndResolve(node, compositeLimits);
    const resolvedType = this.blue.resolve(targetType, compositeLimits);
    return this.verifyMatch(resolvedNode, targetType, compositeLimits) && this.recursiveValueComparison(resolvedNode, resolvedType);
  }
  /**
   * Resolves a node with the runtime while preserving any structure that could
   * be dropped during resolution (items, properties, identifiers, values).
   */
  extendAndResolve(node, limits) {
    const originalClone = node.clone();
    const extendedClone = originalClone.clone();
    this.blue.extend(extendedClone, limits);
    const resolved = this.blue.resolve(extendedClone, limits);
    this.restoreMissingStructure(resolved, originalClone);
    return resolved;
  }
  /**
   * Recursively copies structural information from the original node to the
   * resolved node so comparisons can still see user-provided shape data.
   */
  restoreMissingStructure(target, source) {
    const sourceItems = source.getItems();
    const targetItems = target.getItems();
    if (sourceItems && sourceItems.length > 0) {
      if (!targetItems || targetItems.length === 0) {
        target.setItems(sourceItems.map((item) => item.clone()));
      } else {
        for (let i2 = 0; i2 < Math.min(targetItems.length, sourceItems.length); i2++) {
          this.restoreMissingStructure(targetItems[i2], sourceItems[i2]);
        }
      }
    }
    const sourceProps = source.getProperties();
    if (sourceProps) {
      let targetProps = target.getProperties();
      if (!targetProps) {
        targetProps = {};
        target.setProperties(targetProps);
      }
      for (const [key2, value] of Object.entries(sourceProps)) {
        const targetValue = targetProps[key2];
        if (targetValue === void 0) {
          targetProps[key2] = value.clone();
        } else {
          this.restoreMissingStructure(targetValue, value);
        }
      }
    }
    const sourceBlueId = source.getBlueId();
    if (target.getBlueId() === void 0 && sourceBlueId !== void 0) {
      target.setBlueId(sourceBlueId);
    }
    const sourceValue = source.getValue();
    if (target.getValue() === void 0 && sourceValue !== void 0) {
      target.setValue(sourceValue);
    }
  }
  verifyMatch(resolvedNode, targetType, limits) {
    const targetTypeType = targetType.getType();
    if (this.matchesImplicitStructure(resolvedNode, targetTypeType)) {
      return true;
    }
    const testNode = resolvedNode.clone().setType(targetType.clone());
    try {
      this.blue.resolve(testNode, limits);
    } catch {
      return false;
    }
    return true;
  }
  recursiveValueComparison(node, targetType) {
    const targetTypeType = targetType.getType();
    const isImplicitStructureMatch = this.matchesImplicitStructure(
      node,
      targetTypeType
    );
    if (targetTypeType && !isImplicitStructureMatch) {
      const nodeType = node.getType();
      if (!nodeType) {
        return false;
      }
      if (!NodeTypes_exports.isSubtype(
        nodeType,
        targetTypeType,
        this.blue.getNodeProvider()
      )) {
        return false;
      }
    }
    const targetBlueId = targetType.getBlueId();
    if (!isImplicitStructureMatch) {
      if (targetBlueId !== void 0) {
        const nodeBlueId = node.getBlueId();
        const nodeTypeBlueId = node.getType()?.getBlueId();
        if (nodeBlueId !== void 0) {
          if (targetBlueId !== nodeBlueId) {
            return false;
          }
        } else {
          if (nodeTypeBlueId === void 0) {
            return false;
          }
          if (targetBlueId !== nodeTypeBlueId) {
            return false;
          }
        }
      }
    }
    const targetValue = targetType.getValue();
    if (targetValue !== void 0) {
      const nodeValue = node.getValue();
      if (nodeValue === void 0) {
        return false;
      }
      if (isBigNumber(nodeValue) && isBigNumber(targetValue)) {
        if (!nodeValue.eq(targetValue)) {
          return false;
        }
      } else if (nodeValue !== targetValue) {
        return false;
      }
    }
    const targetItems = targetType.getItems();
    if (targetItems !== void 0) {
      const nodeItems = node.getItems() ?? [];
      for (let i2 = 0; i2 < targetItems.length; i2++) {
        if (i2 < nodeItems.length) {
          if (!this.recursiveValueComparison(nodeItems[i2], targetItems[i2])) {
            return false;
          }
        } else {
          if (this.hasValueInNestedStructure(targetItems[i2])) {
            return false;
          }
        }
      }
    }
    const targetItemType = targetType.getItemType();
    if (targetItemType !== void 0) {
      const nodeItems = node.getItems() ?? [];
      for (const item of nodeItems) {
        if (!this.recursiveValueComparison(item, targetItemType)) {
          return false;
        }
      }
    }
    const targetProps = targetType.getProperties();
    if (targetProps !== void 0) {
      const nodeProps = node.getProperties() ?? {};
      for (const [key2, value] of Object.entries(targetProps)) {
        if (key2 in nodeProps) {
          if (!this.recursiveValueComparison(nodeProps[key2], value)) {
            return false;
          }
        } else {
          if (this.hasValueInNestedStructure(value)) {
            return false;
          }
        }
      }
    }
    const targetValueType = targetType.getValueType();
    if (targetValueType !== void 0) {
      const nodeProps = Object.values(node.getProperties() ?? {});
      for (const value of nodeProps) {
        if (!this.recursiveValueComparison(value, targetValueType)) {
          return false;
        }
      }
    }
    return true;
  }
  hasValueInNestedStructure(node) {
    if (node.getValue() !== void 0) {
      return true;
    }
    const items = node.getItems();
    if (items !== void 0) {
      for (const item of items) {
        if (this.hasValueInNestedStructure(item)) {
          return true;
        }
      }
    }
    const props = node.getProperties();
    if (props !== void 0) {
      for (const prop of Object.values(props)) {
        if (this.hasValueInNestedStructure(prop)) {
          return true;
        }
      }
    }
    return false;
  }
  /**
   * Determines whether a node without an explicit type already satisfies the
   * shape of the requested core list or dictionary type.
   */
  matchesImplicitStructure(node, targetTypeType) {
    if (targetTypeType === void 0 || node.getType() !== void 0) {
      return false;
    }
    if (NodeTypes_exports.isListType(targetTypeType)) {
      return this.isImplicitListStructure(node);
    }
    if (NodeTypes_exports.isDictionaryType(targetTypeType)) {
      return this.isImplicitDictionaryStructure(node);
    }
    return false;
  }
  isImplicitListStructure(node) {
    return node.getItems() !== void 0 && node.getValue() === void 0;
  }
  isImplicitDictionaryStructure(node) {
    return node.getProperties() !== void 0 && node.getValue() === void 0;
  }
};

// libs/language/src/schema/utils.ts
var isWrapperType = (schema2) => {
  return schema2 instanceof ZodOptional || schema2 instanceof ZodNullable || schema2 instanceof ZodReadonly || schema2 instanceof ZodBranded || schema2 instanceof ZodEffects || schema2 instanceof ZodLazy;
};
var isPrimitiveType = (schema2) => {
  return schema2 instanceof ZodString || schema2 instanceof ZodNumber || schema2 instanceof ZodBoolean || schema2 instanceof ZodBigInt;
};

// libs/language/src/lib/mapping/ValueConverter.ts
var ValueConverter = class {
  static convertValue(node, targetSchema) {
    const typeBlueId = node.getType()?.getBlueId();
    const value = node.getValue();
    if (R(value)) {
      if (isPrimitiveType(targetSchema) && Nodes.isValidValueNode(node)) {
        return this.getDefaultPrimitiveValue(targetSchema);
      }
      return value;
    }
    if (TEXT_TYPE_BLUE_ID === typeBlueId) {
      return this.convertFromString(String(value), targetSchema);
    } else if (DOUBLE_TYPE_BLUE_ID === typeBlueId || value instanceof BigDecimalNumber) {
      return this.convertFromBigDecimal(
        new BigDecimalNumber(value?.toString()),
        targetSchema
      );
    } else if (INTEGER_TYPE_BLUE_ID === typeBlueId || value instanceof BigIntegerNumber) {
      return this.convertFromBigInteger(
        new BigIntegerNumber(value?.toString()),
        targetSchema
      );
    } else if (BOOLEAN_TYPE_BLUE_ID === typeBlueId || typeof value === "boolean") {
      return this.convertFromBoolean(Boolean(value), targetSchema);
    }
    return this.convertFromString(String(value), targetSchema);
  }
  static convertFromString(value, targetSchema) {
    if (!targetSchema) return value;
    if (targetSchema instanceof ZodString || targetSchema instanceof ZodEnum || targetSchema instanceof ZodNativeEnum) {
      return value;
    }
    if (targetSchema instanceof ZodNumber) {
      return Number(value);
    }
    if (targetSchema instanceof ZodBoolean) {
      return value.toLowerCase() === "true";
    }
    if (targetSchema instanceof ZodBigInt) {
      return BigInt(value);
    }
    throw new Error(`Cannot convert String to ${targetSchema._def.typeName}`);
  }
  static convertFromBigDecimal(value, targetSchema) {
    if (targetSchema instanceof ZodNumber) {
      return value.toNumber();
    }
    if (targetSchema instanceof ZodString) {
      return value.toString();
    }
    throw new Error(`Cannot convert Number to ${targetSchema._def.typeName}`);
  }
  static convertFromBigInteger(value, targetSchema) {
    if (targetSchema instanceof ZodNumber) {
      return value.toNumber();
    }
    if (targetSchema instanceof ZodBigInt) {
      return BigInt(value.toString());
    }
    if (targetSchema instanceof ZodString) {
      return value.toString();
    }
    throw new Error(`Cannot convert Number to ${targetSchema._def.typeName}`);
  }
  static convertFromBoolean(value, targetSchema) {
    if (!targetSchema) return value;
    if (targetSchema instanceof ZodBoolean) {
      return value;
    }
    if (targetSchema instanceof ZodString) {
      return value.toString();
    }
    if (targetSchema instanceof ZodNumber) {
      return Number(value);
    }
    if (targetSchema instanceof ZodBigInt) {
      return BigInt(value);
    }
    throw new Error(`Cannot convert Boolean to ${targetSchema._def.typeName}`);
  }
  static getDefaultPrimitiveValue(targetSchema) {
    if (!targetSchema) return null;
    if (targetSchema instanceof ZodNumber) {
      return 0;
    } else if (targetSchema instanceof ZodBoolean) {
      return false;
    } else if (targetSchema instanceof ZodString) {
      return "";
    }
    throw new Error(
      `Unsupported primitive type: ${targetSchema._def.typeName}`
    );
  }
};

// libs/language/src/lib/mapping/PrimitiveConverter.ts
var PrimitiveConverter = class {
  convert(node, targetType) {
    return ValueConverter.convertValue(node, targetType);
  }
};

// libs/language/src/lib/mapping/ComplexObjectConverter.ts
var ComplexObjectConverter = class {
  constructor(nodeToObjectConverter) {
    this.nodeToObjectConverter = nodeToObjectConverter;
  }
  convert(node, targetType) {
    return this.convertFields(node, targetType);
  }
  convertFields(node, schema2) {
    if (schema2 instanceof ZodIntersection) {
      const left = schema2._def.left;
      const right = schema2._def.right;
      const leftResult = this.convert(node, left);
      const rightResult = this.convert(node, right);
      return { ...leftResult, ...rightResult };
    }
    if (schema2 instanceof ZodUnion) {
      throw new Error("Union not supported");
    }
    if (schema2 instanceof ZodObject) {
      const result = Object.keys(schema2.shape).reduce((acc, propertyName) => {
        const properties = node.getProperties();
        const schemaProperty = schema2.shape[propertyName];
        const blueIdAnnotation2 = getBlueIdAnnotation(schemaProperty);
        if (g(blueIdAnnotation2)) {
          const propertyNameWithAnnotation = isString(blueIdAnnotation2) ? blueIdAnnotation2 : propertyName;
          const propertyNode2 = properties?.[propertyNameWithAnnotation];
          const blueId = propertyNode2 ? BlueIdCalculator.calculateBlueIdSync(propertyNode2) : void 0;
          acc[propertyName] = blueId;
          return acc;
        }
        const blueNameAnnotation = getBlueNameAnnotation(schemaProperty);
        if (g(blueNameAnnotation)) {
          const propertyNode2 = properties?.[blueNameAnnotation];
          acc[propertyName] = propertyNode2?.getName();
          return acc;
        }
        const blueDescriptionAnnotation = getBlueDescriptionAnnotation(schemaProperty);
        if (g(blueDescriptionAnnotation)) {
          const propertyNode2 = properties?.[blueDescriptionAnnotation];
          acc[propertyName] = propertyNode2?.getDescription();
          return acc;
        }
        if (propertyName === "name") {
          const name = node.getName();
          acc[propertyName] = name;
          return acc;
        }
        if (propertyName === "description") {
          const description = node.getDescription();
          acc[propertyName] = description;
          return acc;
        }
        const propertyNode = properties?.[propertyName];
        if (R(propertyNode)) {
          return acc;
        }
        const converted = this.nodeToObjectConverter.convert(
          propertyNode,
          schemaProperty
        );
        acc[propertyName] = converted;
        return acc;
      }, {});
      return result;
    }
    throw new Error("Unknown schema type, " + schema2._def.typeName);
  }
};

// libs/language/src/lib/mapping/ArrayConverter.ts
var ArrayConverter = class {
  constructor(nodeToObjectConverter) {
    this.nodeToObjectConverter = nodeToObjectConverter;
  }
  convert(node, targetType) {
    const items = node.getItems();
    if (!items) {
      return void 0;
    }
    const elementSchema = targetType.element;
    const result = items.map(
      (item) => this.nodeToObjectConverter.convert(item, elementSchema)
    );
    return result;
  }
};

// libs/language/src/lib/mapping/SetConverter.ts
var SetConverter = class {
  constructor(nodeToObjectConverter) {
    this.nodeToObjectConverter = nodeToObjectConverter;
  }
  convert(node, targetType) {
    const items = node.getItems();
    if (!items) {
      return void 0;
    }
    const elementSchema = targetType._def.valueType;
    const result = items.map(
      (item) => this.nodeToObjectConverter.convert(item, elementSchema)
    );
    return new Set(result);
  }
};

// libs/language/src/lib/mapping/MapConverter.ts
var MapConverter = class {
  constructor(nodeToObjectConverter) {
    this.nodeToObjectConverter = nodeToObjectConverter;
  }
  convert(node, targetType) {
    const keySchema = targetType.keySchema;
    const valueSchema = targetType.valueSchema;
    const result = /* @__PURE__ */ new Map();
    const nodeName = node.getName();
    if (g(nodeName)) {
      result.set(OBJECT_NAME, nodeName);
    }
    const nodeDescription = node.getDescription();
    if (g(nodeDescription)) {
      result.set(OBJECT_DESCRIPTION, nodeDescription);
    }
    const properties = node.getProperties();
    if (g(properties)) {
      Object.entries(properties).forEach(([key2, property]) => {
        const keyNode = new BlueNode().setValue(key2);
        keyNode.setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));
        const keyConverted = ValueConverter.convertValue(keyNode, keySchema);
        const value = this.nodeToObjectConverter.convert(property, valueSchema);
        result.set(keyConverted, value);
      });
    }
    if (targetType instanceof ZodRecord) {
      return Object.fromEntries(result);
    }
    return result;
  }
};

// libs/language/src/lib/mapping/UnknownConverter.ts
var UnknownConverter = class {
  convert(node) {
    return NodeToMapListOrValue.get(node);
  }
};

// libs/language/src/lib/mapping/AnyConverter.ts
var AnyConverter = class {
  convert(node) {
    return NodeToMapListOrValue.get(node);
  }
};

// libs/language/src/lib/mapping/TupleConverter.ts
var TupleConverter = class {
  constructor(nodeToObjectConverter) {
    this.nodeToObjectConverter = nodeToObjectConverter;
  }
  convert(node, targetType) {
    const items = node.getItems();
    if (!items) {
      return void 0;
    }
    const targetTypeItems = targetType.items;
    const result = items.map(
      (item, index) => this.nodeToObjectConverter.convert(item, targetTypeItems[index])
    );
    return result;
  }
};

// libs/language/src/lib/mapping/ConverterFactory.ts
var zodSchemaTypeNamesSchema = z.union([
  z.literal("ZodString"),
  z.literal("ZodNumber"),
  z.literal("ZodBoolean"),
  z.literal("ZodBigInt"),
  z.literal("ZodArray"),
  z.literal("ZodSet"),
  z.literal("ZodMap"),
  z.literal("ZodRecord"),
  z.literal("ZodObject"),
  z.literal("ZodEnum"),
  z.literal("ZodNativeEnum"),
  z.literal("ZodUnknown"),
  z.literal("ZodAny"),
  z.literal("ZodTuple")
]);
var ConverterFactory = class {
  constructor(nodeToObjectConverter) {
    this.nodeToObjectConverter = nodeToObjectConverter;
    __publicField(this, "converters", /* @__PURE__ */ new Map());
    __publicField(this, "complexObjectConverter");
    this.registerConverters();
    this.complexObjectConverter = new ComplexObjectConverter(
      this.nodeToObjectConverter
    );
  }
  registerConverters() {
    const primitiveConverter = new PrimitiveConverter();
    const arrayConverter = new ArrayConverter(this.nodeToObjectConverter);
    const tupleConverter = new TupleConverter(this.nodeToObjectConverter);
    const setConverter = new SetConverter(this.nodeToObjectConverter);
    const mapConverter = new MapConverter(this.nodeToObjectConverter);
    this.converters.set("ZodString", primitiveConverter);
    this.converters.set("ZodNumber", primitiveConverter);
    this.converters.set("ZodBoolean", primitiveConverter);
    this.converters.set("ZodBigInt", primitiveConverter);
    this.converters.set("ZodEnum", primitiveConverter);
    this.converters.set("ZodNativeEnum", primitiveConverter);
    this.converters.set("ZodUnknown", new UnknownConverter());
    this.converters.set("ZodAny", new AnyConverter());
    this.converters.set("ZodArray", arrayConverter);
    this.converters.set("ZodTuple", tupleConverter);
    this.converters.set("ZodSet", setConverter);
    this.converters.set("ZodMap", mapConverter);
    this.converters.set("ZodRecord", mapConverter);
    this.converters.set("ZodObject", this.complexObjectConverter);
  }
  getConverter(targetType) {
    const schemaTargetTypeName = this.getSchemaTypeName(targetType);
    return this.converters.get(schemaTargetTypeName) ?? this.complexObjectConverter;
  }
  getSchemaTypeName(schema2) {
    if (isWrapperType(schema2)) {
      if (schema2 instanceof ZodEffects) {
        return this.getSchemaTypeName(schema2.innerType());
      }
      if (schema2 instanceof ZodLazy) {
        return this.getSchemaTypeName(schema2.schema);
      }
      return this.getSchemaTypeName(schema2.unwrap());
    }
    const schemaTypeName = schema2._def.typeName;
    try {
      const parsedSchemaTypeName = zodSchemaTypeNamesSchema.parse(schemaTypeName);
      return parsedSchemaTypeName;
    } catch {
      throw new Error(`Schema type name ${schemaTypeName} is not supported`);
    }
  }
};

// libs/language/src/lib/mapping/NodeToObjectConverter.ts
var NodeToObjectConverter = class {
  constructor(typeSchemaResolver) {
    this.typeSchemaResolver = typeSchemaResolver;
    __publicField(this, "converterFactory");
    this.converterFactory = new ConverterFactory(this);
  }
  convert(node, targetType) {
    const resolvedSchema = this.typeSchemaResolver?.resolveSchema(node);
    const unwrappedTargetType = BlueNodeTypeSchema.unwrapSchema(targetType);
    if (isBlueNodeSchema(unwrappedTargetType)) {
      return node;
    }
    let schemaToUse = unwrappedTargetType;
    if (BlueNodeTypeSchema.checkSchemaExtension(
      resolvedSchema,
      unwrappedTargetType
    ) && g(resolvedSchema)) {
      schemaToUse = resolvedSchema;
    }
    return this.convertWithType(node, schemaToUse);
  }
  convertWithType(node, targetType) {
    const converter = this.converterFactory.getConverter(targetType);
    return converter.convert(node, targetType);
  }
};

// libs/language/src/lib/NodeProvider.ts
var NodeProvider = class {
  /**
   * Fetches the first node associated with the given Blue ID
   * Default implementation that takes the first node from fetchByBlueId result
   *
   * @param blueId - The Blue ID to fetch nodes for
   * @returns The first node found for the Blue ID, or null if none exist
   */
  fetchFirstByBlueId(blueId) {
    const nodes = this.fetchByBlueId(blueId);
    if (nodes && nodes.length > 0) {
      return nodes[0];
    }
    return null;
  }
};
function createNodeProvider(fetchByBlueIdFn) {
  return new class extends NodeProvider {
    fetchByBlueId(blueId) {
      return fetchByBlueIdFn(blueId);
    }
  }();
}

// libs/language/src/lib/provider/SequentialNodeProvider.ts
var SequentialNodeProvider = class extends NodeProvider {
  constructor(nodeProviders) {
    super();
    __publicField(this, "nodeProviders");
    this.nodeProviders = nodeProviders;
  }
  fetchByBlueId(blueId) {
    for (const provider of this.nodeProviders) {
      const nodes = provider.fetchByBlueId(blueId);
      if (nodes && nodes.length > 0) {
        return nodes;
      }
    }
    return [];
  }
  // Override fetchFirstByBlueId for more efficient implementation
  // In Java, this would call the default implementation, but we optimize here
  fetchFirstByBlueId(blueId) {
    for (const provider of this.nodeProviders) {
      const node = provider.fetchFirstByBlueId(blueId);
      if (node) {
        return node;
      }
    }
    return null;
  }
  getNodeProviders() {
    return this.nodeProviders;
  }
};

// node_modules/js-yaml/dist/js-yaml.mjs
function isNothing(subject) {
  return typeof subject === "undefined" || subject === null;
}
function isObject2(subject) {
  return typeof subject === "object" && subject !== null;
}
function toArray(sequence) {
  if (Array.isArray(sequence)) return sequence;
  else if (isNothing(sequence)) return [];
  return [sequence];
}
function extend(target, source) {
  var index, length, key2, sourceKeys;
  if (source) {
    sourceKeys = Object.keys(source);
    for (index = 0, length = sourceKeys.length; index < length; index += 1) {
      key2 = sourceKeys[index];
      target[key2] = source[key2];
    }
  }
  return target;
}
function repeat(string, count) {
  var result = "", cycle;
  for (cycle = 0; cycle < count; cycle += 1) {
    result += string;
  }
  return result;
}
function isNegativeZero(number) {
  return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
}
var isNothing_1 = isNothing;
var isObject_1 = isObject2;
var toArray_1 = toArray;
var repeat_1 = repeat;
var isNegativeZero_1 = isNegativeZero;
var extend_1 = extend;
var common = {
  isNothing: isNothing_1,
  isObject: isObject_1,
  toArray: toArray_1,
  repeat: repeat_1,
  isNegativeZero: isNegativeZero_1,
  extend: extend_1
};
function formatError(exception2, compact) {
  var where = "", message = exception2.reason || "(unknown reason)";
  if (!exception2.mark) return message;
  if (exception2.mark.name) {
    where += 'in "' + exception2.mark.name + '" ';
  }
  where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
  if (!compact && exception2.mark.snippet) {
    where += "\n\n" + exception2.mark.snippet;
  }
  return message + " " + where;
}
function YAMLException$1(reason, mark) {
  Error.call(this);
  this.name = "YAMLException";
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = new Error().stack || "";
  }
}
YAMLException$1.prototype = Object.create(Error.prototype);
YAMLException$1.prototype.constructor = YAMLException$1;
YAMLException$1.prototype.toString = function toString(compact) {
  return this.name + ": " + formatError(this, compact);
};
var exception = YAMLException$1;
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  var head = "";
  var tail = "";
  var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
  if (position - lineStart > maxHalfLength) {
    head = " ... ";
    lineStart = position - maxHalfLength + head.length;
  }
  if (lineEnd - position > maxHalfLength) {
    tail = " ...";
    lineEnd = position + maxHalfLength - tail.length;
  }
  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
    pos: position - lineStart + head.length
    // relative position
  };
}
function padStart(string, max) {
  return common.repeat(" ", max - string.length) + string;
}
function makeSnippet(mark, options3) {
  options3 = Object.create(options3 || null);
  if (!mark.buffer) return null;
  if (!options3.maxLength) options3.maxLength = 79;
  if (typeof options3.indent !== "number") options3.indent = 1;
  if (typeof options3.linesBefore !== "number") options3.linesBefore = 3;
  if (typeof options3.linesAfter !== "number") options3.linesAfter = 2;
  var re2 = /\r?\n|\r|\0/g;
  var lineStarts = [0];
  var lineEnds = [];
  var match;
  var foundLineNo = -1;
  while (match = re2.exec(mark.buffer)) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);
    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }
  if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
  var result = "", i2, line;
  var lineNoLength = Math.min(mark.line + options3.linesAfter, lineEnds.length).toString().length;
  var maxLineLength = options3.maxLength - (options3.indent + lineNoLength + 3);
  for (i2 = 1; i2 <= options3.linesBefore; i2++) {
    if (foundLineNo - i2 < 0) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo - i2],
      lineEnds[foundLineNo - i2],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i2]),
      maxLineLength
    );
    result = common.repeat(" ", options3.indent) + padStart((mark.line - i2 + 1).toString(), lineNoLength) + " | " + line.str + "\n" + result;
  }
  line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += common.repeat(" ", options3.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  result += common.repeat("-", options3.indent + lineNoLength + 3 + line.pos) + "^\n";
  for (i2 = 1; i2 <= options3.linesAfter; i2++) {
    if (foundLineNo + i2 >= lineEnds.length) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo + i2],
      lineEnds[foundLineNo + i2],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i2]),
      maxLineLength
    );
    result += common.repeat(" ", options3.indent) + padStart((mark.line + i2 + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  }
  return result.replace(/\n$/, "");
}
var snippet = makeSnippet;
var TYPE_CONSTRUCTOR_OPTIONS = [
  "kind",
  "multi",
  "resolve",
  "construct",
  "instanceOf",
  "predicate",
  "represent",
  "representName",
  "defaultStyle",
  "styleAliases"
];
var YAML_NODE_KINDS = [
  "scalar",
  "sequence",
  "mapping"
];
function compileStyleAliases(map2) {
  var result = {};
  if (map2 !== null) {
    Object.keys(map2).forEach(function(style) {
      map2[style].forEach(function(alias) {
        result[String(alias)] = style;
      });
    });
  }
  return result;
}
function Type$1(tag, options3) {
  options3 = options3 || {};
  Object.keys(options3).forEach(function(name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new exception('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });
  this.options = options3;
  this.tag = tag;
  this.kind = options3["kind"] || null;
  this.resolve = options3["resolve"] || function() {
    return true;
  };
  this.construct = options3["construct"] || function(data) {
    return data;
  };
  this.instanceOf = options3["instanceOf"] || null;
  this.predicate = options3["predicate"] || null;
  this.represent = options3["represent"] || null;
  this.representName = options3["representName"] || null;
  this.defaultStyle = options3["defaultStyle"] || null;
  this.multi = options3["multi"] || false;
  this.styleAliases = compileStyleAliases(options3["styleAliases"] || null);
  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}
var type = Type$1;
function compileList(schema2, name) {
  var result = [];
  schema2[name].forEach(function(currentType) {
    var newIndex = result.length;
    result.forEach(function(previousType, previousIndex) {
      if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
        newIndex = previousIndex;
      }
    });
    result[newIndex] = currentType;
  });
  return result;
}
function compileMap() {
  var result = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  }, index, length;
  function collectType(type2) {
    if (type2.multi) {
      result.multi[type2.kind].push(type2);
      result.multi["fallback"].push(type2);
    } else {
      result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
    }
  }
  for (index = 0, length = arguments.length; index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result;
}
function Schema$1(definition) {
  return this.extend(definition);
}
Schema$1.prototype.extend = function extend2(definition) {
  var implicit = [];
  var explicit = [];
  if (definition instanceof type) {
    explicit.push(definition);
  } else if (Array.isArray(definition)) {
    explicit = explicit.concat(definition);
  } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
    if (definition.implicit) implicit = implicit.concat(definition.implicit);
    if (definition.explicit) explicit = explicit.concat(definition.explicit);
  } else {
    throw new exception("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  }
  implicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
    if (type$1.loadKind && type$1.loadKind !== "scalar") {
      throw new exception("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    }
    if (type$1.multi) {
      throw new exception("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
    }
  });
  explicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
  });
  var result = Object.create(Schema$1.prototype);
  result.implicit = (this.implicit || []).concat(implicit);
  result.explicit = (this.explicit || []).concat(explicit);
  result.compiledImplicit = compileList(result, "implicit");
  result.compiledExplicit = compileList(result, "explicit");
  result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
  return result;
};
var schema = Schema$1;
var str = new type("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(data) {
    return data !== null ? data : "";
  }
});
var seq = new type("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(data) {
    return data !== null ? data : [];
  }
});
var map = new type("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(data) {
    return data !== null ? data : {};
  }
});
var failsafe = new schema({
  explicit: [
    str,
    seq,
    map
  ]
});
function resolveYamlNull(data) {
  if (data === null) return true;
  var max = data.length;
  return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
}
function constructYamlNull() {
  return null;
}
function isNull(object) {
  return object === null;
}
var _null = new type("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function() {
      return "~";
    },
    lowercase: function() {
      return "null";
    },
    uppercase: function() {
      return "NULL";
    },
    camelcase: function() {
      return "Null";
    },
    empty: function() {
      return "";
    }
  },
  defaultStyle: "lowercase"
});
function resolveYamlBoolean(data) {
  if (data === null) return false;
  var max = data.length;
  return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
}
function constructYamlBoolean(data) {
  return data === "true" || data === "True" || data === "TRUE";
}
function isBoolean(object) {
  return Object.prototype.toString.call(object) === "[object Boolean]";
}
var bool = new type("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: resolveYamlBoolean,
  construct: constructYamlBoolean,
  predicate: isBoolean,
  represent: {
    lowercase: function(object) {
      return object ? "true" : "false";
    },
    uppercase: function(object) {
      return object ? "TRUE" : "FALSE";
    },
    camelcase: function(object) {
      return object ? "True" : "False";
    }
  },
  defaultStyle: "lowercase"
});
function isHexCode(c4) {
  return 48 <= c4 && c4 <= 57 || 65 <= c4 && c4 <= 70 || 97 <= c4 && c4 <= 102;
}
function isOctCode(c4) {
  return 48 <= c4 && c4 <= 55;
}
function isDecCode(c4) {
  return 48 <= c4 && c4 <= 57;
}
function resolveYamlInteger(data) {
  if (data === null) return false;
  var max = data.length, index = 0, hasDigits = false, ch;
  if (!max) return false;
  ch = data[index];
  if (ch === "-" || ch === "+") {
    ch = data[++index];
  }
  if (ch === "0") {
    if (index + 1 === max) return true;
    ch = data[++index];
    if (ch === "b") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (ch !== "0" && ch !== "1") return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "x") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isHexCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "o") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isOctCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
  }
  if (ch === "_") return false;
  for (; index < max; index++) {
    ch = data[index];
    if (ch === "_") continue;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }
  if (!hasDigits || ch === "_") return false;
  return true;
}
function constructYamlInteger(data) {
  var value = data, sign = 1, ch;
  if (value.indexOf("_") !== -1) {
    value = value.replace(/_/g, "");
  }
  ch = value[0];
  if (ch === "-" || ch === "+") {
    if (ch === "-") sign = -1;
    value = value.slice(1);
    ch = value[0];
  }
  if (value === "0") return 0;
  if (ch === "0") {
    if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
    if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
    if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
  }
  return sign * parseInt(value, 10);
}
function isInteger(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
}
var int = new type("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: resolveYamlInteger,
  construct: constructYamlInteger,
  predicate: isInteger,
  represent: {
    binary: function(obj) {
      return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
    },
    octal: function(obj) {
      return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
    },
    decimal: function(obj) {
      return obj.toString(10);
    },
    /* eslint-disable max-len */
    hexadecimal: function(obj) {
      return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
    }
  },
  defaultStyle: "decimal",
  styleAliases: {
    binary: [2, "bin"],
    octal: [8, "oct"],
    decimal: [10, "dec"],
    hexadecimal: [16, "hex"]
  }
});
var YAML_FLOAT_PATTERN = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function resolveYamlFloat(data) {
  if (data === null) return false;
  if (!YAML_FLOAT_PATTERN.test(data) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  data[data.length - 1] === "_") {
    return false;
  }
  return true;
}
function constructYamlFloat(data) {
  var value, sign;
  value = data.replace(/_/g, "").toLowerCase();
  sign = value[0] === "-" ? -1 : 1;
  if ("+-".indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }
  if (value === ".inf") {
    return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  } else if (value === ".nan") {
    return NaN;
  }
  return sign * parseFloat(value, 10);
}
var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
function representYamlFloat(object, style) {
  var res;
  if (isNaN(object)) {
    switch (style) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  } else if (common.isNegativeZero(object)) {
    return "-0.0";
  }
  res = object.toString(10);
  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
}
function isFloat2(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
}
var float = new type("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: resolveYamlFloat,
  construct: constructYamlFloat,
  predicate: isFloat2,
  represent: representYamlFloat,
  defaultStyle: "lowercase"
});
var json = failsafe.extend({
  implicit: [
    _null,
    bool,
    int,
    float
  ]
});
var core = json;
var YAML_DATE_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
);
var YAML_TIMESTAMP_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function resolveYamlTimestamp(data) {
  if (data === null) return false;
  if (YAML_DATE_REGEXP.exec(data) !== null) return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
  return false;
}
function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
  match = YAML_DATE_REGEXP.exec(data);
  if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
  if (match === null) throw new Error("Date resolve error");
  year = +match[1];
  month = +match[2] - 1;
  day = +match[3];
  if (!match[4]) {
    return new Date(Date.UTC(year, month, day));
  }
  hour = +match[4];
  minute = +match[5];
  second = +match[6];
  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) {
      fraction += "0";
    }
    fraction = +fraction;
  }
  if (match[9]) {
    tz_hour = +match[10];
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 6e4;
    if (match[9] === "-") delta = -delta;
  }
  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
  if (delta) date.setTime(date.getTime() - delta);
  return date;
}
function representYamlTimestamp(object) {
  return object.toISOString();
}
var timestamp = new type("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: resolveYamlTimestamp,
  construct: constructYamlTimestamp,
  instanceOf: Date,
  represent: representYamlTimestamp
});
function resolveYamlMerge(data) {
  return data === "<<" || data === null;
}
var merge = new type("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: resolveYamlMerge
});
var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
function resolveYamlBinary(data) {
  if (data === null) return false;
  var code, idx, bitlen = 0, max = data.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    code = map2.indexOf(data.charAt(idx));
    if (code > 64) continue;
    if (code < 0) return false;
    bitlen += 6;
  }
  return bitlen % 8 === 0;
}
function constructYamlBinary(data) {
  var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map2 = BASE64_MAP, bits = 0, result = [];
  for (idx = 0; idx < max; idx++) {
    if (idx % 4 === 0 && idx) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    }
    bits = bits << 6 | map2.indexOf(input.charAt(idx));
  }
  tailbits = max % 4 * 6;
  if (tailbits === 0) {
    result.push(bits >> 16 & 255);
    result.push(bits >> 8 & 255);
    result.push(bits & 255);
  } else if (tailbits === 18) {
    result.push(bits >> 10 & 255);
    result.push(bits >> 2 & 255);
  } else if (tailbits === 12) {
    result.push(bits >> 4 & 255);
  }
  return new Uint8Array(result);
}
function representYamlBinary(object) {
  var result = "", bits = 0, idx, tail, max = object.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    if (idx % 3 === 0 && idx) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    }
    bits = (bits << 8) + object[idx];
  }
  tail = max % 3;
  if (tail === 0) {
    result += map2[bits >> 18 & 63];
    result += map2[bits >> 12 & 63];
    result += map2[bits >> 6 & 63];
    result += map2[bits & 63];
  } else if (tail === 2) {
    result += map2[bits >> 10 & 63];
    result += map2[bits >> 4 & 63];
    result += map2[bits << 2 & 63];
    result += map2[64];
  } else if (tail === 1) {
    result += map2[bits >> 2 & 63];
    result += map2[bits << 4 & 63];
    result += map2[64];
    result += map2[64];
  }
  return result;
}
function isBinary(obj) {
  return Object.prototype.toString.call(obj) === "[object Uint8Array]";
}
var binary = new type("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: resolveYamlBinary,
  construct: constructYamlBinary,
  predicate: isBinary,
  represent: representYamlBinary
});
var _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
var _toString$2 = Object.prototype.toString;
function resolveYamlOmap(data) {
  if (data === null) return true;
  var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;
    if (_toString$2.call(pair) !== "[object Object]") return false;
    for (pairKey in pair) {
      if (_hasOwnProperty$3.call(pair, pairKey)) {
        if (!pairHasKey) pairHasKey = true;
        else return false;
      }
    }
    if (!pairHasKey) return false;
    if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
    else return false;
  }
  return true;
}
function constructYamlOmap(data) {
  return data !== null ? data : [];
}
var omap = new type("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: resolveYamlOmap,
  construct: constructYamlOmap
});
var _toString$1 = Object.prototype.toString;
function resolveYamlPairs(data) {
  if (data === null) return true;
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    if (_toString$1.call(pair) !== "[object Object]") return false;
    keys = Object.keys(pair);
    if (keys.length !== 1) return false;
    result[index] = [keys[0], pair[keys[0]]];
  }
  return true;
}
function constructYamlPairs(data) {
  if (data === null) return [];
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    keys = Object.keys(pair);
    result[index] = [keys[0], pair[keys[0]]];
  }
  return result;
}
var pairs = new type("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: resolveYamlPairs,
  construct: constructYamlPairs
});
var _hasOwnProperty$2 = Object.prototype.hasOwnProperty;
function resolveYamlSet(data) {
  if (data === null) return true;
  var key2, object = data;
  for (key2 in object) {
    if (_hasOwnProperty$2.call(object, key2)) {
      if (object[key2] !== null) return false;
    }
  }
  return true;
}
function constructYamlSet(data) {
  return data !== null ? data : {};
}
var set = new type("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: resolveYamlSet,
  construct: constructYamlSet
});
var _default = core.extend({
  implicit: [
    timestamp,
    merge
  ],
  explicit: [
    binary,
    omap,
    pairs,
    set
  ]
});
var _hasOwnProperty$1 = Object.prototype.hasOwnProperty;
var CONTEXT_FLOW_IN = 1;
var CONTEXT_FLOW_OUT = 2;
var CONTEXT_BLOCK_IN = 3;
var CONTEXT_BLOCK_OUT = 4;
var CHOMPING_CLIP = 1;
var CHOMPING_STRIP = 2;
var CHOMPING_KEEP = 3;
var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function _class(obj) {
  return Object.prototype.toString.call(obj);
}
function is_EOL(c4) {
  return c4 === 10 || c4 === 13;
}
function is_WHITE_SPACE(c4) {
  return c4 === 9 || c4 === 32;
}
function is_WS_OR_EOL(c4) {
  return c4 === 9 || c4 === 32 || c4 === 10 || c4 === 13;
}
function is_FLOW_INDICATOR(c4) {
  return c4 === 44 || c4 === 91 || c4 === 93 || c4 === 123 || c4 === 125;
}
function fromHexCode(c4) {
  var lc;
  if (48 <= c4 && c4 <= 57) {
    return c4 - 48;
  }
  lc = c4 | 32;
  if (97 <= lc && lc <= 102) {
    return lc - 97 + 10;
  }
  return -1;
}
function escapedHexLen(c4) {
  if (c4 === 120) {
    return 2;
  }
  if (c4 === 117) {
    return 4;
  }
  if (c4 === 85) {
    return 8;
  }
  return 0;
}
function fromDecimalCode(c4) {
  if (48 <= c4 && c4 <= 57) {
    return c4 - 48;
  }
  return -1;
}
function simpleEscapeSequence(c4) {
  return c4 === 48 ? "\0" : c4 === 97 ? "\x07" : c4 === 98 ? "\b" : c4 === 116 ? "	" : c4 === 9 ? "	" : c4 === 110 ? "\n" : c4 === 118 ? "\v" : c4 === 102 ? "\f" : c4 === 114 ? "\r" : c4 === 101 ? "\x1B" : c4 === 32 ? " " : c4 === 34 ? '"' : c4 === 47 ? "/" : c4 === 92 ? "\\" : c4 === 78 ? "\x85" : c4 === 95 ? "\xA0" : c4 === 76 ? "\u2028" : c4 === 80 ? "\u2029" : "";
}
function charFromCodepoint(c4) {
  if (c4 <= 65535) {
    return String.fromCharCode(c4);
  }
  return String.fromCharCode(
    (c4 - 65536 >> 10) + 55296,
    (c4 - 65536 & 1023) + 56320
  );
}
var simpleEscapeCheck = new Array(256);
var simpleEscapeMap = new Array(256);
for (i2 = 0; i2 < 256; i2++) {
  simpleEscapeCheck[i2] = simpleEscapeSequence(i2) ? 1 : 0;
  simpleEscapeMap[i2] = simpleEscapeSequence(i2);
}
var i2;
function State$1(input, options3) {
  this.input = input;
  this.filename = options3["filename"] || null;
  this.schema = options3["schema"] || _default;
  this.onWarning = options3["onWarning"] || null;
  this.legacy = options3["legacy"] || false;
  this.json = options3["json"] || false;
  this.listener = options3["listener"] || null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap = this.schema.compiledTypeMap;
  this.length = input.length;
  this.position = 0;
  this.line = 0;
  this.lineStart = 0;
  this.lineIndent = 0;
  this.firstTabInLine = -1;
  this.documents = [];
}
function generateError(state, message) {
  var mark = {
    name: state.filename,
    buffer: state.input.slice(0, -1),
    // omit trailing \0
    position: state.position,
    line: state.line,
    column: state.position - state.lineStart
  };
  mark.snippet = snippet(mark);
  return new exception(message, mark);
}
function throwError(state, message) {
  throw generateError(state, message);
}
function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}
var directiveHandlers = {
  YAML: function handleYamlDirective(state, name, args) {
    var match, major, minor;
    if (state.version !== null) {
      throwError(state, "duplication of %YAML directive");
    }
    if (args.length !== 1) {
      throwError(state, "YAML directive accepts exactly one argument");
    }
    match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
    if (match === null) {
      throwError(state, "ill-formed argument of the YAML directive");
    }
    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);
    if (major !== 1) {
      throwError(state, "unacceptable YAML version of the document");
    }
    state.version = args[0];
    state.checkLineBreaks = minor < 2;
    if (minor !== 1 && minor !== 2) {
      throwWarning(state, "unsupported YAML version of the document");
    }
  },
  TAG: function handleTagDirective(state, name, args) {
    var handle, prefix;
    if (args.length !== 2) {
      throwError(state, "TAG directive accepts exactly two arguments");
    }
    handle = args[0];
    prefix = args[1];
    if (!PATTERN_TAG_HANDLE.test(handle)) {
      throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
    }
    if (_hasOwnProperty$1.call(state.tagMap, handle)) {
      throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
    }
    if (!PATTERN_TAG_URI.test(prefix)) {
      throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
    }
    try {
      prefix = decodeURIComponent(prefix);
    } catch (err) {
      throwError(state, "tag prefix is malformed: " + prefix);
    }
    state.tagMap[handle] = prefix;
  }
};
function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;
  if (start < end) {
    _result = state.input.slice(start, end);
    if (checkJson) {
      for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
          throwError(state, "expected valid JSON character");
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, "the stream contains non-printable characters");
    }
    state.result += _result;
  }
}
function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key2, index, quantity;
  if (!common.isObject(source)) {
    throwError(state, "cannot merge mappings; the provided source object is unacceptable");
  }
  sourceKeys = Object.keys(source);
  for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
    key2 = sourceKeys[index];
    if (!_hasOwnProperty$1.call(destination, key2)) {
      destination[key2] = source[key2];
      overridableKeys[key2] = true;
    }
  }
}
function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
  var index, quantity;
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);
    for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, "nested arrays are not supported inside keys");
      }
      if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
        keyNode[index] = "[object Object]";
      }
    }
  }
  if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
    keyNode = "[object Object]";
  }
  keyNode = String(keyNode);
  if (_result === null) {
    _result = {};
  }
  if (keyTag === "tag:yaml.org,2002:merge") {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json && !_hasOwnProperty$1.call(overridableKeys, keyNode) && _hasOwnProperty$1.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, "duplicated mapping key");
    }
    if (keyNode === "__proto__") {
      Object.defineProperty(_result, keyNode, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: valueNode
      });
    } else {
      _result[keyNode] = valueNode;
    }
    delete overridableKeys[keyNode];
  }
  return _result;
}
function readLineBreak(state) {
  var ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 10) {
    state.position++;
  } else if (ch === 13) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 10) {
      state.position++;
    }
  } else {
    throwError(state, "a line break is expected");
  }
  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}
function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      if (ch === 9 && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    if (allowComments && ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 10 && ch !== 13 && ch !== 0);
    }
    if (is_EOL(ch)) {
      readLineBreak(state);
      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;
      while (ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }
  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, "deficient indentation");
  }
  return lineBreaks;
}
function testDocumentSeparator(state) {
  var _position = state.position, ch;
  ch = state.input.charCodeAt(_position);
  if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
    _position += 3;
    ch = state.input.charCodeAt(_position);
    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }
  return false;
}
function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += " ";
  } else if (count > 1) {
    state.result += common.repeat("\n", count - 1);
  }
}
function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
  ch = state.input.charCodeAt(state.position);
  if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
    return false;
  }
  if (ch === 63 || ch === 45) {
    following = state.input.charCodeAt(state.position + 1);
    if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }
  state.kind = "scalar";
  state.result = "";
  captureStart = captureEnd = state.position;
  hasPendingContent = false;
  while (ch !== 0) {
    if (ch === 58) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }
    } else if (ch === 35) {
      preceding = state.input.charCodeAt(state.position - 1);
      if (is_WS_OR_EOL(preceding)) {
        break;
      }
    } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;
    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);
      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }
    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }
    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }
    ch = state.input.charCodeAt(++state.position);
  }
  captureSegment(state, captureStart, captureEnd, false);
  if (state.result) {
    return true;
  }
  state.kind = _kind;
  state.result = _result;
  return false;
}
function readSingleQuotedScalar(state, nodeIndent) {
  var ch, captureStart, captureEnd;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 39) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 39) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (ch === 39) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a single quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a single quoted scalar");
}
function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 34) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 34) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;
    } else if (ch === 92) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;
      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;
        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);
          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;
          } else {
            throwError(state, "expected hexadecimal character");
          }
        }
        state.result += charFromCodepoint(hexResult);
        state.position++;
      } else {
        throwError(state, "unknown escape sequence");
      }
      captureStart = captureEnd = state.position;
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a double quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a double quoted scalar");
}
function readFlowCollection(state, nodeIndent) {
  var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = /* @__PURE__ */ Object.create(null), keyNode, keyTag, valueNode, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 91) {
    terminator = 93;
    isMapping = false;
    _result = [];
  } else if (ch === 123) {
    terminator = 125;
    isMapping = true;
    _result = {};
  } else {
    return false;
  }
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(++state.position);
  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? "mapping" : "sequence";
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, "missed comma between flow collection entries");
    } else if (ch === 44) {
      throwError(state, "expected the node content, but found ','");
    }
    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;
    if (ch === 63) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }
    _line = state.line;
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if ((isExplicitPair || state.line === _line) && ch === 58) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }
    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === 44) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }
  throwError(state, "unexpected end of the stream within a flow collection");
}
function readBlockScalar(state, nodeIndent) {
  var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 124) {
    folding = false;
  } else if (ch === 62) {
    folding = true;
  } else {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);
    if (ch === 43 || ch === 45) {
      if (CHOMPING_CLIP === chomping) {
        chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, "repeat of a chomping mode identifier");
      }
    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, "repeat of an indentation width identifier");
      }
    } else {
      break;
    }
  }
  if (is_WHITE_SPACE(ch)) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (is_WHITE_SPACE(ch));
    if (ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (!is_EOL(ch) && ch !== 0);
    }
  }
  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;
    ch = state.input.charCodeAt(state.position);
    while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }
    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }
    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }
    if (state.lineIndent < textIndent) {
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) {
          state.result += "\n";
        }
      }
      break;
    }
    if (folding) {
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat("\n", emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent) {
          state.result += " ";
        }
      } else {
        state.result += common.repeat("\n", emptyLines);
      }
    } else {
      state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
    }
    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;
    while (!is_EOL(ch) && ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, state.position, false);
  }
  return true;
}
function readBlockSequence(state, nodeIndent) {
  var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    if (ch !== 45) {
      break;
    }
    following = state.input.charCodeAt(state.position + 1);
    if (!is_WS_OR_EOL(following)) {
      break;
    }
    detected = true;
    state.position++;
    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }
    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a sequence entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "sequence";
    state.result = _result;
    return true;
  }
  return false;
}
function readBlockMapping(state, nodeIndent, flowIndent) {
  var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = /* @__PURE__ */ Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    following = state.input.charCodeAt(state.position + 1);
    _line = state.line;
    if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
      if (ch === 63) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        detected = true;
        atExplicitKey = true;
        allowCompact = true;
      } else if (atExplicitKey) {
        atExplicitKey = false;
        allowCompact = true;
      } else {
        throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
      }
      state.position += 1;
      ch = following;
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;
      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        break;
      }
      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 58) {
          ch = state.input.charCodeAt(++state.position);
          if (!is_WS_OR_EOL(ch)) {
            throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
          }
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;
        } else if (detected) {
          throwError(state, "can not read an implicit mapping pair; a colon is missed");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      } else if (detected) {
        throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true;
      }
    }
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }
      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }
      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a mapping entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "mapping";
    state.result = _result;
  }
  return detected;
}
function readTagProperty(state) {
  var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 33) return false;
  if (state.tag !== null) {
    throwError(state, "duplication of a tag property");
  }
  ch = state.input.charCodeAt(++state.position);
  if (ch === 60) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === 33) {
    isNamed = true;
    tagHandle = "!!";
    ch = state.input.charCodeAt(++state.position);
  } else {
    tagHandle = "!";
  }
  _position = state.position;
  if (isVerbatim) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (ch !== 0 && ch !== 62);
    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, "unexpected end of the stream within a verbatim tag");
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      if (ch === 33) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, "named tag handle cannot contain such characters");
          }
          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, "tag suffix cannot contain exclamation marks");
        }
      }
      ch = state.input.charCodeAt(++state.position);
    }
    tagName = state.input.slice(_position, state.position);
    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, "tag suffix cannot contain flow indicator characters");
    }
  }
  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, "tag name cannot contain such characters: " + tagName);
  }
  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, "tag name is malformed: " + tagName);
  }
  if (isVerbatim) {
    state.tag = tagName;
  } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;
  } else if (tagHandle === "!") {
    state.tag = "!" + tagName;
  } else if (tagHandle === "!!") {
    state.tag = "tag:yaml.org,2002:" + tagName;
  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }
  return true;
}
function readAnchorProperty(state) {
  var _position, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 38) return false;
  if (state.anchor !== null) {
    throwError(state, "duplication of an anchor property");
  }
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an anchor node must contain at least one character");
  }
  state.anchor = state.input.slice(_position, state.position);
  return true;
}
function readAlias(state) {
  var _position, alias, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 42) return false;
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an alias node must contain at least one character");
  }
  alias = state.input.slice(_position, state.position);
  if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }
  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}
function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type2, flowIndent, blockIndent;
  if (state.listener !== null) {
    state.listener("open", state);
  }
  state.tag = null;
  state.anchor = null;
  state.kind = null;
  state.result = null;
  allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;
      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }
  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }
  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }
  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }
    blockIndent = state.position - state.lineStart;
    if (indentStatus === 1) {
      if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;
        } else if (readAlias(state)) {
          hasContent = true;
          if (state.tag !== null || state.anchor !== null) {
            throwError(state, "alias node should not have any properties");
          }
        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;
          if (state.tag === null) {
            state.tag = "?";
          }
        }
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }
  if (state.tag === null) {
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = state.result;
    }
  } else if (state.tag === "?") {
    if (state.result !== null && state.kind !== "scalar") {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }
    for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
      type2 = state.implicitTypes[typeIndex];
      if (type2.resolve(state.result)) {
        state.result = type2.construct(state.result);
        state.tag = type2.tag;
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
        break;
      }
    }
  } else if (state.tag !== "!") {
    if (_hasOwnProperty$1.call(state.typeMap[state.kind || "fallback"], state.tag)) {
      type2 = state.typeMap[state.kind || "fallback"][state.tag];
    } else {
      type2 = null;
      typeList = state.typeMap.multi[state.kind || "fallback"];
      for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type2 = typeList[typeIndex];
          break;
        }
      }
    }
    if (!type2) {
      throwError(state, "unknown tag !<" + state.tag + ">");
    }
    if (state.result !== null && type2.kind !== state.kind) {
      throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
    }
    if (!type2.resolve(state.result, state.tag)) {
      throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
    } else {
      state.result = type2.construct(state.result, state.tag);
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    }
  }
  if (state.listener !== null) {
    state.listener("close", state);
  }
  return state.tag !== null || state.anchor !== null || hasContent;
}
function readDocument(state) {
  var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = /* @__PURE__ */ Object.create(null);
  state.anchorMap = /* @__PURE__ */ Object.create(null);
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if (state.lineIndent > 0 || ch !== 37) {
      break;
    }
    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];
    if (directiveName.length < 1) {
      throwError(state, "directive name must not be less than one character in length");
    }
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && !is_EOL(ch));
        break;
      }
      if (is_EOL(ch)) break;
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveArgs.push(state.input.slice(_position, state.position));
    }
    if (ch !== 0) readLineBreak(state);
    if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }
  skipSeparationSpace(state, true, -1);
  if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);
  } else if (hasDirectives) {
    throwError(state, "directives end mark is expected");
  }
  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);
  if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, "non-ASCII line breaks are interpreted as content");
  }
  state.documents.push(state.result);
  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    if (state.input.charCodeAt(state.position) === 46) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }
  if (state.position < state.length - 1) {
    throwError(state, "end of the stream or a document separator is expected");
  } else {
    return;
  }
}
function loadDocuments(input, options3) {
  input = String(input);
  options3 = options3 || {};
  if (input.length !== 0) {
    if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
      input += "\n";
    }
    if (input.charCodeAt(0) === 65279) {
      input = input.slice(1);
    }
  }
  var state = new State$1(input, options3);
  var nullpos = input.indexOf("\0");
  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, "null byte is not allowed in input");
  }
  state.input += "\0";
  while (state.input.charCodeAt(state.position) === 32) {
    state.lineIndent += 1;
    state.position += 1;
  }
  while (state.position < state.length - 1) {
    readDocument(state);
  }
  return state.documents;
}
function loadAll$1(input, iterator, options3) {
  if (iterator !== null && typeof iterator === "object" && typeof options3 === "undefined") {
    options3 = iterator;
    iterator = null;
  }
  var documents = loadDocuments(input, options3);
  if (typeof iterator !== "function") {
    return documents;
  }
  for (var index = 0, length = documents.length; index < length; index += 1) {
    iterator(documents[index]);
  }
}
function load$1(input, options3) {
  var documents = loadDocuments(input, options3);
  if (documents.length === 0) {
    return void 0;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new exception("expected a single document in the stream, but found more");
}
var loadAll_1 = loadAll$1;
var load_1 = load$1;
var loader = {
  loadAll: loadAll_1,
  load: load_1
};
var _toString = Object.prototype.toString;
var _hasOwnProperty = Object.prototype.hasOwnProperty;
var CHAR_BOM = 65279;
var CHAR_TAB = 9;
var CHAR_LINE_FEED = 10;
var CHAR_CARRIAGE_RETURN = 13;
var CHAR_SPACE = 32;
var CHAR_EXCLAMATION = 33;
var CHAR_DOUBLE_QUOTE = 34;
var CHAR_SHARP = 35;
var CHAR_PERCENT = 37;
var CHAR_AMPERSAND = 38;
var CHAR_SINGLE_QUOTE = 39;
var CHAR_ASTERISK = 42;
var CHAR_COMMA = 44;
var CHAR_MINUS = 45;
var CHAR_COLON = 58;
var CHAR_EQUALS = 61;
var CHAR_GREATER_THAN = 62;
var CHAR_QUESTION = 63;
var CHAR_COMMERCIAL_AT = 64;
var CHAR_LEFT_SQUARE_BRACKET = 91;
var CHAR_RIGHT_SQUARE_BRACKET = 93;
var CHAR_GRAVE_ACCENT = 96;
var CHAR_LEFT_CURLY_BRACKET = 123;
var CHAR_VERTICAL_LINE = 124;
var CHAR_RIGHT_CURLY_BRACKET = 125;
var ESCAPE_SEQUENCES = {};
ESCAPE_SEQUENCES[0] = "\\0";
ESCAPE_SEQUENCES[7] = "\\a";
ESCAPE_SEQUENCES[8] = "\\b";
ESCAPE_SEQUENCES[9] = "\\t";
ESCAPE_SEQUENCES[10] = "\\n";
ESCAPE_SEQUENCES[11] = "\\v";
ESCAPE_SEQUENCES[12] = "\\f";
ESCAPE_SEQUENCES[13] = "\\r";
ESCAPE_SEQUENCES[27] = "\\e";
ESCAPE_SEQUENCES[34] = '\\"';
ESCAPE_SEQUENCES[92] = "\\\\";
ESCAPE_SEQUENCES[133] = "\\N";
ESCAPE_SEQUENCES[160] = "\\_";
ESCAPE_SEQUENCES[8232] = "\\L";
ESCAPE_SEQUENCES[8233] = "\\P";
var DEPRECATED_BOOLEANS_SYNTAX = [
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "on",
  "On",
  "ON",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "off",
  "Off",
  "OFF"
];
var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function compileStyleMap(schema2, map2) {
  var result, keys, index, length, tag, style, type2;
  if (map2 === null) return {};
  result = {};
  keys = Object.keys(map2);
  for (index = 0, length = keys.length; index < length; index += 1) {
    tag = keys[index];
    style = String(map2[tag]);
    if (tag.slice(0, 2) === "!!") {
      tag = "tag:yaml.org,2002:" + tag.slice(2);
    }
    type2 = schema2.compiledTypeMap["fallback"][tag];
    if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
      style = type2.styleAliases[style];
    }
    result[tag] = style;
  }
  return result;
}
function encodeHex(character) {
  var string, handle, length;
  string = character.toString(16).toUpperCase();
  if (character <= 255) {
    handle = "x";
    length = 2;
  } else if (character <= 65535) {
    handle = "u";
    length = 4;
  } else if (character <= 4294967295) {
    handle = "U";
    length = 8;
  } else {
    throw new exception("code point within a string may not be greater than 0xFFFFFFFF");
  }
  return "\\" + handle + common.repeat("0", length - string.length) + string;
}
var QUOTING_TYPE_SINGLE = 1;
var QUOTING_TYPE_DOUBLE = 2;
function State(options3) {
  this.schema = options3["schema"] || _default;
  this.indent = Math.max(1, options3["indent"] || 2);
  this.noArrayIndent = options3["noArrayIndent"] || false;
  this.skipInvalid = options3["skipInvalid"] || false;
  this.flowLevel = common.isNothing(options3["flowLevel"]) ? -1 : options3["flowLevel"];
  this.styleMap = compileStyleMap(this.schema, options3["styles"] || null);
  this.sortKeys = options3["sortKeys"] || false;
  this.lineWidth = options3["lineWidth"] || 80;
  this.noRefs = options3["noRefs"] || false;
  this.noCompatMode = options3["noCompatMode"] || false;
  this.condenseFlow = options3["condenseFlow"] || false;
  this.quotingType = options3["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes = options3["forceQuotes"] || false;
  this.replacer = typeof options3["replacer"] === "function" ? options3["replacer"] : null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;
  this.tag = null;
  this.result = "";
  this.duplicates = [];
  this.usedDuplicates = null;
}
function indentString(string, spaces) {
  var ind = common.repeat(" ", spaces), position = 0, next = -1, result = "", line, length = string.length;
  while (position < length) {
    next = string.indexOf("\n", position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }
    if (line.length && line !== "\n") result += ind;
    result += line;
  }
  return result;
}
function generateNextLine(state, level) {
  return "\n" + common.repeat(" ", state.indent * level);
}
function testImplicitResolving(state, str2) {
  var index, length, type2;
  for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
    type2 = state.implicitTypes[index];
    if (type2.resolve(str2)) {
      return true;
    }
  }
  return false;
}
function isWhitespace(c4) {
  return c4 === CHAR_SPACE || c4 === CHAR_TAB;
}
function isPrintable(c4) {
  return 32 <= c4 && c4 <= 126 || 161 <= c4 && c4 <= 55295 && c4 !== 8232 && c4 !== 8233 || 57344 <= c4 && c4 <= 65533 && c4 !== CHAR_BOM || 65536 <= c4 && c4 <= 1114111;
}
function isNsCharOrWhitespace(c4) {
  return isPrintable(c4) && c4 !== CHAR_BOM && c4 !== CHAR_CARRIAGE_RETURN && c4 !== CHAR_LINE_FEED;
}
function isPlainSafe(c4, prev, inblock) {
  var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c4);
  var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c4);
  return (
    // ns-plain-safe
    (inblock ? (
      // c = flow-in
      cIsNsCharOrWhitespace
    ) : cIsNsCharOrWhitespace && c4 !== CHAR_COMMA && c4 !== CHAR_LEFT_SQUARE_BRACKET && c4 !== CHAR_RIGHT_SQUARE_BRACKET && c4 !== CHAR_LEFT_CURLY_BRACKET && c4 !== CHAR_RIGHT_CURLY_BRACKET) && c4 !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c4 === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar
  );
}
function isPlainSafeFirst(c4) {
  return isPrintable(c4) && c4 !== CHAR_BOM && !isWhitespace(c4) && c4 !== CHAR_MINUS && c4 !== CHAR_QUESTION && c4 !== CHAR_COLON && c4 !== CHAR_COMMA && c4 !== CHAR_LEFT_SQUARE_BRACKET && c4 !== CHAR_RIGHT_SQUARE_BRACKET && c4 !== CHAR_LEFT_CURLY_BRACKET && c4 !== CHAR_RIGHT_CURLY_BRACKET && c4 !== CHAR_SHARP && c4 !== CHAR_AMPERSAND && c4 !== CHAR_ASTERISK && c4 !== CHAR_EXCLAMATION && c4 !== CHAR_VERTICAL_LINE && c4 !== CHAR_EQUALS && c4 !== CHAR_GREATER_THAN && c4 !== CHAR_SINGLE_QUOTE && c4 !== CHAR_DOUBLE_QUOTE && c4 !== CHAR_PERCENT && c4 !== CHAR_COMMERCIAL_AT && c4 !== CHAR_GRAVE_ACCENT;
}
function isPlainSafeLast(c4) {
  return !isWhitespace(c4) && c4 !== CHAR_COLON;
}
function codePointAt(string, pos) {
  var first = string.charCodeAt(pos), second;
  if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 56320 && second <= 57343) {
      return (first - 55296) * 1024 + second - 56320 + 65536;
    }
  }
  return first;
}
function needIndentIndicator(string) {
  var leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}
var STYLE_PLAIN = 1;
var STYLE_SINGLE = 2;
var STYLE_LITERAL = 3;
var STYLE_FOLDED = 4;
var STYLE_DOUBLE = 5;
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
  var i2;
  var char = 0;
  var prevChar = null;
  var hasLineBreak = false;
  var hasFoldableLine = false;
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1;
  var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
  if (singleLineOnly || forceQuotes) {
    for (i2 = 0; i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
      char = codePointAt(string, i2);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    for (i2 = 0; i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
      char = codePointAt(string, i2);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
          i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
          previousLineBreak = i2;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
  }
  if (!hasLineBreak && !hasFoldableLine) {
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
}
function writeScalar(state, string, level, iskey, inblock) {
  state.dump = function() {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
      }
    }
    var indent = state.indent * Math.max(1, level);
    var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
    var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
    function testAmbiguity(string2) {
      return testImplicitResolving(state, string2);
    }
    switch (chooseScalarStyle(
      string,
      singleLineOnly,
      state.indent,
      lineWidth,
      testAmbiguity,
      state.quotingType,
      state.forceQuotes && !iskey,
      inblock
    )) {
      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string) + '"';
      default:
        throw new exception("impossible error: invalid scalar style");
    }
  }();
}
function blockHeader(string, indentPerLevel) {
  var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
  var clip = string[string.length - 1] === "\n";
  var keep = clip && (string[string.length - 2] === "\n" || string === "\n");
  var chomp = keep ? "+" : clip ? "" : "-";
  return indentIndicator + chomp + "\n";
}
function dropEndingNewline(string) {
  return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
}
function foldString(string, width) {
  var lineRe = /(\n+)([^\n]*)/g;
  var result = function() {
    var nextLF = string.indexOf("\n");
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  }();
  var prevMoreIndented = string[0] === "\n" || string[0] === " ";
  var moreIndented;
  var match;
  while (match = lineRe.exec(string)) {
    var prefix = match[1], line = match[2];
    moreIndented = line[0] === " ";
    result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }
  return result;
}
function foldLine(line, width) {
  if (line === "" || line[0] === " ") return line;
  var breakRe = / [^ ]/g;
  var match;
  var start = 0, end, curr = 0, next = 0;
  var result = "";
  while (match = breakRe.exec(line)) {
    next = match.index;
    if (next - start > width) {
      end = curr > start ? curr : next;
      result += "\n" + line.slice(start, end);
      start = end + 1;
    }
    curr = next;
  }
  result += "\n";
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }
  return result.slice(1);
}
function escapeString(string) {
  var result = "";
  var char = 0;
  var escapeSeq;
  for (var i2 = 0; i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
    char = codePointAt(string, i2);
    escapeSeq = ESCAPE_SEQUENCES[char];
    if (!escapeSeq && isPrintable(char)) {
      result += string[i2];
      if (char >= 65536) result += string[i2 + 1];
    } else {
      result += escapeSeq || encodeHex(char);
    }
  }
  return result;
}
function writeFlowSequence(state, level, object) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
      if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = "[" + _result + "]";
}
function writeBlockSequence(state, level, object, compact) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
      if (!compact || _result !== "") {
        _result += generateNextLine(state, level);
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += "-";
      } else {
        _result += "- ";
      }
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = _result || "[]";
}
function writeFlowMapping(state, level, object) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (_result !== "") pairBuffer += ", ";
    if (state.condenseFlow) pairBuffer += '"';
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level, objectKey, false, false)) {
      continue;
    }
    if (state.dump.length > 1024) pairBuffer += "? ";
    pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
    if (!writeNode(state, level, objectValue, false, false)) {
      continue;
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = "{" + _result + "}";
}
function writeBlockMapping(state, level, object, compact) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
  if (state.sortKeys === true) {
    objectKeyList.sort();
  } else if (typeof state.sortKeys === "function") {
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    throw new exception("sortKeys must be a boolean or a function");
  }
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (!compact || _result !== "") {
      pairBuffer += generateNextLine(state, level);
    }
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue;
    }
    explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += "?";
      } else {
        pairBuffer += "? ";
      }
    }
    pairBuffer += state.dump;
    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }
    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue;
    }
    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ":";
    } else {
      pairBuffer += ": ";
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = _result || "{}";
}
function detectType(state, object, explicit) {
  var _result, typeList, index, length, type2, style;
  typeList = explicit ? state.explicitTypes : state.implicitTypes;
  for (index = 0, length = typeList.length; index < length; index += 1) {
    type2 = typeList[index];
    if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
      if (explicit) {
        if (type2.multi && type2.representName) {
          state.tag = type2.representName(object);
        } else {
          state.tag = type2.tag;
        }
      } else {
        state.tag = "?";
      }
      if (type2.represent) {
        style = state.styleMap[type2.tag] || type2.defaultStyle;
        if (_toString.call(type2.represent) === "[object Function]") {
          _result = type2.represent(object, style);
        } else if (_hasOwnProperty.call(type2.represent, style)) {
          _result = type2.represent[style](object, style);
        } else {
          throw new exception("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
        }
        state.dump = _result;
      }
      return true;
    }
  }
  return false;
}
function writeNode(state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;
  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }
  var type2 = _toString.call(state.dump);
  var inblock = block;
  var tagStr;
  if (block) {
    block = state.flowLevel < 0 || state.flowLevel > level;
  }
  var objectOrArray = type2 === "[object Object]" || type2 === "[object Array]", duplicateIndex, duplicate;
  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }
  if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
    compact = false;
  }
  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = "*ref_" + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type2 === "[object Object]") {
      if (block && Object.keys(state.dump).length !== 0) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object Array]") {
      if (block && state.dump.length !== 0) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object String]") {
      if (state.tag !== "?") {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type2 === "[object Undefined]") {
      return false;
    } else {
      if (state.skipInvalid) return false;
      throw new exception("unacceptable kind of an object to dump " + type2);
    }
    if (state.tag !== null && state.tag !== "?") {
      tagStr = encodeURI(
        state.tag[0] === "!" ? state.tag.slice(1) : state.tag
      ).replace(/!/g, "%21");
      if (state.tag[0] === "!") {
        tagStr = "!" + tagStr;
      } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
        tagStr = "!!" + tagStr.slice(18);
      } else {
        tagStr = "!<" + tagStr + ">";
      }
      state.dump = tagStr + " " + state.dump;
    }
  }
  return true;
}
function getDuplicateReferences(object, state) {
  var objects = [], duplicatesIndexes = [], index, length;
  inspectNode(object, objects, duplicatesIndexes);
  for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}
function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList, index, length;
  if (object !== null && typeof object === "object") {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);
      if (Array.isArray(object)) {
        for (index = 0, length = object.length; index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);
        for (index = 0, length = objectKeyList.length; index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}
function dump$1(input, options3) {
  options3 = options3 || {};
  var state = new State(options3);
  if (!state.noRefs) getDuplicateReferences(input, state);
  var value = input;
  if (state.replacer) {
    value = state.replacer.call({ "": value }, "", value);
  }
  if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
  return "";
}
var dump_1 = dump$1;
var dumper = {
  dump: dump_1
};
function renamed(from, to) {
  return function() {
    throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
  };
}
var Type = type;
var Schema = schema;
var FAILSAFE_SCHEMA = failsafe;
var JSON_SCHEMA = json;
var CORE_SCHEMA = core;
var DEFAULT_SCHEMA = _default;
var load = loader.load;
var loadAll = loader.loadAll;
var dump = dumper.dump;
var YAMLException = exception;
var types = {
  binary,
  float,
  map,
  null: _null,
  pairs,
  set,
  timestamp,
  bool,
  int,
  merge,
  omap,
  seq,
  str
};
var safeLoad = renamed("safeLoad", "load");
var safeLoadAll = renamed("safeLoadAll", "loadAll");
var safeDump = renamed("safeDump", "dump");
var jsYaml = {
  Type,
  Schema,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  load,
  loadAll,
  dump,
  YAMLException,
  types,
  safeLoad,
  safeLoadAll,
  safeDump
};
var js_yaml_default = jsYaml;

// libs/language/src/utils/yamlBlue/type/float.ts
var floatTypeOptions = js_yaml_default.types.float.options;
var options = {
  ...floatTypeOptions,
  construct: (data) => {
    const value = data.replace(/_/g, "").toLowerCase();
    if (!q(value)) {
      return new BigDecimalNumber(value);
    }
    if (floatTypeOptions.construct) {
      return floatTypeOptions.construct(data);
    }
  }
};
var FloatType = new js_yaml_default.Type("tag:yaml.org,2002:float", options);

// libs/language/src/utils/yamlBlue/type/int.ts
var intTypeOptions = js_yaml_default.types.int.options;
var options2 = {
  ...intTypeOptions,
  construct: (data) => {
    let value = data;
    if (value.indexOf("_") !== -1) {
      value = value.replace(/_/g, "");
    }
    if (!q(value)) {
      return new BigIntegerNumber(value);
    }
    if (intTypeOptions.construct) {
      return intTypeOptions.construct(data);
    }
  }
};
var IntType = new js_yaml_default.Type("tag:yaml.org,2002:int", options2);

// libs/language/src/utils/yamlBlue/schema.ts
var YAML_BLUE_SCHEMA = js_yaml_default.CORE_SCHEMA.extend({
  implicit: [FloatType, IntType]
});

// libs/language/src/utils/yamlBlue/parse.ts
var yamlBlueParse = (value) => {
  const loadedYaml = js_yaml_default.load(value, { schema: YAML_BLUE_SCHEMA });
  if (loadedYaml === void 0) {
    return void 0;
  }
  const jsonBlueValue = loadedYaml;
  return jsonBlueValue;
};

// raw-yaml:/Users/mjonak/www-apps/work/Blue/blue-js-3/libs/language/src/lib/resources/transformation/DefaultBlue.yaml
var DefaultBlue_default = "- type:\n    blueId: 27B7fuxQCS1VAptiCPc2RMkKoutP5qxkh3uDxZ7dr6Eo\n  mappings:\n    Text: F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP\n    Double: 68ryJtnmui4j5rCZWUnkZ3DChtmEb7Z9F8atn1mBSM3L\n    Integer: DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8\n    Boolean: EL6AjrbJsxTWRTPzY8WR8Y2zAMXRbydQj83PcZwuAHbo\n    List: G8wmfjEqugPEEXByMYWJXiEdbLToPRWNQEekNxrxfQWB\n    Dictionary: 294NBTj2mFRL3RB4kDRUSckwGg7Kzj6T8CTAFeR1kcSA\n- type:\n    blueId: FGYuTXwaoSKfZmpTysLTLsb8WzSqf43384rKZDkXhxD4\n";

// raw-yaml:/Users/mjonak/www-apps/work/Blue/blue-js-3/libs/language/src/lib/resources/transformation/Transformation.yaml
var Transformation_default = "name: Transformation\ndescription: TODO";

// raw-yaml:/Users/mjonak/www-apps/work/Blue/blue-js-3/libs/language/src/lib/resources/transformation/InferBasicTypesForUntypedValues.yaml
var InferBasicTypesForUntypedValues_default = "name: Infer Basic Types For Untyped Values\ntype:\n  blueId: Ct1SGRGw1i47qjzm1ruiUdSZofeV6WevPTGuieVvbRS4\ndescription: This transformation infers type details for Text, Integer, Number and Boolean.";

// raw-yaml:/Users/mjonak/www-apps/work/Blue/blue-js-3/libs/language/src/lib/resources/transformation/ReplaceInlineTypesWithBlueIds.yaml
var ReplaceInlineTypesWithBlueIds_default = "name: Replace Inline Types with BlueIds\ntype:\n  blueId: Ct1SGRGw1i47qjzm1ruiUdSZofeV6WevPTGuieVvbRS4\ndescription: This transformation replaces";

// libs/language/src/lib/provider/BaseContentNodeProvider.ts
var contents = [
  DefaultBlue_default,
  Transformation_default,
  InferBasicTypesForUntypedValues_default,
  ReplaceInlineTypesWithBlueIds_default
];
var BaseContentNodeProvider = class extends NodeProvider {
  constructor() {
    super();
    __publicField(this, "blueIdToNodesMap", /* @__PURE__ */ new Map());
    this.load();
  }
  fetchByBlueId(blueId) {
    return this.blueIdToNodesMap.get(blueId) || [];
  }
  load() {
    for (const content of contents) {
      const parsedYaml = yamlBlueParse(content);
      if (parsedYaml === void 0) {
        console.error(`This content file is not valid YAML: ${content}`);
        continue;
      }
      if (Array.isArray(parsedYaml)) {
        const nodes = parsedYaml.map(
          (item) => NodeDeserializer.deserialize(item)
        );
        const blueId = BlueIdCalculator.calculateBlueIdSync(nodes);
        this.blueIdToNodesMap.set(blueId, nodes);
      } else {
        const node = NodeDeserializer.deserialize(parsedYaml);
        const blueId = BlueIdCalculator.calculateBlueIdSync(node);
        this.blueIdToNodesMap.set(blueId, [node]);
      }
    }
  }
};

// libs/language/src/lib/provider/BootstrapProvider.ts
var _BootstrapProvider = class _BootstrapProvider extends NodeProvider {
  constructor() {
    super();
    __publicField(this, "nodeProvider");
    this.nodeProvider = new BaseContentNodeProvider();
  }
  fetchByBlueId(blueId) {
    return this.nodeProvider.fetchByBlueId(blueId);
  }
};
__publicField(_BootstrapProvider, "INSTANCE", new _BootstrapProvider());
var BootstrapProvider = _BootstrapProvider;

// libs/language/src/lib/provider/NodeContentHandler.ts
var ParsedContent = class {
  constructor(blueId, content, isMultipleDocuments) {
    this.blueId = blueId;
    this.content = content;
    this.isMultipleDocuments = isMultipleDocuments;
  }
};
var NodeContentHandler = class {
  static parseAndCalculateBlueId(content, preprocessor) {
    let jsonNode;
    try {
      const parsed = yamlBlueParse(content);
      if (parsed === void 0) {
        throw new Error();
      }
      jsonNode = parsed;
    } catch {
      throw new Error("Failed to parse content as YAML or JSON");
    }
    let blueId;
    let resultContent;
    const isMultipleDocuments = Array.isArray(jsonNode) && jsonNode.length > 1;
    if (isMultipleDocuments) {
      const nodes = jsonNode.map((item) => {
        const node = NodeDeserializer.deserialize(item);
        return preprocessor(node);
      });
      blueId = BlueIdCalculator.calculateBlueIdSync(nodes);
      resultContent = nodes.map((node) => NodeToMapListOrValue.get(node));
    } else {
      const node = NodeDeserializer.deserialize(jsonNode);
      const processedNode = preprocessor(node);
      blueId = BlueIdCalculator.calculateBlueIdSync(processedNode);
      resultContent = NodeToMapListOrValue.get(processedNode);
    }
    return new ParsedContent(blueId, resultContent, isMultipleDocuments);
  }
  static parseAndCalculateBlueIdForNode(node, preprocessor) {
    const preprocessedNode = preprocessor(node);
    const blueId = BlueIdCalculator.calculateBlueIdSync(preprocessedNode);
    const jsonNode = NodeToMapListOrValue.get(preprocessedNode);
    return new ParsedContent(blueId, jsonNode, false);
  }
  static parseAndCalculateBlueIdForNodeList(nodes, preprocessor) {
    if (!nodes || nodes.length === 0) {
      throw new Error("List of nodes cannot be null or empty");
    }
    const preprocessedNodes = nodes.map(preprocessor);
    const blueId = BlueIdCalculator.calculateBlueIdSync(preprocessedNodes);
    const jsonNodes = preprocessedNodes.map(
      (node) => NodeToMapListOrValue.get(node)
    );
    const isMultipleDocuments = nodes.length > 1;
    return new ParsedContent(blueId, jsonNodes, isMultipleDocuments);
  }
  static resolveThisReferences(content, currentBlueId, isMultipleDocuments) {
    return this.resolveThisReferencesRecursive(
      content,
      currentBlueId,
      isMultipleDocuments
    );
  }
  static resolveThisReferencesRecursive(content, currentBlueId, isMultipleDocuments) {
    if (content && typeof content === "object" && !Array.isArray(content)) {
      const result = {};
      for (const [key2, value] of Object.entries(content)) {
        if (typeof value === "string") {
          if (this.THIS_REFERENCE_PATTERN.test(value)) {
            result[key2] = this.resolveThisReference(
              value,
              currentBlueId,
              isMultipleDocuments
            );
          } else {
            result[key2] = value;
          }
        } else if (value && typeof value === "object") {
          result[key2] = this.resolveThisReferencesRecursive(
            value,
            currentBlueId,
            isMultipleDocuments
          );
        } else {
          result[key2] = value;
        }
      }
      return result;
    } else if (Array.isArray(content)) {
      return content.map((element) => {
        if (typeof element === "string") {
          if (this.THIS_REFERENCE_PATTERN.test(element)) {
            return this.resolveThisReference(
              element,
              currentBlueId,
              isMultipleDocuments
            );
          }
          return element;
        } else if (element && typeof element === "object") {
          return this.resolveThisReferencesRecursive(
            element,
            currentBlueId,
            isMultipleDocuments
          );
        }
        return element;
      });
    }
    return content;
  }
  static resolveThisReference(textValue, currentBlueId, isMultipleDocuments) {
    if (isMultipleDocuments) {
      if (!textValue.startsWith("this#")) {
        throw new Error(
          "For multiple documents, 'this' references must include an index (e.g., 'this#0')"
        );
      }
      return currentBlueId + textValue.substring(4);
    } else {
      if (textValue === "this") {
        return currentBlueId;
      } else {
        throw new Error(
          "For a single document, only 'this' is allowed as a reference, not 'this#<id>'"
        );
      }
    }
  }
};
__publicField(NodeContentHandler, "THIS_REFERENCE_PATTERN", /^this(#\d+)?$/);

// libs/language/src/lib/provider/AbstractNodeProvider.ts
var AbstractNodeProvider = class extends NodeProvider {
  fetchByBlueId(blueId) {
    const baseBlueId = blueId.split("#")[0];
    const content = this.fetchContentByBlueId(baseBlueId);
    if (content === null || content === void 0) {
      return null;
    }
    const isMultipleDocuments = Array.isArray(content) && content.length > 1;
    const resolvedContent = NodeContentHandler.resolveThisReferences(
      content,
      baseBlueId,
      isMultipleDocuments
    );
    if (blueId.includes("#")) {
      const parts = blueId.split("#");
      if (parts.length > 1) {
        const index = parseInt(parts[1]);
        if (Array.isArray(resolvedContent) && index < resolvedContent.length) {
          const item = resolvedContent[index];
          const node = NodeDeserializer.deserialize(item);
          node.setBlueId(blueId);
          return [node];
        } else if (index === 0) {
          const node = NodeDeserializer.deserialize(resolvedContent);
          node.setBlueId(blueId);
          return [node];
        } else {
          return null;
        }
      }
    }
    if (Array.isArray(resolvedContent)) {
      return resolvedContent.map((item) => {
        const node = NodeDeserializer.deserialize(item);
        return node;
      });
    } else {
      const node = NodeDeserializer.deserialize(resolvedContent);
      node.setBlueId(baseBlueId);
      return [node];
    }
  }
};

// libs/language/src/lib/provider/PreloadedNodeProvider.ts
var PreloadedNodeProvider = class extends AbstractNodeProvider {
  constructor() {
    super(...arguments);
    __publicField(this, "nameToBlueIdsMap", /* @__PURE__ */ new Map());
  }
  /**
   * Find a node by name. Throws an error if multiple nodes are found with the same name.
   * @param name - The name to search for
   * @returns The node if found, or undefined if not found
   */
  findNodeByName(name) {
    const blueIds = this.nameToBlueIdsMap.get(name);
    if (!blueIds) {
      return void 0;
    }
    if (blueIds.length > 1) {
      throw new Error(`Multiple nodes found with name: ${name}`);
    }
    const nodes = this.fetchByBlueId(blueIds[0]);
    return nodes && nodes.length > 0 ? nodes[0] : void 0;
  }
  /**
   * Find all nodes with the given name
   * @param name - The name to search for
   * @returns Array of nodes with the given name
   */
  findAllNodesByName(name) {
    const blueIds = this.nameToBlueIdsMap.get(name);
    if (!blueIds) {
      return [];
    }
    const result = [];
    for (const blueId of blueIds) {
      const nodes = this.fetchByBlueId(blueId);
      if (nodes) {
        result.push(...nodes);
      }
    }
    return result;
  }
  /**
   * Add a name to Blue ID mapping
   * @param name - The name of the node
   * @param blueId - The Blue ID of the node
   */
  addToNameMap(name, blueId) {
    this.nameToBlueIdsMap.set(name, [
      ...this.nameToBlueIdsMap.get(name) || [],
      blueId
    ]);
  }
};

// libs/language/src/utils/url.ts
function isUrl(str2) {
  try {
    const url = new URL(str2);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// libs/language/src/lib/preprocess/processor/InferBasicTypesForUntypedValues.ts
var InferBasicTypesForUntypedValues = class {
  /**
   * Process a document node to infer basic types for untyped values
   * @param document - The document to process
   * @returns The processed document
   */
  process(document) {
    return NodeTransformer.transform(document, this.inferType.bind(this));
  }
  /**
   * Infer a basic type for a node
   * @param node - The node to infer a type for
   * @returns The node with the inferred type
   */
  inferType(node) {
    const type2 = node.getType();
    const value = node.getValue();
    if (R(type2) && g(value)) {
      if (typeof value === "string") {
        node.setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));
      } else if (typeof value === "bigint" || isBigIntegerNumber(value)) {
        node.setType(new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID));
      } else if (isBigDecimalNumber(value)) {
        node.setType(new BlueNode().setBlueId(DOUBLE_TYPE_BLUE_ID));
      } else if (typeof value === "boolean") {
        node.setType(new BlueNode().setBlueId(BOOLEAN_TYPE_BLUE_ID));
      }
    }
    return node;
  }
};

// libs/language/src/lib/preprocess/processor/ReplaceInlineValuesForTypeAttributesWithImports.ts
var _ReplaceInlineValuesForTypeAttributesWithImports = class _ReplaceInlineValuesForTypeAttributesWithImports {
  /**
   * Creates a new processor with the given transformation node or mappings
   * @param transformationOrMappings - The transformation node or mappings to use
   */
  constructor(transformationOrMappings) {
    __publicField(this, "mappings", /* @__PURE__ */ new Map());
    if (transformationOrMappings instanceof BlueNode) {
      const transformation = transformationOrMappings;
      const properties = transformation.getProperties();
      if (properties && properties[_ReplaceInlineValuesForTypeAttributesWithImports.MAPPINGS]) {
        const mappingsNode = properties[_ReplaceInlineValuesForTypeAttributesWithImports.MAPPINGS];
        const mappingProperties = mappingsNode.getProperties();
        if (mappingProperties) {
          Object.entries(mappingProperties).forEach(([key2, node]) => {
            const value = node.getValue();
            if (typeof value === "string") {
              this.mappings.set(key2, value);
            }
          });
        }
      }
    } else {
      this.mappings = transformationOrMappings;
    }
  }
  /**
   * Process a document node to replace inline values for type attributes with imports
   * @param document - The document to process
   * @returns The processed document
   */
  process(document) {
    return NodeTransformer.transform(document, this.transformNode.bind(this));
  }
  transformNode(node) {
    const transformedNode = node.clone();
    this.transformTypeField(transformedNode, transformedNode.getType());
    this.transformTypeField(transformedNode, transformedNode.getItemType());
    this.transformTypeField(transformedNode, transformedNode.getKeyType());
    this.transformTypeField(transformedNode, transformedNode.getValueType());
    return transformedNode;
  }
  transformTypeField(node, typeNode) {
    if (typeNode && typeNode.isInlineValue() && typeNode.getValue() !== void 0) {
      const typeValue = String(typeNode.getValue());
      if (this.mappings.has(typeValue)) {
        const blueId = this.mappings.get(typeValue);
        if (blueId) {
          const newTypeNode = new BlueNode().setBlueId(blueId);
          if (typeNode === node.getType()) {
            node.setType(newTypeNode);
          } else if (typeNode === node.getItemType()) {
            node.setItemType(newTypeNode);
          } else if (typeNode === node.getKeyType()) {
            node.setKeyType(newTypeNode);
          } else if (typeNode === node.getValueType()) {
            node.setValueType(newTypeNode);
          }
        }
      }
    }
  }
};
__publicField(_ReplaceInlineValuesForTypeAttributesWithImports, "MAPPINGS", "mappings");
var ReplaceInlineValuesForTypeAttributesWithImports = _ReplaceInlineValuesForTypeAttributesWithImports;

// libs/language/src/lib/preprocess/processor/ValidateInlineTypesReplaced.ts
var ValidateInlineTypesReplaced = class {
  /**
   * Process a document node to validate all inline types have been replaced
   * @param document - The document to process
   * @returns The document unchanged if validation passes
   * @throws Error if any inline type values remain without BlueId mappings
   */
  process(document) {
    NodeTransformer.transform(document, this.validateNode.bind(this));
    return document;
  }
  validateNode(node) {
    this.validateTypeField(node, node.getType(), "type");
    this.validateTypeField(node, node.getItemType(), "itemType");
    this.validateTypeField(node, node.getKeyType(), "keyType");
    this.validateTypeField(node, node.getValueType(), "valueType");
    return node;
  }
  validateTypeField(node, typeNode, fieldName) {
    if (typeNode && typeNode.isInlineValue() && typeNode.getValue() !== void 0) {
      const typeValue = String(typeNode.getValue());
      throw new Error(
        `Unknown type "${typeValue}" found in ${fieldName} field. No BlueId mapping exists for this type.`
      );
    }
  }
};

// libs/language/src/lib/utils/NodeExtender.ts
var NodeExtender = class {
  /**
   * Creates a new NodeExtender with the specified NodeProvider and optional strategy
   * @param nodeProvider - The NodeProvider to use for resolving nodes
   * @param strategy - The strategy to use for missing elements (defaults to THROW_EXCEPTION)
   */
  constructor(nodeProvider, strategy) {
    __publicField(this, "nodeProvider");
    __publicField(this, "strategy");
    this.nodeProvider = NodeProviderWrapper.wrap(nodeProvider);
    this.strategy = strategy || "THROW_EXCEPTION";
  }
  /**
   * Extends a node with its resolved references
   * @param node - The node to extend
   * @param limits - The limits to apply when extending
   */
  extend(node, limits) {
    this.extendNode(node, limits, "");
  }
  extendNode(currentNode, currentLimits, currentSegment, skipLimitCheck = false) {
    if (!skipLimitCheck) {
      if (!currentLimits.shouldExtendPathSegment(currentSegment, currentNode)) {
        return;
      }
      currentLimits.enterPathSegment(currentSegment, currentNode);
    }
    try {
      const blueId = currentNode.getBlueId();
      if (blueId && !CORE_TYPE_BLUE_IDS.includes(
        blueId
      )) {
        const resolvedNodes = this.fetchNode(currentNode);
        if (resolvedNodes && resolvedNodes.length > 0) {
          if (resolvedNodes.length === 1) {
            const resolvedNode = resolvedNodes[0];
            this.mergeNodes(currentNode, resolvedNode);
          } else {
            const mergedNodes = resolvedNodes.map((node) => node.clone());
            const listNode = new BlueNode().setItems(mergedNodes);
            this.mergeNodes(currentNode, listNode);
          }
        }
      }
      const typeNode = currentNode.getType();
      if (typeNode) {
        this.extendNode(typeNode, currentLimits, "type", true);
      }
      const itemTypeNode = currentNode.getItemType();
      if (itemTypeNode) {
        this.extendNode(itemTypeNode, currentLimits, "itemType", true);
      }
      const keyTypeNode = currentNode.getKeyType();
      if (keyTypeNode) {
        this.extendNode(keyTypeNode, currentLimits, "keyType", true);
      }
      const valueTypeNode = currentNode.getValueType();
      if (valueTypeNode) {
        this.extendNode(valueTypeNode, currentLimits, "valueType", true);
      }
      const properties = currentNode.getProperties();
      if (properties) {
        Object.entries(properties).forEach(([key2, value]) => {
          this.extendNode(value, currentLimits, key2, false);
        });
      }
      const items = currentNode.getItems();
      if (items && items.length > 0) {
        this.reconstructList(items);
        for (let i2 = 0; i2 < items.length; i2++) {
          this.extendNode(items[i2], currentLimits, String(i2), false);
        }
      }
    } finally {
      if (!skipLimitCheck) {
        currentLimits.exitPathSegment();
      }
    }
  }
  reconstructList(items) {
    while (items.length > 0) {
      const firstItem = items[0];
      const blueId = firstItem?.getBlueId();
      if (!blueId) {
        break;
      }
      const resolved = this.nodeProvider.fetchByBlueId(blueId);
      if (!resolved || resolved.length === 1) {
        break;
      }
      items.shift();
      items.unshift(...resolved);
    }
  }
  fetchNode(node) {
    const nodeBlueId = node.getBlueId();
    if (!nodeBlueId) {
      if (this.strategy === "RETURN_EMPTY") {
        return null;
      } else {
        throw new Error(`No blueId found for node: ${node.getName()}`);
      }
    }
    const resolvedNodes = this.nodeProvider.fetchByBlueId(nodeBlueId);
    if (!resolvedNodes || resolvedNodes.length === 0) {
      if (this.strategy === "RETURN_EMPTY") {
        return null;
      } else {
        throw new Error(`No content found for blueId: ${node.getBlueId()}`);
      }
    }
    return resolvedNodes;
  }
  mergeNodes(target, source) {
    target.setName(source.getName());
    target.setDescription(source.getDescription());
    target.setType(source.getType());
    target.setItemType(source.getItemType());
    target.setKeyType(source.getKeyType());
    target.setValueType(source.getValueType());
    const sourceValue = source.getValue();
    if (g(sourceValue)) {
      target.setValue(sourceValue);
    }
    target.setItems(source.getItems());
    target.setProperties(source.getProperties());
  }
};

// libs/language/src/lib/preprocess/utils/BlueIdsMappingGenerator.ts
var BlueIdsMappingGenerator = class {
  constructor() {
    __publicField(this, "blueIdsCollections", []);
  }
  /**
   * Initializes the generator with default BlueIds collections
   * @param defaultCollections - Array of default BlueIds objects to initialize with
   */
  initialize(...defaultCollections) {
    this.blueIdsCollections = [...defaultCollections];
  }
  /**
   * Registers additional BlueIds collections for mapping generation
   * @param blueIdsCollections - Array of BlueIds objects to register
   */
  registerBlueIds(...blueIdsCollections) {
    this.blueIdsCollections.push(...blueIdsCollections);
  }
  /**
   * Generates YAML mappings section from all registered BlueIds collections
   * @param transformationBlueId - The BlueId for the transformation type (defaults to the standard one)
   * @returns YAML string with mappings for all BlueIds
   */
  generateMappingsYaml(transformationBlueId = "27B7fuxQCS1VAptiCPc2RMkKoutP5qxkh3uDxZ7dr6Eo") {
    const allMappings = {};
    for (const blueIdsCollection of this.blueIdsCollections) {
      Object.assign(allMappings, blueIdsCollection);
    }
    const mappingsEntries = Object.entries(allMappings).map(([name, blueId]) => `    ${name}: ${blueId}`).join("\n");
    return `- type:
    blueId: ${transformationBlueId}
  mappings:
${mappingsEntries}`;
  }
  /**
   * Gets all currently registered BlueIds as a merged object
   * @returns Merged object containing all BlueIds from all collections
   */
  getAllBlueIds() {
    const allMappings = {};
    for (const blueIdsCollection of this.blueIdsCollections) {
      Object.assign(allMappings, blueIdsCollection);
    }
    return allMappings;
  }
  /**
   * Gets the names of all registered BlueIds
   * @returns Array of all BlueId names
   */
  getAllBlueIdNames() {
    return Object.keys(this.getAllBlueIds());
  }
  /**
   * Clears all registered BlueIds collections
   */
  clear() {
    this.blueIdsCollections = [];
  }
  /**
   * Gets the count of registered BlueIds collections
   * @returns Number of registered collections
   */
  getCollectionCount() {
    return this.blueIdsCollections.length;
  }
  /**
   * Gets the total count of unique BlueIds across all collections
   * @returns Number of unique BlueIds
   */
  getTotalBlueIdCount() {
    return Object.keys(this.getAllBlueIds()).length;
  }
};

// libs/language/src/lib/preprocess/Preprocessor.ts
var _Preprocessor = class _Preprocessor {
  /**
   * Creates a new Preprocessor with the specified options
   * @param options - Configuration options for the preprocessor
   */
  constructor(options3 = {}) {
    __publicField(this, "processorProvider");
    __publicField(this, "nodeProvider");
    __publicField(this, "defaultSimpleBlue", null);
    __publicField(this, "blueIdsMappingGenerator");
    const { nodeProvider, processorProvider, blueIdsMappingGenerator } = options3;
    if (!nodeProvider) {
      throw new Error("NodeProvider is required");
    }
    this.nodeProvider = NodeProviderWrapper.wrap(nodeProvider);
    this.processorProvider = processorProvider || _Preprocessor.getStandardProvider();
    this.blueIdsMappingGenerator = blueIdsMappingGenerator || new BlueIdsMappingGenerator();
    this.loadDefaultSimpleBlue();
  }
  /**
   * Preprocesses a document node
   * @param document - The document node to preprocess
   * @returns The preprocessed document
   */
  preprocess(document) {
    return this.preprocessWithOptions(document, null);
  }
  /**
   * Preprocesses a document node using the default Blue node
   * @param document - The document node to preprocess
   * @returns The preprocessed document
   */
  preprocessWithDefaultBlue(document) {
    return this.preprocessWithOptions(document, this.defaultSimpleBlue);
  }
  /**
   * Preprocesses a document node with the specified default Blue node
   * @param document - The document node to preprocess
   * @param defaultBlue - The default Blue node to use if the document doesn't have one
   * @returns The preprocessed document
   */
  preprocessWithOptions(document, defaultBlue) {
    let processedDocument = document.clone();
    let blueNode = processedDocument.getBlue();
    if (!blueNode && defaultBlue) {
      blueNode = defaultBlue.clone();
    }
    if (blueNode) {
      new NodeExtender(this.nodeProvider).extend(
        blueNode,
        PathLimits2.withSinglePath("/*")
      );
      const transformations = blueNode.getItems();
      if (transformations && transformations.length > 0) {
        for (const transformation of transformations) {
          const processor2 = this.processorProvider.getProcessor(transformation);
          if (processor2) {
            processedDocument = processor2.process(processedDocument);
          } else {
            throw new Error(
              `No processor found for transformation: ${transformation}`
            );
          }
        }
        processedDocument.setBlue(void 0);
      }
      processedDocument = new ValidateInlineTypesReplaced().process(
        processedDocument
      );
    }
    return processedDocument;
  }
  /**
   * Gets the standard transformation processor provider
   * @returns The standard provider
   */
  static getStandardProvider() {
    return {
      getProcessor(transformation) {
        const REPLACE_INLINE_TYPES = "27B7fuxQCS1VAptiCPc2RMkKoutP5qxkh3uDxZ7dr6Eo";
        const INFER_BASIC_TYPES = "FGYuTXwaoSKfZmpTysLTLsb8WzSqf43384rKZDkXhxD4";
        const blueId = transformation.getType()?.getBlueId();
        if (REPLACE_INLINE_TYPES === blueId) {
          return new ReplaceInlineValuesForTypeAttributesWithImports(
            transformation
          );
        } else if (INFER_BASIC_TYPES === blueId) {
          return new InferBasicTypesForUntypedValues();
        }
        return void 0;
      }
    };
  }
  /**
   * Enriches the default Blue YAML with dynamic BlueIds mappings
   * @param defaultBlue - The base default Blue YAML content
   * @returns Enriched YAML content with dynamic mappings
   */
  enrichDefaultBlue(defaultBlue) {
    const dynamicMappings = this.blueIdsMappingGenerator.generateMappingsYaml();
    return `
${defaultBlue}
${dynamicMappings}
    `;
  }
  /**
   * Loads the default simple Blue node
   */
  loadDefaultSimpleBlue() {
    const enrichedDefaultBlue = this.enrichDefaultBlue(DefaultBlue_default);
    try {
      const parsedYaml = yamlBlueParse(enrichedDefaultBlue);
      if (parsedYaml) {
        this.defaultSimpleBlue = NodeDeserializer.deserialize(parsedYaml);
      } else {
        throw new Error("Failed to parse default Blue content");
      }
    } catch (e) {
      throw new Error(`Error loading default Blue: ${e}`);
    }
  }
};
__publicField(_Preprocessor, "DEFAULT_BLUE_BLUE_ID", "FREHAAGDZSzpnoTUoCQ86bBmxbVCULMjvx9JZM6fyqT1");
var Preprocessor = _Preprocessor;

// libs/language/src/lib/provider/RepositoryBasedNodeProvider.ts
var RepositoryBasedNodeProvider = class extends PreloadedNodeProvider {
  constructor(repositories2) {
    super();
    __publicField(this, "blueIdToContentMap", /* @__PURE__ */ new Map());
    __publicField(this, "blueIdToMultipleDocumentsMap", /* @__PURE__ */ new Map());
    __publicField(this, "preprocessor");
    const defaultPreprocessor = new Preprocessor({ nodeProvider: this });
    this.preprocessor = (node) => defaultPreprocessor.preprocessWithDefaultBlue(node);
    this.loadRepositories(repositories2);
  }
  loadRepositories(repositories2) {
    for (const repository of repositories2) {
      if (repository.contents) {
        for (const [providedBlueId, content] of Object.entries(
          repository.contents
        )) {
          this.processContent(content, providedBlueId);
        }
      }
    }
  }
  processContent(content, providedBlueId) {
    if (Array.isArray(content)) {
      this.processMultipleDocuments(content, providedBlueId);
    } else {
      this.processSingleDocument(content, providedBlueId);
    }
  }
  processSingleDocument(content, providedBlueId) {
    const node = NodeDeserializer.deserialize(content);
    const parsedContent = NodeContentHandler.parseAndCalculateBlueIdForNode(
      node,
      this.preprocessor
    );
    const blueId = providedBlueId || parsedContent.blueId;
    this.blueIdToContentMap.set(blueId, parsedContent.content);
    this.blueIdToMultipleDocumentsMap.set(blueId, false);
    const nodeName = node.getName();
    if (nodeName) {
      this.addToNameMap(nodeName, blueId);
    }
  }
  processMultipleDocuments(contents2, providedBlueId) {
    const nodes = contents2.map((item) => {
      const node = NodeDeserializer.deserialize(item);
      return this.preprocessor(node);
    });
    const parsedContent = NodeContentHandler.parseAndCalculateBlueIdForNodeList(
      nodes,
      (node) => node
      // Already preprocessed above
    );
    const blueId = providedBlueId || parsedContent.blueId;
    this.blueIdToContentMap.set(blueId, parsedContent.content);
    this.blueIdToMultipleDocumentsMap.set(blueId, true);
    nodes.forEach((node, index) => {
      const itemBlueId = `${blueId}#${index}`;
      const itemContent = NodeToMapListOrValue.get(node);
      const individualBlueId = BlueIdCalculator.calculateBlueIdSync(node);
      this.blueIdToContentMap.set(individualBlueId, itemContent);
      this.blueIdToMultipleDocumentsMap.set(individualBlueId, false);
      const nodeName = node.getName();
      if (nodeName) {
        this.addToNameMap(nodeName, itemBlueId);
      }
    });
  }
  fetchContentByBlueId(baseBlueId) {
    const content = this.blueIdToContentMap.get(baseBlueId);
    const isMultipleDocuments = this.blueIdToMultipleDocumentsMap.get(baseBlueId);
    if (content !== void 0 && isMultipleDocuments !== void 0) {
      return NodeContentHandler.resolveThisReferences(
        content,
        baseBlueId,
        isMultipleDocuments
      );
    }
    return null;
  }
  /**
   * Get all stored Blue IDs
   */
  getBlueIds() {
    return Array.from(this.blueIdToContentMap.keys());
  }
  /**
   * Check if a Blue ID exists in this provider
   */
  hasBlueId(blueId) {
    const baseBlueId = blueId.split("#")[0];
    return this.blueIdToContentMap.has(baseBlueId);
  }
};

// libs/language/src/lib/utils/NodeProviderWrapper.ts
var NodeProviderWrapper = class {
  /**
   * Wraps a NodeProvider with a SequentialNodeProvider that includes bootstrap providers and repository definitions
   * @param originalProvider - The original NodeProvider to wrap
   * @param repositories - Optional repositories containing definitions
   * @returns A wrapped NodeProvider that includes bootstrap providers and repository definitions
   */
  static wrap(originalProvider, repositories2) {
    const providers = [BootstrapProvider.INSTANCE];
    if (repositories2 && repositories2.length > 0) {
      const repositoryProvider = new RepositoryBasedNodeProvider(repositories2);
      providers.push(repositoryProvider);
    }
    providers.push(originalProvider);
    return new SequentialNodeProvider(providers);
  }
};

// libs/language/src/lib/preprocess/BlueDirectivePreprocessor.ts
var BlueDirectivePreprocessor = class {
  /**
   * Creates a new BlueDirectivePreprocessor
   *
   * @param preprocessingAliases - Map of alias values to BlueIds (optional)
   * @param urlContentFetcher - UrlContentFetcher for fetching URL content
   */
  constructor(preprocessingAliases, urlContentFetcher) {
    __publicField(this, "preprocessingAliases", /* @__PURE__ */ new Map());
    __publicField(this, "urlContentFetcher");
    if (preprocessingAliases) {
      this.preprocessingAliases = new Map(preprocessingAliases);
    }
    this.urlContentFetcher = urlContentFetcher;
  }
  /**
   * Processes a node's blue directive synchronously
   *
   * @param node - The node to process
   * @returns The node with processed blue directive
   */
  process(node) {
    const blueNodeValue = this.getBlueNodeValue(node);
    if (blueNodeValue) {
      const clonedNode = node.clone();
      if (this.preprocessingAliases.has(blueNodeValue)) {
        return this.handleAliasValue(clonedNode, blueNodeValue);
      } else if (BlueIds.isPotentialBlueId(blueNodeValue)) {
        return this.handleBlueId(clonedNode, blueNodeValue);
      } else if (isUrl(blueNodeValue)) {
        throw new Error(
          `URL '${blueNodeValue}' detected. Use the async version of this method to fetch the content.`
        );
      } else {
        throw new Error(`Invalid blue value: ${blueNodeValue}`);
      }
    }
    return node;
  }
  /**
   * Processes a node's blue directive asynchronously, with support for URL fetching
   *
   * @param node - The node to process
   * @returns Promise that resolves to the node with processed blue directive
   */
  async processAsync(node) {
    const blueNodeValue = this.getBlueNodeValue(node);
    if (blueNodeValue) {
      const clonedNode = node.clone();
      if (this.preprocessingAliases.has(blueNodeValue)) {
        return this.handleAliasValue(clonedNode, blueNodeValue);
      } else if (BlueIds.isPotentialBlueId(blueNodeValue)) {
        return this.handleBlueId(clonedNode, blueNodeValue);
      } else if (isUrl(blueNodeValue) && this.urlContentFetcher) {
        try {
          const urlNodes = await this.fetchFromUrl(blueNodeValue);
          if (urlNodes) {
            clonedNode.setBlue(new BlueNode().setItems(urlNodes));
          }
          return clonedNode;
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(
              `Failed to fetch from URL '${blueNodeValue}'.
${error.message}`
            );
          }
          throw error;
        }
      } else if (isUrl(blueNodeValue)) {
        throw new Error(
          `UrlContentFetcher not provided for URL: ${blueNodeValue}`
        );
      } else {
        throw new Error(`Invalid blue value: ${blueNodeValue}`);
      }
    }
    return node;
  }
  /**
   * Gets the blue node value if it exists and is a string
   * @param node - The node to get the blue value from
   * @returns The blue node value or null if it doesn't exist or isn't a string
   */
  getBlueNodeValue(node) {
    const blueNode = node.getBlue();
    const blueNodeValue = blueNode?.getValue();
    return blueNodeValue && typeof blueNodeValue === "string" ? blueNodeValue : null;
  }
  /**
   * Handles a blue value that is an alias
   * @param node - The cloned node to modify
   * @param value - The alias value
   * @returns The modified node
   */
  handleAliasValue(node, value) {
    node.setBlue(
      new BlueNode().setBlueId(this.preprocessingAliases.get(value))
    );
    return node;
  }
  /**
   * Handles a blue value that is a potential BlueId
   * @param node - The cloned node to modify
   * @param value - The BlueId value
   * @returns The modified node
   */
  handleBlueId(node, value) {
    node.setBlue(new BlueNode().setBlueId(value));
    return node;
  }
  /**
   * Fetches content from a URL
   * @param url - The URL to fetch from
   * @returns Promise that resolves to the fetched BlueNodes or null if fetch fails
   */
  async fetchFromUrl(url) {
    if (!this.urlContentFetcher) {
      throw new Error(`UrlContentFetcher not provided for URL: ${url}`);
    }
    return await this.urlContentFetcher.fetchAndCache(url);
  }
  /**
   * Gets the current preprocessing aliases
   * @returns Map of aliases to BlueIds
   */
  getPreprocessingAliases() {
    return new Map(this.preprocessingAliases);
  }
  /**
   * Sets the preprocessing aliases
   * @param aliases - Map of aliases to set
   * @returns this instance for chaining
   */
  setPreprocessingAliases(aliases) {
    this.preprocessingAliases = new Map(aliases);
    return this;
  }
  /**
   * Adds preprocessing aliases to the map
   * @param aliases - Map of aliases to add
   * @returns this instance for chaining
   */
  addPreprocessingAliases(aliases) {
    aliases.forEach((value, key2) => {
      this.preprocessingAliases.set(key2, value);
    });
    return this;
  }
  /**
   * Updates the URL content fetcher
   * @param urlContentFetcher - The UrlContentFetcher to use
   * @returns this instance for chaining
   */
  setUrlContentFetcher(urlContentFetcher) {
    this.urlContentFetcher = urlContentFetcher;
    return this;
  }
  /**
   * Gets the current URL content fetcher
   * @returns The current UrlContentFetcher or undefined
   */
  getUrlContentFetcher() {
    return this.urlContentFetcher;
  }
};

// libs/language/src/lib/provider/UrlContentFetcher.ts
var DefaultUrlFetchStrategy = {
  fetchUrl: async (url) => {
    throw new Error(
      `You must provide a custom UrlFetchStrategy to fetch content from URL: ${url}`
    );
  }
};
var UrlContentFetcher = class {
  constructor(fetchStrategy) {
    // Cache to avoid repeated network requests for the same URL
    __publicField(this, "cache", /* @__PURE__ */ new Map());
    __publicField(this, "fetchStrategy");
    __publicField(this, "enabled", false);
    __publicField(this, "allowedDomains", []);
    this.fetchStrategy = fetchStrategy || DefaultUrlFetchStrategy;
  }
  validateUrl(url) {
    if (!isUrl(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }
    return true;
  }
  isDomainAllowed(url) {
    if (this.allowedDomains.length === 0) {
      return true;
    }
    try {
      const urlObj = new URL(url);
      return this.allowedDomains.some(
        (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }
  getFromCache(url) {
    try {
      this.validateUrl(url);
      return this.cache.get(url) || [];
    } catch {
      return [];
    }
  }
  async fetchAndCache(url) {
    this.validateUrl(url);
    if (!this.enabled) {
      throw new Error(
        `URL fetching is disabled. Enable it using the enableFetching method.`
      );
    }
    if (!this.isDomainAllowed(url)) {
      throw new Error(`Domain not allowed for URL: ${url}.`);
    }
    let urlFetchResult;
    try {
      urlFetchResult = await this.fetchStrategy.fetchUrl(url);
    } catch (error) {
      throw new Error(`Error fetching from URL: ${url}`, { cause: error });
    }
    const { data, contentType } = urlFetchResult;
    let parsedData;
    if (contentType.includes("application/json") || contentType.includes("text/yaml") || contentType.includes("application/yaml") || contentType.includes("text/plain")) {
      parsedData = yamlBlueParse(data);
    } else {
      throw new Error(`Unsupported content type from URL: ${contentType}`);
    }
    if (parsedData === void 0) {
      throw new Error(`Failed to parse content from URL: ${url}`);
    }
    let nodes;
    if (Array.isArray(parsedData)) {
      nodes = parsedData.map((item) => NodeDeserializer.deserialize(item));
    } else {
      nodes = [NodeDeserializer.deserialize(parsedData)];
    }
    this.cache.set(url, nodes);
    return nodes;
  }
  prefetchUrl(url, nodes) {
    try {
      this.validateUrl(url);
      this.cache.set(url, nodes);
    } catch {
    }
  }
  clearCache() {
    this.cache.clear();
  }
  setFetchStrategy(fetchStrategy) {
    this.fetchStrategy = fetchStrategy;
    return this;
  }
  getFetchStrategy() {
    return this.fetchStrategy;
  }
  /**
   * Enables fetching for all URLs
   * @returns This instance for chaining
   */
  enableFetching() {
    this.enabled = true;
    this.allowedDomains = [];
    return this;
  }
  /**
   * Enables fetching for specific domains only
   * @param domains Array of allowed domains
   * @returns This instance for chaining
   */
  enableFetchingForDomains(domains) {
    this.enabled = true;
    this.allowedDomains = [...domains];
    return this;
  }
  /**
   * Disables all URL fetching
   * @returns This instance for chaining
   */
  disableFetching() {
    this.enabled = false;
    return this;
  }
  isFetchingEnabled() {
    return this.enabled;
  }
  /**
   * Gets the list of allowed domains
   * An empty list means all domains are allowed when fetching is enabled
   * @returns Array of allowed domains
   */
  getAllowedDomains() {
    return [...this.allowedDomains];
  }
  /**
   * Adds a domain to the allowed domains list
   * @param domain Domain to allow
   * @returns This instance for chaining
   */
  allowDomain(domain) {
    if (!this.allowedDomains.includes(domain)) {
      this.allowedDomains.push(domain);
    }
    return this;
  }
  /**
   * Removes a domain from the allowed domains list
   * @param domain Domain to disallow
   * @returns This instance for chaining
   */
  disallowDomain(domain) {
    this.allowedDomains = this.allowedDomains.filter((d3) => d3 !== domain);
    return this;
  }
  /**
   * Clears all allowed domains, meaning all domains will be allowed when fetching is enabled
   * @returns This instance for chaining
   */
  clearAllowedDomains() {
    this.allowedDomains = [];
    return this;
  }
};

// libs/language/src/lib/utils/MergeReverser.ts
var MergeReverser = class {
  reverse(mergedNode) {
    const minimalNode = new BlueNode();
    this.reverseNode(minimalNode, mergedNode, mergedNode.getType());
    return minimalNode;
  }
  reverseNode(minimal, merged, fromType) {
    if (this.isIdenticalToType(merged, fromType)) {
      return;
    }
    this.reverseBasicProperties(minimal, merged, fromType);
    this.reverseTypeReferences(minimal, merged, fromType);
    this.reverseItems(minimal, merged, fromType);
    this.reverseProperties(minimal, merged, fromType);
  }
  isIdenticalToType(merged, fromType) {
    return g(merged.getBlueId()) && g(fromType?.getBlueId()) && merged.getBlueId() === fromType.getBlueId();
  }
  reverseBasicProperties(minimal, merged, fromType) {
    const mergedValue = merged.getValue();
    if (g(mergedValue) && (R(fromType) || R(fromType.getValue()))) {
      minimal.setValue(mergedValue);
    }
    if (g(merged.getName()) && (R(fromType) || merged.getName() !== fromType.getName())) {
      minimal.setName(merged.getName());
    }
    if (g(merged.getDescription()) && (R(fromType) || merged.getDescription() !== fromType.getDescription())) {
      minimal.setDescription(merged.getDescription());
    }
    if (g(merged.getBlueId()) && (R(fromType) || merged.getBlueId() !== fromType.getBlueId())) {
      minimal.setBlueId(merged.getBlueId());
    }
  }
  reverseTypeReferences(minimal, merged, fromType) {
    const setIfDifferent = (getter, setter) => {
      const mergedTypeRef = getter(merged);
      const fromTypeRef = fromType ? getter(fromType) : void 0;
      const mergedBlueId = mergedTypeRef?.getBlueId();
      if (g(mergedBlueId) && (R(fromTypeRef?.getBlueId()) || mergedBlueId !== fromTypeRef.getBlueId())) {
        setter(minimal, new BlueNode().setBlueId(mergedBlueId));
      }
    };
    setIfDifferent(
      (n) => n.getType(),
      (n, v4) => n.setType(v4)
    );
    setIfDifferent(
      (n) => n.getItemType(),
      (n, v4) => n.setItemType(v4)
    );
    setIfDifferent(
      (n) => n.getKeyType(),
      (n, v4) => n.setKeyType(v4)
    );
    setIfDifferent(
      (n) => n.getValueType(),
      (n, v4) => n.setValueType(v4)
    );
  }
  reverseItems(minimal, merged, fromType) {
    const mergedItems = merged.getItems();
    if (R(mergedItems)) {
      return;
    }
    const fromTypeItems = fromType?.getItems();
    const minimalItems = [];
    if (g(fromTypeItems) && fromTypeItems.length > 0) {
      const itemsBlueId = BlueIdCalculator.calculateBlueIdSync(fromTypeItems);
      minimalItems.push(new BlueNode().setBlueId(itemsBlueId));
    }
    const startIndex = fromTypeItems?.length || 0;
    for (let i2 = startIndex; i2 < mergedItems.length; i2++) {
      const minimalItem = new BlueNode();
      this.reverseNode(minimalItem, mergedItems[i2], void 0);
      minimalItems.push(minimalItem);
    }
    if (minimalItems.length > 0) {
      minimal.setItems(minimalItems);
    }
  }
  reverseProperties(minimal, merged, fromType) {
    const mergedProperties = merged.getProperties();
    if (R(mergedProperties)) {
      return;
    }
    const minimalProperties = {};
    for (const [key2, mergedProperty] of Object.entries(mergedProperties)) {
      const inheritedProperty = this.getInheritedProperty(
        key2,
        merged,
        fromType
      );
      const minimalProperty = new BlueNode();
      this.reverseNode(minimalProperty, mergedProperty, inheritedProperty);
      if (!Nodes.isEmptyNode(minimalProperty)) {
        minimalProperties[key2] = minimalProperty;
      }
    }
    if (Object.keys(minimalProperties).length > 0) {
      minimal.setProperties(minimalProperties);
    }
  }
  /**
   * Determines what a property inherits from by combining contributions
   * from both the parent type and the node's own type.
   */
  getInheritedProperty(key2, merged, fromType) {
    const fromParentType = fromType?.getProperties()?.[key2];
    const fromOwnType = merged.getType()?.getProperties()?.[key2];
    if (R(fromParentType) && R(fromOwnType)) {
      return void 0;
    }
    if (R(fromParentType)) {
      return fromOwnType;
    }
    if (R(fromOwnType)) {
      return fromParentType;
    }
    return this.mergeNodes(fromParentType, fromOwnType);
  }
  /**
   * Merges two nodes, with the second node's properties taking precedence.
   * This represents what would be inherited when both parent and own types
   * contribute to a property.
   */
  mergeNodes(base2, overlay) {
    const merged = base2.clone();
    const overlayValue = overlay.getValue();
    if (g(overlayValue)) {
      merged.setValue(overlayValue);
    }
    const overlayType = overlay.getType();
    if (g(overlayType)) {
      merged.setType(overlayType.clone());
    }
    const overlayItemType = overlay.getItemType();
    if (g(overlayItemType)) {
      merged.setItemType(overlayItemType.clone());
    }
    const overlayKeyType = overlay.getKeyType();
    if (g(overlayKeyType)) {
      merged.setKeyType(overlayKeyType.clone());
    }
    const overlayValueType = overlay.getValueType();
    if (g(overlayValueType)) {
      merged.setValueType(overlayValueType.clone());
    }
    const overlayProps = overlay.getProperties();
    if (g(overlayProps)) {
      const mergedProps = merged.getProperties() || {};
      for (const [k3, v4] of Object.entries(overlayProps)) {
        mergedProps[k3] = v4.clone();
      }
      merged.setProperties(mergedProps);
    }
    const overlayItems = overlay.getItems();
    if (g(overlayItems)) {
      merged.setItems(overlayItems.map((item) => item.clone()));
    }
    return merged;
  }
};

// libs/language/src/lib/model/ResolvedNode.ts
var ResolvedBlueNode = class _ResolvedBlueNode extends BlueNode {
  /**
   * Creates a new ResolvedBlueNode from a resolved BlueNode
   * @param resolvedNode - The fully resolved node after merge operations
   */
  constructor(resolvedNode) {
    super(resolvedNode.getName());
    this.createFrom(resolvedNode);
  }
  /**
   * Checks if this is a resolved node
   * @returns Always returns true for ResolvedBlueNode instances
   */
  isResolved() {
    return true;
  }
  /**
   * Gets the minimal representation of this node.
   * This represents the node without any properties inherited from type resolution.
   *
   * @returns The minimal node representation
   */
  getMinimalNode() {
    const reverser = new MergeReverser();
    return reverser.reverse(this);
  }
  getMinimalBlueId() {
    const minimalNode = this.getMinimalNode();
    return BlueIdCalculator.calculateBlueIdSync(minimalNode);
  }
  /**
   * Creates a clone of this ResolvedBlueNode
   * @returns A new ResolvedBlueNode with the same state
   */
  clone() {
    const clonedBase = super.clone();
    return new _ResolvedBlueNode(clonedBase);
  }
  /**
   * Copies all properties from another BlueNode
   * @param source - The node to copy properties from
   */
  createFrom(source) {
    if (source.getName() !== this.getName()) {
      this.setName(source.getName());
    }
    this.setDescription(source.getDescription()).setType(source.getType()).setItemType(source.getItemType()).setKeyType(source.getKeyType()).setValueType(source.getValueType()).setItems(source.getItems()).setProperties(source.getProperties()).setBlueId(source.getBlueId()).setBlue(source.getBlue()).setInlineValue(source.isInlineValue());
    const value = source.getValue();
    if (value !== void 0) {
      this.setValue(value);
    }
  }
};

// libs/language/src/lib/merge/NodeResolver.ts
var NodeResolver = class {
  /**
   * Resolves a node without limits
   * Default implementation that uses NO_LIMITS
   *
   * @param node - The node to resolve
   * @returns The resolved node using NO_LIMITS
   */
  resolveWithoutLimits(node) {
    return this.resolve(node, NO_LIMITS);
  }
};

// libs/language/src/lib/merge/Merger.ts
var Merger = class extends NodeResolver {
  /**
   * Creates a new Merger with the specified MergingProcessor and NodeProvider
   * @param mergingProcessor - The processor to use for merge operations
   * @param nodeProvider - The provider to use for resolving nodes
   */
  constructor(mergingProcessor, nodeProvider) {
    super();
    __publicField(this, "mergingProcessor");
    __publicField(this, "nodeProvider");
    this.mergingProcessor = mergingProcessor;
    this.nodeProvider = NodeProviderWrapper.wrap(nodeProvider);
  }
  /**
   * Merges a source node into a target node with the given limits
   * @param target - The target node to merge into
   * @param source - The source node to merge from
   * @param limits - The limits to apply during merging
   * @returns A new BlueNode with the merged content
   */
  merge(target, source, limits) {
    if (g(source.getBlue())) {
      throw new Error(
        'Document contains "blue" attribute. Preprocess document before merging.'
      );
    }
    let newTarget = target;
    const typeNode = source.getType();
    if (g(typeNode)) {
      const clonedTypeNode = typeNode.clone();
      if (g(clonedTypeNode.getBlueId())) {
        new NodeExtender(this.nodeProvider).extend(
          clonedTypeNode,
          PathLimits2.withSinglePath("/")
        );
      }
      const resolvedType = this.resolve(clonedTypeNode, limits);
      const sourceWithResolvedType = source.clone().setType(resolvedType);
      newTarget = this.merge(newTarget, clonedTypeNode, limits);
      return this.mergeObject(newTarget, sourceWithResolvedType, limits);
    }
    return this.mergeObject(newTarget, source, limits);
  }
  /**
   * Merges the properties and items of a source node into a target node
   * @param target - The target node to merge into
   * @param source - The source node to merge from
   * @param limits - The limits to apply during merging
   * @returns A new BlueNode with the merged content
   */
  mergeObject(target, source, limits) {
    let newTarget = this.mergingProcessor.process(
      target,
      source,
      this.nodeProvider
    );
    const children = source.getItems();
    if (g(children)) {
      newTarget = this.mergeChildren(newTarget, children, limits);
    }
    const properties = source.getProperties();
    if (g(properties)) {
      Object.entries(properties).forEach(([key2, value]) => {
        if (limits.shouldMergePathSegment(key2, value)) {
          limits.enterPathSegment(key2, value);
          newTarget = this.mergeProperty(newTarget, key2, value, limits);
          limits.exitPathSegment();
        }
      });
    }
    if (g(source.getBlueId())) {
      newTarget = newTarget.clone().setBlueId(source.getBlueId());
    }
    if (this.mergingProcessor.postProcess) {
      newTarget = this.mergingProcessor.postProcess(
        newTarget,
        source,
        this.nodeProvider
      );
    }
    return newTarget;
  }
  /**
   * Merges child items from source into target
   * @param target - The target node
   * @param sourceChildren - The source children to merge
   * @param limits - The limits to apply
   * @returns A new BlueNode with the merged children
   */
  mergeChildren(target, sourceChildren, limits) {
    const targetChildren = target.getItems();
    if (R(targetChildren)) {
      const filteredChildren = sourceChildren.filter(
        (child, index) => limits.shouldMergePathSegment(String(index), child)
      ).map((child) => {
        limits.enterPathSegment(String(sourceChildren.indexOf(child)), child);
        const resolvedChild = this.resolve(child, limits);
        limits.exitPathSegment();
        return resolvedChild;
      });
      return target.clone().setItems(filteredChildren);
    } else if (sourceChildren.length < targetChildren.length) {
      throw new Error(
        `Subtype of element must not have more items (${targetChildren.length}) than the element itself (${sourceChildren.length}).`
      );
    }
    const newTargetChildren = [...targetChildren];
    for (let i2 = 0; i2 < sourceChildren.length; i2++) {
      if (!limits.shouldMergePathSegment(String(i2), sourceChildren[i2])) {
        continue;
      }
      limits.enterPathSegment(String(i2), sourceChildren[i2]);
      if (i2 >= newTargetChildren.length) {
        newTargetChildren.push(sourceChildren[i2]);
        limits.exitPathSegment();
        continue;
      }
      const sourceBlueId = BlueIdCalculator.calculateBlueIdSync(
        sourceChildren[i2]
      );
      const targetBlueId = BlueIdCalculator.calculateBlueIdSync(
        newTargetChildren[i2]
      );
      if (sourceBlueId !== targetBlueId) {
        throw new Error(
          `Mismatched items at index ${i2}: source item has blueId '${sourceBlueId}', but target item has blueId '${targetBlueId}'.`
        );
      }
      limits.exitPathSegment();
    }
    return target.clone().setItems(newTargetChildren);
  }
  /**
   * Merges a property from source into target
   * @param target - The target node
   * @param sourceKey - The property key
   * @param sourceValue - The property value to merge
   * @param limits - The limits to apply
   * @returns A new BlueNode with the merged property
   */
  mergeProperty(target, sourceKey, sourceValue, limits) {
    const node = this.resolve(sourceValue, limits);
    const newTarget = target.clone();
    if (R(newTarget.getProperties())) {
      newTarget.setProperties({});
    }
    const targetValue = newTarget.getProperties()[sourceKey];
    if (targetValue === void 0) {
      newTarget.getProperties()[sourceKey] = node;
    } else {
      newTarget.getProperties()[sourceKey] = this.mergeObject(
        targetValue,
        node,
        limits
      );
    }
    return newTarget;
  }
  /**
   * Resolves a node by creating a new node and merging the source into it
   * @param node - The node to resolve
   * @param limits - The limits to apply during resolution
   * @returns A ResolvedBlueNode containing the resolved content
   */
  resolve(node, limits) {
    const resultNode = new BlueNode();
    const mergedNode = this.merge(resultNode, node, limits);
    const finalNode = mergedNode.clone().setName(node.getName()).setDescription(node.getDescription()).setBlueId(node.getBlueId());
    return new ResolvedBlueNode(finalNode);
  }
};

// libs/language/src/lib/merge/processors/SequentialMergingProcessor.ts
var SequentialMergingProcessor = class {
  /**
   * Creates a new SequentialMergingProcessor with the given processors
   * @param mergingProcessors - Array of processors to execute in sequence
   */
  constructor(mergingProcessors) {
    __publicField(this, "mergingProcessors");
    this.mergingProcessors = mergingProcessors;
  }
  /**
   * Processes all contained processors in sequence
   */
  process(target, source, nodeProvider) {
    return this.mergingProcessors.reduce(
      (currentTarget, processor2) => processor2.process(currentTarget, source, nodeProvider),
      target
    );
  }
  /**
   * Post-processes all contained processors in sequence
   */
  postProcess(target, source, nodeProvider) {
    return this.mergingProcessors.reduce((currentPostTarget, processor2) => {
      if (processor2.postProcess) {
        return processor2.postProcess(currentPostTarget, source, nodeProvider);
      }
      return currentPostTarget;
    }, target);
  }
};

// libs/language/src/lib/merge/processors/ValuePropagator.ts
var ValuePropagator = class {
  process(target, source) {
    const sourceValue = source.getValue();
    if (g(sourceValue)) {
      const targetValue = target.getValue();
      if (R(targetValue)) {
        return target.clone().setValue(sourceValue);
      } else if (!isEqualValue(sourceValue, targetValue)) {
        throw new Error(
          `Node values conflict. Source node value: ${sourceValue}, target node value: ${targetValue}`
        );
      }
    }
    return target;
  }
};
var isEqualValue = (a4, b3) => {
  if (isBigIntegerNumber(a4) && isBigIntegerNumber(b3) || isBigDecimalNumber(a4) && isBigDecimalNumber(b3)) {
    return a4.eq(b3);
  }
  return a4 === b3;
};

// libs/language/src/lib/merge/processors/TypeAssigner.ts
var TypeAssigner = class {
  process(target, source, nodeProvider) {
    const targetType = target.getType();
    const sourceType = source.getType();
    let newTarget = target;
    if (targetType === void 0) {
      newTarget = target.clone().setType(sourceType);
    } else if (sourceType !== void 0) {
      const isSubtypeResult = NodeTypes_exports.isSubtype(
        sourceType,
        targetType,
        nodeProvider
      );
      if (!isSubtypeResult) {
        const sourceTypeStr = NodeToMapListOrValue.get(sourceType);
        const targetTypeStr = NodeToMapListOrValue.get(targetType);
        throw new Error(
          `The source type '${JSON.stringify(
            sourceTypeStr
          )}' is not a subtype of the target type '${JSON.stringify(
            targetTypeStr
          )}'.`
        );
      }
      newTarget = target.clone().setType(sourceType);
    }
    return newTarget;
  }
};

// libs/language/src/lib/merge/processors/ListProcessor.ts
var ListProcessor = class {
  process(target, source, nodeProvider) {
    if (source.getItemType() !== void 0 && !NodeTypes_exports.isListType(source.getType())) {
      throw new Error("Source node with itemType must have a List type");
    }
    const targetItemType = target.getItemType();
    const sourceItemType = source.getItemType();
    let newTarget = target;
    if (targetItemType === void 0) {
      if (sourceItemType !== void 0) {
        newTarget = target.clone().setItemType(sourceItemType);
      }
    } else if (sourceItemType !== void 0) {
      const isSubtypeResult = NodeTypes_exports.isSubtype(
        sourceItemType,
        targetItemType,
        nodeProvider
      );
      if (!isSubtypeResult) {
        const sourceItemTypeStr = NodeToMapListOrValue.get(sourceItemType);
        const targetItemTypeStr = NodeToMapListOrValue.get(targetItemType);
        throw new Error(
          `The source item type '${JSON.stringify(
            sourceItemTypeStr
          )}' is not a subtype of the target item type '${JSON.stringify(
            targetItemTypeStr
          )}'.`
        );
      }
      newTarget = target.clone().setItemType(sourceItemType);
    }
    const targetItemTypeForValidation = newTarget.getItemType();
    const sourceItems = source.getItems();
    if (targetItemTypeForValidation !== void 0 && sourceItems !== void 0) {
      for (const item of sourceItems) {
        const itemType = item.getType();
        if (itemType !== void 0 && !NodeTypes_exports.isSubtype(
          itemType,
          targetItemTypeForValidation,
          nodeProvider
        )) {
          const itemTypeStr = NodeToMapListOrValue.get(itemType);
          const targetItemTypeStr = NodeToMapListOrValue.get(
            targetItemTypeForValidation
          );
          throw new Error(
            `Item of type '${JSON.stringify(
              itemTypeStr
            )}' is not a subtype of the list's item type '${JSON.stringify(
              targetItemTypeStr
            )}'.`
          );
        }
      }
    }
    return newTarget;
  }
};

// libs/language/src/lib/merge/processors/DictionaryProcessor.ts
var DictionaryProcessor = class {
  process(target, source, nodeProvider) {
    if ((source.getKeyType() !== void 0 || source.getValueType() !== void 0) && !NodeTypes_exports.isDictionaryType(source.getType())) {
      throw new Error(
        "Source node with keyType or valueType must have a Dictionary type"
      );
    }
    let newTarget = this.processKeyType(target, source, nodeProvider);
    newTarget = this.processValueType(newTarget, source, nodeProvider);
    const targetKeyType = newTarget.getKeyType();
    const targetValueType = newTarget.getValueType();
    const sourceProperties = source.getProperties();
    if ((targetKeyType !== void 0 || targetValueType !== void 0) && sourceProperties !== void 0) {
      Object.entries(sourceProperties).forEach(([key2, value]) => {
        if (targetKeyType !== void 0) {
          this.validateKeyType(key2, targetKeyType, nodeProvider);
        }
        if (targetValueType !== void 0) {
          this.validateValueType(value, targetValueType, nodeProvider);
        }
      });
    }
    return newTarget;
  }
  processKeyType(target, source, nodeProvider) {
    const targetKeyType = target.getKeyType();
    const sourceKeyType = source.getKeyType();
    if (targetKeyType === void 0) {
      if (sourceKeyType !== void 0) {
        this.validateBasicKeyType(sourceKeyType, nodeProvider);
        return target.clone().setKeyType(sourceKeyType);
      }
    } else if (sourceKeyType !== void 0) {
      this.validateBasicKeyType(sourceKeyType, nodeProvider);
      const isSubtypeResult = NodeTypes_exports.isSubtype(
        sourceKeyType,
        targetKeyType,
        nodeProvider
      );
      if (!isSubtypeResult) {
        const sourceKeyTypeStr = NodeToMapListOrValue.get(sourceKeyType);
        const targetKeyTypeStr = NodeToMapListOrValue.get(targetKeyType);
        throw new Error(
          `The source key type '${JSON.stringify(
            sourceKeyTypeStr
          )}' is not a subtype of the target key type '${JSON.stringify(
            targetKeyTypeStr
          )}'.`
        );
      }
      return target.clone().setKeyType(sourceKeyType);
    }
    return target;
  }
  processValueType(target, source, nodeProvider) {
    const targetValueType = target.getValueType();
    const sourceValueType = source.getValueType();
    if (targetValueType === void 0) {
      if (sourceValueType !== void 0) {
        return target.clone().setValueType(sourceValueType);
      }
    } else if (sourceValueType !== void 0) {
      const isSubtypeResult = NodeTypes_exports.isSubtype(
        sourceValueType,
        targetValueType,
        nodeProvider
      );
      if (!isSubtypeResult) {
        const sourceValueTypeStr = NodeToMapListOrValue.get(sourceValueType);
        const targetValueTypeStr = NodeToMapListOrValue.get(targetValueType);
        throw new Error(
          `The source value type '${JSON.stringify(
            sourceValueTypeStr
          )}' is not a subtype of the target value type '${JSON.stringify(
            targetValueTypeStr
          )}'.`
        );
      }
      return target.clone().setValueType(sourceValueType);
    }
    return target;
  }
  validateBasicKeyType(keyType, nodeProvider) {
    if (!NodeTypes_exports.isBasicType(keyType, nodeProvider)) {
      throw new Error("Dictionary key type must be a basic type");
    }
  }
  validateKeyType(key2, keyType, nodeProvider) {
    if (NodeTypes_exports.isTextType(keyType, nodeProvider)) {
      return;
    }
    if (NodeTypes_exports.isIntegerType(keyType, nodeProvider)) {
      const parsed = Number.parseInt(key2, 10);
      if (Number.isNaN(parsed) || parsed.toString() !== key2) {
        throw new Error(`Key '${key2}' is not a valid Integer.`);
      }
    } else if (NodeTypes_exports.isNumberType(keyType, nodeProvider)) {
      const parsed = Number.parseFloat(key2);
      if (Number.isNaN(parsed)) {
        throw new Error(`Key '${key2}' is not a valid Number.`);
      }
    } else if (NodeTypes_exports.isBooleanType(keyType, nodeProvider)) {
      if (key2.toLowerCase() !== "true" && key2.toLowerCase() !== "false") {
        throw new Error(`Key '${key2}' is not a valid Boolean.`);
      }
    } else {
      throw new Error(
        `Unsupported key type: ${keyType.getName() || "unknown"}`
      );
    }
  }
  validateValueType(value, valueType, nodeProvider) {
    const nodeValueType = value.getType();
    if (nodeValueType !== void 0 && !NodeTypes_exports.isSubtype(nodeValueType, valueType, nodeProvider)) {
      const valueTypeStr = NodeToMapListOrValue.get(nodeValueType);
      const expectedValueTypeStr = NodeToMapListOrValue.get(valueType);
      throw new Error(
        `Value of type '${JSON.stringify(
          valueTypeStr
        )}' is not a subtype of the dictionary's value type '${JSON.stringify(
          expectedValueTypeStr
        )}'.`
      );
    }
  }
};

// libs/language/src/lib/merge/processors/BasicTypesVerifier.ts
var BasicTypesVerifier = class {
  process(target) {
    return target;
  }
  postProcess(target, source, nodeProvider) {
    const targetType = target.getType();
    if (targetType !== void 0 && NodeTypes_exports.isSubtypeOfBasicType(targetType, nodeProvider)) {
      const items = target.getItems();
      const properties = target.getProperties();
      if (items !== void 0 && items.length > 0 || properties !== void 0 && Object.keys(properties).length > 0) {
        const basicTypeName = NodeTypes_exports.findBasicTypeName(
          targetType,
          nodeProvider
        );
        const typeName = targetType.getName() || "unknown";
        throw new Error(
          `Node of type "${typeName}" (which extends basic type "${basicTypeName}") must not have items, properties or contracts.`
        );
      }
    }
    return target;
  }
};

// libs/language/src/lib/merge/processors/MetadataPropagator.ts
var MetadataPropagator = class {
  process(target, source) {
    let newTarget = target;
    const sourceName = source.getName();
    const targetName = target.getName();
    if (sourceName !== void 0 && targetName === void 0) {
      newTarget = newTarget.clone().setName(sourceName);
    }
    const sourceDescription = source.getDescription();
    const targetDescription = newTarget.getDescription();
    if (sourceDescription !== void 0 && targetDescription === void 0) {
      newTarget = newTarget.clone().setDescription(sourceDescription);
    }
    return newTarget;
  }
};

// libs/language/src/lib/merge/utils/default.ts
function createDefaultMergingProcessor() {
  return new SequentialMergingProcessor([
    new ValuePropagator(),
    new TypeAssigner(),
    new ListProcessor(),
    new DictionaryProcessor(),
    new MetadataPropagator(),
    new BasicTypesVerifier()
  ]);
}

// libs/language/src/lib/Blue.ts
var Blue = class {
  constructor(options3 = {}) {
    __publicField(this, "nodeProvider");
    __publicField(this, "typeSchemaResolver");
    __publicField(this, "blueDirectivePreprocessor");
    __publicField(this, "urlContentFetcher");
    __publicField(this, "blueIdsMappingGenerator");
    __publicField(this, "globalLimits", NO_LIMITS);
    __publicField(this, "mergingProcessor");
    __publicField(this, "repositories");
    __publicField(this, "prepareForBlueIdCalculation", async (value) => {
      if (value instanceof BlueNode || Array.isArray(value) && value.every((v4) => v4 instanceof BlueNode)) {
        return value;
      }
      if (Array.isArray(value)) {
        const nodes = await Promise.all(
          value.map((v4) => this.jsonValueToNodeAsync(v4))
        );
        return nodes;
      }
      return this.jsonValueToNodeAsync(value);
    });
    __publicField(this, "calculateBlueId", async (value) => {
      const prepared = await this.prepareForBlueIdCalculation(value);
      return BlueIdCalculator.calculateBlueId(prepared);
    });
    __publicField(this, "prepareForBlueIdCalculationSync", (value) => {
      if (value instanceof BlueNode || Array.isArray(value) && value.every((v4) => v4 instanceof BlueNode)) {
        return value;
      }
      if (Array.isArray(value)) {
        return value.map((v4) => this.jsonValueToNode(v4));
      }
      return this.jsonValueToNode(value);
    });
    const {
      nodeProvider,
      typeSchemaResolver = null,
      urlFetchStrategy,
      repositories: repositories2,
      mergingProcessor
    } = options3;
    this.repositories = repositories2;
    const defaultProvider = createNodeProvider(() => []);
    this.nodeProvider = NodeProviderWrapper.wrap(
      nodeProvider || defaultProvider,
      repositories2
    );
    this.typeSchemaResolver = typeSchemaResolver ?? new TypeSchemaResolver([]);
    this.mergingProcessor = mergingProcessor ?? createDefaultMergingProcessor();
    this.urlContentFetcher = new UrlContentFetcher(urlFetchStrategy);
    this.blueDirectivePreprocessor = new BlueDirectivePreprocessor(
      void 0,
      this.urlContentFetcher
    );
    this.blueIdsMappingGenerator = new BlueIdsMappingGenerator();
    if (repositories2) {
      for (const { schemas, blueIds } of repositories2) {
        this.typeSchemaResolver?.registerSchemas(schemas);
        this.blueIdsMappingGenerator.registerBlueIds(blueIds);
      }
    }
  }
  /**
   * Converts a BlueNode to a JSON representation based on the specified strategy.
   *
   * @param node - The BlueNode to convert.
   * @param strategy - The conversion strategy to use. See {@link NodeToMapListOrValue.get} for detailed strategy descriptions.
   * @returns A JSON representation of the node.
   */
  nodeToJson(node, strategy = "official") {
    return NodeToMapListOrValue.get(node, strategy);
  }
  nodeToSchemaOutput(node, schema2) {
    const converter = new NodeToObjectConverter(this.typeSchemaResolver);
    return converter.convert(node, schema2);
  }
  resolve(node, limits = NO_LIMITS) {
    const effectiveLimits = this.combineWithGlobalLimits(limits);
    const merger = new Merger(this.mergingProcessor, this.nodeProvider);
    return merger.resolve(node, effectiveLimits);
  }
  reverse(node) {
    const reverser = new MergeReverser();
    return reverser.reverse(node);
  }
  extend(node, limits) {
    const effectiveLimits = this.combineWithGlobalLimits(limits);
    new NodeExtender(this.nodeProvider).extend(node, effectiveLimits);
  }
  jsonValueToNode(json2) {
    return this.preprocess(NodeDeserializer.deserialize(json2));
  }
  async jsonValueToNodeAsync(json2) {
    return this.preprocessAsync(NodeDeserializer.deserialize(json2));
  }
  yamlToNode(yaml) {
    const json2 = yamlBlueParse(yaml);
    if (!json2) {
      throw new Error("Failed to parse YAML to JSON");
    }
    return this.jsonValueToNode(json2);
  }
  async yamlToNodeAsync(yaml) {
    const json2 = yamlBlueParse(yaml);
    if (!json2) {
      throw new Error("Failed to parse YAML to JSON");
    }
    return this.jsonValueToNodeAsync(json2);
  }
  calculateBlueIdSync(value) {
    const prepared = this.prepareForBlueIdCalculationSync(value);
    return BlueIdCalculator.calculateBlueIdSync(prepared);
  }
  addPreprocessingAliases(aliases) {
    this.blueDirectivePreprocessor.addPreprocessingAliases(aliases);
  }
  preprocess(node) {
    const preprocessedNode = this.blueDirectivePreprocessor.process(node);
    return new Preprocessor({
      nodeProvider: this.nodeProvider,
      blueIdsMappingGenerator: this.blueIdsMappingGenerator
    }).preprocessWithDefaultBlue(preprocessedNode);
  }
  async preprocessAsync(node) {
    const preprocessedNode = await this.blueDirectivePreprocessor.processAsync(
      node
    );
    return new Preprocessor({
      nodeProvider: this.nodeProvider,
      blueIdsMappingGenerator: this.blueIdsMappingGenerator
    }).preprocessWithDefaultBlue(preprocessedNode);
  }
  transform(node, transformer) {
    return NodeTransformer.transform(node, transformer);
  }
  getNodeProvider() {
    return this.nodeProvider;
  }
  setNodeProvider(nodeProvider) {
    this.nodeProvider = NodeProviderWrapper.wrap(
      nodeProvider,
      this.repositories
    );
    return this;
  }
  getTypeSchemaResolver() {
    return this.typeSchemaResolver;
  }
  setTypeSchemaResolver(typeSchemaResolver) {
    this.typeSchemaResolver = typeSchemaResolver;
    return this;
  }
  getUrlContentFetcher() {
    return this.urlContentFetcher;
  }
  setUrlFetchStrategy(urlFetchStrategy) {
    this.urlContentFetcher.setFetchStrategy(urlFetchStrategy);
    return this;
  }
  /**
   * Enables fetching content from URLs in blue directives for all domains.
   * By default, URL fetching is disabled for security reasons.
   * This clears any domain restrictions that may have been set.
   *
   * @returns This instance for chaining
   */
  enablePreprocessingDirectivesFetchForUrls() {
    this.urlContentFetcher.enableFetching();
    return this;
  }
  /**
   * Enables fetching content from URLs in blue directives only for specified domains.
   * By default, URL fetching is disabled for security reasons.
   *
   * @param domains Array of domains to allow (e.g. ['example.com', 'api.github.com'])
   * @returns This instance for chaining
   */
  enablePreprocessingDirectivesFetchForDomains(domains) {
    this.urlContentFetcher.enableFetchingForDomains(domains);
    return this;
  }
  /**
   * Adds a domain to the list of allowed domains for URL fetching.
   *
   * @param domain Domain to allow (e.g. 'example.com')
   * @returns This instance for chaining
   */
  allowUrlFetchingForDomain(domain) {
    this.urlContentFetcher.allowDomain(domain);
    return this;
  }
  /**
   * Removes a domain from the list of allowed domains for URL fetching.
   *
   * @param domain Domain to disallow
   * @returns This instance for chaining
   */
  disallowUrlFetchingForDomain(domain) {
    this.urlContentFetcher.disallowDomain(domain);
    return this;
  }
  /**
   * Gets the list of domains allowed for URL fetching.
   * An empty list means all domains are allowed when fetching is enabled.
   *
   * @returns Array of allowed domains
   */
  getAllowedUrlFetchingDomains() {
    return this.urlContentFetcher.getAllowedDomains();
  }
  /**
   * Disables fetching content from URLs in blue directives.
   *
   * @returns This instance for chaining
   */
  disablePreprocessingDirectivesFetchForUrls() {
    this.urlContentFetcher.disableFetching();
    return this;
  }
  /**
   * Checks if URL fetching is enabled for blue directives
   *
   * @returns true if URL fetching is enabled, false otherwise
   */
  isPreprocessingDirectivesFetchForUrlsEnabled() {
    return this.urlContentFetcher.isFetchingEnabled();
  }
  getPreprocessingAliases() {
    return this.blueDirectivePreprocessor.getPreprocessingAliases();
  }
  setPreprocessingAliases(aliases) {
    this.blueDirectivePreprocessor.setPreprocessingAliases(aliases);
    return this;
  }
  /**
   * Registers additional BlueIds collections for mapping generation
   * @param blueIdsCollections - Array of BlueIds objects to register
   * @returns This instance for chaining
   */
  registerBlueIds(...blueIdsCollections) {
    this.blueIdsMappingGenerator.registerBlueIds(...blueIdsCollections);
    return this;
  }
  /**
   * Gets all currently registered BlueIds
   * @returns Merged object containing all BlueIds from all collections
   */
  getAllRegisteredBlueIds() {
    return this.blueIdsMappingGenerator.getAllBlueIds();
  }
  /**
   * Gets the names of all registered BlueIds
   * @returns Array of all BlueId names
   */
  getAllBlueIdNames() {
    return this.blueIdsMappingGenerator.getAllBlueIdNames();
  }
  /**
   * Gets the BlueIdsMappingGenerator instance
   * @returns The BlueIdsMappingGenerator instance
   */
  getBlueIdsMappingGenerator() {
    return this.blueIdsMappingGenerator;
  }
  /**
   * Checks if a BlueNode is of a specific type schema.
   *
   * @param node - The BlueNode to check
   * @param schema - The Zod schema to check against
   * @param options - Optional configuration
   * @returns true if the node matches the schema type, false otherwise
   */
  isTypeOf(node, schema2, options3) {
    return BlueNodeTypeSchema.isTypeOf(node, schema2, {
      checkSchemaExtensions: options3?.checkSchemaExtensions,
      typeSchemaResolver: this.typeSchemaResolver
    });
  }
  /**
   * Checks if a BlueNode matches a BlueNode type.
   *
   * @param node - The BlueNode to check.
   * @param type - The BlueNode type to check against.
   * @returns true if the node matches the type, false otherwise.
   */
  isTypeOfNode(node, type2) {
    return new NodeTypeMatcher(this).matchesType(node, type2, this.globalLimits);
  }
  /**
   * Sets the global limits for this Blue instance.
   * These limits will be combined with method-specific limits when resolving or extending nodes.
   *
   * @param globalLimits - The global limits to set, or null to use NO_LIMITS
   * @returns This instance for chaining
   */
  setGlobalLimits(globalLimits) {
    this.globalLimits = globalLimits ?? NO_LIMITS;
    return this;
  }
  /**
   * Gets the current global limits for this Blue instance.
   *
   * @returns The current global limits
   */
  getGlobalLimits() {
    return this.globalLimits;
  }
  combineWithGlobalLimits(methodLimits) {
    if (this.globalLimits == NO_LIMITS) {
      return methodLimits;
    }
    if (methodLimits == NO_LIMITS) {
      return this.globalLimits;
    }
    return CompositeLimits.of(this.globalLimits, methodLimits);
  }
};

// node_modules/@blue-repository/core-dev/dist/index.mjs
var t = {
  Channel: "23ZWQ6WWqFcyuoBDV9P8XaLk2oEwJtoQaPrkFFayZVqY",
  "Channel Event Checkpoint": "GWGpN9tAX5i3MUic8NhrfRtKDh9mz6dxBys8NXyPYXZf",
  "Chat Message": "51RV2uUTrvMb1P1u9pno6r4Ujbns9kBJRFbZrq45C6WS",
  "Composite Timeline Channel": "ABs3rYy5bpfHAF8DYi9tmcWPauhnLwfSAJvgmjG4av14",
  "Document Processing Initiated": "75eYxjwaABUcTCuKCeg1Pf1jjwDarLnFLXtxERehWFCv",
  "Document Status": "HsnCTdM4Rxjp28V7yq4ezQHyRh7MJixqDKtzm3tiLbcN",
  "Document Update": "EetjknS9cKPHHZuK93nvqNDFjJDsPLM7qsbyxLzuur7N",
  "Document Update Channel": "5emTmQdhCatJU4jGWQbb14A4NTrhKggd4e6ToV6ySHtn",
  "Embedded Node Channel": "9FT814paTzhSQ3sRPUWoj7Qv5EeWGhXvhU5ebNpbkv2S",
  Event: "3gtD3i9bgfhDat3VB53vrQpchWFn1McYe2ngSc3YLjar",
  "Inform User About Pending Action": "DiocsM4B3rE4LVAbdSf9WBKa8tdUSaDmvpPfNuBRHUxs",
  "Initialized Marker": "9Wgpr1kx18MaV1C6QraNbS2mYeapUhHh5SDAuNFTCHcf",
  "JavaScript Code": "CbkaaimMgTw2L5AP6bVWVKVArHkkrKuJxu6Uo4o6Piwr",
  "Json Patch Entry": "HdRLN3dEgUJH9Yp3HVH2gDPjG7hsYEAVfWoFuStGrvuu",
  "Lifecycle Event": "3nViyQeU3RwjHJ7wtCoef7dwe7JPqYEvZUKEx4FohuP5",
  "Lifecycle Event Channel": "8XrM27vz8BEC7vDT6Yn41fRwucLeLFXsvqLt7JCvkG4c",
  Marker: "3gJb4roGCuJQ1gibFXex6HoNjuTeiPvYRCquujAvg83t",
  Operation: "APkQmnhBWzQzpZAPHgyHeVm9QK8geARgVFg6418oFH1C",
  "Operation Request": "QQiMca4DR3UwxGceNoECDcKkeQQuF7Y8Noh2DDQTUFv",
  "Process Embedded": "2eAkQahk1Ce5qC9Rzwkmc5eU1yYG3asRS21gBYePb4KE",
  "Sequential Workflow": "rjhSMnLxw45PaS3KLfjKgS2JoosfX4QYTHpWGwzpY4Y",
  "Sequential Workflow Operation": "27JYkbWuBwyPYUZCjP67K6hxXQ7gndzdwgU8yrau2465",
  "Sequential Workflow Step": "CvfSAWwJ4ZAMDNfum11cEcs54ECL8oszspkPKrMMY7xt",
  "State Change": "Ayf4DPoE8H7JWxE8CDM73T7GJdjey4jo4mUEDnenwzkN",
  "Status Change": "7gvd9dkoEmTAkcuQwanuNsqV9YSMMeXSazWfVoCYe2s9",
  "Status Completed": "5XDLfSQku2iom43SeJc9BiL5vFEEQawKT4wwZZeu4M52",
  "Status Failed": "6SRyW1uayPmzCUmWsSiXcNH6jRTLUnm3oBvd1NzLdEwc",
  "Status In Progress": "C5gqFmeydNK78vSKdqDw3WqB5owofwDowme3y7tY87n",
  "Status Pending": "5RD2v96BsZLWijdSyrjG6qFXHqqdS2mSzQoqX9B5ooN3",
  Timeline: "C7TsyShrDryZ121B2EJMKD9ui1ozmvTfGUkquRKkSvAP",
  "Timeline Channel": "xyBvDpt4fv9uqLMEvpJz4u6NDM9cpuanrmk1VsY7Z6V",
  "Timeline Entry": "3BfN3pzCyuWfyksE6P467WJEtYqAvUeC9LybJA6iXVtL",
  "Trigger Event": "BWBJFxM7DtorfwMewvrfn3938VBCa3seKXTkkfpCwrQ1",
  "Triggered Event Channel": "CXk6kCQ4S28Ee7piJ5a96fXAdgxW7VsuzG4cyJpTgsNL",
  "Update Document": "Bf61yTzodeWXWCTaiZqNNPf5Zbpet1ZUczvuewiL3rSZ"
};
var h = withTypeBlueId(
  t["Channel Event Checkpoint"]
)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    lastEvents: z.record(z.string(), z.unknown()).optional()
  })
);
var i = withTypeBlueId(t.Channel)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional()
  })
);
var m2 = withTypeBlueId(t["Chat Message"])(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    message: z.string().optional()
  })
);
var g2 = withTypeBlueId(
  t["Composite Timeline Channel"]
)(
  i.extend({
    name: z.string().optional(),
    channels: z.array(z.string()).optional()
  })
);
var r = withTypeBlueId(t.Event)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional()
  })
);
var c2 = withTypeBlueId(t["Lifecycle Event"])(
  r.extend({
    name: z.string().optional(),
    description: z.string().optional()
  })
);
var f = withTypeBlueId(
  t["Document Processing Initiated"]
)(
  c2.extend({
    name: z.string().optional(),
    description: z.string().optional()
  })
);
var a2 = withTypeBlueId(t["Document Status"])(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    mode: z.string().optional()
  })
);
var b = withTypeBlueId(
  t["Document Update Channel"]
)(
  i.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    path: z.string().optional()
  })
);
var y2 = withTypeBlueId(t["Document Update"])(
  r.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    val: blueNodeField().optional(),
    op: z.string().optional(),
    path: z.string().optional(),
    from: z.string().optional()
  })
);
var P3 = withTypeBlueId(
  t["Embedded Node Channel"]
)(
  i.extend({
    name: z.string().optional(),
    path: z.string().optional()
  })
);
var S2 = withTypeBlueId(
  t["Inform User About Pending Action"]
)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    channel: z.string().optional(),
    expectedRequest: blueNodeField().optional(),
    title: z.string().optional(),
    message: z.string().optional(),
    operation: z.string().optional()
  })
);
var p2 = withTypeBlueId(t.Marker)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional()
  })
);
var v2 = withTypeBlueId(
  t["Initialized Marker"]
)(
  p2.extend({
    name: z.string().optional(),
    description: z.string().optional()
  })
);
var s = withTypeBlueId(
  t["Sequential Workflow Step"]
)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional()
  })
);
var x = withTypeBlueId(t["JavaScript Code"])(
  s.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    code: z.string().optional()
  })
);
var d = withTypeBlueId(t["Json Patch Entry"])(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    val: blueNodeField().optional(),
    op: z.string().optional(),
    path: z.string().optional()
  })
);
var C = withTypeBlueId(
  t["Lifecycle Event Channel"]
)(
  i.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    event: c2.optional()
  })
);
var A2 = withTypeBlueId(
  t["Operation Request"]
)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    request: blueNodeField().optional(),
    operation: z.string().optional(),
    document: blueNodeField().optional(),
    allowNewerVersion: z.boolean().optional()
  })
);
var D = withTypeBlueId(t.Operation)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    channel: z.string().optional(),
    request: blueNodeField().optional()
  })
);
var w2 = withTypeBlueId(
  t["Process Embedded"]
)(
  z.object({
    name: z.string().optional(),
    paths: z.array(z.string()).optional()
  })
);
var l2 = withTypeBlueId(
  t["Sequential Workflow"]
)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    channel: z.string().optional(),
    event: blueNodeField().optional(),
    steps: z.array(s).optional()
  })
);
var W = withTypeBlueId(
  t["Sequential Workflow Operation"]
)(
  l2.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    operation: z.string().optional()
  })
);
var E = withTypeBlueId(t["State Change"])(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    state: z.string().optional()
  })
);
var R2 = withTypeBlueId(t["Status Change"])(
  r.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    status: a2.optional()
  })
);
var k = withTypeBlueId(
  t["Status Completed"]
)(
  a2.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    mode: z.string().optional()
  })
);
var B = withTypeBlueId(t["Status Failed"])(
  a2.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    mode: z.string().optional()
  })
);
var J = withTypeBlueId(
  t["Status In Progress"]
)(
  a2.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    mode: z.string().optional()
  })
);
var q2 = withTypeBlueId(t["Status Pending"])(
  a2.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    mode: z.string().optional()
  })
);
var j2 = withTypeBlueId(
  t["Timeline Channel"]
)(
  i.extend({
    name: z.string().optional(),
    timelineId: z.string().optional()
  })
);
var u2 = withTypeBlueId(t.Timeline)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    timelineId: z.string().optional()
  })
);
var L = withTypeBlueId(t["Timeline Entry"])(
  z.object({
    name: z.string().optional(),
    threadPrev: blueNodeField().optional(),
    signature: z.string().optional(),
    timeline: u2.optional(),
    thread: blueNodeField().optional(),
    timelinePrev: blueNodeField().optional(),
    message: blueNodeField().optional()
  })
);
var T = withTypeBlueId(t["Trigger Event"])(
  s.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    event: blueNodeField().optional()
  })
);
var F = withTypeBlueId(
  t["Triggered Event Channel"]
)(
  i.extend({
    name: z.string().optional(),
    description: z.string().optional()
  })
);
var U = withTypeBlueId(t["Update Document"])(
  s.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    changeset: z.array(d).optional()
  })
);
var V = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ChannelEventCheckpointSchema: h,
  ChannelSchema: i,
  ChatMessageSchema: m2,
  CompositeTimelineChannelSchema: g2,
  DocumentProcessingInitiatedSchema: f,
  DocumentStatusSchema: a2,
  DocumentUpdateChannelSchema: b,
  DocumentUpdateSchema: y2,
  EmbeddedNodeChannelSchema: P3,
  EventSchema: r,
  InformUserAboutPendingActionSchema: S2,
  InitializedMarkerSchema: v2,
  JavaScriptCodeSchema: x,
  JsonPatchEntrySchema: d,
  LifecycleEventChannelSchema: C,
  LifecycleEventSchema: c2,
  MarkerSchema: p2,
  OperationRequestSchema: A2,
  OperationSchema: D,
  ProcessEmbeddedSchema: w2,
  SequentialWorkflowOperationSchema: W,
  SequentialWorkflowSchema: l2,
  SequentialWorkflowStepSchema: s,
  StateChangeSchema: E,
  StatusChangeSchema: R2,
  StatusCompletedSchema: k,
  StatusFailedSchema: B,
  StatusInProgressSchema: J,
  StatusPendingSchema: q2,
  TimelineChannelSchema: j2,
  TimelineEntrySchema: L,
  TimelineSchema: u2,
  TriggerEventSchema: T,
  TriggeredEventChannelSchema: F,
  UpdateDocumentSchema: U
}, Symbol.toStringTag, { value: "Module" }));
var M = {
  name: "Channel",
  description: "Generic channel"
};
var N2 = {
  name: "Sequential Workflow Operation",
  description: "The most common approach for implementing operations. Links to an operation definition and defines processing steps that execute sequentially when the operation is called.",
  type: {
    blueId: "rjhSMnLxw45PaS3KLfjKgS2JoosfX4QYTHpWGwzpY4Y"
  },
  operation: {
    description: "References the name of the operation definition that this implementation serves. Links this workflow to a specific Operation contract.",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var I = {
  name: "Process Embedded",
  paths: {
    type: {
      blueId: "G8wmfjEqugPEEXByMYWJXiEdbLToPRWNQEekNxrxfQWB"
    },
    itemType: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var Q = {
  name: "Timeline Entry",
  threadPrev: {
    description: "Previous entry in the thread"
  },
  signature: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  timeline: {
    description: "Timeline this entry belongs to",
    type: {
      blueId: "C7TsyShrDryZ121B2EJMKD9ui1ozmvTfGUkquRKkSvAP"
    }
  },
  thread: {
    description: "Optional thread"
  },
  timelinePrev: {
    description: "Previous entry"
  },
  message: {
    description: "Message"
  }
};
var Y = {
  name: "Marker",
  description: "Generic marker"
};
var z3 = {
  name: "Event",
  description: "Represents a generic event that can occur within the system."
};
var H = {
  name: "Lifecycle Event",
  description: "A type of event that signals a significant change in a document's lifecycle.",
  type: {
    blueId: "3gtD3i9bgfhDat3VB53vrQpchWFn1McYe2ngSc3YLjar"
  }
};
var K = {
  name: "Chat Message",
  description: "Represents a single chat message exchanged between participants.",
  message: {
    description: "The textual content of the chat message.",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var X = {
  name: "Document Update Channel",
  description: `A channel for document update events. Use this channel to react to changes
in the document state, optionally constrained by a target path.
`,
  type: {
    blueId: "23ZWQ6WWqFcyuoBDV9P8XaLk2oEwJtoQaPrkFFayZVqY"
  },
  path: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var Z = {
  name: "Status Pending",
  description: `A generic initial state. The document is waiting for an initial action
or condition to be met before it becomes active.`,
  type: {
    blueId: "HsnCTdM4Rxjp28V7yq4ezQHyRh7MJixqDKtzm3tiLbcN"
  },
  mode: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    },
    value: "pending"
  }
};
var G = {
  name: "Status Completed",
  description: `A successful final state. The document has achieved its goal and its
process has finished as expected.`,
  type: {
    blueId: "HsnCTdM4Rxjp28V7yq4ezQHyRh7MJixqDKtzm3tiLbcN"
  },
  mode: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    },
    value: "terminated"
  }
};
var O2 = {
  name: "Status Failed",
  description: `A final state indicating that the document encountered an unrecoverable
error and could not complete its process.`,
  type: {
    blueId: "HsnCTdM4Rxjp28V7yq4ezQHyRh7MJixqDKtzm3tiLbcN"
  },
  mode: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    },
    value: "terminated"
  }
};
var _ = {
  name: "Document Processing Initiated",
  description: "An event that marks the beginning of document processing.",
  type: {
    blueId: "3nViyQeU3RwjHJ7wtCoef7dwe7JPqYEvZUKEx4FohuP5"
  }
};
var $ = {
  name: "Status Change",
  description: "An event indicating that the document's status has transitioned.",
  type: {
    blueId: "3gtD3i9bgfhDat3VB53vrQpchWFn1McYe2ngSc3YLjar"
  },
  status: {
    description: "The new status of the document.",
    type: {
      blueId: "HsnCTdM4Rxjp28V7yq4ezQHyRh7MJixqDKtzm3tiLbcN"
    }
  }
};
var ee = {
  name: "Lifecycle Event Channel",
  description: `A channel for lifecycle events in the document (e.g., processing initiation).
You can optionally provide an event pattern to filter which lifecycle events are handled.
`,
  type: {
    blueId: "23ZWQ6WWqFcyuoBDV9P8XaLk2oEwJtoQaPrkFFayZVqY"
  },
  event: {
    type: {
      blueId: "3nViyQeU3RwjHJ7wtCoef7dwe7JPqYEvZUKEx4FohuP5"
    }
  }
};
var te = {
  name: "Embedded Node Channel",
  type: {
    blueId: "23ZWQ6WWqFcyuoBDV9P8XaLk2oEwJtoQaPrkFFayZVqY"
  },
  path: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var ne = {
  name: "Initialized Marker",
  description: "A marker that indicates that the document has been initialized.",
  type: {
    blueId: "3gJb4roGCuJQ1gibFXex6HoNjuTeiPvYRCquujAvg83t"
  }
};
var oe = {
  name: "Composite Timeline Channel",
  type: {
    blueId: "23ZWQ6WWqFcyuoBDV9P8XaLk2oEwJtoQaPrkFFayZVqY"
  },
  channels: {
    type: {
      blueId: "G8wmfjEqugPEEXByMYWJXiEdbLToPRWNQEekNxrxfQWB"
    },
    itemType: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var ie = {
  name: "Operation",
  description: "Named, structured interfaces that documents expose to the outside world. They define specific actions that can be performed on a document, complete with formal request definitions.",
  channel: {
    description: "Specifies the channel through which Operation Request events are sent to invoke this operation on the document.",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  request: {
    description: "Defines the expected input structure and validation rules for the operation. This represents the data that will be passed when the operation is invoked."
  }
};
var ae = {
  name: "State Change",
  description: "Displays information to the user when the document state changes during processing.",
  state: {
    description: 'Indicates the new state of the document (e.g., "cancelled", "approved", "pending") when a state change occurs during workflow execution.',
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var se = {
  name: "Update Document",
  description: "Updates the document with the changeset.",
  type: {
    blueId: "CvfSAWwJ4ZAMDNfum11cEcs54ECL8oszspkPKrMMY7xt"
  },
  changeset: {
    type: {
      blueId: "G8wmfjEqugPEEXByMYWJXiEdbLToPRWNQEekNxrxfQWB"
    },
    itemType: {
      blueId: "HdRLN3dEgUJH9Yp3HVH2gDPjG7hsYEAVfWoFuStGrvuu"
    }
  }
};
var re = {
  name: "Trigger Event",
  description: "A sequential workflow step that can trigger an event.",
  type: {
    blueId: "CvfSAWwJ4ZAMDNfum11cEcs54ECL8oszspkPKrMMY7xt"
  },
  event: {
    description: "Event data"
  }
};
var ce = {
  name: "Status In Progress",
  description: `Represents active processing of the document, often used for processes that involve
multiple steps over time.`,
  type: {
    blueId: "HsnCTdM4Rxjp28V7yq4ezQHyRh7MJixqDKtzm3tiLbcN"
  },
  mode: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    },
    value: "active"
  }
};
var pe = {
  name: "Timeline",
  description: "Represents a sequence of authenticated, hash-chained events.",
  timelineId: {
    description: "Unique identifier for the timeline",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var de = {
  name: "JavaScript Code",
  description: "A workflow step that executes a JavaScript code.",
  type: {
    blueId: "CvfSAWwJ4ZAMDNfum11cEcs54ECL8oszspkPKrMMY7xt"
  },
  code: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var le = {
  name: "Sequential Workflow Step",
  description: "Represents a single step within a workflow."
};
var ue = {
  name: "Triggered Event Channel",
  description: `A channel for document\u2011internal custom events produced during processing.
It is intended for locally generated events within the document, not for
external timeline entries.
`,
  type: {
    blueId: "23ZWQ6WWqFcyuoBDV9P8XaLk2oEwJtoQaPrkFFayZVqY"
  }
};
var he = {
  name: "Inform User About Pending Action",
  description: "Notifies that a required action must be performed by running a specific operation defined in the document. Provides details and the expected request payload.",
  channel: {
    description: "The channel defined in the document from which a timeline entry is expected, and which will trigger the required operation.",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  expectedRequest: {
    description: "The expected request payload or structure that should be provided to complete the required operation."
  },
  title: {
    description: 'A short, user-facing title describing the required action (e.g., "Payment Setup Required", "Agreement Required").',
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  message: {
    description: "A detailed message explaining what action is needed and any relevant context for the user.",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  operation: {
    description: "The name of the operation defined in the document that the user is required to run to fulfill the pending action.",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var me = {
  name: "Document Update",
  description: "Describes a single operation that was applied to a document.",
  type: {
    blueId: "3gtD3i9bgfhDat3VB53vrQpchWFn1McYe2ngSc3YLjar"
  },
  val: {
    description: 'The value to be added or used as a replacement. Required for "add" and "replace" ops.'
  },
  op: {
    description: 'The operation to perform. One of: "add", "remove", "replace", "move", "copy".',
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  path: {
    description: "A JSON Pointer string that references a location within the target document.",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  from: {
    description: 'A JSON Pointer string referencing the location in the source document to move or copy from. Required for "move" and "copy" ops.',
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var ge = {
  name: "Channel Event Checkpoint",
  description: "A processing checkpoint that records the BlueId of the last processed event from each channel. Provides exact tracking of which events were processed, works reliably across decentralized processors, and supports multi-channel documents with independent event streams.",
  lastEvents: {
    description: "Maps channel names to their last processed event information. Each channel tracks the BlueId of the most recent event that has been successfully processed from that channel's timeline.",
    type: {
      blueId: "294NBTj2mFRL3RB4kDRUSckwGg7Kzj6T8CTAFeR1kcSA"
    },
    keyType: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var fe = {
  name: "Json Patch Entry",
  description: "Represents a single operation in a Json Patch, defining a specific change to be applied to a JSON document.",
  val: {
    description: "The value to be used in the operation"
  },
  op: {
    description: "The operation to be performed on the target JSON document.",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  path: {
    description: "A JSON Pointer string indicating the location in the document where the operation should be applied. Must start with a forward slash (/).",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var be = {
  name: "Document Status",
  description: "The base type for all document status indicators.",
  mode: {
    description: `Defines the high-level phase of the document's lifecycle. Must be one of:
  pending: The document is waiting for a pre-condition before its core logic begins.
  active: The document is in its main operational phase, actively processing events.
  terminated: The document has reached a final, conclusive state.`,
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var ye = {
  name: "Operation Request",
  description: "Event sent to a document's channel to invoke a specific operation. This event contains the operation name, request data, target document information, and versioning preferences.",
  request: {
    description: "The data to pass to the operation. Can be simple values for primitive types or structured objects for complex types. Must match the structure defined in the operation contract."
  },
  operation: {
    description: "The name of the operation to be performed.",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  document: {
    description: "Specifies the target document for the operation, typically containing the blueId of the document to operate on."
  },
  allowNewerVersion: {
    description: "Controls concurrent modification handling. When true, processes the operation on the latest document version even if it changed. When false, only processes if the document still has the same blueId as specified.",
    type: {
      blueId: "EL6AjrbJsxTWRTPzY8WR8Y2zAMXRbydQj83PcZwuAHbo"
    }
  }
};
var Pe = {
  name: "Sequential Workflow",
  description: "A sequential workflow that executes its steps in a linear order.",
  channel: {
    description: `Name of the channel this workflow listens to.
`,
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  event: {
    description: `Optional event-type criteria to filter incoming events from the channel.
`
  },
  steps: {
    type: {
      blueId: "G8wmfjEqugPEEXByMYWJXiEdbLToPRWNQEekNxrxfQWB"
    },
    itemType: {
      blueId: "CvfSAWwJ4ZAMDNfum11cEcs54ECL8oszspkPKrMMY7xt"
    }
  }
};
var Se = {
  name: "Timeline Channel",
  type: {
    blueId: "23ZWQ6WWqFcyuoBDV9P8XaLk2oEwJtoQaPrkFFayZVqY"
  },
  timelineId: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var ve = {
  "23ZWQ6WWqFcyuoBDV9P8XaLk2oEwJtoQaPrkFFayZVqY": M,
  "27JYkbWuBwyPYUZCjP67K6hxXQ7gndzdwgU8yrau2465": N2,
  "2eAkQahk1Ce5qC9Rzwkmc5eU1yYG3asRS21gBYePb4KE": I,
  "3BfN3pzCyuWfyksE6P467WJEtYqAvUeC9LybJA6iXVtL": Q,
  "3gJb4roGCuJQ1gibFXex6HoNjuTeiPvYRCquujAvg83t": Y,
  "3gtD3i9bgfhDat3VB53vrQpchWFn1McYe2ngSc3YLjar": z3,
  "3nViyQeU3RwjHJ7wtCoef7dwe7JPqYEvZUKEx4FohuP5": H,
  "51RV2uUTrvMb1P1u9pno6r4Ujbns9kBJRFbZrq45C6WS": K,
  "5emTmQdhCatJU4jGWQbb14A4NTrhKggd4e6ToV6ySHtn": X,
  "5RD2v96BsZLWijdSyrjG6qFXHqqdS2mSzQoqX9B5ooN3": Z,
  "5XDLfSQku2iom43SeJc9BiL5vFEEQawKT4wwZZeu4M52": G,
  "6SRyW1uayPmzCUmWsSiXcNH6jRTLUnm3oBvd1NzLdEwc": O2,
  "75eYxjwaABUcTCuKCeg1Pf1jjwDarLnFLXtxERehWFCv": _,
  "7gvd9dkoEmTAkcuQwanuNsqV9YSMMeXSazWfVoCYe2s9": $,
  "8XrM27vz8BEC7vDT6Yn41fRwucLeLFXsvqLt7JCvkG4c": ee,
  "9FT814paTzhSQ3sRPUWoj7Qv5EeWGhXvhU5ebNpbkv2S": te,
  "9Wgpr1kx18MaV1C6QraNbS2mYeapUhHh5SDAuNFTCHcf": ne,
  ABs3rYy5bpfHAF8DYi9tmcWPauhnLwfSAJvgmjG4av14: oe,
  APkQmnhBWzQzpZAPHgyHeVm9QK8geARgVFg6418oFH1C: ie,
  Ayf4DPoE8H7JWxE8CDM73T7GJdjey4jo4mUEDnenwzkN: ae,
  Bf61yTzodeWXWCTaiZqNNPf5Zbpet1ZUczvuewiL3rSZ: se,
  BWBJFxM7DtorfwMewvrfn3938VBCa3seKXTkkfpCwrQ1: re,
  C5gqFmeydNK78vSKdqDw3WqB5owofwDowme3y7tY87n: ce,
  C7TsyShrDryZ121B2EJMKD9ui1ozmvTfGUkquRKkSvAP: pe,
  CbkaaimMgTw2L5AP6bVWVKVArHkkrKuJxu6Uo4o6Piwr: de,
  CvfSAWwJ4ZAMDNfum11cEcs54ECL8oszspkPKrMMY7xt: le,
  CXk6kCQ4S28Ee7piJ5a96fXAdgxW7VsuzG4cyJpTgsNL: ue,
  DiocsM4B3rE4LVAbdSf9WBKa8tdUSaDmvpPfNuBRHUxs: he,
  EetjknS9cKPHHZuK93nvqNDFjJDsPLM7qsbyxLzuur7N: me,
  GWGpN9tAX5i3MUic8NhrfRtKDh9mz6dxBys8NXyPYXZf: ge,
  HdRLN3dEgUJH9Yp3HVH2gDPjG7hsYEAVfWoFuStGrvuu: fe,
  HsnCTdM4Rxjp28V7yq4ezQHyRh7MJixqDKtzm3tiLbcN: be,
  QQiMca4DR3UwxGceNoECDcKkeQQuF7Y8Noh2DDQTUFv: ye,
  rjhSMnLxw45PaS3KLfjKgS2JoosfX4QYTHpWGwzpY4Y: Pe,
  xyBvDpt4fv9uqLMEvpJz4u6NDM9cpuanrmk1VsY7Z6V: Se
};
var Ae = {
  blueIds: t,
  schemas: Object.values(V),
  contents: ve
};

// node_modules/@blue-repository/myos-dev/dist/index.mjs
var t2 = {
  "Adding Participant Requested": "HxcK5S9Lz2q5cqtER8kKgLQzDARZGiUAxWuhtBi2ev3a",
  "Adding Participant Responded": "H556UWC5XU8vj53PqHaXQQwXrGia9uHHkkdQpExJXJYT",
  "All Participants Ready": "Ff61TKzxLStjvfMksRNUBif2PRJGJM6XvmTqSf3M76wC",
  "Bootstrap Failed": "8WpUtXczWTnk5cc38GNVH59ZBEwh5B9WEwjK9RGmSjqx",
  "Document Session Bootstrap": "59JfECYVQbmK6yQ3NdcpGivHqujJH6XQpK48s8szPH73",
  "MyOS Admin Base": "9NExoTity2JU7poKAYairyjHsxDSH5jv5XyokoFE4VR2",
  "MyOS Agent": "9dvBsvQ5tGUZmR3bQkRy8nfwzAkSuM4NA8e4Fmy9eJtN",
  "MyOS Agent Channel": "GvLXrz3siPPmmSLz1gHrQ4PCpDvjESdEfWSWUNwKrhf1",
  "MyOS Agent Event": "C99Sgq7uyEjz4YH7L27Aj1aahV2tJMAoCVct3ZiZp8av",
  "MyOS Participants Orchestration": "6tzp2YX1rei3aAXg22SqYbeiiteGthj1LesTNCWm7wbU",
  "MyOS Session Interaction": "CeWyRmXAMZqvWBvby2KbRUZWcS7Pdxs42vnMXgn9gg6H",
  "MyOS Timeline": "8cyT2HqPHGFBNjLnZzqsb4qN3CqZxMQEWo3h7KLVCfog",
  "MyOS Timeline Channel": "Bx3dgXf5uFkGf9KxkUTFWQhbEw9QBc9cTgz1KP1Qtgh6",
  "MyOS Timeline Entry": "FW2R85SUhYpoCVrzyr3DYWXK9TJNAuw5HLAmzdUnW6M3",
  "MyOS Worker Agency": "4Lix4AKXvBDvrwxw2htSdYFKxL4wugEQzqoSEYet5Dh1",
  Participant: "B1W38RbaLYqkaPVP6upwrF6Z8G95LA7yPMPPXPvWvuRW",
  "Participant Activated": "6Zztm3YUuFwM5FoJ5Se9rsghP1BgQa3rLHoR8BhdNsTM",
  "Participant Activation State": "77dKAvJLiqw5WXwyjHNRXfkh3ep8sHw7Q4gQyJEfoadJ",
  "Participant Resolved": "8wwU4rYswgfNnVYgEEBeLEdaPwXMzLzNs6do7bawa7xD",
  "Removing Participant Requested": "2gnwi1cAknCcEdUoACnoSjfWD8oJRAhMyxmWnYD2595T",
  "Removing Participant Responded": "BUufbPHWkFYjUUHXKaJVTErb4EVhCSfaubj5KECNhNXa",
  "Target Document Session Started": "EKDNdfFrKyQqa6ifz1oqPBZqhz3xvv7GB914CJPCumXF"
};
var o = withTypeBlueId(
  t2["Adding Participant Requested"]
)(
  z.object({
    name: z.string().optional(),
    channelName: z.string().optional(),
    participantBinding: z.object({
      description: z.string().optional(),
      accountId: z.string().optional(),
      email: z.string().optional()
    }).optional()
  })
);
var b2 = withTypeBlueId(
  t2["Adding Participant Responded"]
)(
  z.object({
    name: z.string().optional(),
    request: o.optional(),
    status: z.string().optional()
  })
);
var u3 = withTypeBlueId(
  t2["All Participants Ready"]
)(
  z.object({
    name: z.string().optional()
  })
);
var h2 = withTypeBlueId(
  t2["Bootstrap Failed"]
)(
  z.object({
    name: z.string().optional(),
    reason: z.string().optional()
  })
);
var r2 = withTypeBlueId(
  t2["MyOS Timeline Channel"]
)(
  j2.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    accountId: z.string().optional(),
    email: z.string().optional()
  })
);
var c3 = withTypeBlueId(t2["MyOS Admin Base"])(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    contracts: z.object({
      myOsAdminChannel: r2.optional(),
      myOsAdminUpdateImpl: W.optional(),
      myOsAdminUpdate: D.optional()
    }).optional()
  })
);
var R3 = withTypeBlueId(
  t2["Document Session Bootstrap"]
)(
  c3.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    capabilities: z.record(z.string(), z.boolean()).optional(),
    channelBindings: z.record(z.string(), i).optional(),
    document: blueNodeField().optional(),
    initialMessages: z.object({
      description: z.string().optional(),
      defaultMessage: z.string().optional(),
      perChannel: z.record(z.string(), z.string()).optional()
    }).optional()
  })
);
var s2 = withTypeBlueId(t2["MyOS Agent"])(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    agentId: z.string().optional()
  })
);
var x2 = withTypeBlueId(
  t2["MyOS Agent Channel"]
)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    event: blueNodeField().optional(),
    agent: s2.optional()
  })
);
var B2 = withTypeBlueId(t2["MyOS Agent Event"])(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    agentId: z.string().optional(),
    id: z.string().optional(),
    event: blueNodeField().optional(),
    timestamp: z.number().optional()
  })
);
var v3 = withTypeBlueId(
  t2["MyOS Participants Orchestration"]
)(
  z.object({
    name: z.string().optional()
  })
);
var f2 = withTypeBlueId(
  t2["MyOS Session Interaction"]
)(
  z.object({
    name: z.string().optional()
  })
);
var p3 = withTypeBlueId(t2["MyOS Timeline"])(
  u2.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    accountId: z.string().optional()
  })
);
var D2 = withTypeBlueId(
  t2["MyOS Timeline Entry"]
)(
  L.extend({
    name: z.string().optional(),
    description: z.string().optional(),
    timeline: p3.optional(),
    timestamp: z.number().optional()
  })
);
var W2 = withTypeBlueId(
  t2["MyOS Worker Agency"]
)(
  z.object({
    name: z.string().optional()
  })
);
var d2 = withTypeBlueId(
  t2["Participant Activation State"]
)(
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    accountStatus: z.string().optional(),
    errorMessage: z.string().optional()
  })
);
var a3 = withTypeBlueId(t2.Participant)(
  z.object({
    name: z.string().optional(),
    timelineId: z.string().optional(),
    accountId: z.string().optional(),
    email: z.string().optional(),
    status: d2.optional()
  })
);
var M2 = withTypeBlueId(
  t2["Participant Activated"]
)(
  z.object({
    name: z.string().optional(),
    channelName: z.string().optional(),
    participant: a3.optional()
  })
);
var j3 = withTypeBlueId(
  t2["Participant Resolved"]
)(
  z.object({
    name: z.string().optional(),
    channelName: z.string().optional(),
    participant: a3.optional()
  })
);
var l3 = withTypeBlueId(
  t2["Removing Participant Requested"]
)(
  z.object({
    name: z.string().optional(),
    channelName: z.string().optional()
  })
);
var C2 = withTypeBlueId(
  t2["Removing Participant Responded"]
)(
  z.object({
    name: z.string().optional(),
    request: l3.optional(),
    status: z.string().optional()
  })
);
var O3 = withTypeBlueId(
  t2["Target Document Session Started"]
)(
  z.object({
    name: z.string().optional(),
    document: blueNodeField().optional(),
    initiatorSessionId: z.string().optional()
  })
);
var F2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AddingParticipantRequestedSchema: o,
  AddingParticipantRespondedSchema: b2,
  AllParticipantsReadySchema: u3,
  BootstrapFailedSchema: h2,
  DocumentSessionBootstrapSchema: R3,
  MyOSAdminBaseSchema: c3,
  MyOSAgentChannelSchema: x2,
  MyOSAgentEventSchema: B2,
  MyOSAgentSchema: s2,
  MyOSParticipantsOrchestrationSchema: v3,
  MyOSSessionInteractionSchema: f2,
  MyOSTimelineChannelSchema: r2,
  MyOSTimelineEntrySchema: D2,
  MyOSTimelineSchema: p3,
  MyOSWorkerAgencySchema: W2,
  ParticipantActivatedSchema: M2,
  ParticipantActivationStateSchema: d2,
  ParticipantResolvedSchema: j3,
  ParticipantSchema: a3,
  RemovingParticipantRequestedSchema: l3,
  RemovingParticipantRespondedSchema: C2,
  TargetDocumentSessionStartedSchema: O3
}, Symbol.toStringTag, { value: "Module" }));
var I2 = {
  name: "Removing Participant Requested",
  channelName: {
    description: "The abstract channel name of the participant to be removed.",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var L2 = {
  name: "MyOS Worker Agency"
};
var T2 = {
  name: "Document Session Bootstrap",
  description: "MyOS-specific document for bootstrapping document sessions and tracking bootstrap progress",
  type: {
    blueId: "9NExoTity2JU7poKAYairyjHsxDSH5jv5XyokoFE4VR2"
  },
  capabilities: {
    description: "Optional MyOS Admin capability contracts to attach (participantsOrchestration, sessionInteraction, workerAgency)",
    type: {
      blueId: "294NBTj2mFRL3RB4kDRUSckwGg7Kzj6T8CTAFeR1kcSA"
    },
    keyType: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    },
    valueType: {
      blueId: "EL6AjrbJsxTWRTPzY8WR8Y2zAMXRbydQj83PcZwuAHbo"
    }
  },
  channelBindings: {
    description: "Maps channel names to participant identifiers",
    type: {
      blueId: "294NBTj2mFRL3RB4kDRUSckwGg7Kzj6T8CTAFeR1kcSA"
    },
    keyType: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    },
    valueType: {
      blueId: "23ZWQ6WWqFcyuoBDV9P8XaLk2oEwJtoQaPrkFFayZVqY"
    }
  },
  document: {
    description: "Target Blue document to be bootstrapped"
  },
  initialMessages: {
    description: "Messages sent to participants when inviting them to the bootstrapped document",
    defaultMessage: {
      description: "Default invitation message sent to all participants",
      type: {
        blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
      }
    },
    perChannel: {
      description: "Per-channel custom invitation messages",
      type: {
        blueId: "294NBTj2mFRL3RB4kDRUSckwGg7Kzj6T8CTAFeR1kcSA"
      },
      keyType: {
        blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
      },
      valueType: {
        blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
      }
    }
  }
};
var U2 = {
  name: "MyOS Participants Orchestration"
};
var w3 = {
  name: "Participant Activated",
  channelName: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  participant: {
    type: {
      blueId: "B1W38RbaLYqkaPVP6upwrF6Z8G95LA7yPMPPXPvWvuRW"
    }
  }
};
var E2 = {
  name: "Participant Activation State",
  description: "Tracks participant account status and activation",
  accountStatus: {
    description: "Participant's MyOS account status from bootstrap events (Active | Inactive | Failed)",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  errorMessage: {
    description: "Error message if participant activation failed",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var J2 = {
  name: "MyOS Timeline",
  description: "A managed timeline implementation providing convenient email-based authentication and extensive features. MyOS timelines are straightforward to set up and use, offering a balance of convenience and security through hash-chained, authenticated event sequences.",
  type: {
    blueId: "C7TsyShrDryZ121B2EJMKD9ui1ozmvTfGUkquRKkSvAP"
  },
  accountId: {
    description: "Identifier for the MyOS account associated with this timeline",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var k2 = {
  name: "Bootstrap Failed",
  reason: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var q3 = {
  name: "Participant Resolved",
  channelName: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  participant: {
    type: {
      blueId: "B1W38RbaLYqkaPVP6upwrF6Z8G95LA7yPMPPXPvWvuRW"
    }
  }
};
var V2 = {
  name: "MyOS Agent",
  description: "MyOS-specific agent with optional agent identifier",
  agentId: {
    description: "Optional agent identifier",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var H2 = {
  name: "MyOS Admin Base",
  description: "Document base for MyOS Admin participant",
  contracts: {
    myOsAdminChannel: {
      description: "MyOS Admin (accountId=0) \u2014 posts operational progress/decisions via myOsAdminUpdate",
      type: {
        blueId: "Bx3dgXf5uFkGf9KxkUTFWQhbEw9QBc9cTgz1KP1Qtgh6"
      }
    },
    myOsAdminUpdateImpl: {
      description: "Implementation that re-emits the provided events",
      type: {
        blueId: "27JYkbWuBwyPYUZCjP67K6hxXQ7gndzdwgU8yrau2465"
      },
      operation: {
        type: {
          blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
        },
        value: "myOsAdminUpdate"
      },
      steps: {
        items: [
          {
            name: "EmitAdminEvents",
            type: {
              blueId: "CbkaaimMgTw2L5AP6bVWVKVArHkkrKuJxu6Uo4o6Piwr"
            },
            code: {
              type: {
                blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
              },
              value: `return { events: event.message.request };
`
            }
          }
        ]
      }
    },
    myOsAdminUpdate: {
      description: "The standard, required operation for MyOS Admin to deliver events.",
      type: {
        blueId: "APkQmnhBWzQzpZAPHgyHeVm9QK8geARgVFg6418oFH1C"
      },
      channel: {
        type: {
          blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
        },
        value: "myOsAdminChannel"
      },
      request: {
        type: {
          blueId: "G8wmfjEqugPEEXByMYWJXiEdbLToPRWNQEekNxrxfQWB"
        },
        itemType: {
          blueId: "3gtD3i9bgfhDat3VB53vrQpchWFn1McYe2ngSc3YLjar"
        }
      }
    }
  }
};
var X2 = {
  name: "Participant",
  timelineId: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  accountId: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  email: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  status: {
    description: "Participant activation status",
    type: {
      blueId: "77dKAvJLiqw5WXwyjHNRXfkh3ep8sHw7Q4gQyJEfoadJ"
    }
  }
};
var z4 = {
  name: "Removing Participant Responded",
  request: {
    type: {
      blueId: "2gnwi1cAknCcEdUoACnoSjfWD8oJRAhMyxmWnYD2595T"
    }
  },
  status: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var Q2 = {
  name: "MyOS Timeline Channel",
  description: "MyOS-specific Timeline Channel",
  type: {
    blueId: "xyBvDpt4fv9uqLMEvpJz4u6NDM9cpuanrmk1VsY7Z6V"
  },
  accountId: {
    description: "Account identifier for the MyOS timeline",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  email: {
    description: "Email address associated with the MyOS timeline",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var N3 = {
  name: "MyOS Agent Event",
  description: "MyOS-specific agent event with agent ID, timestamp, and event data",
  agentId: {
    description: "Optional agent identifier",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  id: {
    description: "Optional event ID",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  event: {
    description: "Optional event node reference"
  },
  timestamp: {
    description: "Optional timestamp for the event",
    type: {
      blueId: "DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8"
    }
  }
};
var K2 = {
  name: "MyOS Session Interaction"
};
var Y2 = {
  name: "Target Document Session Started",
  document: {
    description: "The final, canonicalized document state with all timelineIds filled in."
  },
  initiatorSessionId: {
    description: "Session ID created for the bootstrap initiator (caller)",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var Z2 = {
  name: "All Participants Ready"
};
var G2 = {
  name: "MyOS Timeline Entry",
  description: "MyOS-specific timeline entry with account and email information",
  type: {
    blueId: "3BfN3pzCyuWfyksE6P467WJEtYqAvUeC9LybJA6iXVtL"
  },
  timeline: {
    type: {
      blueId: "8cyT2HqPHGFBNjLnZzqsb4qN3CqZxMQEWo3h7KLVCfog"
    }
  },
  timestamp: {
    description: "Timestamp of the MyOS timeline entry",
    type: {
      blueId: "DHmxTkFbXePZHCHCYmQr2dSzcNLcryFVjXVHkdQrrZr8"
    }
  }
};
var _2 = {
  name: "MyOS Agent Channel",
  description: "MyOS-specific agent channel extending Channel with agent and event fields",
  event: {
    description: "Optional event node reference"
  },
  agent: {
    description: "Optional MyOS agent associated with this channel",
    type: {
      blueId: "9dvBsvQ5tGUZmR3bQkRy8nfwzAkSuM4NA8e4Fmy9eJtN"
    }
  }
};
var $2 = {
  name: "Adding Participant Responded",
  request: {
    type: {
      blueId: "HxcK5S9Lz2q5cqtER8kKgLQzDARZGiUAxWuhtBi2ev3a"
    }
  },
  status: {
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  }
};
var ee2 = {
  name: "Adding Participant Requested",
  channelName: {
    description: "The abstract channel name for the new participant.",
    type: {
      blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
    }
  },
  participantBinding: {
    description: "How to identify the new user.",
    accountId: {
      type: {
        blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
      }
    },
    email: {
      type: {
        blueId: "F92yo19rCcbBoBSpUA5LRxpfDejJDAaP1PRxxbWAraVP"
      }
    }
  }
};
var te2 = {
  "2gnwi1cAknCcEdUoACnoSjfWD8oJRAhMyxmWnYD2595T": I2,
  "4Lix4AKXvBDvrwxw2htSdYFKxL4wugEQzqoSEYet5Dh1": L2,
  "59JfECYVQbmK6yQ3NdcpGivHqujJH6XQpK48s8szPH73": T2,
  "6tzp2YX1rei3aAXg22SqYbeiiteGthj1LesTNCWm7wbU": U2,
  "6Zztm3YUuFwM5FoJ5Se9rsghP1BgQa3rLHoR8BhdNsTM": w3,
  "77dKAvJLiqw5WXwyjHNRXfkh3ep8sHw7Q4gQyJEfoadJ": E2,
  "8cyT2HqPHGFBNjLnZzqsb4qN3CqZxMQEWo3h7KLVCfog": J2,
  "8WpUtXczWTnk5cc38GNVH59ZBEwh5B9WEwjK9RGmSjqx": k2,
  "8wwU4rYswgfNnVYgEEBeLEdaPwXMzLzNs6do7bawa7xD": q3,
  "9dvBsvQ5tGUZmR3bQkRy8nfwzAkSuM4NA8e4Fmy9eJtN": V2,
  "9NExoTity2JU7poKAYairyjHsxDSH5jv5XyokoFE4VR2": H2,
  B1W38RbaLYqkaPVP6upwrF6Z8G95LA7yPMPPXPvWvuRW: X2,
  BUufbPHWkFYjUUHXKaJVTErb4EVhCSfaubj5KECNhNXa: z4,
  Bx3dgXf5uFkGf9KxkUTFWQhbEw9QBc9cTgz1KP1Qtgh6: Q2,
  C99Sgq7uyEjz4YH7L27Aj1aahV2tJMAoCVct3ZiZp8av: N3,
  CeWyRmXAMZqvWBvby2KbRUZWcS7Pdxs42vnMXgn9gg6H: K2,
  EKDNdfFrKyQqa6ifz1oqPBZqhz3xvv7GB914CJPCumXF: Y2,
  Ff61TKzxLStjvfMksRNUBif2PRJGJM6XvmTqSf3M76wC: Z2,
  FW2R85SUhYpoCVrzyr3DYWXK9TJNAuw5HLAmzdUnW6M3: G2,
  GvLXrz3siPPmmSLz1gHrQ4PCpDvjESdEfWSWUNwKrhf1: _2,
  H556UWC5XU8vj53PqHaXQQwXrGia9uHHkkdQpExJXJYT: $2,
  HxcK5S9Lz2q5cqtER8kKgLQzDARZGiUAxWuhtBi2ev3a: ee2
};
var oe2 = {
  blueIds: t2,
  schemas: Object.values(F2),
  contents: te2
};

// libs/document-processor/src/utils/path.ts
var makePath = (...parts) => parts.map((part, index) => {
  if (typeof part !== "string") return "";
  if (index === 0 && part === "/") return "/";
  const withoutLeadingSlash = index > 0 ? part.replace(/^\/+/, "") : part;
  return index < parts.length - 1 ? withoutLeadingSlash.replace(/\/+$/, "") : withoutLeadingSlash;
}).filter(Boolean).join("/").replace(/\/{2,}/g, "/");

// libs/document-processor/src/context.ts
var InternalContext = class {
  constructor(getDocument, taskInfo, blue2, onFlush, gasMeter) {
    this.getDocument = getDocument;
    this.taskInfo = taskInfo;
    this.blue = blue2;
    this.onFlush = onFlush;
    this.gasMeter = gasMeter;
    __publicField(this, "actions", []);
  }
  get(path) {
    const doc = this.getDocument();
    const resolvedPath = makePath(this.taskInfo.nodePath, path);
    return doc.get(resolvedPath);
  }
  addPatch(patch) {
    this.actions.push({
      kind: "patch",
      patch: {
        ...patch,
        path: makePath(this.taskInfo.nodePath, patch.path)
      }
    });
  }
  emitEvent(event) {
    const inputEvent = this.taskInfo.event;
    const inputEventTrace = inputEvent.trace ?? [];
    const enriched = {
      ...event,
      source: event.source ?? "internal",
      originNodePath: event.originNodePath ?? this.taskInfo.nodePath,
      rootEvent: event.rootEvent ?? inputEvent.rootEvent ?? inputEvent,
      trace: [...inputEventTrace],
      emissionType: event.emissionType ?? inputEvent.emissionType
    };
    this.actions.push({ kind: "event", event: enriched });
  }
  async flush() {
    if (!this.actions.length) return [];
    const out = [...this.actions];
    this.actions.length = 0;
    await this.onFlush?.(out);
    return out;
  }
  getNodePath() {
    return this.taskInfo.nodePath;
  }
  resolvePath(path) {
    return makePath(this.taskInfo.nodePath, path);
  }
  getTaskInfo() {
    return this.taskInfo;
  }
  getBlue() {
    return this.blue;
  }
  /* TODO: Move to a separate interface */
  loadExternalModule() {
    throw new Error("Not implemented");
  }
  loadBlueContent(blueId) {
    const blueNode = this.blue.getNodeProvider().fetchFirstByBlueId(blueId);
    if (!blueNode) {
      throw new Error(`Blue node not found for blueId: ${blueId}`);
    }
    return Promise.resolve(JSON.stringify(this.blue.nodeToJson(blueNode)));
  }
  getGasMeter() {
    return this.gasMeter;
  }
};

// libs/document-processor/src/utils/GasMeter.ts
var GasMeter = class {
  constructor(budget) {
    this.budget = budget;
    __publicField(this, "consumed", 0);
  }
  consume(amount, reason) {
    if (amount <= 0) return;
    this.consumed += amount;
    if (this.budget !== void 0 && this.consumed > this.budget) {
      const exceededBy = this.consumed - this.budget;
      throw new GasBudgetExceededError(
        this.budget,
        this.consumed,
        exceededBy,
        reason
      );
    }
  }
  getBudget() {
    return this.budget;
  }
  getConsumed() {
    return this.consumed;
  }
  getRemaining() {
    if (this.budget === void 0) return void 0;
    return Math.max(0, this.budget - this.consumed);
  }
};
var GasBudgetExceededError = class extends Error {
  constructor(budget, consumed, exceededBy, reason) {
    super(
      `Gas budget of ${budget} exceeded by ${exceededBy}${reason ? ` while processing ${reason}` : ""}`
    );
    this.budget = budget;
    this.consumed = consumed;
    this.exceededBy = exceededBy;
    this.reason = reason;
    this.name = "GasBudgetExceededError";
  }
};

// libs/document-processor/src/utils/exceptions.ts
var PatchApplicationError = class extends Error {
  constructor(patch, cause) {
    super(`Cannot apply patch ${JSON.stringify(patch)}`);
    this.patch = patch;
    this.cause = cause;
    this.name = "PatchApplicationError";
  }
};
var EmbeddedDocumentModificationError = class extends Error {
  constructor(patch, offendingPath, contractNodePath) {
    super(
      `Patch ${JSON.stringify(patch)} touches "${patch.op === "move" || patch.op === "copy" ? `${patch.from} \u2192 ${patch.path}` : patch.path}" which is inside embedded document "${offendingPath}" (Process Embedded @ "${contractNodePath}")`
    );
    this.patch = patch;
    this.offendingPath = offendingPath;
    this.contractNodePath = contractNodePath;
    this.name = "EmbeddedDocumentModificationError";
  }
};
var ExpressionEvaluationError = class extends Error {
  constructor(code, cause) {
    super(`Failed to evaluate expression "${code}"`);
    this.code = code;
    this.cause = cause;
    this.name = "ExpressionEvaluationError";
  }
};
var CodeBlockEvaluationError = class extends Error {
  constructor(code, cause) {
    super(`Failed to evaluate code block "${code}"`);
    this.code = code;
    this.cause = cause;
    this.name = "CodeBlockEvaluationError";
  }
};

// libs/document-processor/src/utils/document.ts
function freeze(doc) {
  return P2(doc);
}
function mutable(doc) {
  return doc.clone();
}
function collectEmbeddedPathSpecs(doc, blue2, base2 = "/", out = []) {
  const contracts = doc.getContracts() ?? {};
  for (const [name, node] of Object.entries(contracts)) {
    const isProcessEmbedded = blue2.isTypeOf(node, w2);
    if (isProcessEmbedded) {
      const processEmbedded = blue2.nodeToSchemaOutput(
        node,
        w2
      );
      const paths = processEmbedded.paths ?? [];
      for (const rel of paths) {
        out.push({
          absPath: makePath(base2, rel),
          contractPath: makePath(base2, `contracts/${name}`)
        });
      }
    }
  }
  for (const [key2, value] of Object.entries(doc.getProperties() ?? {})) {
    collectEmbeddedPathSpecs(
      value,
      blue2,
      makePath(base2, key2),
      out
    );
  }
  return out;
}
function isInside(target, root) {
  return target === root || target.startsWith(root.endsWith("/") ? root : root + "/");
}
function applyPatches(document, patches) {
  if (!patches.length) return document;
  let mutableDoc = mutable(document);
  for (const patch of patches) {
    try {
      mutableDoc = applyBlueNodePatch(mutableDoc, patch, true);
    } catch (error) {
      throw new PatchApplicationError(patch, error);
    }
  }
  return freeze(mutableDoc);
}

// libs/document-processor/src/utils/typeGuard.ts
function isNonNullable(value) {
  return value !== null && value !== void 0;
}
function isDocumentNode(value) {
  return value instanceof BlueNode;
}

// libs/document-processor/src/utils/TinyQueue.ts
var TinyQueue = class {
  constructor(data = [], compare = (a4, b3) => a4 < b3 ? -1 : a4 > b3 ? 1 : 0) {
    __publicField(this, "data");
    __publicField(this, "length");
    __publicField(this, "compare");
    this.data = data;
    this.length = this.data.length;
    this.compare = compare;
    if (this.length > 0) {
      for (let i2 = (this.length >> 1) - 1; i2 >= 0; i2--) this._down(i2);
    }
  }
  push(item) {
    this.data.push(item);
    this._up(this.length++);
  }
  pop() {
    if (this.length === 0) return void 0;
    const top = this.data[0];
    const bottom = this.data.pop();
    if (--this.length > 0) {
      this.data[0] = bottom;
      this._down(0);
    }
    return top;
  }
  peek() {
    return this.data[0];
  }
  _up(pos) {
    const { data, compare } = this;
    const item = data[pos];
    while (pos > 0) {
      const parent = pos - 1 >> 1;
      const current = data[parent];
      if (compare(item, current) >= 0) break;
      data[pos] = current;
      pos = parent;
    }
    data[pos] = item;
  }
  _down(pos) {
    const { data, compare } = this;
    const halfLength = this.length >> 1;
    const item = data[pos];
    while (pos < halfLength) {
      let bestChild = (pos << 1) + 1;
      const right = bestChild + 1;
      if (right < this.length && compare(data[right], data[bestChild]) < 0) {
        bestChild = right;
      }
      if (compare(data[bestChild], item) >= 0) break;
      data[pos] = data[bestChild];
      pos = bestChild;
    }
    data[pos] = item;
  }
};

// libs/document-processor/src/queue/TaskKey.ts
var makeTaskKey = (depth, eventSeq, contractTypePriority, contractOrder, contractName, taskId) => [
  -depth,
  eventSeq,
  contractTypePriority,
  contractOrder,
  contractName,
  taskId
];
var compareTasks = (a4, b3) => {
  for (let i2 = 0; i2 < a4.key.length; i2++) {
    const av = a4.key[i2];
    const bv = b3.key[i2];
    if (av === bv) continue;
    if (typeof av === "number" && typeof bv === "number") {
      return av - bv;
    }
    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv);
    }
    return 0;
  }
  return 0;
};

// libs/document-processor/src/queue/TaskQueue.ts
var TaskQueue = class {
  /**
   * Creates a new task queue with the task key comparator
   */
  constructor() {
    __publicField(this, "queue");
    this.queue = new TinyQueue([], compareTasks);
  }
  /**
   * Adds a task to the queue
   *
   * @param task - The task to add
   */
  push(task) {
    this.queue.push(task);
  }
  /**
   * Removes and returns the highest priority task
   *
   * @returns The highest priority task or undefined if queue is empty
   */
  pop() {
    return this.queue.pop();
  }
  /**
   * Gets the number of tasks in the queue
   */
  get length() {
    return this.queue.length;
  }
};

// libs/document-processor/src/registry/ContractRegistry.ts
var ContractRegistry = class {
  /**
   * Creates a new contract registry
   *
   * @param list - Initial list of processors to register
   */
  constructor(list = []) {
    __publicField(this, "processors", /* @__PURE__ */ new Map());
    __publicField(this, "typeOrder", /* @__PURE__ */ new Map());
    list.forEach((p4, i2) => this.register(p4, i2));
  }
  /**
   * Registers a new contract processor
   *
   * @param proc - The processor to register
   * @param orderHint - Optional priority value for execution order
   * @throws Error if a processor for the same contract type is already registered
   */
  register(proc, orderHint) {
    if (this.processors.has(proc.contractBlueId)) {
      throw new Error(`Processor for ${proc.contractType} already registered`);
    }
    this.processors.set(proc.contractBlueId, proc);
    if (!this.typeOrder.has(proc.contractBlueId)) {
      this.typeOrder.set(proc.contractBlueId, orderHint ?? this.typeOrder.size);
    }
  }
  /**
   * Gets a processor by contract type node
   *
   * @param typeNode - The contract type node
   * @returns The associated processor or undefined
   */
  get(typeNode) {
    if (!typeNode) return void 0;
    const blueId = typeNode.getBlueId();
    if (!blueId) return void 0;
    return this.processors.get(blueId);
  }
  /**
   * Gets the order priority for a contract type node
   *
   * @param typeNode - The contract type node
   * @returns The priority value (0 if not found)
   */
  orderOf(typeNode) {
    if (!typeNode) return 0;
    const blueId = typeNode.getBlueId();
    if (!blueId) return 0;
    return this.typeOrder.get(blueId) ?? 0;
  }
  /**
   * Gets all registered processors
   *
   * @returns Iterator of all registered processors
   */
  values() {
    return this.processors.values();
  }
};

// libs/document-processor/src/utils/runtimeEnv.ts
function getEnvVar(name) {
  const valueFromProcess = getValueFromProcessEnv(name);
  if (valueFromProcess !== void 0) {
    return valueFromProcess;
  }
  const valueFromGlobal = getValueFromGlobalEnv(name);
  if (valueFromGlobal !== void 0) {
    return valueFromGlobal;
  }
  return void 0;
}
function getEnvFlag(name) {
  const raw = getEnvVar(name);
  if (!raw) return false;
  return raw === "true" || raw === "1";
}
function getRuntimeInfo() {
  if (true) {
    return { version: "unknown", platform: "unknown", arch: "unknown" };
  }
  const { version, platform, arch } = void 0;
  return {
    version: version ?? "unknown",
    platform: platform ?? "unknown",
    arch: arch ?? "unknown"
  };
}
function getValueFromProcessEnv(name) {
  if (true) return void 0;
  const env = (void 0).env;
  if (!env) return void 0;
  const value = env[name];
  return typeof value === "string" ? value : void 0;
}
function getValueFromGlobalEnv(name) {
  const globalEnv = globalThis.__BLUE_ENV__;
  if (!globalEnv) return void 0;
  const value = globalEnv[name];
  return typeof value === "string" ? value : void 0;
}

// libs/document-processor/src/utils/EventTraceManager.ts
var _EventTraceManager = class _EventTraceManager {
  constructor(isEnabled) {
    __publicField(this, "isEnabled");
    if (typeof isEnabled === "boolean") {
      this.isEnabled = isEnabled;
      return;
    }
    const envValue = getEnvVar("TRACE_BLUE_ENABLED");
    this.isEnabled = envValue !== "false";
  }
  /**
   * Creates a hop entry for the trace
   * @param nodePath - The path to the node
   * @param contractName - The name of the contract
   * @returns A formatted hop string
   */
  makeHop(nodePath, contractName) {
    return `${nodePath}#${contractName}`;
  }
  /**
   * Checks if tracing is enabled
   * @returns Whether tracing is enabled
   */
  shouldTrace() {
    return this.isEnabled;
  }
  /**
   * Adds a hop to the event's trace if tracing is enabled
   * @param event - The event to add the trace to
   * @param nodePath - The path to the node
   * @param contractName - The name of the contract
   * @returns A new event with the updated trace
   */
  addHop(event, nodePath, contractName) {
    if (!this.shouldTrace()) {
      return { ...event };
    }
    const prev = event.trace ?? [];
    const base2 = prev.length >= _EventTraceManager.MAX_TRACE_LENGTH ? prev.slice(prev.length - (_EventTraceManager.MAX_TRACE_LENGTH - 1)) : prev;
    const newTrace = [...base2, this.makeHop(nodePath, contractName)];
    return {
      ...event,
      trace: newTrace
    };
  }
  /**
   * Gets the current trace for an event
   * @param event - The event to get the trace for
   * @returns The current trace array or an empty array if none exists
   */
  getTrace(event) {
    return event.trace ?? [];
  }
  /**
   * Clears the trace for an event
   * @param event - The event to clear the trace for
   * @returns A new event with an empty trace
   */
  clearTrace(event) {
    return {
      ...event,
      trace: []
    };
  }
  /**
   * Checks if tracing is enabled globally
   * @returns Whether tracing is enabled
   */
  isTracingEnabled() {
    return this.isEnabled;
  }
};
__publicField(_EventTraceManager, "MAX_TRACE_LENGTH", 128);
var EventTraceManager = _EventTraceManager;

// libs/document-processor/src/routing/buildContractEntries.ts
function buildContractEntries(node) {
  const entries = Object.entries(node.getContracts() ?? {});
  return entries;
}

// libs/document-processor/src/utils/gasCosts.ts
var GAS_COST_ROUTE_TRAVERSAL = 5;
var GAS_COST_ROUTE_MATCH = 10;
var GAS_COST_HANDLER_INVOCATION = 25;
var GAS_COST_PATCH_APPLICATION = 15;
var GAS_COST_EMITTED_EVENT = 10;

// libs/document-processor/src/routing/EventRouter.ts
var MAX_INLINE_ADAPTER_DEPTH = 64;
var EventRouter = class {
  /**
   * Creates a new event router
   *
   * @param registry - Contract registry for looking up processors
   * @param queue - Task queue for scheduling handlers
   * @param getNextTaskId - Function to get the next task ID
   * @param getNextEventSeq - Function to get the next event sequence number
   */
  constructor(blue2, registry, queue, getNextTaskId, getNextEventSeq) {
    this.blue = blue2;
    this.registry = registry;
    this.queue = queue;
    this.getNextTaskId = getNextTaskId;
    this.getNextEventSeq = getNextEventSeq;
    __publicField(this, "traceManager");
    this.traceManager = new EventTraceManager();
  }
  /**
   * Routes an event to matching contracts in the document
   *
   * @param doc - The document to route events in
   * @param pathSegments - Path segments to the current node
   * @param event - The event to route
   * @param afterTaskId - Minimum task ID to use
   * @param inlineDepth - Current adapter recursion depth
   */
  async route(doc, pathSegments, event, afterTaskId, inlineDepth = 0, gasMeter) {
    gasMeter?.consume(
      GAS_COST_ROUTE_TRAVERSAL,
      `route:depth:${pathSegments.length}`
    );
    if (event.seq === void 0) {
      event.seq = this.getNextEventSeq();
    }
    if (pathSegments.length === 0) {
      if (event.dispatchPath) {
        const segs = event.dispatchPath.split("/").filter(Boolean);
        const cloned = { ...event };
        delete cloned.dispatchPath;
        return this.route(doc, segs, cloned, afterTaskId, inlineDepth, gasMeter);
      }
      if (event.source === "channel" && event.originNodePath && event.originNodePath !== "/") {
        const segs = event.originNodePath?.split("/").filter(Boolean) ?? [];
        return this.route(doc, segs, event, afterTaskId, inlineDepth, gasMeter);
      }
    }
    const nodePath = makePath("/", pathSegments.join("/"));
    const node = doc.get(nodePath);
    if (!isDocumentNode(node)) return;
    await this.traverseContracts({
      doc,
      node,
      nodePath,
      event,
      afterTaskId,
      pathSegments,
      inlineDepth,
      gasMeter
    });
  }
  /**
   * Traverses contracts at the current node and routes to matching ones
   */
  async traverseContracts(args) {
    const {
      doc,
      node,
      nodePath,
      event,
      afterTaskId,
      pathSegments,
      inlineDepth,
      gasMeter
    } = args;
    if (this.shouldSkipForChannel(event, nodePath)) return;
    for (const [contractName, contractNode] of buildContractEntries(node)) {
      if (!contractNode.getType()) continue;
      const cp = this.registry.get(contractNode.getType());
      if (!cp) {
        console.warn(`No processor registered for contract: ${contractName}`);
        continue;
      }
      const handlerTask = {
        nodePath,
        contractName,
        contractNode,
        event
      };
      const ctx = new InternalContext(() => doc, handlerTask, this.blue, void 0, gasMeter);
      if (!cp.supports(event, contractNode, ctx, contractName)) continue;
      gasMeter?.consume(
        GAS_COST_ROUTE_MATCH,
        `route:match:${nodePath}#${contractName}`
      );
      switch (cp.role) {
        case "adapter":
          await this.processAdapter({
            cp,
            event,
            contractNode,
            ctx,
            contractName,
            doc,
            afterTaskId,
            inlineDepth,
            gasMeter
          });
          break;
        case "handler":
          this.scheduleHandler({
            contractNode,
            contractName,
            nodePath,
            event,
            depth: pathSegments.length,
            afterTaskId,
            gasMeter
          });
          break;
        case "validator":
          break;
        case "marker":
          break;
      }
    }
  }
  /**
   * Processes an adapter contract and routes any emitted events
   */
  async processAdapter(args) {
    const {
      cp,
      event,
      contractNode,
      ctx,
      contractName,
      doc,
      afterTaskId,
      inlineDepth,
      gasMeter
    } = args;
    if (inlineDepth >= MAX_INLINE_ADAPTER_DEPTH) {
      throw new Error("Adapter recursion limit reached");
    }
    const tracedEvent = this.traceManager.addHop(
      event,
      ctx.getTaskInfo()?.nodePath ?? "",
      contractName
    );
    gasMeter?.consume(
      GAS_COST_HANDLER_INVOCATION,
      `adapter:${contractName}`
    );
    await cp.handle(tracedEvent, contractNode, ctx, contractName);
    const batch = await ctx.flush();
    const illegal = batch.find((a4) => a4.kind === "patch");
    if (illegal) {
      throw new Error(
        `Contract "${contractName}" (adapter) attempted to patch the document`
      );
    }
    const emitted = batch.filter((a4) => a4.kind === "event");
    for (const a4 of emitted) {
      gasMeter?.consume(
        GAS_COST_EMITTED_EVENT,
        `event:adapter:${contractName}`
      );
      await this.route(doc, [], a4.event, afterTaskId, inlineDepth + 1, gasMeter);
    }
  }
  /**
   * Schedules a handler contract for future execution
   */
  scheduleHandler(args) {
    const {
      contractNode,
      contractName,
      nodePath,
      event,
      depth,
      afterTaskId,
      gasMeter
    } = args;
    const contractNodeType = contractNode.getType();
    if (!contractNodeType) {
      console.warn(`Contract node type is not defined for: ${contractName}`);
      return;
    }
    const typePriority = this.registry.orderOf(contractNodeType);
    const contractNodeOrder = contractNode.get("/order");
    const contractOrder = isBigNumber(contractNodeOrder) ? contractNodeOrder.toNumber() : 0;
    const taskId = this.getNextTaskId() + afterTaskId;
    const eventSeq = event.seq;
    if (eventSeq === void 0) {
      throw new Error("Event sequence missing");
    }
    const key2 = makeTaskKey(
      depth,
      eventSeq,
      typePriority,
      contractOrder,
      contractName,
      taskId
    );
    {
      const currentHop = `${nodePath}#${contractName}`;
      const trace = event.trace ?? [];
      if (event.source !== "external" && trace.includes(currentHop)) {
        throw new Error(
          `Loop detected: repeated hop ${currentHop} within the same event chain`
        );
      }
    }
    const tracedEvent = this.traceManager.addHop(event, nodePath, contractName);
    this.queue.push({
      key: key2,
      nodePath,
      contractName,
      contractNode,
      event: tracedEvent
    });
  }
  /**
   * Checks if an event should be skipped because it came from another channel node
   */
  shouldSkipForChannel(event, nodePath) {
    return event.source === "channel" && !!event.originNodePath && event.originNodePath !== nodePath;
  }
};

// libs/document-processor/src/utils/logPatchError.ts
var logPatchError = (contractName, event, err) => {
  if (err instanceof PatchApplicationError || err instanceof EmbeddedDocumentModificationError) {
    console.error(
      `[Blue] Failed to apply patches for contract "${contractName}" on event ${JSON.stringify(event)}`,
      err
    );
  }
};

// libs/document-processor/src/utils/checkpoint.ts
function ensureCheckpointContracts(doc, blue2) {
  const mutableDoc = mutable(doc);
  const ensureOnNode = (node) => {
    if (!isDocumentNode(node)) return;
    const contracts = node.getContracts();
    if (!contracts?.checkpoint || !BlueNodeTypeSchema.isTypeOf(
      contracts.checkpoint,
      h
    )) {
      node.addContract(
        "checkpoint",
        blue2.jsonValueToNode({
          type: {
            name: "Channel Event Checkpoint",
            blueId: t["Channel Event Checkpoint"]
          },
          lastEvents: {}
        })
      );
    }
  };
  ensureOnNode(mutableDoc);
  for (const { absPath } of collectEmbeddedPathSpecs(mutableDoc, blue2)) {
    const embedded = mutableDoc.get(absPath);
    if (isDocumentNode(embedded)) {
      ensureOnNode(embedded);
    }
  }
  return freeze(mutableDoc);
}

// libs/document-processor/src/utils/initialized.ts
function ensureInitializedContract(doc, blue2) {
  const mutableDoc = mutable(doc);
  if (!isDocumentNode(mutableDoc)) {
    return freeze(mutableDoc);
  }
  if (!isInitialized(mutableDoc, blue2)) {
    mutableDoc.addContract(
      "initialized",
      blue2.jsonValueToNode({
        type: {
          name: "Initialized Marker",
          blueId: t["Initialized Marker"]
        }
      })
    );
  }
  return freeze(mutableDoc);
}
function isInitialized(doc, blue2) {
  const contracts = doc.getContracts();
  return Object.values(contracts ?? {}).some(
    (contract) => blue2.isTypeOf(contract, v2, {
      checkSchemaExtensions: true
    })
  );
}

// libs/document-processor/src/processors/ChannelEventCheckpointProcessor.ts
var ChannelEventCheckpointProcessor = class {
  constructor(cache) {
    this.cache = cache;
    __publicField(this, "contractType", "Channel Event Checkpoint");
    __publicField(this, "contractBlueId", t["Channel Event Checkpoint"]);
    __publicField(this, "role", "handler");
  }
  supports(evt) {
    return evt.source === "channel" && evt.rootEvent?.payload === evt.payload && evt.rootEvent?.source === "external";
  }
  async getEventBlueId(event, ctx) {
    const eventPayload = event.rootEvent?.payload;
    if (!eventPayload) {
      throw new Error(
        "Cannot calculate blueId for checkpoint: missing root event payload"
      );
    }
    if (eventPayload instanceof ResolvedBlueNode) {
      const minimalNode = eventPayload.getMinimalNode();
      return await ctx.getBlue().calculateBlueId(minimalNode);
    }
    return await ctx.getBlue().calculateBlueId(eventPayload);
  }
  async handle(event, node, ctx) {
    if (!event.channelName || !event.rootEvent?.seq) return;
    const blueId = await this.getEventBlueId(event, ctx);
    const docBase = ctx.getNodePath().replace(/\/contracts\/checkpoint$/, "");
    this.cache.record(docBase, event, blueId);
  }
};

// libs/document-processor/src/utils/CheckpointCache.ts
var hasPath = (obj, path) => {
  return obj.get(path) !== void 0;
};
var CheckpointCache = class {
  constructor() {
    __publicField(this, "firstSeen", /* @__PURE__ */ new Map());
  }
  record(docBase, event, eventBlueId) {
    const k3 = docBase;
    if (!this.firstSeen.has(k3)) {
      this.firstSeen.set(k3, { docBase, event, eventBlueId });
    }
  }
  /** Turn cached data into JSON-Patch ops */
  flush(document) {
    const patches = [];
    for (const { docBase, event, eventBlueId } of this.firstSeen.values()) {
      if (!event.channelName) continue;
      const chanBase = makePath(
        docBase,
        "contracts/checkpoint/lastEvents",
        event.channelName
      );
      const blueIdPath = `${chanBase}/blueId`;
      if (!hasPath(document, chanBase)) {
        patches.push({
          op: "add",
          path: chanBase,
          val: { blueId: eventBlueId }
        });
      } else {
        patches.push({
          op: hasPath(document, blueIdPath) ? "replace" : "add",
          path: blueIdPath,
          val: eventBlueId
        });
      }
    }
    return patches;
  }
  clear() {
    this.firstSeen.clear();
  }
};

// libs/document-processor/src/processors/CompositeTimelineChannelProcessor.ts
var CompositeTimelineChannelProcessor = class {
  constructor() {
    __publicField(this, "contractType", "Composite Timeline Channel");
    __publicField(this, "contractBlueId", t["Composite Timeline Channel"]);
    __publicField(this, "role", "adapter");
  }
  supports(event, node, ctx) {
    const compositeTimelineChannel = ctx.getBlue().nodeToSchemaOutput(node, g2);
    if (!compositeTimelineChannel.channels) return false;
    if (!event.channelName) return false;
    return compositeTimelineChannel.channels.includes(event.channelName);
  }
  handle(event, node, ctx, path) {
    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: "channel"
    });
  }
};

// libs/document-processor/src/processors/BaseChannelProcessor.ts
var BaseChannelProcessor = class {
  constructor() {
    __publicField(this, "role", "adapter");
  }
  /**
   * Base implementation of supports that checks if the event is not from a channel
   * Derived classes should call this method first in their supports implementation
   */
  baseSupports(event) {
    return event.source !== "channel";
  }
};

// libs/document-processor/src/processors/DocumentUpdateChannelProcessor.ts
var DocumentUpdateChannelProcessor = class extends BaseChannelProcessor {
  constructor() {
    super(...arguments);
    __publicField(this, "contractType", "Document Update Channel");
    __publicField(this, "contractBlueId", t["Document Update Channel"]);
  }
  supports(event, contractNode, ctx) {
    if (!this.baseSupports(event)) return false;
    if (event.emissionType !== "update") return false;
    const documentUpdateChannel = ctx.getBlue().nodeToSchemaOutput(contractNode, b);
    const payloadPath = event.payload.get("/path");
    if (!payloadPath) return false;
    const documentUpdatePath = documentUpdateChannel.path;
    return g(documentUpdatePath) && payloadPath === ctx.resolvePath(documentUpdatePath);
  }
  handle(event, _node, ctx, path) {
    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: "channel"
    });
  }
};

// libs/document-processor/src/processors/EmbeddedNodeChannelProcessor.ts
var EmbeddedNodeChannelProcessor = class extends BaseChannelProcessor {
  constructor() {
    super(...arguments);
    __publicField(this, "contractType", "Embedded Node Channel");
    __publicField(this, "contractBlueId", t["Embedded Node Channel"]);
  }
  supports(event, node, ctx) {
    if (!this.baseSupports(event)) return false;
    const embeddedNodeChannel = ctx.getBlue().nodeToSchemaOutput(node, P3);
    return isNonNullable(event.originNodePath) && isNonNullable(embeddedNodeChannel.path) && event.originNodePath === ctx.resolvePath(embeddedNodeChannel.path);
  }
  handle(event, node, ctx, path) {
    const embeddedNodeChannel = ctx.getBlue().nodeToSchemaOutput(node, P3);
    const { originNodePath, payload } = event;
    if (isNonNullable(embeddedNodeChannel.path) && originNodePath === ctx.resolvePath(embeddedNodeChannel.path)) {
      ctx.emitEvent({
        payload,
        channelName: path,
        source: "channel"
      });
    }
  }
};

// libs/document-processor/src/processors/InitializedMarkerProcessor.ts
var InitializedMarkerProcessor = class {
  constructor() {
    __publicField(this, "contractType", "Initialized Marker");
    __publicField(this, "contractBlueId", t["Initialized Marker"]);
    __publicField(this, "role", "marker");
  }
  supports() {
    return false;
  }
  handle() {
    return;
  }
};

// libs/document-processor/src/processors/LifecycleEventChannelProcessor.ts
var LifecycleEventChannelProcessor = class extends BaseChannelProcessor {
  constructor() {
    super(...arguments);
    __publicField(this, "contractType", "Lifecycle Event Channel");
    __publicField(this, "contractBlueId", t["Lifecycle Event Channel"]);
  }
  supports(event, node, ctx) {
    if (!this.baseSupports(event)) return false;
    if (event.emissionType !== "lifecycle") return false;
    if (!this.isLifecycleEvent(event, ctx)) return false;
    return this.isEventPatternMatch(event, node, ctx);
  }
  handle(event, _node, ctx, path) {
    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: "channel",
      emissionType: event.emissionType
    });
  }
  /**
   * Checks if the event is a supported lifecycle event type
   */
  isLifecycleEvent(event, ctx) {
    const blue2 = ctx.getBlue();
    const eventPayloadNode = event.payload;
    return blue2.isTypeOf(eventPayloadNode, c2, {
      checkSchemaExtensions: true
    });
  }
  /**
   * Checks if the event matches the channel's event pattern (if specified)
   */
  isEventPatternMatch(event, node, ctx) {
    const channelEvent = node.getProperties()?.["event"];
    if (!channelEvent) {
      return true;
    }
    try {
      const blue2 = ctx.getBlue();
      const eventPayloadNode = blue2.resolve(event.payload);
      return blue2.isTypeOfNode(eventPayloadNode, channelEvent);
    } catch (error) {
      console.warn("Error during lifecycle event pattern matching:", error);
      return false;
    }
  }
};

// libs/document-processor/src/processors/MyOSTimelineChannelProcessor.ts
var isTimelineEntryEvent = (evt, ctx) => {
  const blue2 = ctx.getBlue();
  return blue2.isTypeOf(evt.payload, L) || blue2.isTypeOf(evt.payload, D2);
};
var MyOSTimelineChannelProcessor = class extends BaseChannelProcessor {
  constructor() {
    super(...arguments);
    __publicField(this, "contractType", "MyOS Timeline Channel");
    __publicField(this, "contractBlueId", t2["MyOS Timeline Channel"]);
  }
  supports(event, node, ctx) {
    if (!this.baseSupports(event)) return false;
    if (!isTimelineEntryEvent(event, ctx)) return false;
    const blue2 = ctx.getBlue();
    const myosTimelineEntry = blue2.nodeToSchemaOutput(
      event.payload,
      D2
    );
    const myosTimelineChannel = ctx.getBlue().nodeToSchemaOutput(node, r2);
    const timelineEntryTimelineId = myosTimelineEntry.timeline?.timelineId;
    const hasTimelineId = isNonNullable(myosTimelineChannel.timelineId) && isNonNullable(timelineEntryTimelineId);
    return hasTimelineId && timelineEntryTimelineId === myosTimelineChannel.timelineId;
  }
  handle(event, node, ctx, path) {
    if (!isTimelineEntryEvent(event, ctx)) return;
    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: "channel"
    });
  }
};

// libs/document-processor/src/processors/MyOSAgentChannelProcessor.ts
var MyOSAgentChannelProcessor = class extends BaseChannelProcessor {
  constructor() {
    super(...arguments);
    __publicField(this, "contractType", "MyOS Agent Channel");
    __publicField(this, "contractBlueId", t2["MyOS Agent Channel"]);
  }
  supports(event, node, ctx) {
    if (!this.baseSupports(event)) return false;
    try {
      const { myosAgentEvent, myosAgentChannel } = this.parseEventAndChannel(
        event,
        node,
        ctx
      );
      return this.isAgentMatch(myosAgentEvent, myosAgentChannel) && this.isEventPatternMatch(myosAgentEvent, myosAgentChannel, ctx);
    } catch (error) {
      console.warn("Error in MyOSAgentChannelProcessor.supports:", error);
      return false;
    }
  }
  handle(event, node, ctx, path) {
    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: "channel"
    });
  }
  /**
   * Parses and validates the event payload and channel configuration
   * @throws {Error} If schema validation fails
   */
  parseEventAndChannel(event, node, ctx) {
    const blue2 = ctx.getBlue();
    const myosAgentEvent = blue2.nodeToSchemaOutput(
      event.payload,
      B2
    );
    const myosAgentChannel = blue2.nodeToSchemaOutput(
      node,
      x2
    );
    return { myosAgentEvent, myosAgentChannel };
  }
  /**
   * Checks if the agent IDs match between event and channel
   * @param myosAgentEvent - The parsed agent event
   * @param myosAgentChannel - The parsed agent channel configuration
   * @returns true if both have valid agent IDs and they match
   */
  isAgentMatch(myosAgentEvent, myosAgentChannel) {
    const eventAgentId = myosAgentEvent.agentId;
    const channelAgentId = myosAgentChannel.agent?.agentId;
    return isNonNullable(eventAgentId) && isNonNullable(channelAgentId) && eventAgentId === channelAgentId;
  }
  /**
   * Checks if the event pattern matches the channel's event filter
   *
   * @param myosAgentEvent - The parsed agent event
   * @param myosAgentChannel - The parsed agent channel configuration
   * @param ctx - Processing context for Blue instance access
   * @returns true if the event matches the channel's filter criteria
   *
   * **Matching Logic:**
   * - If no event pattern is specified in channel → matches all events
   * - If channel has event pattern but incoming event has no event data → no match
   * - Otherwise → uses deep containment matching (event must contain all channel pattern fields)
   */
  isEventPatternMatch(myosAgentEvent, myosAgentChannel, ctx) {
    const channelEvent = myosAgentChannel.event;
    if (!channelEvent) {
      return true;
    }
    const eventData = myosAgentEvent.event;
    if (!eventData) {
      return false;
    }
    try {
      const blue2 = ctx.getBlue();
      const eventPayloadJson = blue2.nodeToJson(eventData);
      const channelEventJson = blue2.nodeToJson(channelEvent);
      return a(eventPayloadJson, channelEventJson);
    } catch (error) {
      console.warn("Error during event pattern matching:", error);
      return false;
    }
  }
};

// libs/document-processor/src/processors/OperationProcessor.ts
var OperationProcessor = class {
  constructor() {
    __publicField(this, "contractType", "Operation");
    __publicField(this, "contractBlueId", t["Operation"]);
    __publicField(this, "role", "adapter");
  }
  supports(event, node, ctx, contractName) {
    const blue2 = ctx.getBlue();
    const operationDefinition = blue2.nodeToSchemaOutput(node, D);
    const eventOperationRequest = this.parseEventPayload(event, ctx);
    const matchOperationName = this.isOperationNameMatch(
      eventOperationRequest,
      contractName
    );
    const matchChannelName = this.isOperationChannelMatch(
      event,
      operationDefinition
    );
    const matchRequestPattern = this.isRequestPatternMatch(
      eventOperationRequest,
      operationDefinition,
      ctx
    );
    return matchOperationName && matchChannelName && matchRequestPattern;
  }
  async handle(event, node, ctx, contractName) {
    ctx.emitEvent({
      payload: event.payload,
      channelName: contractName,
      source: "channel"
    });
  }
  parseEventPayload(event, ctx) {
    const blue2 = ctx.getBlue();
    if (blue2.isTypeOf(event.payload, L, {
      checkSchemaExtensions: true
    })) {
      const timelineEntry = blue2.nodeToSchemaOutput(
        event.payload,
        L
      );
      if (timelineEntry.message) {
        const operationRequest = blue2.nodeToSchemaOutput(
          timelineEntry.message,
          A2
        );
        return operationRequest;
      }
    }
    return null;
  }
  isOperationNameMatch(eventOperationRequest, contractName) {
    return isNonNullable(eventOperationRequest?.operation) && eventOperationRequest?.operation === contractName;
  }
  isOperationChannelMatch(event, operationDefinition) {
    const operationDefinitionChannelName = operationDefinition.channel;
    if (R(operationDefinitionChannelName)) {
      return true;
    }
    return event.source === "channel" && event.channelName === operationDefinitionChannelName;
  }
  isRequestPatternMatch(eventOperationRequest, operationDefinition, ctx) {
    const requestNode = operationDefinition.request;
    if (R(requestNode)) {
      return true;
    }
    const blue2 = ctx.getBlue();
    const eventRequestNode = eventOperationRequest?.request;
    if (R(eventRequestNode)) {
      return false;
    }
    const eventRequestNodeResolved = blue2.resolve(eventRequestNode);
    return blue2.isTypeOfNode(eventRequestNodeResolved, requestNode);
  }
};

// libs/document-processor/src/processors/ProcessEmbeddedProcessor.ts
var ProcessEmbeddedProcessor = class {
  constructor() {
    __publicField(this, "contractType", "Process Embedded");
    __publicField(this, "role", "adapter");
    __publicField(this, "contractBlueId", t["Process Embedded"]);
  }
  supports(evt) {
    return evt.source !== "channel";
  }
  handle(evt, node, ctx) {
    const processEmbedded = ctx.getBlue().nodeToSchemaOutput(node, w2);
    for (const rel of processEmbedded.paths ?? []) {
      ctx.emitEvent({
        ...evt,
        dispatchPath: ctx.resolvePath(rel)
      });
    }
  }
};

// libs/document-processor/src/quickjs/stubs/quickjs-emscripten.ts
async function newQuickJSAsyncWASMModule() {
  throw new Error("quickjs-emscripten is not available inside the QuickJS bundle.");
}

// libs/document-processor/src/processors/SequentialWorkflowProcessor/utils/ExpressionEvaluator.ts
var DEFAULT_MEMORY_LIMIT_BYTES = 32 * 1024 * 1024;
var DEFAULT_TIMEOUT_MS = 500;
var BASE_EXPRESSION_GAS_COST = 50;
var GAS_PER_CHAR_COST = 2;
var GAS_PER_BINDING_COST = 5;
var MODULE_RESOLUTION_GAS_COST = 75;
function shouldSkipQuickJS() {
  return getEnvFlag("SKIP_QUICKJS") || getEnvFlag("SKIP_QUICKJS_WASM") || getEnvFlag("SKIP_ISOLATED_VM");
}
var quickJsModulePromise = null;
async function getQuickJsModule() {
  if (!quickJsModulePromise) {
    quickJsModulePromise = newQuickJSAsyncWASMModule().catch((err) => {
      quickJsModulePromise = null;
      throw err;
    });
  }
  return quickJsModulePromise;
}
function hasModuleSyntax(code) {
  return /\bimport\s.+\sfrom\s+['"][^'"]+['"]/.test(code) || /\bexport\s+/.test(code);
}
function isObjectLike(value) {
  return typeof value === "object" && value !== null;
}
function toDeterministicError(value) {
  if (value instanceof Error) {
    return value;
  }
  if (isObjectLike(value)) {
    const name = typeof value.name === "string" ? value.name : "Error";
    const message = typeof value.message === "string" ? value.message : JSON.stringify(value);
    const error = new Error(message);
    error.name = name;
    return error;
  }
  return new Error(String(value));
}
async function yieldToEventLoop() {
  if (typeof queueMicrotask === "function") {
    await new Promise((resolve2) => queueMicrotask(() => resolve2()));
    return;
  }
  if (typeof setImmediate === "function") {
    await new Promise((resolve2) => setImmediate(resolve2));
    return;
  }
  if (typeof setTimeout === "function") {
    await new Promise((resolve2) => setTimeout(resolve2, 0));
    return;
  }
  await Promise.resolve();
}
var ExpressionEvaluator = class {
  static getQuickJSUnavailableMessage(error) {
    const { version, platform, arch } = getRuntimeInfo();
    const message = [
      "QuickJS-WASM is required for expression evaluation but could not be initialized.",
      "Ensure the environment supports WebAssembly and that the quickjs-emscripten package is installed.",
      "",
      `Detected environment: ${version} on ${platform}/${arch}.`
    ];
    if (error) {
      message.push("", `Underlying error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return message.join("\n");
  }
  static async evaluate({
    code,
    ctx,
    bindings = {},
    options: options3 = {}
  }) {
    this.chargeForEvaluation(ctx, code, bindings);
    if (shouldSkipQuickJS()) {
      return this.evaluateSimple(code, bindings, options3);
    }
    let quickJsModule;
    try {
      quickJsModule = await getQuickJsModule();
    } catch (error) {
      throw new ExpressionEvaluationError(code, this.getQuickJSUnavailableMessage(error));
    }
    try {
      return await this.evaluateWithQuickJS(
        quickJsModule,
        code,
        bindings,
        ctx,
        options3
      );
    } catch (error) {
      if (options3.isCodeBlock) {
        throw new CodeBlockEvaluationError(code, error);
      }
      throw new ExpressionEvaluationError(code, error);
    }
  }
  static async evaluateSimple(code, bindings, options3 = {}) {
    if (hasModuleSyntax(code)) {
      throw new Error(
        "Static import/export syntax requires QuickJS \u2013 start without SKIP_QUICKJS or SKIP_ISOLATED_VM."
      );
    }
    try {
      if (options3.isCodeBlock) {
        const bindingKeys = Object.keys(bindings);
        const evalFn2 = new Function(
          ...bindingKeys,
          `return async function codeBlock(${bindingKeys.join(", ")}) { ${code} }`
        );
        const codeBlockFn = await evalFn2(
          ...bindingKeys.map((key2) => bindings[key2])
        );
        return await codeBlockFn(...bindingKeys.map((key2) => bindings[key2]));
      }
      const evalFn = new Function(
        ...Object.keys(bindings),
        `return ${code};`
      );
      return evalFn(...Object.values(bindings));
    } catch (error) {
      if (options3.isCodeBlock) throw new CodeBlockEvaluationError(code, error);
      throw new ExpressionEvaluationError(code, error);
    }
  }
  static async evaluateWithQuickJS(quickJsModule, code, bindings, ctx, options3 = {}) {
    const runtime = quickJsModule.newRuntime();
    const context = runtime.newContext();
    runtime.setMemoryLimit(DEFAULT_MEMORY_LIMIT_BYTES);
    const timeoutMs = options3.timeout ?? DEFAULT_TIMEOUT_MS;
    const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : null;
    if (deadline) {
      runtime.setInterruptHandler(() => Date.now() > deadline);
    }
    const moduleCache = /* @__PURE__ */ new Map();
    runtime.setModuleLoader(async (specifier) => {
      if (moduleCache.has(specifier)) {
        return moduleCache.get(specifier);
      }
      const source = await this.loadModuleSource(specifier, ctx);
      moduleCache.set(specifier, source);
      return source;
    });
    try {
      this.setupBindings(context, bindings);
      let resultHandle;
      if (hasModuleSyntax(code)) {
        resultHandle = await this.evaluateAsModule(
          context,
          runtime,
          code,
          options3,
          deadline
        );
      } else {
        resultHandle = await this.evaluateAsScript(
          context,
          runtime,
          code,
          bindings,
          options3,
          deadline
        );
      }
      const result = context.dump(resultHandle);
      if (resultHandle.alive) {
        resultHandle.dispose();
      }
      return this.deepClone(result);
    } finally {
      if (deadline) {
        runtime.removeInterruptHandler();
      }
      context.dispose();
      runtime.dispose();
    }
  }
  static setupBindings(context, bindings) {
    const consoleObject = context.newObject();
    const logFunction = context.newAsyncifiedFunction("log", async (...args) => {
      const values = args.map((arg) => context.dump(arg));
      console.log(...values);
      return context.undefined;
    });
    context.setProp(consoleObject, "log", logFunction);
    logFunction.dispose();
    context.setProp(context.global, "console", consoleObject);
    consoleObject.dispose();
    for (const [key2, value] of Object.entries(bindings)) {
      if (typeof value === "function") {
        const fnHandle = context.newAsyncifiedFunction(
          key2,
          async (...args) => {
            const hostArgs = args.map((arg) => context.dump(arg));
            try {
              const hostResult = await value(
                ...hostArgs
              );
              const { handle } = this.toQuickJSValue(context, hostResult);
              return handle;
            } catch (error) {
              return { error: this.toQuickJSErrorHandle(context, error) };
            }
          }
        );
        context.setProp(context.global, key2, fnHandle);
        fnHandle.dispose();
      } else {
        const { handle, dispose } = this.toQuickJSValue(context, value);
        context.setProp(context.global, key2, handle);
        if (dispose && handle.alive) {
          handle.dispose();
        }
      }
    }
  }
  static async evaluateAsScript(context, runtime, code, bindings, options3, deadline) {
    const bindingKeys = Object.keys(bindings);
    const paramList = bindingKeys.join(", ");
    const argsList = bindingKeys.join(", ");
    const body = options3.isCodeBlock ? code : `return (${code});`;
    const invocation = `(async (${paramList}) => { ${body} })(${argsList})`;
    const evaluation = await context.evalCodeAsync(invocation);
    const handle = context.unwrapResult(evaluation);
    return await this.resolveQuickJSHandle(context, runtime, handle, deadline);
  }
  static async evaluateAsModule(context, runtime, code, options3, deadline) {
    let moduleCode = code;
    if (options3.isCodeBlock) {
      const importExportRegex = /^\s*(import\s.+?;|export\s.+?;)/gm;
      const importExportLines = (code.match(importExportRegex) || []).join("\n");
      const codeWithoutImports = code.replace(importExportRegex, "").trim();
      moduleCode = `
        ${importExportLines}
        const run = function() {
          ${codeWithoutImports}
        };
        export default run();
      `;
    }
    const evaluation = await context.evalCodeAsync(moduleCode, "expression-evaluator-entry.mjs", {
      type: "module"
    });
    const namespaceHandle = await this.resolveQuickJSHandle(
      context,
      runtime,
      context.unwrapResult(evaluation),
      deadline
    );
    const defaultExportHandle = context.getProp(namespaceHandle, "default");
    namespaceHandle.dispose();
    return defaultExportHandle;
  }
  static async resolveQuickJSHandle(context, runtime, handle, deadline) {
    while (true) {
      const state = context.getPromiseState(handle);
      if (state.type === "pending") {
        if (deadline && Date.now() > deadline) {
          handle.dispose();
          throw new Error("QuickJS evaluation timed out while waiting for a promise to settle.");
        }
        const executed = this.executePendingJobs(runtime);
        if (!executed) {
          await yieldToEventLoop();
        }
        continue;
      }
      if (state.type === "fulfilled") {
        if (state.notAPromise) {
          return handle;
        }
        handle.dispose();
        return state.value;
      }
      const errorHandle = state.error;
      const error = toDeterministicError(context.dump(errorHandle));
      if (errorHandle.alive) {
        errorHandle.dispose();
      }
      handle.dispose();
      throw error;
    }
  }
  static executePendingJobs(runtime) {
    let executed = false;
    while (runtime.hasPendingJob()) {
      const jobResult = runtime.executePendingJobs();
      if (jobResult.error) {
        const errorContext = jobResult.error.context;
        const error = toDeterministicError(errorContext.dump(jobResult.error));
        if (jobResult.error.alive) {
          jobResult.error.dispose();
        }
        jobResult.dispose();
        throw error;
      }
      executed = executed || jobResult.value > 0;
      jobResult.dispose();
    }
    return executed;
  }
  static toQuickJSValue(context, value, seen = /* @__PURE__ */ new WeakMap()) {
    if (value === void 0) {
      return { handle: context.undefined, dispose: false };
    }
    if (value === null) {
      return { handle: context.null, dispose: false };
    }
    if (typeof value === "boolean") {
      return { handle: value ? context.true : context.false, dispose: false };
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return { handle: context.undefined, dispose: false };
      }
      return { handle: context.newNumber(value), dispose: true };
    }
    if (typeof value === "string") {
      return { handle: context.newString(value), dispose: true };
    }
    if (typeof value === "bigint") {
      return { handle: context.newBigInt(value), dispose: true };
    }
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
      const copy = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      return { handle: context.newArrayBuffer(copy), dispose: true };
    }
    if (value instanceof Date) {
      return { handle: context.newString(value.toJSON()), dispose: true };
    }
    if (value instanceof Map) {
      return this.toQuickJSValue(context, Array.from(value.entries()), seen);
    }
    if (value instanceof Set) {
      return this.toQuickJSValue(context, Array.from(value.values()), seen);
    }
    if (Array.isArray(value)) {
      const arrayHandle = context.newArray();
      for (let index = 0; index < value.length; index++) {
        const { handle: elementHandle, dispose } = this.toQuickJSValue(
          context,
          value[index],
          seen
        );
        context.setProp(arrayHandle, index, elementHandle);
        if (dispose && elementHandle.alive) {
          elementHandle.dispose();
        }
      }
      return { handle: arrayHandle, dispose: true };
    }
    if (isObjectLike(value)) {
      if (seen.has(value)) {
        return { handle: seen.get(value), dispose: false };
      }
      const objectHandle = context.newObject();
      seen.set(value, objectHandle);
      for (const [key2, entryValue] of Object.entries(value)) {
        const { handle: propertyHandle, dispose } = this.toQuickJSValue(
          context,
          entryValue,
          seen
        );
        context.setProp(objectHandle, key2, propertyHandle);
        if (dispose && propertyHandle.alive) {
          propertyHandle.dispose();
        }
      }
      return { handle: objectHandle, dispose: true };
    }
    return { handle: context.undefined, dispose: false };
  }
  static toQuickJSErrorHandle(context, error) {
    if (error instanceof Error) {
      return context.newError({ name: error.name, message: error.message });
    }
    return context.newError(String(error));
  }
  static async loadModuleSource(specifier, ctx) {
    this.chargeForModuleResolution(ctx, specifier);
    if (specifier.startsWith("blue:")) {
      const blueId = specifier.slice(5);
      const fetchFn = ctx.loadBlueContent;
      if (typeof fetchFn !== "function") {
        throw new Error(
          `ProcessingContext is missing a loadBlueContent(blueId) implementation (needed for ${specifier})`
        );
      }
      return await fetchFn(blueId);
    }
    if (/^https?:\/\//.test(specifier)) {
      if (typeof ctx.loadExternalModule !== "function") {
        throw new Error(
          `ProcessingContext is missing a loadExternalModule(url) implementation (needed for ${specifier})`
        );
      }
      return await ctx.loadExternalModule(specifier);
    }
    throw new Error(`Unsupported module specifier "${specifier}"`);
  }
  static deepClone(value) {
    if (typeof value === "undefined") {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }
  static chargeForEvaluation(ctx, code, bindings) {
    const gasMeter = ctx.getGasMeter?.();
    if (!gasMeter) return;
    const bindingCount = Object.keys(bindings).length;
    const cost = BASE_EXPRESSION_GAS_COST + code.length * GAS_PER_CHAR_COST + bindingCount * GAS_PER_BINDING_COST;
    gasMeter.consume(cost, "expression");
  }
  static chargeForModuleResolution(ctx, specifier) {
    const gasMeter = ctx.getGasMeter?.();
    if (!gasMeter) return;
    const cost = MODULE_RESOLUTION_GAS_COST + specifier.length * GAS_PER_CHAR_COST;
    gasMeter.consume(cost, `module:${specifier}`);
  }
};

// libs/document-processor/src/processors/SequentialWorkflowProcessor/utils/BindingsFactory.ts
var BindingsFactory = class {
  /**
   * Creates standard bindings for workflow step execution
   */
  static createStandardBindings(ctx, event, stepResults) {
    const blue2 = ctx.getBlue();
    const eventJson = blue2.nodeToJson(event.payload, "simple");
    const eventParsed = isBigNumber(eventJson) ? eventJson.toNumber() : eventJson;
    return {
      document: (path) => {
        const value = ctx.get(path);
        if (isBigNumber(value)) {
          return value.toNumber();
        }
        if (isDocumentNode(value)) {
          return blue2.nodeToJson(value, "original");
        }
        return value;
      },
      event: eventParsed,
      steps: stepResults
    };
  }
};

// libs/document-processor/src/utils/expressionUtils.ts
var EXPRESSION_REGEX = /^\$\{([\s\S]*)\}$/;
var EMBEDDED_EXPRESSION_REGEX = /\$\{([\s\S]*?)\}/;
var isExpression = (value) => {
  if (typeof value !== "string") {
    return false;
  }
  return EXPRESSION_REGEX.test(value);
};
var containsExpression = (value) => {
  if (typeof value !== "string") {
    return false;
  }
  return EMBEDDED_EXPRESSION_REGEX.test(value);
};
var extractExpressionContent = (expression) => {
  if (!isExpression(expression)) {
    throw new Error(`Invalid expression: ${expression}`);
  }
  return expression.slice(2, -1);
};

// libs/document-processor/src/processors/SequentialWorkflowProcessor/utils/ExpressionResolver.ts
var ExpressionResolver = class {
  static createBindings(ctx, event, stepResults) {
    return BindingsFactory.createStandardBindings(ctx, event, stepResults);
  }
  static async evaluate(input, ctx, bindings, options3) {
    const { coerceToString } = options3;
    if (isExpression(input)) {
      const expr = extractExpressionContent(input);
      const evaluated = await ExpressionEvaluator.evaluate({
        code: expr,
        ctx,
        bindings
      });
      return coerceToString ? String(evaluated ?? "") : evaluated;
    }
    if (containsExpression(input)) {
      const escaped = String(input).replace(/`/g, "\\`");
      const code = `\`${escaped}\``;
      const evaluated = await ExpressionEvaluator.evaluate({
        code,
        ctx,
        bindings
      });
      return String(evaluated ?? "");
    }
    return coerceToString ? String(input) : input;
  }
};

// libs/document-processor/src/utils/eventFactories.ts
function createDocumentUpdateEvent(options3, blue2) {
  const { op, path, val, from } = options3;
  if ((op === "move" || op === "copy") && !from) {
    throw new Error(`${op} operation requires 'from' path`);
  }
  if ((op === "add" || op === "replace") && val === void 0) {
    throw new Error(`${op} operation requires 'val' property`);
  }
  const payload = {
    type: "Document Update",
    op,
    path
  };
  if (val !== void 0) payload.val = val;
  if (from !== void 0) payload.from = from;
  return blue2.jsonValueToNode(payload);
}
function createDocumentProcessingInitiatedEvent(blue2) {
  return blue2.jsonValueToNode({
    type: "Document Processing Initiated"
  });
}

// libs/document-processor/src/processors/SequentialWorkflowProcessor/steps/UpdateDocumentExecutor.ts
var UpdateDocumentExecutor = class {
  constructor() {
    __publicField(this, "stepType", "Update Document");
  }
  supports(node) {
    return BlueNodeTypeSchema.isTypeOf(node, U);
  }
  async execute(step2, event, ctx, documentPath, stepResults) {
    const blue2 = ctx.getBlue();
    if (!BlueNodeTypeSchema.isTypeOf(step2, U)) return;
    const changesetNodeValue = await this.evaluateChangeset(
      step2.get("/changeset"),
      ctx,
      event,
      stepResults
    );
    const newStep = applyBlueNodePatch(step2, {
      op: "replace",
      path: "/changeset",
      val: changesetNodeValue
    });
    const updateDocumentStep = ctx.getBlue().nodeToSchemaOutput(newStep, U);
    for (const change of updateDocumentStep.changeset ?? []) {
      if (!change.path) continue;
      const evaluatedPath = await this.evaluateChangePath(
        change.path,
        ctx,
        event,
        stepResults
      );
      const changeValue = change.val;
      if ((change.op === "replace" || change.op === "add") && g(changeValue)) {
        const changeValueNode = await this.evaluateChangeValue(
          changeValue,
          ctx,
          event,
          stepResults
        );
        ctx.addPatch({
          op: change.op,
          path: evaluatedPath,
          val: changeValueNode
        });
        ctx.emitEvent({
          payload: createDocumentUpdateEvent(
            {
              op: change.op,
              path: ctx.resolvePath(evaluatedPath),
              val: blue2.nodeToJson(changeValueNode, "original")
            },
            blue2
          ),
          emissionType: "update"
        });
      }
      if (change.op === "remove") {
        ctx.addPatch({ op: change.op, path: evaluatedPath });
        ctx.emitEvent({
          payload: createDocumentUpdateEvent(
            {
              op: change.op,
              path: ctx.resolvePath(evaluatedPath),
              val: null
            },
            blue2
          ),
          emissionType: "update"
        });
      }
    }
  }
  async evaluateChangeset(changesetNodeGetResult, ctx, event, stepResults) {
    const blue2 = ctx.getBlue();
    if (isExpression(changesetNodeGetResult)) {
      const expr = extractExpressionContent(changesetNodeGetResult);
      const evaluatedValue = await ExpressionEvaluator.evaluate({
        code: expr,
        ctx,
        bindings: BindingsFactory.createStandardBindings(
          ctx,
          event,
          stepResults
        )
      });
      return blue2.jsonValueToNode(evaluatedValue ?? null);
    }
    if (isDocumentNode(changesetNodeGetResult)) {
      return changesetNodeGetResult;
    }
    throw new Error("Invalid changeset: expected a string or document node");
  }
  async evaluateChangeValue(changeValueNode, ctx, event, stepResults) {
    const evaluatedValueString = changeValueNode.getValue();
    const blue2 = ctx.getBlue();
    if (isExpression(evaluatedValueString) || typeof evaluatedValueString === "string" && containsExpression(evaluatedValueString)) {
      const bindings = ExpressionResolver.createBindings(
        ctx,
        event,
        stepResults
      );
      const evaluated = await ExpressionResolver.evaluate(
        String(evaluatedValueString),
        ctx,
        bindings,
        { coerceToString: !isExpression(evaluatedValueString) }
      );
      return blue2.jsonValueToNode(evaluated ?? null);
    }
    return changeValueNode;
  }
  async evaluateChangePath(path, ctx, event, stepResults) {
    const bindings = ExpressionResolver.createBindings(ctx, event, stepResults);
    if (isExpression(path) || containsExpression(path)) {
      const evaluated = await ExpressionResolver.evaluate(path, ctx, bindings, {
        coerceToString: true
      });
      return String(evaluated ?? "");
    }
    return path;
  }
};

// libs/document-processor/src/processors/SequentialWorkflowProcessor/steps/TriggerEventExecutor.ts
var TriggerEventExecutor = class {
  constructor() {
    __publicField(this, "stepType", "Trigger Event");
  }
  supports(node) {
    return BlueNodeTypeSchema.isTypeOf(node, T);
  }
  async execute(step2, event, ctx) {
    const blue2 = ctx.getBlue();
    if (!BlueNodeTypeSchema.isTypeOf(step2, T)) return;
    const triggerEventStep = blue2.nodeToSchemaOutput(step2, T);
    if (!triggerEventStep.event) return;
    ctx.emitEvent({
      payload: triggerEventStep.event,
      emissionType: "triggered"
    });
    return;
  }
};

// libs/document-processor/src/processors/SequentialWorkflowProcessor/steps/JavaScriptCodeExecutor.ts
var JavaScriptCodeExecutor = class {
  constructor() {
    __publicField(this, "stepType", "JavaScript Code");
  }
  supports(node) {
    return BlueNodeTypeSchema.isTypeOf(node, x);
  }
  async execute(step2, event, ctx, documentPath, stepResults) {
    if (!BlueNodeTypeSchema.isTypeOf(step2, x)) return;
    const blue2 = ctx.getBlue();
    const javaScriptCodeStep = blue2.nodeToSchemaOutput(
      step2,
      x
    );
    if (!javaScriptCodeStep.code) {
      throw new Error("JavaScript code is required");
    }
    const bindings = BindingsFactory.createStandardBindings(
      ctx,
      event,
      stepResults
    );
    const result = await ExpressionEvaluator.evaluate({
      code: javaScriptCodeStep.code,
      ctx,
      bindings,
      options: {
        isCodeBlock: true,
        timeout: 500
      }
    });
    if (result && typeof result === "object" && "events" in result) {
      const resultWithEvents = result;
      if (Array.isArray(resultWithEvents.events)) {
        for (const event2 of resultWithEvents.events) {
          ctx.emitEvent({
            payload: blue2.jsonValueToNode(event2),
            emissionType: "triggered"
          });
        }
      }
    }
    return result;
  }
};

// libs/document-processor/src/processors/SequentialWorkflowProcessor/SequentialWorkflowProcessor.ts
var defaultExecutors = [
  new UpdateDocumentExecutor(),
  new TriggerEventExecutor(),
  new JavaScriptCodeExecutor()
];
var SequentialWorkflowProcessor = class {
  constructor(executors = defaultExecutors) {
    __publicField(this, "contractType", "Sequential Workflow");
    __publicField(this, "contractBlueId", t["Sequential Workflow"]);
    __publicField(this, "role", "handler");
    __publicField(this, "executors", []);
    this.executors = executors;
  }
  /** allow registering custom step executors */
  registerExecutor(ex) {
    this.executors.push(ex);
  }
  supports(event, node, context) {
    const blue2 = context.getBlue();
    const sequentialWorkflow = blue2.nodeToSchemaOutput(
      node,
      l2
    );
    const matchChannelName = this.isChannelNameMatch(event, sequentialWorkflow);
    const matchEventPattern = this.isEventPatternMatch(event, node, context);
    return matchChannelName && matchEventPattern;
  }
  async handle(event, node, context, path) {
    const stepResults = {};
    const stepNodes = node.getProperties()?.["steps"].getItems();
    for (const [i2, step2] of (stepNodes ?? []).entries()) {
      const stepExecutor = this.executors.find((e) => e.supports(step2));
      if (!stepExecutor) {
        throw new Error(`Unsupported workflow step type "${step2.getType()}"`);
      }
      const result = await stepExecutor.execute(
        step2,
        event,
        context,
        path,
        stepResults
      );
      if (result !== void 0) {
        const stepName = step2.getName();
        const key2 = typeof stepName === "string" ? stepName : `Step${i2 + 1}`;
        stepResults[key2] = result;
      }
      await context.flush();
    }
  }
  isChannelNameMatch(event, sequentialWorkflow) {
    const channel = sequentialWorkflow.channel;
    return g(channel) && event.source === "channel" && event.channelName === channel;
  }
  /**
   * Checks if the event matches the channel's event pattern (if specified)
   */
  isEventPatternMatch(event, node, ctx) {
    const channelEvent = node.getProperties()?.["event"];
    if (!channelEvent) {
      return true;
    }
    try {
      const blue2 = ctx.getBlue();
      const eventPayloadNode = blue2.resolve(event.payload);
      return blue2.isTypeOfNode(eventPayloadNode, channelEvent);
    } catch (error) {
      console.warn("Error during event pattern matching:", error);
      return false;
    }
  }
};

// libs/document-processor/src/processors/SequentialWorkflowOperationProcessor.ts
var SequentialWorkflowOperationProcessor = class {
  constructor(sequentialWorkflowProcessor) {
    __publicField(this, "contractType", "Sequential Workflow Operation");
    __publicField(this, "contractBlueId", t["Sequential Workflow Operation"]);
    __publicField(this, "role", "handler");
    __publicField(this, "sequentialWorkflowProcessor");
    this.sequentialWorkflowProcessor = sequentialWorkflowProcessor || new SequentialWorkflowProcessor();
  }
  supports(event, node, ctx) {
    const blue2 = ctx.getBlue();
    const sequentialWorkflowOperation = blue2.nodeToSchemaOutput(
      node,
      W
    );
    const operation = sequentialWorkflowOperation.operation;
    const eventChannelName = event.channelName;
    return event.source === "channel" && g(eventChannelName) && g(operation) && eventChannelName === operation;
  }
  async handle(event, node, context, path) {
    try {
      await this.sequentialWorkflowProcessor.handle(event, node, context, path);
    } catch (error) {
      console.error(
        "Error in SequentialWorkflowOperationProcessor.handle:",
        error
      );
      throw error;
    }
  }
};

// libs/document-processor/src/processors/TimelineChannelProcessor.ts
var isTimelineEntryEvent2 = (evt) => {
  return BlueNodeTypeSchema.isTypeOf(evt.payload, L);
};
var TimelineChannelProcessor = class extends BaseChannelProcessor {
  constructor() {
    super(...arguments);
    __publicField(this, "contractType", "Timeline Channel");
    __publicField(this, "contractBlueId", t["Timeline Channel"]);
  }
  supports(event, node, ctx) {
    if (!this.baseSupports(event)) return false;
    if (!isTimelineEntryEvent2(event)) return false;
    const blue2 = ctx.getBlue();
    const timelineEntry = blue2.nodeToSchemaOutput(
      event.payload,
      L
    );
    const timelineChannel = ctx.getBlue().nodeToSchemaOutput(node, j2);
    const timelineEntryTimelineId = timelineEntry.timeline?.timelineId;
    const hasTimelineId = isNonNullable(timelineChannel.timelineId) && isNonNullable(timelineEntryTimelineId);
    return hasTimelineId && timelineEntryTimelineId === timelineChannel.timelineId;
  }
  handle(event, node, ctx, path) {
    if (!isTimelineEntryEvent2(event)) return;
    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: "channel"
    });
  }
};

// libs/document-processor/src/processors/TriggeredEventChannelProcessor.ts
var TriggeredEventChannelProcessor = class extends BaseChannelProcessor {
  constructor() {
    super(...arguments);
    __publicField(this, "contractType", "Triggered Event Channel");
    __publicField(this, "contractBlueId", t["Triggered Event Channel"]);
  }
  supports(event) {
    if (!this.baseSupports(event)) return false;
    return event.emissionType === "triggered";
  }
  handle(event, _node, ctx, path) {
    ctx.emitEvent({
      payload: event.payload,
      channelName: path,
      source: "channel"
    });
  }
};

// libs/document-processor/src/config.ts
var defaultProcessors = [
  new ProcessEmbeddedProcessor(),
  // channels
  new EmbeddedNodeChannelProcessor(),
  new DocumentUpdateChannelProcessor(),
  new TimelineChannelProcessor(),
  new MyOSTimelineChannelProcessor(),
  new MyOSAgentChannelProcessor(),
  new CompositeTimelineChannelProcessor(),
  new LifecycleEventChannelProcessor(),
  new TriggeredEventChannelProcessor(),
  new OperationProcessor(),
  // sequential workflows
  new SequentialWorkflowProcessor(),
  new SequentialWorkflowOperationProcessor(),
  // markers
  new InitializedMarkerProcessor()
];

// libs/document-processor/src/NativeBlueDocumentProcessor.ts
var NativeBlueDocumentProcessor = class {
  /**
   * Creates a new document processor
   *
   * @param processors - Initial list of processors to register
   */
  constructor(blue2, processors = defaultProcessors) {
    this.blue = blue2;
    __publicField(this, "taskCounter", 0);
    __publicField(this, "eventCounter", 0);
    __publicField(this, "registry");
    __publicField(this, "queue");
    __publicField(this, "router");
    __publicField(this, "checkpointCache", new CheckpointCache());
    this.registry = new ContractRegistry(processors);
    this.queue = new TaskQueue();
    this.router = new EventRouter(
      this.blue,
      this.registry,
      this.queue,
      () => ++this.taskCounter,
      () => ++this.eventCounter
    );
    this.register(
      new ChannelEventCheckpointProcessor(this.checkpointCache),
      9999
    );
  }
  /**
   * Registers a new contract processor
   *
   * @param cp - The processor to register
   * @param orderHint - Optional priority value for execution order
   */
  register(cp, orderHint) {
    this.registry.register(cp, orderHint);
  }
  /**
   * Initializes a document by emitting a Document Processing Initiated event
   *
   * @param document - The document to initialize
   * @returns Processing result with final state and emitted events
   */
  async initialize(document, options3 = {}) {
    let current = ensureCheckpointContracts(freeze(document), this.blue);
    const gasMeter = new GasMeter(options3.gasBudget);
    const initEvent = {
      payload: createDocumentProcessingInitiatedEvent(this.blue),
      source: "internal",
      emissionType: "lifecycle"
    };
    const emitted = [initEvent.payload];
    await this.router.route(current, [], initEvent, 0, 0, gasMeter);
    const result = await this.drainQueue(current, gasMeter);
    current = result.state;
    emitted.push(...result.emitted);
    current = ensureInitializedContract(current, this.blue);
    return {
      state: mutable(current),
      emitted,
      gasUsed: gasMeter.getConsumed(),
      gasRemaining: gasMeter.getRemaining()
    };
  }
  /**
   * Processes a batch of events against the document
   *
   * @param document - The document to process events against
   * @param incoming - List of event payloads to process
   * @returns Processing result with final state and emitted events
   */
  async processEvents(document, incoming, options3 = {}) {
    let current = ensureCheckpointContracts(freeze(document), this.blue);
    const emitted = [];
    const gasMeter = new GasMeter(options3.gasBudget);
    if (!isInitialized(current, this.blue)) {
      throw new Error("Document is not initialized");
    }
    for (const payload of incoming) {
      try {
        const externalEvent = { payload, source: "external" };
        await this.router.route(current, [], externalEvent, 0, 0, gasMeter);
        const result = await this.drainQueue(current, gasMeter);
        current = result.state;
        emitted.push(...result.emitted);
        const checkpointPatches = this.checkpointCache.flush(current);
        if (checkpointPatches.length) {
          current = applyPatches(current, checkpointPatches);
        }
      } finally {
        this.checkpointCache.clear();
      }
    }
    return {
      state: mutable(current),
      emitted,
      gasUsed: gasMeter.getConsumed(),
      gasRemaining: gasMeter.getRemaining()
    };
  }
  /**
   * Drains the task queue and applies all actions
   */
  async drainQueue(document, gasMeter) {
    let current = document;
    const emitted = [];
    const MAX_STEPS = 1e4;
    let steps = 0;
    while (this.queue.length) {
      if (++steps > MAX_STEPS) {
        throw new Error("Possible cycle \u2013 too many iterations");
      }
      const task = this.queue.pop();
      const { nodePath, contractName, contractNode, event } = task;
      const node = current.get(nodePath);
      if (!isDocumentNode(node) || !node.getContracts()?.[contractName]) continue;
      if (!contractNode.getType()) continue;
      const cp = this.registry.get(contractNode.getType());
      if (!cp) {
        console.warn(`No processor registered for contract: ${contractName}`);
        continue;
      }
      const ctx = new InternalContext(
        () => current,
        task,
        this.blue,
        async (actions) => {
          for (const act of actions) {
            if (act.kind === "patch") {
              const embeddedPaths = collectEmbeddedPathSpecs(
                current,
                this.blue
              );
              for (const embeddedPath of embeddedPaths) {
                const touchedPaths = act.patch.op === "move" || act.patch.op === "copy" ? [act.patch.from, act.patch.path] : [act.patch.path];
                const writerNodePath = ctx.getNodePath();
                const isEmbeddedTouching = touchedPaths.some(
                  (touchedPath) => isInside(touchedPath, embeddedPath.absPath)
                );
                const isWriterInside = isInside(
                  writerNodePath,
                  embeddedPath.absPath
                );
                const crossesBoundary = isEmbeddedTouching && !isWriterInside;
                if (crossesBoundary) {
                  throw new EmbeddedDocumentModificationError(
                    act.patch,
                    embeddedPath.absPath,
                    writerNodePath
                  );
                }
              }
              try {
                gasMeter?.consume(
                  GAS_COST_PATCH_APPLICATION,
                  `patch:${act.patch.op}`
                );
                current = applyPatches(current, [act.patch]);
              } catch (err) {
                logPatchError(contractName, event, err);
                throw err;
              }
            } else if (act.kind === "event") {
              emitted.push(act.event.payload);
              gasMeter?.consume(
                GAS_COST_EMITTED_EVENT,
                `event:${contractName}`
              );
              await this.router.route(
                current,
                [],
                act.event,
                task.key[5],
                0,
                gasMeter
              );
            }
          }
        },
        gasMeter
      );
      gasMeter?.consume(
        GAS_COST_HANDLER_INVOCATION,
        `handler:${contractName}`
      );
      await cp.handle(event, contractNode, ctx, contractName);
      await ctx.flush();
    }
    return {
      state: current,
      emitted,
      gasUsed: gasMeter?.getConsumed(),
      gasRemaining: gasMeter?.getRemaining()
    };
  }
};

// libs/document-processor/src/quickjs/entry.ts
function coerceArray(value) {
  if (!Array.isArray(value)) return void 0;
  return value;
}
var host = globalThis.__BLUE_HOST__;
var envBag = globalThis.__BLUE_ENV__ ?? {};
envBag.SKIP_QUICKJS = "true";
envBag.SKIP_QUICKJS_WASM = "true";
envBag.SKIP_ISOLATED_VM = "true";
globalThis.__BLUE_ENV__ = envBag;
var repositories = coerceArray(globalThis.__BLUE_REPOSITORIES__) ?? [
  Ae,
  oe2
];
var blue = new Blue({ repositories });
var processor = new NativeBlueDocumentProcessor(blue, defaultProcessors);
function serializeState(state) {
  return blue.nodeToJson(state, "original");
}
function serializeEmitted(emitted) {
  if (!emitted) return [];
  return emitted.map((evt) => blue.nodeToJson(evt, "original"));
}
function deserializeDocument(json2) {
  return blue.jsonValueToNode(json2);
}
function deserializeEvents(json2) {
  if (!json2) return [];
  return json2.map((evt) => blue.jsonValueToNode(evt));
}
async function safeCall(label, fn) {
  try {
    return await fn();
  } catch (error) {
    host?.log?.("error", `${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
async function initialize(documentJson, options3 = {}) {
  return safeCall("initialize", async () => {
    const document = deserializeDocument(documentJson);
    const result = await processor.initialize(document, options3);
    return {
      state: serializeState(result.state),
      emitted: serializeEmitted(result.emitted),
      gasUsed: result.gasUsed,
      gasRemaining: result.gasRemaining
    };
  });
}
async function processEvents(documentJson, eventsJson, options3 = {}) {
  return safeCall("processEvents", async () => {
    const document = deserializeDocument(documentJson);
    const events = deserializeEvents(eventsJson);
    const result = await processor.processEvents(document, events, options3);
    return {
      state: serializeState(result.state),
      emitted: serializeEmitted(result.emitted),
      gasUsed: result.gasUsed,
      gasRemaining: result.gasRemaining
    };
  });
}
var quickJsEntry = {
  initialize,
  processEvents
};
globalThis.__BLUE_ENTRY__ = quickJsEntry;
