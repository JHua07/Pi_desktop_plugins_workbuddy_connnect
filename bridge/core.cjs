// Bundled from corrinehu/dsh-workbuddy-connect (MIT), commit fa570627016f56adfd2f91ccd706356b9157f2a7. See vendor/dsh-workbuddy-connect/LICENSE and THIRD_PARTY_NOTICES.md.
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// bridge/home.cjs
var require_home = __commonJS({
  "bridge/home.cjs"(exports2, module2) {
    "use strict";
    var { homedir: homedir4 } = require("node:os");
    var { resolve: resolve2, join: join6 } = require("node:path");
    function resolveDshHome5() {
      return process.env.PI_WORKBUDDY_HOME ? resolve2(process.env.PI_WORKBUDDY_HOME) : join6(homedir4(), ".pi-workbuddy-connect");
    }
    module2.exports = { resolveDshHome: resolveDshHome5 };
  }
});

// bridge/core-entry.ts
var core_entry_exports = {};
__export(core_entry_exports, {
  FALLBACK_WORKBUDDY_AI_MODELS: () => FALLBACK_WORKBUDDY_AI_MODELS,
  FALLBACK_WORKBUDDY_MODELS: () => FALLBACK_WORKBUDDY_MODELS,
  WORKBUDDY_VARIANTS: () => WORKBUDDY_VARIANTS,
  WorkBuddyCatalog: () => WorkBuddyCatalog,
  WorkBuddyCatalogStore: () => WorkBuddyCatalogStore,
  WorkBuddyCredentialStore: () => WorkBuddyCredentialStore,
  WorkBuddyUpstreamClient: () => WorkBuddyUpstreamClient,
  atRestKeyProviderFor: () => atRestKeyProviderFor,
  extractDisplayErrorMessage: () => extractDisplayErrorMessage,
  hostIsLoopback: () => hostIsLoopback,
  originIsLoopback: () => originIsLoopback,
  parseWorkBuddyAuth: () => parseWorkBuddyAuth,
  prepareChatBody: () => prepareChatBody
});
module.exports = __toCommonJS(core_entry_exports);

// vendor/dsh-workbuddy-connect/auth.ts
var import_promises4 = require("node:fs/promises");
var import_node_os3 = require("node:os");
var import_node_path5 = require("node:path");

// node_modules/@deepseek-ai/dsh-atomic-write/lib/index.js
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var WINDOWS_TRANSIENT_RENAME_ERRORS = /* @__PURE__ */ new Set([
  "EACCES",
  "EBUSY",
  "EPERM"
]);
var WINDOWS_RENAME_RETRY_INITIAL_MS = 20;
var WINDOWS_RENAME_RETRY_MAX_MS = 200;
var WINDOWS_RENAME_RETRY_LIMIT = 8;
function isTransientWindowsRenameError(error) {
  if (process.platform !== "win32") return false;
  return WINDOWS_TRANSIENT_RENAME_ERRORS.has(error?.code ?? "");
}
async function renameAtomicTemp(temp, filename) {
  let delay = WINDOWS_RENAME_RETRY_INITIAL_MS;
  for (let retries = 0; ; retries += 1) {
    try {
      await (0, import_promises.rename)(temp, filename);
      return;
    } catch (error) {
      if (!isTransientWindowsRenameError(error)) throw error;
      if (retries >= WINDOWS_RENAME_RETRY_LIMIT) throw error;
    }
    await new Promise((resolve2) => setTimeout(resolve2, delay));
    delay = Math.min(delay * 2, WINDOWS_RENAME_RETRY_MAX_MS);
  }
}
async function writeFileAtomic(filename, content, options) {
  await (0, import_promises.mkdir)((0, import_node_path.dirname)(filename), {
    recursive: true,
    ...options.dirMode === void 0 ? {} : { mode: options.dirMode }
  });
  const temp = `${filename}.${(0, import_node_crypto.randomBytes)(6).toString("hex")}.tmp`;
  try {
    await (0, import_promises.writeFile)(temp, content, {
      mode: options.mode,
      flag: "wx"
    });
    await renameAtomicTemp(temp, filename);
  } catch (error) {
    await (0, import_promises.rm)(temp, { force: true });
    throw error;
  }
}
async function isLockContention(error, lockPath) {
  const code = error?.code;
  if (code === "EEXIST") return true;
  if (code !== "EPERM") return false;
  try {
    await (0, import_promises.lstat)(lockPath);
    return true;
  } catch {
    return false;
  }
}
function holderExited(record) {
  if (!/^\d+\n$/.test(record)) return false;
  const pid = Number(record.trim());
  if (pid === 0 || pid > 2147483647) return false;
  if (pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === "ESRCH";
  }
}
async function readLockRecord(lockPath) {
  try {
    return await (0, import_promises.readFile)(lockPath, "utf8");
  } catch (error) {
    return;
  }
}
async function takeOverExitedLock(lockPath) {
  const record = await readLockRecord(lockPath);
  if (record === void 0 || !holderExited(record)) return false;
  const claim = `${lockPath}.takeover-${(0, import_node_crypto.createHash)("sha256").update(record).digest("hex").slice(0, 16)}`;
  try {
    await (0, import_promises.writeFile)(claim, `${process.pid}
`, {
      mode: 384,
      flag: "wx"
    });
  } catch (error) {
    const code = error.code;
    if (code === "EEXIST" || code === "EPERM") return false;
    throw error;
  }
  try {
    if (await readLockRecord(lockPath) !== record || !holderExited(record)) return false;
    try {
      await (0, import_promises.rm)(lockPath, { force: true });
    } catch (error) {
      return false;
    }
    return true;
  } finally {
    await (0, import_promises.rm)(claim, { force: true }).catch((error) => {
    });
  }
}
var LOCK_RETRY_INITIAL_MS = 20;
var LOCK_RETRY_MAX_MS = 200;
var DEFAULT_LOCK_WAIT_MS = 2e3;
async function withFileLock(filename, operation, options) {
  const lockPath = `${filename}.lock`;
  const deadline = Date.now() + (options?.waitMs ?? DEFAULT_LOCK_WAIT_MS);
  let delay = LOCK_RETRY_INITIAL_MS;
  let retriedUnconfirmedPermissionError = false;
  for (; ; ) {
    try {
      await (0, import_promises.writeFile)(lockPath, `${process.pid}
`, {
        mode: 384,
        flag: "wx"
      });
      break;
    } catch (error) {
      if (!await isLockContention(error, lockPath)) {
        if (process.platform !== "win32" || error?.code !== "EPERM" || retriedUnconfirmedPermissionError) throw error;
        retriedUnconfirmedPermissionError = true;
      } else if (await takeOverExitedLock(lockPath)) continue;
    }
    if (Date.now() >= deadline) throw new Error(`atomic-write: timed out waiting for the writer lock at ${lockPath}`);
    await new Promise((resolve2) => setTimeout(resolve2, delay));
    delay = Math.min(delay * 2, LOCK_RETRY_MAX_MS);
  }
  try {
    return await operation();
  } finally {
    await (0, import_promises.rm)(lockPath, { force: true });
  }
}

// vendor/dsh-workbuddy-connect/auth.ts
var import_dsh_home_paths3 = __toESM(require_home());

// vendor/dsh-workbuddy-connect/app-version.ts
var import_promises2 = require("node:fs/promises");
var import_node_os = require("node:os");
var import_node_path2 = require("node:path");
var import_dsh_home_paths = __toESM(require_home());
var FALLBACK_APP_VERSION = "5.5.2";
var WORKBUDDY_APP_VERSION_FILENAME = ".workbuddy-ai-version.json";
function validAppVersion(value) {
  return typeof value === "string" && /^\d{1,6}(?:\.\d{1,6}){1,3}$/u.test(value);
}
function macAppRoots() {
  return ["/Applications", (0, import_node_path2.join)((0, import_node_os.homedir)(), "Applications")];
}
async function readBundleVersion(plistPath) {
  let text;
  try {
    text = await (0, import_promises2.readFile)(plistPath, "utf8");
  } catch {
    return void 0;
  }
  const match = /<key>\s*CFBundleShortVersionString\s*<\/key>\s*<string>([^<]*)<\/string>/u.exec(text);
  const version = match?.[1]?.trim();
  return validAppVersion(version) ? version : void 0;
}
async function installedAppVersion() {
  if (process.platform !== "darwin") return void 0;
  for (const root of macAppRoots()) {
    const bundle = (0, import_node_path2.join)(root, "WorkBuddy AI.app");
    const version = await readBundleVersion((0, import_node_path2.join)(bundle, "Contents", "Info.plist"));
    if (version !== void 0) return { version, bundle };
  }
  return void 0;
}
function appVersionPath() {
  return (0, import_node_path2.join)((0, import_dsh_home_paths.resolveDshHome)(), WORKBUDDY_APP_VERSION_FILENAME);
}
async function resolveAppVersion(options = {}) {
  const path = options.path ?? appVersionPath();
  const installed = await (options.installed ?? installedAppVersion)();
  if (installed !== void 0 && validAppVersion(installed.version)) {
    try {
      await writeFileAtomic(
        path,
        `${JSON.stringify({ version: installed.version, bundle: installed.bundle, observedAt: Date.now() }, null, 2)}
`,
        { mode: 384, dirMode: 448 }
      );
    } catch {
    }
    return { version: installed.version, source: "installed", bundle: installed.bundle };
  }
  try {
    const saved = JSON.parse(await (0, import_promises2.readFile)(path, "utf8"));
    if (typeof saved === "object" && saved !== null) {
      const version = saved["version"];
      if (validAppVersion(version)) return { version, source: "saved" };
    }
  } catch {
  }
  return { version: FALLBACK_APP_VERSION, source: "fallback" };
}
function appUserAgent(version) {
  if (!validAppVersion(version)) throw new Error(`invalid WorkBuddy AI version for User-Agent: ${JSON.stringify(version)}`);
  return `WorkBuddyAI/${version}`;
}

// vendor/dsh-workbuddy-connect/client-identity.ts
var import_promises3 = require("node:fs/promises");
var import_node_os2 = require("node:os");
var import_node_path3 = require("node:path");
var import_dsh_home_paths2 = __toESM(require_home());
var FALLBACK_CN_APP_VERSION = "5.5.6";
var CN_APP_VERSION_FILENAME = ".workbuddy-app-version.json";
function validCliVersion(value) {
  return typeof value === "string" && /^\d{1,6}(?:\.\d{1,6}){1,3}(?:-[0-9A-Za-z.]+)?$/u.test(value);
}
function macAppRoots2() {
  return ["/Applications", (0, import_node_path3.join)((0, import_node_os2.homedir)(), "Applications")];
}
function cliPackagePath(bundle) {
  return (0, import_node_path3.join)(bundle, "Contents", "Resources", "app.asar.unpacked", "cli", "package.json");
}
async function readCliVersion(bundle) {
  let document;
  try {
    document = JSON.parse(await (0, import_promises3.readFile)(cliPackagePath(bundle), "utf8"));
  } catch {
    return void 0;
  }
  if (typeof document !== "object" || document === null || Array.isArray(document)) return void 0;
  const pkg = document;
  const declared = pkg["version"];
  if (validCliVersion(declared) && declared !== "0.0.0") return declared;
  const publishConfig = pkg["publishConfig"];
  const customPackage = typeof publishConfig === "object" && publishConfig !== null && !Array.isArray(publishConfig) ? publishConfig : void 0;
  const custom = typeof customPackage?.["customPackage"] === "object" && customPackage["customPackage"] !== null && !Array.isArray(customPackage["customPackage"]) ? customPackage["customPackage"] : void 0;
  const customVersion = custom?.["version"];
  return validCliVersion(customVersion) ? customVersion : void 0;
}
function chatUserAgent(identity, region) {
  if (!validAppVersion(identity.clientVersion)) {
    throw new Error(`invalid client version for chat User-Agent: ${JSON.stringify(identity.clientVersion)}`);
  }
  if (identity.cliVersion !== void 0 && !validCliVersion(identity.cliVersion)) {
    throw new Error(`invalid CLI version for chat User-Agent: ${JSON.stringify(identity.cliVersion)}`);
  }
  const product = region === "global" ? "WorkBuddy AI" : "WorkBuddy";
  const parts = [`WorkBuddy/${identity.clientVersion}`, `${product}/${identity.clientVersion}`];
  if (identity.cliVersion !== void 0) parts.push(`CLI/${identity.cliVersion}`);
  return parts.join(" ");
}
async function installedCnApp() {
  if (process.platform !== "darwin") return void 0;
  for (const root of macAppRoots2()) {
    const bundle = (0, import_node_path3.join)(root, "WorkBuddy.app");
    const version = await readBundleVersion((0, import_node_path3.join)(bundle, "Contents", "Info.plist"));
    if (version !== void 0) return { version, bundle };
  }
  return void 0;
}
function cnSavedVersionPath() {
  return (0, import_node_path3.join)((0, import_dsh_home_paths2.resolveDshHome)(), CN_APP_VERSION_FILENAME);
}
async function resolveChatIdentity(region, options = {}) {
  const injectable = options.installedCn !== void 0 || options.resolveIntl !== void 0 || options.cliVersion !== void 0 || options.cnSavedPath !== void 0;
  if (!injectable) {
    const cached = cache.get(region);
    if (cached !== void 0) return cached;
  }
  let identity;
  try {
    identity = region === "global" ? await resolveGlobalIdentity(options) : await resolveCnIdentity(options);
  } catch {
    return fallbackChatIdentity(region);
  }
  if (!injectable) cache.set(region, identity);
  return identity;
}
var cache = /* @__PURE__ */ new Map();
function fallbackChatIdentity(region) {
  return { clientVersion: region === "global" ? FALLBACK_APP_VERSION : FALLBACK_CN_APP_VERSION };
}
async function resolveCnIdentity(options) {
  const savedPath = options.cnSavedPath ?? cnSavedVersionPath();
  const installed = await (options.installedCn ?? installedCnApp)();
  if (installed !== void 0 && validAppVersion(installed.version)) {
    const cliVersion = await (options.cliVersion ?? readCliVersion)(installed.bundle);
    const identity = {
      clientVersion: installed.version,
      ...cliVersion !== void 0 && validCliVersion(cliVersion) ? { cliVersion } : {}
    };
    try {
      await writeFileAtomic(
        savedPath,
        `${JSON.stringify({ version: identity.clientVersion, observedAt: Date.now() }, null, 2)}
`,
        { mode: 384, dirMode: 448 }
      );
    } catch {
    }
    return identity;
  }
  try {
    const saved = JSON.parse(await (0, import_promises3.readFile)(savedPath, "utf8"));
    if (typeof saved === "object" && saved !== null && !Array.isArray(saved)) {
      const document = saved;
      if (validAppVersion(document["version"])) {
        return { clientVersion: document["version"] };
      }
    }
  } catch {
  }
  return fallbackChatIdentity("cn");
}
async function resolveGlobalIdentity(options) {
  const info = await (options.resolveIntl ?? resolveAppVersion)();
  const clientVersion = validAppVersion(info.version) ? info.version : FALLBACK_APP_VERSION;
  let cliVersion;
  if (info.bundle !== void 0) {
    const read = await (options.cliVersion ?? readCliVersion)(info.bundle);
    if (read !== void 0 && validCliVersion(read)) cliVersion = read;
  }
  return { clientVersion, ...cliVersion === void 0 ? {} : { cliVersion } };
}

