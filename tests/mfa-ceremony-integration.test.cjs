const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const bcrypt = require("bcryptjs");
const { TOTP, URI } = require("otpauth");
const { applyOfflineSqliteDdl } = require("../scripts/lib/prisma-cli.cjs");
const { createSoftwareAuthenticator } = require("./helpers/software-webauthn.cjs");

const ORIGIN = "http://localhost:3000";
const PASSWORD = "integration-passphrase";
const SECRET = "integration-secret-with-at-least-32-characters";
const originalTsExtension = require.extensions[".ts"];
const originalLoad = Module._load;

let core;
let authErrors;
let prisma;
let loginUser;
let mfaActions;
let currentUserId;
let temporaryDirectory;
let requestSequence = 0;
const cookieValues = new Map();

const cookieJar = {
  get(name) {
    const value = cookieValues.get(name);
    return value === undefined ? undefined : { name, value };
  },
  set(name, value) {
    cookieValues.set(name, String(value));
  },
};

function requestHeaders() {
  return new Headers({
    host: "localhost:3000",
    "x-forwarded-proto": "http",
    "x-pip-locale": "en",
  });
}

/** The same URL-encoded credentials boundary used by next-auth's server signIn. */
async function signInThroughAuthJs(provider, options) {
  const { redirectTo, ...credentials } = options;
  delete credentials.redirect;
  const body = new URLSearchParams({ ...credentials, callbackUrl: redirectTo ?? "/" });
  const address = `10.23.${Math.floor(requestSequence / 250) + 1}.${(requestSequence++ % 250) + 1}`;
  const request = new Request(`${ORIGIN}/api/auth/callback/${provider}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-real-ip": address,
    },
    body,
  });
  const result = await core.Auth(request, {
    basePath: "/api/auth",
    secret: SECRET,
    trustHost: true,
    session: { strategy: "jwt", maxAge: 15 * 60 },
    providers: [
      (await import("@auth/core/providers/credentials")).default({
        authorize: (fields, req) => require("../lib/credentials.ts").authorizeCredentials(fields, req),
      }),
    ],
    raw: core.raw,
    skipCSRFCheck: core.skipCSRFCheck,
    logger: { error() {}, warn() {}, debug() {} },
  });
  for (const cookie of result.cookies ?? []) cookieJar.set(cookie.name, cookie.value);
  return result.redirect;
}

Module._load = function (name, parent, isMain) {
  if (name === "next-auth") {
    return { AuthError: authErrors.AuthError, CredentialsSignin: authErrors.CredentialsSignin };
  }
  if (name === "next/headers") {
    return { headers: async () => requestHeaders(), cookies: async () => cookieJar };
  }
  if (name === "next/cache") return { revalidatePath() {} };
  if (name === "@/auth") {
    return {
      auth: async () => currentUserId ? { user: { id: currentUserId, role: "USER" } } : null,
      signIn: signInThroughAuthJs,
      signOut: async () => {},
    };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8").replace(
    /\bimport\.meta\.url\b/g,
    'require("node:url").pathToFileURL(__filename).href',
  );
  module._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};

before(async () => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "pip-mfa-ceremony-"));
  process.env.AUTH_SECRET = SECRET;
  process.env.TURSO_DATABASE_URL = `file:${path.join(temporaryDirectory, "ceremony.db")}`;
  process.env.WEBAUTHN_ORIGIN = ORIGIN;
  process.env.WEBAUTHN_RP_ID = "localhost";
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  await applyOfflineSqliteDdl(process.env);
  core = await import("@auth/core");
  authErrors = await import("@auth/core/errors");
  ({ prisma } = require("../lib/prisma.ts"));
  ({ loginUser } = require("../app/actions/auth.ts"));
  mfaActions = require("../app/actions/mfa.ts");
});

after(async () => {
  await prisma?.$disconnect();
  Module._load = originalLoad;
  if (originalTsExtension) require.extensions[".ts"] = originalTsExtension;
  else delete require.extensions[".ts"];
  if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

async function createAccount(email) {
  const account = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(PASSWORD, 12),
      firstName: "Integration",
      lastName: "User",
      role: "USER",
    },
  });
  currentUserId = account.id;
  return account;
}

function totpCode(secret) {
  return new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 }).generate();
}

test("ordinary customer login still completes through the real Auth.js credentials parser", async () => {
  const account = await createAccount("ordinary-ceremony@example.test");
  const result = await loginUser({ email: account.email, password: PASSWORD, adminMode: false });
  assert.deepEqual(result, { ok: true, success: true, isAdmin: false });
});

test("real passkey and TOTP ceremonies survive Auth.js serialization and remain single-use", async () => {
  const account = await createAccount("combined-ceremony@example.test");
  const authenticator = await createSoftwareAuthenticator(ORIGIN);

  const registration = await mfaActions.beginPasskeyRegistration();
  assert.equal(registration.ok, true, registration.error);
  const attestation = authenticator.registrationResponse(registration.options);
  const registered = await mfaActions.finishPasskeyRegistration(attestation, "Integration passkey");
  assert.equal(registered.ok, true, registered.error);
  assert.equal(registered.backupCodes.length, 10);

  // This is the reported combined state: an existing passkey plus a new TOTP.
  const setup = await mfaActions.beginTotpSetup();
  assert.equal(setup.ok, true, setup.error);
  assert.match(setup.secret, /^[A-Z2-7]{32}$/);
  assert.match(setup.qrCode, /^data:image\/png;base64,/);
  assert.match(setup.otpauthUri, /^otpauth:\/\/totp\//);
  const pendingSecret = await prisma.user.findUnique({
    where: { id: account.id },
    select: { mfaPendingSecret: true },
  });
  assert.notEqual(pendingSecret.mfaPendingSecret, setup.secret, "the database never stores the raw TOTP secret");

  const enabled = await mfaActions.enableTotp(totpCode(setup.secret));
  assert.equal(enabled.ok, true, enabled.error);
  assert.equal(enabled.backupCodes, undefined, "adding a second factor does not rotate existing backup codes");
  const enabledAccount = await prisma.user.findUnique({
    where: { id: account.id },
    select: { mfaSecret: true, mfaPendingSecret: true },
  });
  assert.ok(enabledAccount.mfaSecret);
  assert.equal(enabledAccount.mfaPendingSecret, null);
  assert.equal(await prisma.mfaBackupCode.count({ where: { userId: account.id } }), 10);

  const passwordStep = await loginUser({ email: account.email, password: PASSWORD, adminMode: false });
  assert.equal(passwordStep.mfaRequired, true);
  assert.equal(passwordStep.hasTotp, true);
  assert.equal(passwordStep.hasPasskeys, true);
  const pending = {
    pendingLoginId: passwordStep.pendingLoginId,
    pendingLoginSecret: passwordStep.pendingLoginSecret,
  };

  const authentication = await mfaActions.getMfaPasskeyOptions(pending.pendingLoginId, pending.pendingLoginSecret);
  assert.equal(authentication.ok, true, authentication.error);
  assert.equal(authentication.options.allowCredentials[0].id, authenticator.id);

  // A wrong origin is still rejected by SimpleWebAuthn and cannot update the counter.
  const wrongOrigin = authenticator.authenticationResponse(authentication.options, 1, { origin: "https://evil.example" });
  const rejected = await loginUser({ ...pending, webAuthnResponse: wrongOrigin });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.mfaRequired, true);
  let credential = await prisma.webAuthnCredential.findUnique({ where: { id: authenticator.id } });
  assert.equal(credential.counter, "0");

  // Malformed passkey input must not fall back to a simultaneously valid TOTP.
  const malformed = await loginUser({
    ...pending,
    mfaCode: totpCode(setup.secret),
    webAuthnResponse: "not-a-webauthn-response",
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.mfaRequired, true);

  // The valid assertion object crosses the same URLSearchParams conversion that
  // previously produced "[object Object]", then is cryptographically verified.
  const assertion = authenticator.authenticationResponse(authentication.options, 1);
  const passkeyLogin = await loginUser({ ...pending, webAuthnResponse: assertion });
  assert.deepEqual(passkeyLogin, { ok: true, success: true, isAdmin: false });
  credential = await prisma.webAuthnCredential.findUnique({ where: { id: authenticator.id } });
  assert.equal(credential.counter, "1");
  assert.ok(credential.lastUsedAt instanceof Date);
  assert.equal(await prisma.pendingLogin.count({ where: { id: pending.pendingLoginId } }), 0);

  const replay = await loginUser({ ...pending, webAuthnResponse: assertion });
  assert.equal(replay.ok, false);
  assert.equal(replay.mfaRequired, undefined);

  // The enabled authenticator also completes a separate real pending login.
  const totpPasswordStep = await loginUser({ email: account.email, password: PASSWORD, adminMode: false });
  assert.equal(totpPasswordStep.mfaRequired, true);
  const totpLogin = await loginUser({
    pendingLoginId: totpPasswordStep.pendingLoginId,
    pendingLoginSecret: totpPasswordStep.pendingLoginSecret,
    mfaCode: totpCode(setup.secret),
  });
  assert.deepEqual(totpLogin, { ok: true, success: true, isAdmin: false });
});

test("parallel authenticator setup keeps one stable secret and accepts the scanned URI code", async () => {
  const account = await createAccount("parallel-totp-ceremony@example.test");
  const setups = await Promise.all(Array.from({ length: 4 }, () => mfaActions.beginTotpSetup()));

  for (const setup of setups) {
    assert.equal(setup.ok, true, setup.error);
    assert.ok(Number.isSafeInteger(setup.setupId));
    assert.ok(setup.setupExpiresIn > 0 && setup.setupExpiresIn <= 10 * 60 * 1000);
  }
  assert.equal(new Set(setups.map((setup) => setup.secret)).size, 1, "every tab must show the currently stored enrollment");
  assert.equal(new Set(setups.map((setup) => setup.setupId)).size, 1, "every tab must confirm the same enrollment");
  const reopened = await mfaActions.beginTotpSetup();
  assert.equal(reopened.ok, true, reopened.error);
  assert.ok(reopened.secret === setups[0].secret, "reopening setup must keep the scanned QR valid");
  assert.equal(reopened.setupId, setups[0].setupId);

  // Parse the exact URI encoded into the QR instead of bypassing it with the raw secret.
  const authenticator = URI.parse(setups[0].otpauthUri);
  assert.ok(authenticator.secret.base32 === setups[0].secret, "QR URI must contain the pending secret");
  assert.equal(authenticator.algorithm, "SHA1");
  assert.equal(authenticator.digits, 6);
  assert.equal(authenticator.period, 30);

  const stale = await mfaActions.enableTotp(authenticator.generate(), setups[0].setupId + 1);
  assert.equal(stale.ok, false);
  assert.equal(stale.failureReason, "stale-setup", "a QR from another enrollment must not be treated as a code mismatch");

  const enabled = await mfaActions.enableTotp(authenticator.generate(), setups[0].setupId);
  assert.equal(enabled.ok, true, enabled.error);
  assert.equal(enabled.backupCodes.length, 10);

  const enabledAccount = await prisma.user.findUnique({
    where: { id: account.id },
    select: { mfaSecret: true, mfaPendingSecret: true },
  });
  assert.ok(enabledAccount.mfaSecret);
  assert.equal(enabledAccount.mfaPendingSecret, null);
});

test("expired authenticator setup has an explicit stale state and can be renewed", async () => {
  const account = await createAccount("expired-totp-ceremony@example.test");
  const setup = await mfaActions.beginTotpSetup();
  assert.equal(setup.ok, true, setup.error);

  await prisma.user.update({
    where: { id: account.id },
    data: { mfaPendingCreatedAt: new Date(Date.now() - 11 * 60 * 1000) },
  });
  const expired = await mfaActions.enableTotp(URI.parse(setup.otpauthUri).generate(), setup.setupId);
  assert.equal(expired.ok, false);
  assert.equal(expired.failureReason, "stale-setup");

  const renewed = await mfaActions.beginTotpSetup();
  assert.equal(renewed.ok, true, renewed.error);
  assert.ok(renewed.secret !== setup.secret, "an expired enrollment must rotate");
  assert.ok(renewed.setupId !== setup.setupId, "renewal must bind the form to the new enrollment");
  const enabled = await mfaActions.enableTotp(URI.parse(renewed.otpauthUri).generate(), renewed.setupId);
  assert.equal(enabled.ok, true, enabled.error);
});