// vendor/dsh-workbuddy-connect/probe.ts
var PROBE_PROMPT = "ping";
var PROBE_MAX_TOKENS = 1;

// vendor/dsh-workbuddy-connect/upstream.ts
var CN_CHAT_BASE = "https://copilot.tencent.com";
var CN_BILLING_BASE = "https://www.codebuddy.cn";
var GLOBAL_BASE = "https://www.workbuddy.ai";
var enterprisePackageName = "enterprise";
function describeShape(document) {
  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    return typeof document;
  }
  const record = document;
  const at = (source) => {
    const keys = Object.keys(source).slice(0, 24);
    return keys.length === 0 ? "(empty)" : keys.map((key) => `${key}:${typeof source[key]}`).join(", ");
  };
  const top = `top-level { ${at(record)} }`;
  const data = record["data"];
  if (typeof data !== "object" || data === null || Array.isArray(data)) return top;
  return `${top}; data { ${at(data)} }`;
}
var CLIENT_UA = "CLI/2.63.2 CodeBuddy/2.63.2";
var JSON_TIMEOUT_MS = 3e4;
var ERROR_BODY_LIMIT = 4096;
var HARD_CREDIT_MARKERS = [
  "insufficient credit",
  "no credit",
  "credit exhausted",
  "credits exhausted",
  "out of credit",
  "quota exceeded",
  "quota exhaust",
  "payment required",
  "credit not enough",
  "not enough credit",
  "\u79EF\u5206\u4E0D\u8DB3",
  "\u989D\u5EA6\u4E0D\u8DB3",
  "\u4F59\u989D\u4E0D\u8DB3",
  "\u79EF\u5206\u7528\u5B8C",
  "\u989D\u5EA6\u7528\u5C3D",
  "\u6CA1\u6709\u79EF\u5206"
];
var EFFORT_VALUES = ["low", "medium", "high", "xhigh", "max"];
var BADGE_PREFIX = "badge:";
function resolveUpstreamReasoning(wrapped) {
  const supports = wrapped["supportsReasoning"] === true;
  const onlyReasoning = wrapped["onlyReasoning"] === true;
  const rawReasoning = wrapped["reasoning"];
  let supportedEfforts;
  let defaultEffort;
  let canDisableThinking = true;
  if (typeof rawReasoning === "object" && rawReasoning !== null && !Array.isArray(rawReasoning)) {
    const reasoning = rawReasoning;
    const rawEfforts = reasoning["supportedEfforts"];
    if (Array.isArray(rawEfforts)) {
      const efforts = rawEfforts.filter((value) => typeof value === "string" && EFFORT_VALUES.includes(value));
      if (efforts.length > 0) supportedEfforts = efforts;
    }
    if (typeof reasoning["defaultEffort"] === "string" && EFFORT_VALUES.includes(reasoning["defaultEffort"])) {
      defaultEffort = reasoning["defaultEffort"];
    } else if (typeof reasoning["effort"] === "string" && EFFORT_VALUES.includes(reasoning["effort"])) {
      defaultEffort = reasoning["effort"];
    }
    canDisableThinking = reasoning["canDisableThinking"] === true;
  }
  return {
    reasoning: {
      supports,
      onlyReasoning,
      ...supportedEfforts === void 0 ? {} : { supportedEfforts },
      ...defaultEffort === void 0 ? {} : { defaultEffort },
      canDisableThinking
    }
  };
}
function normalizeCredits(credits) {
  if (credits === void 0) return void 0;
  const trimmed = credits.trim();
  if (trimmed === "") return void 0;
  if (/^credits?$/iu.test(trimmed)) return void 0;
  const bare = trimmed.replace(/\s+credits?$/iu, "").trim();
  return bare === "" ? void 0 : bare;
}
function resolveUpstreamBilling(wrapped, extraTags) {
  const rawCredits = wrapped["credits"];
  const credits = typeof rawCredits === "string" && rawCredits.trim() !== "" ? rawCredits.trim() : void 0;
  const badges = [];
  const rawTags = [...Array.isArray(wrapped["tags"]) ? wrapped["tags"] : [], ...extraTags ?? []];
  for (const tag of rawTags) {
    if (typeof tag !== "string") continue;
    const lowered = tag.toLowerCase();
    if (!lowered.startsWith(BADGE_PREFIX)) continue;
    const label = tag.slice(BADGE_PREFIX.length).split(":")[0] ?? tag.slice(BADGE_PREFIX.length);
    if (label !== "" && !badges.includes(label)) badges.push(label);
  }
  const multiplier = normalizeCredits(credits);
  const free = multiplier !== void 0 && /^x?0\.0+$/u.test(multiplier);
  return {
    billing: {
      ...credits === void 0 ? {} : { credits },
      ...badges.length === 0 ? {} : { badges },
      free
    }
  };
}
var SESSION_DEAD_MARKERS = ["Offline user session not found", "12153"];
function classifyUpstreamError(status, body) {
  if (status === 402) return "hard_credit";
  if (status === 401) return "session_dead";
  const lower = body.toLowerCase();
  for (const marker of HARD_CREDIT_MARKERS) {
    if (lower.includes(marker.toLowerCase()) || body.includes(marker)) return "hard_credit";
  }
  for (const marker of SESSION_DEAD_MARKERS) {
    if (body.includes(marker)) return "session_dead";
  }
  if (status === 429) return "soft_rate";
  if (status === 404) return "not_found";
  if (status >= 500) return "server";
  if (status >= 400) return "client";
  return "client";
}
function extractDisplayErrorMessage(body) {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) return void 0;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
    const obj = parsed;
    const displayMsg = obj["displayMsg"];
    if (typeof displayMsg === "object" && displayMsg !== null && !Array.isArray(displayMsg)) {
      const localized = displayMsg;
      if (typeof localized["zh"] === "string" && localized["zh"].trim() !== "") {
        return localized["zh"].trim();
      }
      if (typeof localized["en"] === "string" && localized["en"].trim() !== "") {
        return localized["en"].trim();
      }
    }
    if (typeof obj["msg"] === "string" && obj["msg"].trim() !== "") {
      return obj["msg"].trim();
    }
  } catch {
  }
  return void 0;
}
function regionOf(domain) {
  const lowered = domain.trim().toLowerCase();
  if (lowered === "workbuddy.ai" || lowered.endsWith(".workbuddy.ai")) return "global";
  return "cn";
}
function chatBase(credential) {
  return regionOf(credential.domain) === "global" ? GLOBAL_BASE : CN_CHAT_BASE;
}
function billingBase(credential) {
  return regionOf(credential.domain) === "global" ? GLOBAL_BASE : CN_BILLING_BASE;
}
function originReferer(credential) {
  return regionOf(credential.domain) === "global" ? GLOBAL_BASE : CN_BILLING_BASE;
}
function commonHeaders(credential) {
  return {
    "Accept": "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
    "Origin": originReferer(credential),
    "Referer": `${originReferer(credential)}/`,
    "User-Agent": CLIENT_UA
  };
}
function chatHeaders(credential, userAgent, clientVersion) {
  const headers = {
    ...commonHeaders(credential),
    "User-Agent": userAgent,
    "Content-Type": "application/json",
    // 安全红线：chat 请求绝不携带 refresh token。
    ...credential.uid === "" ? { "X-No-User-Id": "1" } : { "X-User-Id": credential.uid },
    ...credential.enterpriseId === void 0 || credential.enterpriseId === "" ? { "X-No-Enterprise-Id": "1" } : { "X-Enterprise-Id": credential.enterpriseId },
    ...credential.domain === "" ? { "X-No-Department-Info": "1" } : { "X-Domain": credential.domain },
    "X-IDE-Type": "WorkBuddy",
    "X-IDE-Name": "WorkBuddy",
    "X-IDE-Version": clientVersion,
    "X-Product": "SaaS"
  };
  return headers;
}
function refreshHeaders(credential) {
  const headers = {
    ...commonHeaders(credential),
    "X-Refresh-Token": credential.refreshToken,
    "X-Auth-Refresh-Source": "workbuddy"
  };
  if (credential.enterpriseId !== void 0 && credential.enterpriseId !== "") {
    headers["X-Enterprise-Id"] = credential.enterpriseId;
  }
  return headers;
}
function billingHeaders(credential) {
  const headers = {
    "Authorization": `Bearer ${credential.accessToken}`,
    "Accept": "application/json",
    "Content-Type": "application/json"
  };
  if (credential.uid !== "") headers["X-User-Id"] = credential.uid;
  if (credential.enterpriseId !== void 0 && credential.enterpriseId !== "") {
    headers["X-Enterprise-Id"] = credential.enterpriseId;
    headers["X-Tenant-Id"] = credential.enterpriseId;
  }
  if (credential.domain !== "") headers["X-Domain"] = credential.domain;
  return headers;
}
function prepareChatBody(source) {
  let body;
  try {
    body = JSON.parse(source);
  } catch {
    return source;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return source;
  const obj = body;
  obj["stream"] = true;
  normalizeDeveloperRole(obj);
  normalizeToolChoice(obj);
  return JSON.stringify(obj);
}
function normalizeDeveloperRole(obj) {
  const messages = obj["messages"];
  if (!Array.isArray(messages)) return;
  for (const message of messages) {
    if (typeof message !== "object" || message === null || Array.isArray(message)) continue;
    const wrapped = message;
    if (wrapped["role"] === "developer") wrapped["role"] = "system";
  }
}
function normalizeToolChoice(obj) {
  const suppress = () => {
    delete obj["tools"];
    delete obj["functions"];
  };
  const present = "tool_choice" in obj;
  if (!present) return;
  const choice = obj["tool_choice"];
  if (typeof choice === "string") {
    if (choice.trim().toLowerCase() === "none") {
      delete obj["tool_choice"];
      suppress();
    }
    return;
  }
  if (typeof choice === "object" && choice !== null && !Array.isArray(choice)) {
    const wrapped = choice;
    const type = typeof wrapped["type"] === "string" ? wrapped["type"].trim().toLowerCase() : "";
    if (type === "none") {
      delete obj["tool_choice"];
      suppress();
    } else if (type === "auto" || type === "required") {
      obj["tool_choice"] = type;
    } else if (type === "function") {
      const fn = typeof wrapped["function"] === "object" && wrapped["function"] !== null ? wrapped["function"] : void 0;
      let name = typeof fn?.["name"] === "string" ? fn["name"] : "";
      if (name === "" && typeof wrapped["name"] === "string") name = wrapped["name"];
      name = name.trim();
      obj["tool_choice"] = name !== "" ? name : "auto";
    } else {
      delete obj["tool_choice"];
    }
    return;
  }
  delete obj["tool_choice"];
}
async function readEnvelope(response) {
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`workbuddy upstream returned non-JSON (http ${response.status}): ${text.slice(0, 160)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`workbuddy upstream returned an unexpected document (http ${response.status})`);
  }
  const document = parsed;
  const envelope = {
    code: typeof document["code"] === "number" ? document["code"] : 0,
    msg: typeof document["msg"] === "string" ? document["msg"] : "",
    data: "data" in document ? document["data"] : void 0,
    document
  };
  return envelope;
}
function envelopeError(status, envelope) {
  const kind = classifyUpstreamError(status, envelope.msg);
  return new Error(`workbuddy upstream ${kind} (http ${status}): ${envelope.msg.slice(0, 160)}`);
}
var WorkBuddyUpstreamClient = class {
  /**
   * Resolves the App-shaped UA version for international catalog requests.
   * Injectable so tests never read the real filesystem.
   */
  resolveAppVersion;
  /** Chat-identity resolver; see {@link WorkBuddyUpstreamClientOptions.resolveChatIdentity}. */
  resolveChatIdentity;
  /** Provenance of the most recent successful catalog fetch, for the card. */
  lastCatalog;
  constructor(options = {}) {
    this.resolveAppVersion = options.resolveAppVersion ?? (() => resolveAppVersion());
    this.resolveChatIdentity = options.resolveChatIdentity ?? ((region) => resolveChatIdentity(region));
  }
  /** POST the chat endpoint; a successful answer is the raw SSE response. */
  async chatStream(credential, bodyJson, signal) {
    const region = regionOf(credential.domain);
    let identity;
    let userAgent;
    try {
      identity = await this.resolveChatIdentity(region);
      userAgent = chatUserAgent(identity, region);
    } catch {
      identity = fallbackChatIdentity(region);
      userAgent = chatUserAgent(identity, region);
    }
    let response;
    try {
      response = await fetch(`${chatBase(credential)}/v2/chat/completions`, {
        method: "POST",
        headers: { ...chatHeaders(credential, userAgent, identity.clientVersion), "Authorization": `Bearer ${credential.accessToken}` },
        body: region === "global" ? prepareInternationalChatBody(bodyJson) : bodyJson,
        ...signal === void 0 ? {} : { signal }
      });
    } catch (error) {
      return { ok: false, status: 0, kind: "server", message: `transport error: ${String(error)}` };
    }
    if (response.ok) return { ok: true, response };
    const text = (await response.text()).slice(0, ERROR_BODY_LIMIT);
    return {
      ok: false,
      status: response.status,
      kind: classifyUpstreamError(response.status, text),
      message: text
    };
  }
  /** POST the token-refresh endpoint; the caller merges the outcome. */
  async refreshToken(credential) {
    const response = await fetch(`${chatBase(credential)}/v2/plugin/auth/token/refresh`, {
      method: "POST",
      headers: refreshHeaders(credential),
      signal: AbortSignal.timeout(JSON_TIMEOUT_MS)
    });
    const envelope = await readEnvelope(response);
    if (!response.ok || envelope.code !== 0) throw envelopeError(response.status, envelope);
    const data = typeof envelope.data === "object" && envelope.data !== null ? envelope.data : {};
    const accessToken = typeof data["accessToken"] === "string" ? data["accessToken"] : "";
    if (accessToken === "") throw new Error("workbuddy token refresh returned no accessToken; sign in again in the WorkBuddy app");
    const outcome = { accessToken };
    if (typeof data["refreshToken"] === "string" && data["refreshToken"] !== "") outcome.refreshToken = data["refreshToken"];
    if (typeof data["expiresIn"] === "number" && data["expiresIn"] > 0) outcome.expiresInSec = data["expiresIn"];
    if (typeof data["domain"] === "string" && data["domain"] !== "") outcome.domain = data["domain"];
    return outcome;
  }
  /**
   * GET the personal model catalog.
   *
   * Both variants read `/v3/config`, the product document the desktop product
   * itself fetches. CN used to read `/console/enterprises/personal/models`
   * (the console catalog) instead, and that was why its model list drifted
   * from the desktop App's selector: the console document lags the product
   * one, and the product roster itself churns day to day (`auto`,
   * `kimi-k3-1`, `minimax-m3` have each appeared and disappeared within a
   * week).
   *
   * What distinguishes the two variants here is the User-Agent, not the path:
   * the gateway splits `/v3/config` by client identity, and the split is
   * load-bearing. A CLI-shaped UA yields the CLI's roster — the chat models
   * this plugin serves — while an App-shaped UA yields the App's internal
   * roster. CN keeps the CLI UA it sends for chat, so the catalog it
   * advertises is exactly the one its own requests can use. The international
   * variant has no CLI identity, so it keeps the App-shaped UA.
   *
   * Membership is the `cli` roster intersected with the usable rows (see
   * {@link parseModelCatalog}); the promo badges the product document does
   * not carry are merged in from a best-effort console read — see
   * {@link fetchPromoBadges}.
   *
   * Responses are unwrapped and classified the same way — `readEnvelope` plus
   * `envelopeError` — so an expired session or exhausted credit is reported as
   * such rather than as a generic catalog failure.
   */
  async fetchModels(credential, signal) {
    const international = regionOf(credential.domain) === "global";
    const appVersion = international ? await this.resolveAppVersion() : void 0;
    const response = await fetch(`${chatBase(credential)}/v3/config`, {
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        Accept: "application/json",
        Origin: originReferer(credential),
        Referer: `${originReferer(credential)}/`,
        ...international ? { "X-Requested-With": "XMLHttpRequest", "X-Product": "SaaS" } : {},
        "User-Agent": appVersion === void 0 ? CLIENT_UA : appUserAgent(appVersion.version)
      },
      signal: signal === void 0 ? AbortSignal.timeout(JSON_TIMEOUT_MS) : AbortSignal.any([signal, AbortSignal.timeout(JSON_TIMEOUT_MS)])
    });
    const envelope = await readEnvelope(response);
    if (!response.ok || envelope.code !== 0) throw envelopeError(response.status, envelope);
    const data = isObject(envelope.data) ? envelope.data : "models" in envelope.document || "agents" in envelope.document ? envelope.document : {};
    const promoBadges = international ? void 0 : await this.fetchPromoBadges(credential, signal);
    const models = parseModelCatalog(data, international, promoBadges);
    this.lastCatalog = {
      fetchedAtMs: Date.now(),
      source: international ? "workbuddy-ai:app" : "workbuddy:cli",
      ...appVersion === void 0 ? {} : { appVersion }
    };
    return models;
  }
  /**
   * Read the console catalog's promotional tags, by model id.
   *
   * `/v3/config` carries no `badge:<label>:<color>` tags — the discount labels
   * the cards render (`限时免费`, `夜间折扣`, …) live only in
   * `/console/enterprises/personal/models`. Since the roster now comes from
   * the product document, those tags are read from the console one in a
   * second request and merged by id.
   *
   * Best-effort by construction: a badge is a label on a price, so failing to
   * read this document must not fail a catalog refresh. Every failure —
   * network, envelope, an unreadable body — returns undefined, and the models
   * simply ship without badges.
   */
  async fetchPromoBadges(credential, signal) {
    try {
      const response = await fetch(`${chatBase(credential)}/console/enterprises/personal/models`, {
        headers: {
          Authorization: `Bearer ${credential.accessToken}`,
          Accept: "application/json",
          Origin: originReferer(credential),
          Referer: `${originReferer(credential)}/`,
          "User-Agent": CLIENT_UA
        },
        signal: signal === void 0 ? AbortSignal.timeout(JSON_TIMEOUT_MS) : AbortSignal.any([signal, AbortSignal.timeout(JSON_TIMEOUT_MS)])
      });
      if (!response.ok) return void 0;
      const envelope = await readEnvelope(response);
      const data = isObject(envelope.data) ? envelope.data : envelope.document;
      const rawModels = Array.isArray(data["models"]) ? data["models"] : [];
      const badges = /* @__PURE__ */ new Map();
      for (const model of rawModels) {
        if (!isObject(model)) continue;
        const id = typeof model["id"] === "string" ? model["id"] : "";
        if (id === "") continue;
        const tags = Array.isArray(model["tags"]) ? model["tags"].filter((tag) => typeof tag === "string" && tag.toLowerCase().startsWith(BADGE_PREFIX)) : [];
        if (tags.length > 0) badges.set(id, tags);
      }
      return badges.size === 0 ? void 0 : badges;
    } catch {
      return void 0;
    }
  }
  /**
   * POST the billing endpoint for the aggregated remaining credit.
   *
   * Two upstream shapes, chosen by account type:
   *
   * - **CN enterprise** (`regionOf === 'cn'` and `enterpriseId` non-empty) asks
   *   `/v2/billing/meter/get-enterprise-user-usage`, which answers with a single
   *   cycle quota. The personal endpoint serves these accounts an empty
   *   `Accounts` list, which the card then renders as "0 credit" — a wrong
   *   number rather than a visible failure (issue #31).
   * - **Everyone else** keeps the personal endpoint unchanged.
   *
   * The region gate is load-bearing: the enterprise endpoint is unverified for
   * the global region, so an international credential that happens to carry an
   * `enterpriseId` must stay on the measured personal path instead of being
   * moved onto an unmeasured one.
   */
  async fetchCredits(credential) {
    if (regionOf(credential.domain) === "cn" && credential.enterpriseId !== void 0 && credential.enterpriseId !== "") {
      return await this.fetchEnterpriseCredits(credential);
    }
    const now = /* @__PURE__ */ new Date();
    const format = (date) => [
      date.getFullYear().toString().padStart(4, "0"),
      (date.getMonth() + 1).toString().padStart(2, "0"),
      date.getDate().toString().padStart(2, "0")
    ].join("-") + " " + [
      date.getHours().toString().padStart(2, "0"),
      date.getMinutes().toString().padStart(2, "0"),
      date.getSeconds().toString().padStart(2, "0")
    ].join(":");
    const response = await fetch(`${billingBase(credential)}/v2/billing/meter/get-user-resource`, {
      method: "POST",
      headers: billingHeaders(credential),
      body: JSON.stringify({
        PageNumber: 1,
        PageSize: 100,
        ProductCode: "p_tcaca",
        Status: [0, 3],
        PackageEndTimeRangeBegin: format(now),
        PackageEndTimeRangeEnd: format(new Date(now.getTime() + 365 * 101 * 24 * 3600 * 1e3))
      }),
      signal: AbortSignal.timeout(JSON_TIMEOUT_MS)
    });
    const envelope = await readEnvelope(response);
    if (!response.ok || envelope.code !== 0) throw envelopeError(response.status, envelope);
    const responseWrapper = typeof envelope.data === "object" && envelope.data !== null ? envelope.data : {};
    const data = typeof responseWrapper["Response"] === "object" && responseWrapper["Response"] !== null ? responseWrapper["Response"] : {};
    const inner = typeof data["Data"] === "object" && data["Data"] !== null ? data["Data"] : {};
    const rawAccounts = Array.isArray(inner["Accounts"]) ? inner["Accounts"] : [];
    const accounts = [];
    let total = 0;
    for (const raw of rawAccounts) {
      if (typeof raw !== "object" || raw === null) continue;
      const account = raw;
      const numberField = (key) => typeof account[key] === "number" ? account[key] : 0;
      const size = numberField("CycleCapacitySize");
      const cycleRemain = numberField("CycleCapacityRemain");
      const cycleUsed = numberField("CycleCapacityUsed");
      const capacityRemain = numberField("CapacityRemain");
      let remain;
      if (size > 0) remain = cycleRemain;
      else if (cycleRemain > 0 || cycleUsed > 0) remain = cycleRemain;
      else remain = capacityRemain;
      if (remain < 0) remain = 0;
      total += remain;
      accounts.push({
        packageName: typeof account["PackageName"] === "string" ? account["PackageName"] : "(unnamed)",
        remain,
        size: size > 0 ? size : numberField("CapacitySize")
      });
    }
    return { total, accounts };
  }
  /**
   * CN enterprise credit read: a single cycle quota instead of a package list.
   *
   * Verified against the WorkBuddy desktop app (`app.asar`,
   * `BackendProvider.getEnterpriseUsage` and `CloudAccountRepo.billing`): the
   * body is an empty object and the account identity travels only in the
   * headers. The two official call sites disagree on the field spelling
   * (`limitNum`/`credit` vs `limit_num`/`used_num`), so both are accepted.
   *
   * A body carrying no recognisable quota field is a hard error rather than a
   * zero. Rendering `0` for "we did not understand the answer" is exactly how
   * issue #31 stayed invisible while users saw a plausible wrong number.
   *
   * The error names fields and types only: it reaches the browser, and the
   * response body may describe the account's usage.
   */
  async fetchEnterpriseCredits(credential) {
    const response = await fetch(`${CN_BILLING_BASE}/v2/billing/meter/get-enterprise-user-usage`, {
      method: "POST",
      headers: billingHeaders(credential),
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(JSON_TIMEOUT_MS)
    });
    const envelope = await readEnvelope(response);
    if (!response.ok || envelope.code !== 0) throw envelopeError(response.status, envelope);
    const sources = [];
    for (const candidate of [envelope.data, envelope.document]) {
      if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) continue;
      const record = candidate;
      if (typeof record["data"] === "object" && record["data"] !== null && !Array.isArray(record["data"])) {
        sources.push(record["data"]);
      }
      sources.push(record);
    }
    const numberAt = (source, key) => typeof source[key] === "number" ? source[key] : void 0;
    let limit;
    let used;
    let resetTime;
    for (const source of sources) {
      const candidate = numberAt(source, "limitNum") ?? numberAt(source, "limit_num");
      if (candidate === void 0) continue;
      limit = candidate;
      used = numberAt(source, "credit") ?? numberAt(source, "used_num");
      if (typeof source["cycleResetTime"] === "string" && source["cycleResetTime"] !== "") {
        resetTime = source["cycleResetTime"];
      }
      break;
    }
    if (limit === void 0) {
      throw new Error(`workbuddy enterprise billing response carried no recognised quota field (expected limitNum/limit_num + credit/used_num; received ${describeShape(envelope.document)})`);
    }
    if (limit === -1) {
      return {
        total: 0,
        accounts: [{ packageName: enterprisePackageName, remain: 0, size: 0, unlimited: true }],
        unlimited: true,
        ...resetTime === void 0 ? {} : { cycleResetTime: resetTime }
      };
    }
    if (used === void 0) {
      throw new Error(`workbuddy enterprise billing response carried a quota limit but no recognised usage field (expected credit/used_num alongside limitNum/limit_num; received ${describeShape(envelope.document)})`);
    }
    let remain = limit - used;
    if (remain < 0) remain = 0;
    return {
      total: remain,
      accounts: [{ packageName: enterprisePackageName, remain, size: limit }],
      ...resetTime === void 0 ? {} : { cycleResetTime: resetTime }
    };
  }
  /**
   * One probe request: a real streaming chat call carrying the effort under
   * test.
   *
   * Shares `chatHeaders` with the normal chat path on purpose — the plan
   * forbids probing through anything but the plugin's own credential handling,
   * so a result describes what a real message would experience.
   *
   * The caller aborts as soon as a parseable event arrives; the body is never
   * assembled into an answer. `reasoning_effort` is omitted entirely (rather
   * than sent empty) when `effort` is undefined, so the baseline case is a
   * genuinely bare request.
   *
   * Two international differences, both measured on 2026-09-11:
   *
   * - The gateway requires a leading `system` message (400/11128 otherwise), so
   *   one is prepended for the global region only.
   * - `max_tokens: 1` is below some models' floor (the GPT-5.6 family rejects it
   *   with 400/11133 `integer_below_min_value`), so the international probe asks
   *   for a slightly larger minimum. This is a floor the plugin must clear, not
   *   evidence about any model's effort support: a model still refusing that
   *   minimum is reported as an incompatible request, never as "effort
   *   unsupported", and the ceiling is never raised further to force an answer.
   */
  async probeEffort(credential, model, effort, signal) {
    const international = regionOf(credential.domain) === "global";
    let identity;
    let userAgent;
    try {
      identity = await this.resolveChatIdentity(international ? "global" : "cn");
      userAgent = chatUserAgent(identity, international ? "global" : "cn");
    } catch {
      identity = fallbackChatIdentity(international ? "global" : "cn");
      userAgent = chatUserAgent(identity, international ? "global" : "cn");
    }
    const payload = {
      model,
      stream: true,
      messages: [
        ...international ? [{ role: "system", content: INTERNATIONAL_SYSTEM_PROMPT }] : [],
        { role: "user", content: PROBE_PROMPT }
      ],
      max_tokens: international ? INTERNATIONAL_PROBE_MAX_TOKENS : PROBE_MAX_TOKENS
    };
    if (effort !== void 0) payload["reasoning_effort"] = effort;
    let response;
    try {
      response = await fetch(`${chatBase(credential)}/v2/chat/completions`, {
        method: "POST",
        headers: { ...chatHeaders(credential, userAgent, identity.clientVersion), "Authorization": `Bearer ${credential.accessToken}` },
        body: JSON.stringify(payload),
        signal
      });
    } catch (error) {
      return { status: 0, streamed: false, detail: `transport error: ${String(error)}` };
    }
    if (!response.ok) {
      const text = (await response.text()).slice(0, ERROR_BODY_LIMIT);
      return { status: response.status, streamed: false, ...errorCodeOf(text) };
    }
    const streamed = await readFirstEvent(response);
    return { status: response.status, streamed };
  }
};
function errorCodeOf(text) {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const wrapped = parsed;
      const extError = wrapped["extError"];
      if (typeof extError === "object" && extError !== null && !Array.isArray(extError)) {
        const code = extError["code"];
        if (typeof code === "string") return { errorCode: code, detail: code };
      }
    }
  } catch {
  }
  return { detail: text.slice(0, 200) };
}
async function readFirstEvent(response) {
  const body = response.body;
  if (body === null) return false;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) return false;
      const text = decoder.decode(value, { stream: true });
      if (text.includes("data:")) return true;
    }
  } catch {
    return false;
  } finally {
    await reader.cancel().catch(() => {
    });
  }
}
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function positive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function parseModelCatalog(data, international = false, promoBadges) {
  const rawModels = Array.isArray(data["models"]) ? data["models"] : [];
  const agents = Array.isArray(data["agents"]) ? data["agents"] : [];
  let cliIds;
  for (const agent of agents) {
    if (typeof agent === "object" && agent !== null) {
      const wrapped = agent;
      if (wrapped["name"] === "cli" && Array.isArray(wrapped["models"])) {
        cliIds = wrapped["models"].filter((id) => typeof id === "string");
        break;
      }
    }
  }
  if (cliIds === void 0 || cliIds.length === 0) {
    throw new Error("workbuddy model catalog lists no cli agent models");
  }
  const byId = /* @__PURE__ */ new Map();
  for (const model of rawModels) {
    if (typeof model !== "object" || model === null) continue;
    const wrapped = model;
    const id = typeof wrapped["id"] === "string" ? wrapped["id"] : "";
    if (id === "" || wrapped["disabled"] === true) continue;
    const input = typeof wrapped["maxInputTokens"] === "number" ? wrapped["maxInputTokens"] : 0;
    const output = typeof wrapped["maxOutputTokens"] === "number" ? wrapped["maxOutputTokens"] : 0;
    if (input <= 0 || output <= 0) continue;
    byId.set(id, {
      id,
      name: typeof wrapped["name"] === "string" && wrapped["name"] !== "" ? wrapped["name"] : id,
      contextWindow: international && isObject(wrapped["contextWindow"]) && positive(wrapped["contextWindow"]["defaultLength"]) ? wrapped["contextWindow"]["defaultLength"] : input,
      ...international ? {
        ...isObject(wrapped["contextWindow"]) && positive(wrapped["contextWindow"]["defaultLength"]) ? { defaultContextWindow: wrapped["contextWindow"]["defaultLength"] } : {},
        maxInputTokens: input,
        supportedContextWindows: isObject(wrapped["contextWindow"]) && Array.isArray(wrapped["contextWindow"]["supportedLengths"]) ? wrapped["contextWindow"]["supportedLengths"].filter(positive) : [],
        promotions: parsePromotions(data["modelPromotions"], id)
      } : {},
      maxTokens: output,
      supportsImages: wrapped["supportsImages"] === true && wrapped["disabledMultimodal"] !== true,
      ...resolveUpstreamReasoning(wrapped),
      ...resolveUpstreamBilling(wrapped, promoBadges?.get(id))
    });
  }
  const models = cliIds.map((id) => byId.get(id)).filter((model) => model !== void 0);
  if (models.length === 0) throw new Error("workbuddy model catalog resolved to an empty list");
  return models;
}
function parsePromotions(value, model) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item) || item["enabled"] !== true) return [];
    const modelIds = item["modelIds"];
    if (!Array.isArray(modelIds) || !modelIds.includes(model)) return [];
    const schedule = item["schedule"];
    const discount = item["discount"];
    const badge = item["badge"];
    if (!isObject(schedule) || !isObject(discount) || !isObject(badge)) return [];
    if (discount["displayMode"] !== "replace") return [];
    const start = typeof schedule["validFrom"] === "string" ? Date.parse(schedule["validFrom"]) : Number.NaN;
    const end = typeof schedule["validUntil"] === "string" ? Date.parse(schedule["validUntil"]) : Number.NaN;
    const factor = discount["factor"];
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    if (typeof factor !== "number" || !Number.isFinite(factor) || factor < 0) return [];
    return [{
      start,
      end,
      factor,
      label: typeof badge["label"] === "string" ? badge["label"] : "",
      priority: typeof item["priority"] === "number" && Number.isFinite(item["priority"]) ? item["priority"] : 0
    }];
  });
}
function modelWithCurrentPromotion(model, now = Date.now()) {
  if (model.promotions === void 0 || model.promotions.length === 0) return model;
  const promotion = [...model.promotions].sort((a, b) => b.priority - a.priority).find((candidate) => now >= candidate.start && now < candidate.end);
  if (promotion === void 0) {
    const derivedFromPromotion = model.billing?.free === true || (model.billing?.badges?.length ?? 0) > 0 || model.promotions.some((candidate) => candidate.factor !== 1);
    if (!derivedFromPromotion) return model;
    return {
      ...model,
      billing: {
        free: false,
        rateUnknown: true
      }
    };
  }
  const rate = normalizeCredits(model.billing?.credits);
  const original = rate !== void 0 && rate.startsWith("x") ? Number(rate.slice(1)) : Number.NaN;
  if (promotion.factor !== 0 && !Number.isFinite(original)) return model;
  const value = promotion.factor === 0 ? 0 : original * promotion.factor;
  return {
    ...model,
    billing: {
      ...model.billing,
      credits: `x${value.toFixed(2)}`,
      free: value === 0,
      badges: [
        ...model.billing?.badges ?? [],
        ...promotion.label === "" ? [] : [promotion.label]
      ]
    }
  };
}
function prepareInternationalChatBody(source) {
  const prepared = prepareChatBody(source);
  let body;
  try {
    body = JSON.parse(prepared);
  } catch {
    return prepared;
  }
  if (!isObject(body)) return prepared;
  dropUnsupportedEffort(body);
  const messages = body["messages"];
  if (!Array.isArray(messages)) return JSON.stringify(body);
  const first = messages[0];
  if (isObject(first) && first["role"] === "system") return JSON.stringify(body);
  messages.unshift({ role: "system", content: INTERNATIONAL_SYSTEM_PROMPT });
  return JSON.stringify(body);
}
function dropUnsupportedEffort(obj) {
  if (obj["reasoning_effort"] === "off") delete obj["reasoning_effort"];
}
var INTERNATIONAL_SYSTEM_PROMPT = "You are a helpful assistant.";
var INTERNATIONAL_PROBE_MAX_TOKENS = 16;

// vendor/dsh-workbuddy-connect/desktop-credential-protection.ts
var import_node_child_process = require("node:child_process");
var import_node_fs = require("node:fs");
var import_node_crypto2 = require("node:crypto");
var import_node_path4 = require("node:path");

// vendor/dsh-workbuddy-connect/status-paths.ts
var WORKBUDDY_STATUS_PATH = "/plugins/dsh-workbuddy-connect/status";
var WORKBUDDY_PROBE_PATH = "/plugins/dsh-workbuddy-connect/probe";
var WORKBUDDY_AI_STATUS_PATH = "/plugins/dsh-workbuddy-connect/ai/status";
var WORKBUDDY_AI_PROBE_PATH = "/plugins/dsh-workbuddy-connect/ai/probe";

// vendor/dsh-workbuddy-connect/variants.ts
var WORKBUDDY_VARIANTS = [
  {
    id: "workbuddy",
    displayName: "WorkBuddy",
    appName: "WorkBuddy",
    region: "cn",
    env: "WORKBUDDY_AUTH_FILE",
    electron: {
      productName: "WorkBuddy",
      envVar: "WORKBUDDY_ELECTRON_BIN",
      macOS: {
        bundleId: "com.tencent.workbuddy.mac",
        defaultPath: "/Applications/WorkBuddy.app/Contents/MacOS/Electron"
      },
      windows: {
        displayNamePattern: /^WorkBuddy(?:\s+\d+(?:\.\d+)+(?:[-+][0-9A-Za-z.-]+)?)?$/u,
        exeBasename: "workbuddy.exe",
        defaultPathSegments: ["Programs", "WorkBuddy", "WorkBuddy.exe"]
      }
    },
    desktopFilename: "workbuddy-desktop.info",
    ownFilename: ".workbuddy-auth.json",
    probeFilename: ".workbuddy-probe.json",
    catalogFilename: ".workbuddy-catalog.json",
    visibilityFilename: ".workbuddy-model-visibility.json",
    statusPath: WORKBUDDY_STATUS_PATH,
    probePath: WORKBUDDY_PROBE_PATH
  },
  {
    id: "workbuddy-ai",
    displayName: "WorkBuddy AI",
    appName: "WorkBuddy AI",
    region: "global",
    env: "WORKBUDDY_AI_AUTH_FILE",
    electron: {
      productName: "WorkBuddy AI",
      envVar: "WORKBUDDY_AI_ELECTRON_BIN",
      macOS: {
        bundleId: "com.workbuddy.workbuddy-ai",
        defaultPath: "/Applications/WorkBuddy AI.app/Contents/MacOS/Electron"
      },
      windows: {
        // Measured in #60: `WorkBuddy AI 5.6.2`. The CN pattern cannot match
        // this value ("AI" is not a version) and this pattern cannot match
        // `WorkBuddy 5.6.2` (missing the literal " AI"), so the two records
        // never feed each other's discovery.
        displayNamePattern: /^WorkBuddy AI(?:\s+\d+(?:\.\d+)+(?:[-+][0-9A-Za-z.-]+)?)?$/u,
        exeBasename: "workbuddyai.exe"
      }
    },
    desktopFilename: "workbuddy-desktop-ai.info",
    ownFilename: ".workbuddy-ai-auth.json",
    probeFilename: ".workbuddy-ai-probe.json",
    catalogFilename: ".workbuddy-ai-catalog.json",
    visibilityFilename: ".workbuddy-ai-model-visibility.json",
    statusPath: WORKBUDDY_AI_STATUS_PATH,
    probePath: WORKBUDDY_AI_PROBE_PATH
  }
];
var CN_VARIANT = WORKBUDDY_VARIANTS[0];
var AI_VARIANT = WORKBUDDY_VARIANTS[1];
function electronProfileFor(variant) {
  return variant?.electron ?? (variant?.id === AI_VARIANT.id ? AI_VARIANT : CN_VARIANT).electron;
}

// vendor/dsh-workbuddy-connect/desktop-credential-protection.ts
function defaultWorkBuddyElectronPath(product, platform = process.platform) {
  if (platform === "darwin") return product.macOS.defaultPath;
  if (platform !== "win32" || product.windows.defaultPathSegments === void 0) return void 0;
  const localAppData = process.env.LOCALAPPDATA?.trim();
  return localAppData === void 0 || localAppData === "" ? void 0 : (0, import_node_path4.join)(localAppData, ...product.windows.defaultPathSegments);
}
function keyIdsOf(fields) {
  return [...new Set(fields.map((wrapped) => wrapped.envelope.keyId))];
}
function parseWrappedField(field, value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
  const wrapped = value;
  if (wrapped["$wbEncrypted"] !== 1 || typeof wrapped["envelope"] !== "string") return void 0;
  let inner;
  try {
    inner = JSON.parse(Buffer.from(wrapped["envelope"], "base64").toString("utf8"));
  } catch {
    return void 0;
  }
  if (typeof inner !== "object" || inner === null || Array.isArray(inner)) return void 0;
  const parts = inner;
  const nonce = parseBase64(parts["nonce"], 12);
  const authTag = parseBase64(parts["authTag"], 16);
  const ciphertext = parseBase64(parts["ciphertext"]);
  if (nonce === void 0 || authTag === void 0 || ciphertext === void 0) return void 0;
  if (typeof parts["suite"] !== "number" || !Number.isInteger(parts["suite"])) return void 0;
  if (parts["suite"] !== 1) return void 0;
  if (typeof parts["keyId"] !== "string" || !/^[0-9a-f]{16}$/u.test(parts["keyId"])) return void 0;
  return {
    field,
    envelope: {
      suite: parts["suite"],
      keyId: parts["keyId"],
      nonce,
      authTag,
      ciphertext
    }
  };
}
function parseBase64(value, length) {
  if (typeof value !== "string" || value === "") return void 0;
  let decoded;
  try {
    decoded = Buffer.from(value, "base64");
  } catch {
    return void 0;
  }
  if (decoded.length === 0 || decoded.toString("base64").replace(/=+$/u, "") !== value.replace(/=+$/u, "")) return void 0;
  return length === void 0 || decoded.length === length ? decoded : void 0;
}
var AUTH_FIELDS = ["accessToken", "refreshToken"];
function classifyDesktopAuthDocument(text) {
  if (text.trim() === "") return { format: "absent" };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { format: "unrecognized" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { format: "unrecognized" };
  const document = parsed;
  const auth = typeof document["auth"] === "object" && document["auth"] !== null ? document["auth"] : document;
  const fields = [];
  for (const field of AUTH_FIELDS) {
    const value = auth[field];
    if (typeof value === "string") continue;
    const wrapped = parseWrappedField(field, value);
    if (wrapped === void 0 && value !== void 0) return { format: "unrecognized" };
    if (wrapped !== void 0) fields.push(wrapped);
  }
  if (fields.length === 0) return { format: "plaintext" };
  return { format: "encrypted", wrapped: { document, fields } };
}
function unwrapDesktopAuthDocument(classification, openField) {
  const wrapped = classification.wrapped;
  const rebuilt = structuredClone(wrapped.document);
  const auth = typeof rebuilt["auth"] === "object" && rebuilt["auth"] !== null ? rebuilt["auth"] : rebuilt;
  for (const field of wrapped.fields) {
    auth[field.field] = openField(field);
  }
  return JSON.stringify(rebuilt);
}
function buildAuthenticatedContextAad(keyId, suite) {
  const prefix = Buffer.from("WB-AAD\0", "ascii");
  const lengthPrefixed = (value) => {
    const bytes = Buffer.from(value, "utf8");
    const header = Buffer.allocUnsafe(4);
    header.writeUInt32BE(bytes.length);
    return Buffer.concat([header, bytes]);
  };
  const suiteBytes = Buffer.allocUnsafe(4);
  suiteBytes.writeUInt32BE(suite);
  return Buffer.concat([
    prefix,
    Buffer.from([1]),
    lengthPrefixed("WBEV1"),
    lengthPrefixed("sym-v1"),
    suiteBytes,
    lengthPrefixed(keyId),
    Buffer.from([2]),
    Buffer.from([0]),
    Buffer.from([0])
  ]);
}
function openAuthField(key, envelope) {
  try {
    const decipher = (0, import_node_crypto2.createDecipheriv)("aes-256-gcm", key, envelope.nonce, { authTagLength: 16 });
    decipher.setAAD(buildAuthenticatedContextAad(envelope.keyId, envelope.suite));
    decipher.setAuthTag(envelope.authTag);
    return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return void 0;
  }
}
function parseAtRestPayload(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return void 0;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
  const payload = parsed;
  if (payload["version"] !== 1) return void 0;
  const secret = payload["atRestSecretKey"];
  if (typeof secret !== "string" || secret === "") return void 0;
  let decoded;
  try {
    decoded = Buffer.from(secret, "base64");
  } catch {
    return void 0;
  }
  if (decoded.length !== 32) return void 0;
  if (decoded.toString("base64") !== secret) return void 0;
  if (decoded.every((byte) => byte === 0)) return void 0;
  return { atRestSecretKey: secret };
}
function deriveProtectorKey(secret) {
  return (0, import_node_crypto2.createHash)("sha256").update(secret, "utf8").digest();
}
function electronDiscoveryFor(platform = process.platform) {
  if (platform === "darwin") return "macos-workbuddy";
  if (platform === "win32") return "windows-workbuddy";
  return "none";
}
function atRestKeyProviderFor(variant) {
  return new WorkBuddyAtRestKeyProvider({
    product: electronProfileFor(variant),
    discovery: electronDiscoveryFor()
  });
}
var MDFIND_BIN = "/usr/bin/mdfind";
var PLUTIL_BIN = "/usr/bin/plutil";
var WINDOWS_REGISTRY_ROOTS = [
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
];
var WINDOWS_REGISTRY_OUTPUT_MAX_BYTES = 1024 * 1024;
var WINDOWS_ELECTRON_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;
var WORKBUDDY_DISCOVERY_STEP_TIMEOUT_MS = 3e3;
var WORKBUDDY_DISCOVERY_BUDGET_MS = 1e4;
var MDFIND_MAX_OUTPUT_BYTES = 1024 * 1024;
var PLUTIL_MAX_OUTPUT_BYTES = 64 * 1024;
var DiscoveryIncompleteError = class extends Error {
};
function workBuddyDiscoveryTools(bundleId) {
  const runTool = (bin, args, maxBytes, signal) => new Promise((resolve2, reject) => {
    if (signal.aborted) {
      reject(new DiscoveryIncompleteError(`${bin} was not started: the discovery budget was already spent`));
      return;
    }
    let settled = false;
    const child = (0, import_node_child_process.execFile)(bin, [...args], { maxBuffer: maxBytes, timeout: WORKBUDDY_DISCOVERY_STEP_TIMEOUT_MS }, (error, stdout) => {
      if (settled) return;
      settled = true;
      if (error !== null && error !== void 0) {
        reject(new DiscoveryIncompleteError(`${bin} could not complete (${error.killed === true ? "timed out" : String(error.code ?? "unavailable")})`));
        return;
      }
      resolve2(stdout);
    });
    const abort = () => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new DiscoveryIncompleteError(`${bin} was abandoned: the discovery budget was spent`));
    };
    signal.addEventListener("abort", abort, { once: true });
    child.on("close", () => {
      signal.removeEventListener("abort", abort);
    });
  });
  return {
    findApps: async (signal) => {
      const out = await runTool(
        MDFIND_BIN,
        [`kMDItemCFBundleIdentifier == '${bundleId}'`],
        MDFIND_MAX_OUTPUT_BYTES,
        signal
      );
      return out.split("\n").map((line) => line.trim()).filter((line) => line.endsWith(".app"));
    },
    bundleIdentifier: async (bundlePath, signal) => {
      try {
        const out = await runTool(
          PLUTIL_BIN,
          ["-extract", "CFBundleIdentifier", "raw", "-o", "-", (0, import_node_path4.join)(bundlePath, "Contents", "Info.plist")],
          PLUTIL_MAX_OUTPUT_BYTES,
          signal
        );
        return out.trim();
      } catch {
        return void 0;
      }
    },
    bundleVersion: async (bundlePath, signal) => {
      try {
        const out = await runTool(
          PLUTIL_BIN,
          ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", (0, import_node_path4.join)(bundlePath, "Contents", "Info.plist")],
          PLUTIL_MAX_OUTPUT_BYTES,
          signal
        );
        const version = out.trim();
        return version === "" ? void 0 : version;
      } catch {
        return void 0;
      }
    }
  };
}
function workBuddyWindowsDiscoveryTools() {
  const systemRoot = process.env.SystemRoot?.trim();
  const regPath = systemRoot === void 0 || systemRoot === "" ? void 0 : (0, import_node_path4.join)(systemRoot, "System32", "reg.exe");
  const runTool = (root, signal) => new Promise((resolve2, reject) => {
    if (regPath === void 0) {
      reject(new DiscoveryIncompleteError("SystemRoot is not configured"));
      return;
    }
    if (signal.aborted) {
      reject(new DiscoveryIncompleteError("reg.exe was not started: the discovery budget was already spent"));
      return;
    }
    let settled = false;
    const child = (0, import_node_child_process.execFile)(regPath, ["query", root, "/s"], {
      maxBuffer: WINDOWS_REGISTRY_OUTPUT_MAX_BYTES,
      timeout: WORKBUDDY_DISCOVERY_STEP_TIMEOUT_MS,
      windowsHide: true
    }, (error, stdout, stderr) => {
      if (settled) return;
      settled = true;
      if (error !== null && error !== void 0) {
        if (error.killed !== true && (error.code === 1 || error.code === "1") && windowsRegistryKeyMissing(stderr)) {
          resolve2("");
          return;
        }
        reject(new DiscoveryIncompleteError(`reg.exe could not complete (${error.killed === true ? "timed out" : String(error.code ?? "unavailable")})`));
        return;
      }
      resolve2(stdout);
    });
    const abort = () => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new DiscoveryIncompleteError("reg.exe was abandoned: the discovery budget was spent"));
    };
    signal.addEventListener("abort", abort, { once: true });
    child.on("close", () => {
      signal.removeEventListener("abort", abort);
    });
  });
  return { queryUninstallRoot: runTool };
}
var WorkBuddyAtRestKeyProvider = class {
  /**
   * The explicit binary, when one was configured. `undefined` here means "the
   * caller did not name one", which is what lets discovery run — an explicit
   * path that turns out to be unusable is an error, never a reason to look for
   * a different app.
   */
  explicitPath;
  product;
  defaultPath;
  discovery;
  tools;
  windowsTools;
  platform;
  discoveryBudgetMs;
  timeoutMs;
  source;
  spawnHelper;
  /**
   * The path discovery settled on, cached only on success. A failure leaves
   * this unset so the next attempt tries again — the user may install or move
   * the app without restarting DSH.
   */
  discoveredPath;
  cache;
  inflight;
  constructor(options) {
    this.product = options.product;
    const fromEnv = process.env[options.product.envVar]?.trim();
    const envPath = fromEnv === void 0 || fromEnv === "" ? void 0 : fromEnv;
    this.explicitPath = options.electronPath ?? envPath;
    this.discovery = options.discovery ?? "none";
    this.platform = options.platform ?? process.platform;
    this.defaultPath = this.discovery === "none" ? void 0 : options.defaultElectronPath === void 0 ? defaultWorkBuddyElectronPath(options.product, this.platform) : options.defaultElectronPath ?? void 0;
    this.tools = options.tools ?? workBuddyDiscoveryTools(options.product.macOS.bundleId);
    this.windowsTools = options.windowsTools ?? workBuddyWindowsDiscoveryTools();
    this.discoveryBudgetMs = options.discoveryBudgetMs ?? WORKBUDDY_DISCOVERY_BUDGET_MS;
    this.timeoutMs = options.timeoutMs ?? 1e4;
    this.spawnHelper = options.spawnHelper ?? ((path) => this.spawnAt(path));
    this.source = options.source ?? (() => this.spawnPayload());
  }
  /**
   * The binary the default helper would use, for diagnostics.
   *
   * Reports a *discovery result* once one exists, so diagnostics describe what
   * would actually run rather than the default that was bypassed. Discovery
   * itself stays in {@link resolveElectronPath}: this accessor never triggers a
   * search (the constructor must remain I/O-free, and callers may ask before
   * any resolution has happened).
   */
  helperPath() {
    if (this.explicitPath !== void 0) return this.explicitPath;
    if (this.discovery === "none") return void 0;
    return this.discoveredPath ?? this.defaultPath;
  }
  /**
   * A protector key matching one of the requested envelope key ids. The first
   * id the cache answers wins; otherwise one spawn resolves the current key,
   * which must match a request — a mismatch means the envelopes were sealed by
   * a different install than the one this machine now runs, and no key we can
   * reach will open them.
   */
  async protectorKeyFor(requested) {
    if (requested.length === 0) {
      throw new WorkBuddyElectronPathError(
        "encrypted-credential-unreadable",
        "encrypted desktop credential carries no key ids"
      );
    }
    const cached = this.cache;
    if (cached !== void 0 && requested.includes(cached.keyId)) return cached.key;
    this.inflight ??= this.source().then((text) => this.ingest(text)).finally(() => {
      this.inflight = void 0;
    });
    const resolved = await this.inflight;
    if (!requested.includes(resolved.keyId)) {
      throw new WorkBuddyElectronPathError(
        "encrypted-credential-unreadable",
        `WorkBuddy's current at-rest key (id ${resolved.keyId}) does not match the credential's envelope (id ${requested.join(" or ")}); the desktop credential was sealed by a different WorkBuddy installation`
      );
    }
    return resolved.key;
  }
  ingest(text) {
    const payload = parseAtRestPayload(text);
    if (payload === void 0) {
      throw new WorkBuddyElectronPathError(
        "encrypted-credential-unreadable",
        "WorkBuddy key helper returned an unusable at-rest payload (expected {version:1, atRestSecretKey})"
      );
    }
    const key = deriveProtectorKey(payload.atRestSecretKey);
    const resolved = {
      key,
      keyId: (0, import_node_crypto2.createHash)("sha256").update(key).digest("hex").slice(0, 16)
    };
    this.cache = resolved;
    return resolved;
  }
  /**
   * The binary to spawn, or a diagnosable error saying why there is none.
   *
   * Order is the contract: an explicit path is used as-is and never falls back;
   * discovery runs only for a provider that was configured for it, and only
   * after the platform default has been tried and found unusable.
   */
  async resolveElectronPath() {
    if (this.explicitPath !== void 0) {
      if (!isExecutable(this.explicitPath)) {
        throw new WorkBuddyElectronPathError(
          "electron-path-invalid",
          `the configured ${this.product.productName} Electron binary is not available at ${this.explicitPath}; check ${this.product.envVar} or unset it to let the plugin look for the app itself`
        );
      }
      return this.explicitPath;
    }
    if (this.discovery === "none") {
      throw new WorkBuddyElectronPathError(
        "electron-binary-unavailable",
        `no ${this.product.productName} Electron binary is configured for this platform; set ${this.product.envVar} to the app's Electron binary`
      );
    }
    if (this.defaultPath !== void 0 && isExecutable(this.defaultPath)) return this.defaultPath;
    if (this.discoveredPath !== void 0) {
      if (isExecutable(this.discoveredPath)) return this.discoveredPath;
      this.discoveredPath = void 0;
    }
    const found = this.discovery === "macos-workbuddy" ? await this.discoverMacosApp() : await this.discoverWindowsApp();
    this.discoveredPath = found;
    return found;
  }
  /**
   * Resolve this product's app through Spotlight, then prove each candidate's
   * identity before it can be executed.
   *
   * The whole flow shares one budget: a hang in one candidate must not extend
   * the wait for the others, and running out of budget is reported as an
   * unfinished check rather than an absent app.
   */
  async discoverMacosApp() {
    if (this.platform !== "darwin") {
      throw new WorkBuddyElectronPathError(
        "electron-binary-unavailable",
        `no ${this.product.productName} Electron binary is configured for this platform; set ${this.product.envVar} to the app's Electron binary`
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.discoveryBudgetMs);
    try {
      let candidates;
      try {
        candidates = await this.tools.findApps(controller.signal);
      } catch {
        throw discoveryIncomplete(this.product.productName, "the app search did not complete");
      }
      const seen = /* @__PURE__ */ new Map();
      let unresolved = false;
      for (const candidate of candidates) {
        try {
          (0, import_node_fs.statSync)(candidate);
        } catch (error) {
          if (isENOENT(error)) continue;
          unresolved = true;
          continue;
        }
        let bundleIdentifier;
        try {
          bundleIdentifier = await this.tools.bundleIdentifier(candidate, controller.signal);
        } catch {
          unresolved = true;
          continue;
        }
        if (bundleIdentifier === void 0) {
          unresolved = true;
          continue;
        }
        if (bundleIdentifier !== this.product.macOS.bundleId) continue;
        const electronPath = (0, import_node_path4.join)(candidate, "Contents", "MacOS", "Electron");
        if (!isExecutable(electronPath)) continue;
        let identity;
        try {
          identity = (0, import_node_fs.realpathSync)(candidate);
        } catch {
          identity = candidate;
        }
        if (seen.has(identity)) continue;
        let version;
        try {
          version = await this.tools.bundleVersion(candidate, controller.signal);
        } catch {
          version = void 0;
        }
        seen.set(identity, { bundlePath: candidate, electronPath, ...version === void 0 ? {} : { version } });
      }
      if (seen.size > 1) {
        const listed = [...seen.values()].map((app) => `  - ${app.bundlePath}${app.version === void 0 ? "" : ` (${app.version})`}`).join("\n");
        throw new WorkBuddyElectronPathError(
          "electron-binary-ambiguous",
          `more than one ${this.product.productName} application was found, so none was chosen:
${listed}
 set ${this.product.envVar} to the one to use`
        );
      }
      if (unresolved) throw discoveryIncomplete(this.product.productName, "some candidates could not be checked");
      if (seen.size === 0) {
        throw new WorkBuddyElectronPathError(
          "electron-binary-not-found",
          `no ${this.product.productName} application was found in the default location or the system index; if it is installed elsewhere, it may not be indexed yet; set ${this.product.envVar} to the app's Electron binary`
        );
      }
      return [...seen.values()][0].electronPath;
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
  /**
   * Resolve this product's app through Windows uninstall records. Registry
   * entries provide hints, not trust: every DisplayIcon candidate must still
   * be the product's Electron binary with the known Electron layout before
   * execution.
   */
  async discoverWindowsApp() {
    if (this.platform !== "win32") {
      throw new WorkBuddyElectronPathError(
        "electron-binary-unavailable",
        `no ${this.product.productName} Electron binary is configured for this platform; set ${this.product.envVar} to the app's Electron binary`
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.discoveryBudgetMs);
    try {
      const candidates = [];
      let unresolved = false;
      for (const root of WINDOWS_REGISTRY_ROOTS) {
        let output;
        try {
          output = await this.windowsTools.queryUninstallRoot(root, controller.signal);
        } catch {
          unresolved = true;
          continue;
        }
        const parsed = parseWindowsRegistryOutput(output, this.product.windows.displayNamePattern);
        candidates.push(...parsed.candidates);
        unresolved ||= parsed.incomplete;
      }
      const seen = /* @__PURE__ */ new Map();
      const rejected = [];
      for (const candidate of new Set(candidates)) {
        const inspection = inspectWindowsElectronCandidate(candidate, this.platform, this.product.windows.exeBasename);
        if (inspection === "unresolved") {
          unresolved = true;
          continue;
        }
        if (inspection === void 0) {
          rejected.push(candidate);
          continue;
        }
        seen.set(inspection.identity, inspection.electronPath);
      }
      if (unresolved) throw discoveryIncomplete(this.product.productName, "some registry entries or candidates could not be checked");
      if (seen.size > 1) {
        const listed = [...seen.values()].map((path) => `  - ${path}`).join("\n");
        throw new WorkBuddyElectronPathError(
          "electron-binary-ambiguous",
          `more than one ${this.product.productName} application was found, so none was chosen:
${listed}
 set ${this.product.envVar} to the one to use`
        );
      }
      if (seen.size === 0) {
        const message = rejected.length === 0 ? `no usable ${this.product.productName} Electron binary was found in the default location or Windows uninstall records; set ${this.product.envVar} to the app's Electron binary` : `Windows uninstall records found ${rejected.length} ${this.product.productName} candidate${rejected.length > 1 ? "s" : ""}, but ${rejected.length > 1 ? "none" : "it"} did not match the expected app layout (the app's exe beside a version file and resources\\app.asar); set ${this.product.envVar} to the installed app's executable to use it`;
        throw new WorkBuddyElectronPathError("electron-binary-not-found", message);
      }
      return [...seen.values()][0];
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
  async spawnPayload() {
    return await this.spawnHelper(await this.resolveElectronPath());
  }
  async spawnAt(electronPath) {
    return await new Promise((resolve2, reject) => {
      (0, import_node_child_process.execFile)(electronPath, [HELPER_SCRIPT_ARGUMENT_FLAG, HELPER_SCRIPT], {
        timeout: this.timeoutMs,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
      }, (error, stdout) => {
        if (error !== null && error !== void 0) {
          const reason = error.killed === true ? `timed out or was killed after ${String(this.timeoutMs)}ms` : error.code !== void 0 ? `exited with code ${String(error.code)}` : "could not be started";
          reject(new WorkBuddyElectronPathError(
            "encrypted-credential-unreadable",
            `the WorkBuddy key helper (${electronPath}) ${reason}`
          ));
          return;
        }
        const output = stdout.trim();
        if (output === "") {
          reject(new WorkBuddyElectronPathError(
            "encrypted-credential-unreadable",
            `the WorkBuddy key helper (${electronPath}) produced no payload`
          ));
          return;
        }
        resolve2(output);
      });
    });
  }
};
function windowsRegistryKeyMissing(stderr) {
  const detail = stderr.trim();
  return /^ERROR:\s*The system was unable to find the specified registry key or value\.?$/iu.test(detail) || /^错误[:：]\s*系统找不到指定的注册表项或值[。.]?$/u.test(detail);
}
function parseWindowsRegistryOutput(output, displayNamePattern) {
  const entries = /* @__PURE__ */ new Map();
  let currentKey;
  for (const line of output.split(/\r?\n/u)) {
    const keyMatch = /^\s*(HKEY_[^\r\n]+?)\s*$/iu.exec(line);
    if (keyMatch !== null) {
      currentKey = keyMatch[1];
      entries.set(currentKey, {});
      continue;
    }
    if (currentKey === void 0) continue;
    const valueMatch = /^\s+(DisplayName|DisplayIcon)\s+REG_[A-Z0-9_]+\s*(.*?)\s*$/iu.exec(line);
    if (valueMatch === null) continue;
    const entry = entries.get(currentKey);
    if (entry === void 0) continue;
    const value = valueMatch[2] ?? "";
    if (valueMatch[1].toLowerCase() === "displayname") entry.displayName = value;
    else entry.displayIcon = value;
  }
  const candidates = [];
  let incomplete = false;
  for (const entry of entries.values()) {
    if (entry.displayName === void 0) continue;
    if (!displayNamePattern.test(entry.displayName.trim())) continue;
    const displayIcon = entry.displayIcon === void 0 ? void 0 : parseWindowsDisplayIcon(entry.displayIcon);
    if (displayIcon === void 0) incomplete = true;
    else candidates.push(displayIcon);
  }
  return { candidates, incomplete };
}
function parseWindowsDisplayIcon(value) {
  const raw = value.trim();
  let path;
  if (raw.startsWith('"')) {
    const closingQuote = raw.indexOf('"', 1);
    if (closingQuote < 0) return void 0;
    const suffix = raw.slice(closingQuote + 1).trim();
    if (suffix !== "" && !/^,\d+$/u.test(suffix)) return void 0;
    path = raw.slice(1, closingQuote).replace(/,\d+$/u, "");
  } else {
    const match = /^(.+?\.exe)(?:,\d+)?$/iu.exec(raw);
    if (match === null) return void 0;
    path = match[1];
  }
  path = path.trim();
  return /\.exe$/iu.test(path) ? path : void 0;
}
function inspectWindowsElectronCandidate(electronPath, platform, exeBasename) {
  if (platform !== "win32" || (0, import_node_path4.basename)(electronPath).toLowerCase() !== exeBasename) return void 0;
  let binaryStat;
  try {
    binaryStat = (0, import_node_fs.statSync)(electronPath);
  } catch (error) {
    return isENOENT(error) ? void 0 : "unresolved";
  }
  if (!binaryStat.isFile()) return void 0;
  try {
    (0, import_node_fs.accessSync)(electronPath, import_node_fs.constants.X_OK);
  } catch (error) {
    return isENOENT(error) ? void 0 : "unresolved";
  }
  const installRoot = (0, import_node_path4.dirname)(electronPath);
  let version;
  try {
    version = (0, import_node_fs.readFileSync)((0, import_node_path4.join)(installRoot, "version"), "utf8").trim();
  } catch (error) {
    return isENOENT(error) ? void 0 : "unresolved";
  }
  if (!WINDOWS_ELECTRON_VERSION_PATTERN.test(version)) return void 0;
  try {
    if (!(0, import_node_fs.readdirSync)((0, import_node_path4.join)(installRoot, "resources")).includes("app.asar")) return void 0;
  } catch (error) {
    return isENOENT(error) ? void 0 : "unresolved";
  }
  let identity;
  try {
    identity = (0, import_node_fs.realpathSync)(electronPath);
  } catch (error) {
    return isENOENT(error) ? void 0 : "unresolved";
  }
  return {
    electronPath,
    // Windows paths are case-insensitive even when a registry entry preserved
    // a different casing from the filesystem spelling.
    identity: platform === "win32" ? identity.toLowerCase() : identity
  };
}
function isExecutable(path) {
  try {
    (0, import_node_fs.accessSync)(path, import_node_fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
var WorkBuddyElectronPathError = class extends Error {
  reasonCode;
  constructor(reasonCode, message) {
    super(message);
    this.name = "WorkBuddyElectronPathError";
    this.reasonCode = reasonCode;
  }
};
function reasonCodeOf(error) {
  return error instanceof WorkBuddyElectronPathError ? error.reasonCode : void 0;
}
function isENOENT(error) {
  return error?.code === "ENOENT";
}
function discoveryIncomplete(productName, detail) {
  return new WorkBuddyElectronPathError(
    "electron-discovery-incomplete",
    `the ${productName} application search did not finish (${detail}); this is not proof that the app is missing`
  );
}
var HELPER_SCRIPT = 'process.stdout.write(String(process._linkedBinding("electron_browser_workbuddy_storage").loggerGet()))';
var HELPER_SCRIPT_ARGUMENT_FLAG = "-e";

// vendor/dsh-workbuddy-connect/auth.ts
var WORKBUDDY_AUTH_FILENAME = ".workbuddy-auth.json";
var WORKBUDDY_AUTH_FILE_ENV = "WORKBUDDY_AUTH_FILE";
var OWN_FORMAT_VERSION = 1;
function workbuddyOwnAuthPath() {
  return (0, import_node_path5.join)((0, import_dsh_home_paths3.resolveDshHome)(), WORKBUDDY_AUTH_FILENAME);
}
var DESKTOP_AUTH_RELATIVE_PATH = ["CodeBuddyExtension", "Data", "Public", "auth", "workbuddy-desktop.info"];
function isWsl() {
  if (process.platform !== "linux") return false;
  if (process.env["WSL_DISTRO_NAME"] !== void 0 || process.env["WSL_INTEROP"] !== void 0) return true;
  return (0, import_node_os3.release)().toLowerCase().includes("microsoft");
}
function windowsPathForWsl(value) {
  const path = value?.trim();
  if (!path) return void 0;
  if (path.startsWith("/")) return path;
  const drivePath = /^([a-z]):[\\/](.*)$/iu.exec(path);
  if (drivePath === null) return void 0;
  return (0, import_node_path5.join)("/mnt", drivePath[1].toLowerCase(), ...drivePath[2].split(/[\\/]+/u));
}
function wslDesktopAuthCandidates(home) {
  const profile = windowsPathForWsl(process.env["USERPROFILE"]) ?? (0, import_node_path5.join)("/mnt/c/Users", (0, import_node_path5.basename)(home));
  const localAppData = windowsPathForWsl(process.env["LOCALAPPDATA"]) ?? (0, import_node_path5.join)(profile, "AppData", "Local");
  const roamingAppData = windowsPathForWsl(process.env["APPDATA"]) ?? (0, import_node_path5.join)(profile, "AppData", "Roaming");
  return [
    (0, import_node_path5.join)(localAppData, ...DESKTOP_AUTH_RELATIVE_PATH),
    (0, import_node_path5.join)(roamingAppData, ...DESKTOP_AUTH_RELATIVE_PATH)
  ];
}
function defaultDesktopAuthCandidates() {
  const home = (0, import_node_os3.homedir)();
  if (process.platform === "darwin") {
    return [(0, import_node_path5.join)(home, "Library", "Application Support", "CodeBuddyExtension", "Data", "Public", "auth", "workbuddy-desktop.info")];
  }
  if (process.platform === "win32") {
    return [
      (0, import_node_path5.join)(home, "AppData", "Local", "CodeBuddyExtension", "Data", "Public", "auth", "workbuddy-desktop.info"),
      (0, import_node_path5.join)(home, "AppData", "Roaming", "CodeBuddyExtension", "Data", "Public", "auth", "workbuddy-desktop.info")
    ];
  }
  if (process.platform === "linux") {
    const configHome = xdgBase("XDG_CONFIG_HOME", (0, import_node_path5.join)(home, ".config"));
    const dataHome = xdgBase("XDG_DATA_HOME", (0, import_node_path5.join)(home, ".local", "share"));
    const linux = dedupeCandidates([
      (0, import_node_path5.join)(configHome, ...DESKTOP_AUTH_RELATIVE_PATH),
      (0, import_node_path5.join)(dataHome, ...DESKTOP_AUTH_RELATIVE_PATH)
    ]);
    return isWsl() ? dedupeCandidates([...wslDesktopAuthCandidates(home), ...linux]) : linux;
  }
  return [];
}
function xdgBase(envName, fallback) {
  const value = process.env[envName]?.trim();
  if (value !== void 0 && value !== "" && value.startsWith("/")) return value;
  return fallback;
}
function dedupeCandidates(candidates) {
  return [...new Set(candidates)];
}
function desktopAuthCandidatesFor(variant) {
  return dedupeCandidates(defaultDesktopAuthCandidates().map((path) => (0, import_node_path5.join)((0, import_node_path5.dirname)(path), variant.desktopFilename)));
}
function expiryToMs(value) {
  if (value <= 0) return 0;
  return value > 1e12 ? value : value * 1e3;
}
function optionalString(value) {
  return typeof value === "string" && value !== "" ? value : void 0;
}
function parseWorkBuddyAuth(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return void 0;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
  const document = parsed;
  let auth;
  let identity;
  if (typeof document["auth"] === "object" && document["auth"] !== null) {
    auth = document["auth"];
    identity = typeof document["account"] === "object" && document["account"] !== null ? document["account"] : {};
  } else {
    auth = document;
    identity = document;
  }
  const accessToken = typeof auth["accessToken"] === "string" ? auth["accessToken"] : "";
  if (accessToken === "") return void 0;
  const expiresAtMs = typeof auth["expiresAt"] === "number" ? expiryToMs(auth["expiresAt"]) : 0;
  const refreshExpiresAtMs = typeof auth["refreshExpiresAt"] === "number" ? expiryToMs(auth["refreshExpiresAt"]) : void 0;
  const enterpriseId = optionalString(identity["enterpriseId"]);
  const nickname = optionalString(identity["nickname"]);
  const credential = {
    accessToken,
    refreshToken: typeof auth["refreshToken"] === "string" ? auth["refreshToken"] : "",
    expiresAtMs,
    ...refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs },
    domain: optionalString(auth["domain"]) ?? "",
    uid: optionalString(identity["uid"]) ?? "",
    ...enterpriseId === void 0 ? {} : { enterpriseId },
    ...nickname === void 0 ? {} : { nickname },
    source: "desktop"
  };
  return credential;
}
function ownDocument(credential) {
  return { version: OWN_FORMAT_VERSION, credential };
}
function parseOwnDocument(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return void 0;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
  const document = parsed;
  if (document["version"] !== OWN_FORMAT_VERSION) return void 0;
  if (typeof document["credential"] !== "object" || document["credential"] === null) return void 0;
  const stored = document["credential"];
  const accessToken = typeof stored["accessToken"] === "string" ? stored["accessToken"] : "";
  if (accessToken === "") return void 0;
  const refreshExpiresAtMs = typeof stored["refreshExpiresAtMs"] === "number" ? stored["refreshExpiresAtMs"] : void 0;
  const enterpriseId = optionalString(stored["enterpriseId"]);
  const nickname = optionalString(stored["nickname"]);
  return {
    accessToken,
    refreshToken: typeof stored["refreshToken"] === "string" ? stored["refreshToken"] : "",
    expiresAtMs: typeof stored["expiresAtMs"] === "number" ? stored["expiresAtMs"] : 0,
    ...refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs },
    domain: optionalString(stored["domain"]) ?? "",
    uid: optionalString(stored["uid"]) ?? "",
    ...enterpriseId === void 0 ? {} : { enterpriseId },
    ...nickname === void 0 ? {} : { nickname },
    source: "dsh"
  };
}
function isENOENT2(error) {
  return error?.code === "ENOENT";
}
var WorkBuddyCredentialStore = class {
  variant;
  refresh;
  refreshMarginMs;
  ownPath;
  keyProvider;
  desktopPathOverride;
  inflight;
  constructor(options) {
    this.variant = options.variant;
    this.refresh = options.refresh;
    this.refreshMarginMs = options.refreshMarginMs ?? 5 * 60 * 1e3;
    this.ownPath = options.ownPath ?? (options.variant ? (0, import_node_path5.join)((0, import_dsh_home_paths3.resolveDshHome)(), options.variant.ownFilename) : workbuddyOwnAuthPath());
    this.keyProvider = options.keyProvider ?? new WorkBuddyAtRestKeyProvider({ product: electronProfileFor(options.variant) });
    this.desktopPathOverride = options.desktopPath;
  }
  /**
   * Configuration precedence for the desktop file: the plugin's configured
   * path, then the environment variable, then the platform defaults. An
   * explicit path is used verbatim; the defaults are a probe order.
   */
  resolveDesktopCandidates() {
    const fromEnv = process.env[this.variant?.env ?? WORKBUDDY_AUTH_FILE_ENV];
    const explicit = this.desktopPathOverride ?? (fromEnv !== void 0 && fromEnv.trim() !== "" ? fromEnv : void 0);
    if (explicit !== void 0) return [explicit];
    return this.variant === void 0 ? defaultDesktopAuthCandidates() : desktopAuthCandidatesFor(this.variant);
  }
  resolveDesktopPath() {
    return this.resolveDesktopCandidates()[0];
  }
  /**
   * Repoint the desktop file; a settings change applies on the next read.
   */
  setDesktopPath(path) {
    this.desktopPathOverride = path;
  }
  /** The resolved desktop auth-file path, for diagnostics. */
  desktopAuthPath() {
    return this.resolveDesktopPath();
  }
  /** The plugin-owned copy path, for diagnostics. */
  ownAuthPath() {
    return this.ownPath;
  }
  /** Read the freshest stored credential without refreshing anything. */
  async current() {
    const [desktop, own] = await Promise.all([this.readDesktop(), this.readOwn()]);
    if (this.variant !== void 0) {
      for (const [label, credential] of [["desktop file", desktop], ["plugin copy", own]]) {
        if (credential === void 0) continue;
        const region = regionOf(credential.domain);
        if (region !== this.variant.region) {
          throw new WorkBuddyElectronPathError(
            "credential-region-mismatch",
            `${this.variant.displayName} received a ${region === "cn" ? "WorkBuddy (CN)" : "WorkBuddy AI"} credential in its ${label} (domain ${JSON.stringify(credential.domain)}); point ${this.variant.env} at the ${this.variant.appName} sign-in, or remove the mismatched file`
          );
        }
      }
    }
    if (desktop === void 0) return own;
    if (own === void 0) return desktop;
    if (desktop.uid !== own.uid || desktop.enterpriseId !== own.enterpriseId) return desktop;
    return own.expiresAtMs > desktop.expiresAtMs ? own : desktop;
  }
  /**
   * The credential to send upstream: {@link current}, refreshed on demand.
   * Single-flight, so parallel requests share one refresh.
   */
  async resolve() {
    const credential = await this.current();
    if (credential === void 0) {
      const candidates = this.resolveDesktopCandidates();
      const desktop = candidates.length > 0 ? candidates.join(" or ") : "(no desktop path on this platform)";
      const app = this.variant?.appName ?? "WorkBuddy";
      throw new Error(
        `workbuddy: no signed-in ${app} account found; sign in once in the ${app} desktop app (expected ${desktop} or ${this.variant?.env ?? WORKBUDDY_AUTH_FILE_ENV}), or refresh an existing session`
      );
    }
    if (!this.needsRefresh(credential)) return credential;
    this.inflight ??= this.refreshNow(credential).finally(() => {
      this.inflight = void 0;
    });
    return this.inflight;
  }
  /** Read-only sign-in summary; never refreshes and never throws. */
  async status() {
    try {
      const credential = await this.current();
      if (credential === void 0) return { state: "signed-out", reasonCode: "no-credential" };
      return {
        state: "signed-in",
        expiresAtMs: credential.expiresAtMs,
        ...credential.refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs: credential.refreshExpiresAtMs },
        ...credential.nickname === void 0 ? {} : { nickname: credential.nickname },
        ...credential.domain === "" ? {} : { domain: credential.domain },
        source: credential.source
      };
    } catch (error) {
      return {
        state: "signed-out",
        reason: error instanceof Error ? error.message : String(error),
        ...reasonCodeOf(error) === void 0 ? {} : { reasonCode: reasonCodeOf(error) }
      };
    }
  }
  /** Remove the plugin-owned copy; the desktop file is untouched. */
  async logout() {
    await (0, import_promises4.rm)(this.ownPath, { force: true });
    await (0, import_promises4.rm)(`${this.ownPath}.lock`, { force: true });
  }
  needsRefresh(credential) {
    if (credential.expiresAtMs <= 0) return true;
    return Date.now() + this.refreshMarginMs >= credential.expiresAtMs;
  }
  async refreshNow(credential) {
    if (credential.refreshToken === "") {
      if (credential.expiresAtMs > Date.now() + 3e4) return credential;
      throw new Error("workbuddy: access token expired and no refresh token is stored; sign in again in the WorkBuddy desktop app");
    }
    try {
      const outcome = await this.refresh(credential);
      const refreshed = {
        ...credential,
        accessToken: outcome.accessToken,
        ...outcome.refreshToken === void 0 ? {} : { refreshToken: outcome.refreshToken },
        expiresAtMs: outcome.expiresInSec !== void 0 ? Date.now() + outcome.expiresInSec * 1e3 : credential.expiresAtMs,
        ...outcome.domain === void 0 || outcome.domain === "" ? {} : { domain: outcome.domain },
        source: "dsh"
      };
      await this.saveOwn(refreshed);
      return refreshed;
    } catch (error) {
      if (credential.expiresAtMs > Date.now() + 3e4) return credential;
      throw new Error(
        `workbuddy: token refresh failed and the access token is expired (${String(error)}); open the WorkBuddy desktop app once to sign in again`
      );
    }
  }
  async saveOwn(credential) {
    await withFileLock(this.ownPath, async () => {
      await writeFileAtomic(this.ownPath, `${JSON.stringify(ownDocument(credential), null, 2)}
`, {
        mode: 384,
        dirMode: 448
      });
    });
  }
  /**
   * Read the first desktop candidate that exists. Only an absent file
   * (ENOENT) falls through to the next candidate; a file that is present
   * but unparsable is authoritative for its slot, so a stale older-version
   * file never silently wins over a broken newer one.
   *
   * Since WorkBuddy 5.6 the token fields may arrive in at-rest envelopes, so
   * the text is classified before the regular parser sees it. An encrypted
   * document must be *opened*, never skipped; an unrecognized one must fail
   * loudly. The desktop file, as long as it exists, is the identity
   * authority — a document this plugin cannot read must surface as a
   * diagnosis rather than be papered over by the plugin-owned copy, which
   * belongs to whatever account was signed in when it was last refreshed.
   * Only an absent (or empty) file lets the probe continue.
   */
  async readDesktop() {
    for (const desktopPath of this.resolveDesktopCandidates()) {
      let text;
      try {
        text = await (0, import_promises4.readFile)(desktopPath, "utf8");
      } catch (error) {
        if (!isENOENT2(error)) throw error;
        continue;
      }
      const classification = classifyDesktopAuthDocument(text);
      if (classification.format === "plaintext") return parseWorkBuddyAuth(text);
      if (classification.format === "absent") continue;
      if (classification.format === "unrecognized") {
        throw new Error(
          `the desktop auth file at ${desktopPath} exists but is unreadable (neither a plaintext credential nor a decodable WorkBuddy 5.6 envelope); fix or remove the file \u2014 it outranks the plugin-owned credential copy`
        );
      }
      return await this.openEncryptedDesktop(classification);
    }
    return void 0;
  }
  /** Open a 5.6 encrypted desktop document into the regular credential shape. */
  async openEncryptedDesktop(classification) {
    const wrapped = classification.wrapped;
    const key = await this.keyProvider.protectorKeyFor(keyIdsOf(wrapped.fields));
    const text = unwrapDesktopAuthDocument(classification, (field) => {
      const plaintext = openAuthField(key, field.envelope);
      if (plaintext === void 0) {
        throw new WorkBuddyElectronPathError(
          "encrypted-credential-unreadable",
          `the encrypted desktop credential's ${field.field} could not be decrypted (envelope key id ${field.envelope.keyId}); the WorkBuddy app may hold a different at-rest key \u2014 open it once to reseal the sign-in`
        );
      }
      return plaintext;
    });
    return parseWorkBuddyAuth(text);
  }
  /**
   * Classify the first desktop candidate that exists and carries content;
   * `absent` when none does. An empty first file is skipped so it cannot mask
   * a real document on the next candidate. Diagnostics only — it never spawns
   * the key helper and never decrypts, so doctor can describe the file
   * without attempting the unlock.
   */
  async desktopAuthFormat() {
    for (const desktopPath of this.resolveDesktopCandidates()) {
      let text;
      try {
        text = await (0, import_promises4.readFile)(desktopPath, "utf8");
      } catch (error) {
        if (!isENOENT2(error)) throw error;
        continue;
      }
      const format = classifyDesktopAuthDocument(text).format;
      if (format !== "absent") return format;
    }
    return "absent";
  }
  async readOwn() {
    try {
      return parseOwnDocument(await (0, import_promises4.readFile)(this.ownPath, "utf8"));
    } catch (error) {
      if (isENOENT2(error)) return void 0;
      return void 0;
    }
  }
  /**
   * The first desktop candidate the probe would actually read from; `undefined`
   * when none qualifies. Semantics deliberately match the probe: empty files
   * are skipped (the probe classifies them as absent and moves on), so on an
   * XDG layout where the config-home file is empty but the data-home file
   * holds the credential, diagnostics name the *data-home* file — the one
   * authentication really uses. Like the probe it never parses or decrypts.
   */
  async resolvedDesktopAuthPath() {
    for (const desktopPath of this.resolveDesktopCandidates()) {
      let text;
      try {
        text = await (0, import_promises4.readFile)(desktopPath, "utf8");
      } catch (error) {
        if (!isENOENT2(error)) throw error;
        continue;
      }
      if (text.trim() === "") continue;
      return desktopPath;
    }
    return void 0;
  }
  /** Whether any desktop-file candidate exists as a regular file; diagnostics only. */
  async desktopFilePresent() {
    return await this.resolvedDesktopAuthPath() !== void 0;
  }
};

// vendor/dsh-workbuddy-connect/catalog.ts
var FALLBACK_WORKBUDDY_MODELS = [
  // Entries stay in the live roster's order. Rows without `supportedEfforts`
  // carry only a default effort, so the adapter offers them no thinking
  // control; see `reasoningFields()` in adapter.ts.
  { id: "hy4-preview", name: "Hy4 preview", contextWindow: 1e6, maxTokens: 64e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["high"], defaultEffort: "high", canDisableThinking: false }, billing: { credits: "x0.29 credits", free: false } },
  { id: "hy3", name: "Hy3", contextWindow: 192e3, maxTokens: 64e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "high", canDisableThinking: false }, billing: { credits: "x0.00 credits", free: true } },
  // Distinct display name: the `hy3` row above declares the same 192K window
  // and the document names both "Hy3", so a shared display name left two rows
  // of the same list indistinguishable. Display only — the id stays `hy3-x`,
  // which is what the wire request and the shim route on.
  { id: "hy3-x", name: "Hy3-X", contextWindow: 192e3, maxTokens: 64e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "high", canDisableThinking: false }, billing: { credits: "x0.05 credits", free: false } },
  { id: "deepseek-v4.1-flash", name: "Deepseek-V4.1-Flash", contextWindow: 1e6, maxTokens: 128e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "high", canDisableThinking: false }, billing: { credits: "x0.03 credits", free: false } },
  { id: "glm-5.3", name: "GLM-5.3", contextWindow: 1e6, maxTokens: 64e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.79 credits", free: false } },
  { id: "glm-5.3-flash", name: "GLM-5.3-Flash", contextWindow: 1e6, maxTokens: 131072, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["low", "high", "max"], defaultEffort: "high", canDisableThinking: true }, billing: { credits: "x0.06 credits", free: false } },
  { id: "glm-5.2", name: "GLM-5.2", contextWindow: 1e6, maxTokens: 64e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.79 credits", free: false } },
  { id: "glm-5.1", name: "GLM-5.1", contextWindow: 2e5, maxTokens: 48e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.79 credits", free: false } },
  { id: "glm-5v-turbo", name: "GLM-5v-Turbo", contextWindow: 2e5, maxTokens: 64e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.71 credits", free: false } },
  { id: "minimax-m3", name: "MiniMax-M3", contextWindow: 512e3, maxTokens: 64e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.25 credits", free: false } },
  { id: "minimax-m2.7", name: "MiniMax-M2.7", contextWindow: 2e5, maxTokens: 48e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.19 credits", free: false } },
  { id: "kimi-k3-1", name: "Kimi-K3", contextWindow: 1e6, maxTokens: 32e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x1.62 credits", free: false } },
  { id: "kimi-k2.8-preview", name: "Kimi-K2.8-Preview", contextWindow: 1e6, maxTokens: 64e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["low", "high", "max"], defaultEffort: "high", canDisableThinking: true }, billing: { credits: "x0.77 credits", free: false } },
  { id: "kimi-k2.7", name: "Kimi-K2.7-Code", contextWindow: 256e3, maxTokens: 32e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.57 credits", free: false } },
  { id: "kimi-k2.6", name: "Kimi-K2.6", contextWindow: 256e3, maxTokens: 32e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.52 credits", free: false } },
  { id: "deepseek-v4-pro", name: "Deepseek-V4-Pro", contextWindow: 1e6, maxTokens: 128e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "high", canDisableThinking: false }, billing: { credits: "x0.51 credits", free: false } }
];
var FALLBACK_WORKBUDDY_AI_MODELS = [
  { id: "default-model", name: "Auto", contextWindow: 176e3, maxTokens: 24e3, supportsImages: true, reasoning: { supports: false, onlyReasoning: false, canDisableThinking: true }, billing: { free: false } },
  { id: "fast-model", name: "Fast", contextWindow: 2e5, maxTokens: 32e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.34", free: false } },
  { id: "balanced-model", name: "Balanced", contextWindow: 256e3, maxTokens: 32e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.59", free: false } },
  { id: "primary-model", name: "Primary", contextWindow: 272e3, maxTokens: 72e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "high", canDisableThinking: false }, billing: { credits: "x3.31", free: false } },
  { id: "deep-model", name: "Deep", contextWindow: 176e3, maxTokens: 24e3, supportsImages: true, reasoning: { supports: false, onlyReasoning: false, canDisableThinking: true }, billing: { credits: "x3.33", free: false } },
  { id: "hy4-preview-f", name: "Hy4 preview", contextWindow: 3e5, defaultContextWindow: 3e5, supportedContextWindows: [3e5, 1e6], maxTokens: 64e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["high"], defaultEffort: "high", canDisableThinking: false }, billing: { free: false, rateUnknown: true } },
  { id: "hy3", name: "Hy3", contextWindow: 192e3, maxTokens: 64e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["low", "high"], defaultEffort: "high", canDisableThinking: false }, billing: { free: false, rateUnknown: true } },
  { id: "deepseek-v4.1-flash", name: "Deepseek-V4.1-Flash", contextWindow: 3e5, defaultContextWindow: 3e5, supportedContextWindows: [3e5, 1e6], maxTokens: 128e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "high", canDisableThinking: false }, billing: { free: false, rateUnknown: true } },
  { id: "gpt-6-astra", name: "GPT-6-Astra", contextWindow: 4e5, defaultContextWindow: 4e5, supportedContextWindows: [4e5, 1e6], maxTokens: 128e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["low", "medium", "high", "xhigh", "max"], defaultEffort: "medium", canDisableThinking: true }, billing: { credits: "x6.67", free: false } },
  { id: "gpt-5.6-sol", name: "GPT-5.6-Sol", contextWindow: 1e6, maxTokens: 128e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["low", "medium", "high", "xhigh", "max"], defaultEffort: "medium", canDisableThinking: true }, billing: { credits: "x3.47", free: false } },
  { id: "gpt-5.6-terra", name: "GPT-5.6-Terra", contextWindow: 1e6, maxTokens: 128e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["low", "medium", "high", "xhigh", "max"], defaultEffort: "medium", canDisableThinking: true }, billing: { credits: "x1.39", free: false } },
  { id: "gpt-5.6-luna", name: "GPT-5.6-Luna", contextWindow: 1e6, maxTokens: 128e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["low", "medium", "high", "xhigh", "max"], defaultEffort: "medium", canDisableThinking: true }, billing: { credits: "x0.14", free: false } },
  { id: "gpt-5.5", name: "GPT-5.5", contextWindow: 1e6, maxTokens: 128e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["low", "medium", "high", "xhigh"], defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x3.31", free: false } },
  { id: "gpt-5.4", name: "GPT-5.4", contextWindow: 272e3, maxTokens: 72e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["low", "medium", "high", "xhigh"], defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x1.65", free: false } },
  { id: "gpt-5.3-codex", name: "GPT-5.3-Codex", contextWindow: 272e3, maxTokens: 72e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x1.25", free: false } },
  { id: "gemini-3.5-flash", name: "Gemini-3.5-Flash", contextWindow: 1e6, maxTokens: 65536, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.99", free: false } },
  { id: "glm-5.3", name: "GLM-5.3", contextWindow: 1e6, maxTokens: 48e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["low", "high", "max"], defaultEffort: "high", canDisableThinking: true }, billing: { credits: "x0.79", free: false } },
  { id: "glm-5.2", name: "GLM-5.2", contextWindow: 1e6, maxTokens: 48e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, supportedEfforts: ["high", "xhigh"], defaultEffort: "high", canDisableThinking: true }, billing: { credits: "x0.79", free: false } },
  { id: "kimi-k3", name: "Kimi-K3", contextWindow: 1e6, maxTokens: 32e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x1.62", free: false } },
  { id: "kimi-k2.6", name: "Kimi-K2.6", contextWindow: 256e3, maxTokens: 32e3, supportsImages: true, reasoning: { supports: true, onlyReasoning: true, defaultEffort: "medium", canDisableThinking: false }, billing: { credits: "x0.52", free: false } }
];
var WorkBuddyCatalog = class {
  models;
  visible = true;
  useMaximumContextWindow = false;
  constructor(initial = FALLBACK_WORKBUDDY_MODELS) {
    this.models = initial;
  }
  /** Current entries; empty while the variant has no usable credential. */
  current() {
    if (!this.visible) return [];
    return this.models.map((model) => {
      const current = modelWithCurrentPromotion(model);
      const maximum = current.supportedContextWindows === void 0 ? void 0 : Math.max(...current.supportedContextWindows);
      return this.useMaximumContextWindow && maximum !== void 0 && maximum > current.contextWindow ? { ...current, defaultContextWindow: current.defaultContextWindow ?? current.contextWindow, contextWindow: maximum } : current;
    });
  }
  /** Replace the list; callers invalidate their adapter snapshot after this. */
  set(models) {
    this.models = [...models];
  }
  /** Whether this variant's models are exposed at all. */
  isVisible() {
    return this.visible;
  }
  /**
   * Show or hide the whole catalog. Returns whether the value changed, so the
   * caller can skip an invalidation that would re-render an identical list.
   */
  setVisible(visible) {
    if (this.visible === visible) return false;
    this.visible = visible;
    return true;
  }
  /** Select the largest declared international window where the upstream offers one. */
  setUseMaximumContextWindow(useMaximum) {
    if (this.useMaximumContextWindow === useMaximum) return false;
    this.useMaximumContextWindow = useMaximum;
    return true;
  }
  /** Models to fall back to when the upstream fetch fails; ignores visibility. */
  fallback() {
    return this.models;
  }
};

// vendor/dsh-workbuddy-connect/catalog-store.ts
var import_node_fs2 = require("node:fs");
var import_node_path6 = require("node:path");
var import_dsh_home_paths4 = __toESM(require_home());
var CATALOG_FORMAT_VERSION = 1;
var WORKBUDDY_CATALOG_FILENAME = ".workbuddy-catalog.json";
function workbuddyCatalogPath(filename = WORKBUDDY_CATALOG_FILENAME) {
  return (0, import_node_path6.join)((0, import_dsh_home_paths4.resolveDshHome)(), filename);
}
function isModel(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value;
  return typeof row["id"] === "string" && row["id"] !== "" && typeof row["name"] === "string" && typeof row["contextWindow"] === "number" && Number.isFinite(row["contextWindow"]) && typeof row["maxTokens"] === "number" && Number.isFinite(row["maxTokens"]) && typeof row["supportsImages"] === "boolean";
}
function isSaved(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const entry = value;
  if (typeof entry["account"] !== "string" || entry["account"] === "") return false;
  if (typeof entry["source"] !== "string" || entry["source"] === "") return false;
  if (typeof entry["fetchedAtMs"] !== "number" || !Number.isFinite(entry["fetchedAtMs"])) return false;
  const models = entry["models"];
  if (!Array.isArray(models) || models.length === 0) return false;
  return models.every(isModel);
}
var WorkBuddyCatalogStore = class {
  path;
  entries;
  constructor(options = {}) {
    this.path = typeof options === "string" ? options : options.path ?? workbuddyCatalogPath();
  }
  /** Resolved state-file path, for the CLI and tests. */
  filePath() {
    return this.path;
  }
  load() {
    if (this.entries !== void 0) return this.entries;
    const entries = {};
    if ((0, import_node_fs2.existsSync)(this.path)) {
      try {
        const parsed = JSON.parse((0, import_node_fs2.readFileSync)(this.path, "utf8"));
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          const document = parsed;
          const raw = document["version"] === CATALOG_FORMAT_VERSION ? document["entries"] : void 0;
          if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
            for (const [key, value] of Object.entries(raw)) {
              if (isSaved(value)) entries[key] = value;
            }
          }
        }
      } catch {
      }
    }
    this.entries = entries;
    return entries;
  }
  /** The saved catalog for one account, or `undefined` when there is none. */
  get(account) {
    const entry = this.load()[account];
    return entry === void 0 ? void 0 : entry;
  }
  /**
   * Remember a catalog for an account, replacing whatever was saved before.
   *
   * A failed write is swallowed: the plugin has already served these models,
   * and losing the *memory* of them is not worth surfacing.
   */
  set(account, catalog) {
    const entries = this.load();
    entries[account] = { account, ...catalog };
    this.persist();
  }
  /** Forget one account's catalog — used when that account signs out. */
  delete(account) {
    const entries = this.load();
    if (!(account in entries)) return;
    delete entries[account];
    this.persist();
  }
  persist() {
    const directory = (0, import_node_path6.dirname)(this.path);
    try {
      if (!(0, import_node_fs2.existsSync)(directory)) (0, import_node_fs2.mkdirSync)(directory, { recursive: true });
      const document = { version: CATALOG_FORMAT_VERSION, entries: this.load() };
      const temporary = (0, import_node_path6.resolve)(`${this.path}.tmp`);
      (0, import_node_fs2.writeFileSync)(temporary, `${JSON.stringify(document, null, 2)}
`, { mode: 384 });
      (0, import_node_fs2.renameSync)(temporary, this.path);
    } catch {
    }
  }
};

// vendor/dsh-workbuddy-connect/loopback.ts
var LOOPBACK_HOSTS = /* @__PURE__ */ new Set(["127.0.0.1", "localhost", "[::1]"]);
function hostnameOfHost(host) {
  let hostname = host.trim().toLowerCase();
  if (hostname.startsWith("[")) {
    const end = hostname.indexOf("]");
    return end === -1 ? hostname : hostname.slice(0, end + 1);
  }
  const colon = hostname.lastIndexOf(":");
  if (colon !== -1 && !hostname.slice(0, colon).includes(":") && /^\d+$/.test(hostname.slice(colon + 1))) {
    hostname = hostname.slice(0, colon);
  }
  return hostname;
}
function hostIsLoopback(host) {
  if (host === void 0 || host.trim() === "") return false;
  return LOOPBACK_HOSTS.has(hostnameOfHost(host));
}
function originIsLoopback(origin) {
  if (origin === void 0 || origin.trim() === "") return true;
  try {
    const { hostname } = new URL(origin);
    return LOOPBACK_HOSTS.has(hostname) || hostname === "::1";
  } catch {
    return false;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FALLBACK_WORKBUDDY_AI_MODELS,
  FALLBACK_WORKBUDDY_MODELS,
  WORKBUDDY_VARIANTS,
  WorkBuddyCatalog,
  WorkBuddyCatalogStore,
  WorkBuddyCredentialStore,
  WorkBuddyUpstreamClient,
  atRestKeyProviderFor,
  extractDisplayErrorMessage,
  hostIsLoopback,
  originIsLoopback,
  parseWorkBuddyAuth,
  prepareChatBody
});
