const crypto = require("node:crypto");

const base64url = (value) => Buffer.from(value).toString("base64url");

function counterBytes(counter) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(counter, 0);
  return bytes;
}

/**
 * A local ES256 authenticator for integration tests only. It produces real
 * WebAuthn payloads and signatures; SimpleWebAuthn still verifies challenge,
 * origin, RP ID, flags, COSE key and counter exactly as it does in production.
 * This is not evidence from a physical/platform authenticator.
 */
async function createSoftwareAuthenticator(origin) {
  const { isoCBOR } = await import("@simplewebauthn/server/helpers");
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const credentialId = crypto.randomBytes(32);
  const id = base64url(credentialId);

  return {
    id,
    registrationResponse(options) {
      const clientDataJSON = base64url(JSON.stringify({
        type: "webauthn.create",
        challenge: options.challenge,
        origin,
        crossOrigin: false,
      }));
      const cosePublicKey = isoCBOR.encode(new Map([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, Buffer.from(jwk.x, "base64url")],
        [-3, Buffer.from(jwk.y, "base64url")],
      ]));
      const rpIdHash = crypto.createHash("sha256").update(options.rp.id).digest();
      const authData = Buffer.concat([
        rpIdHash,
        Buffer.from([0x45]), // UP + UV + attested credential data
        counterBytes(0),
        Buffer.alloc(16), // AAGUID (none attestation)
        counterBytes(credentialId.length).subarray(2),
        credentialId,
        Buffer.from(cosePublicKey),
      ]);
      const attestationObject = isoCBOR.encode(new Map([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]));
      return {
        id,
        rawId: id,
        type: "public-key",
        response: {
          clientDataJSON,
          attestationObject: base64url(attestationObject),
          transports: ["internal"],
        },
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
      };
    },
    authenticationResponse(options, counter = 1, overrides = {}) {
      const clientDataJSON = Buffer.from(JSON.stringify({
        type: "webauthn.get",
        challenge: overrides.challenge ?? options.challenge,
        origin: overrides.origin ?? origin,
        crossOrigin: false,
      }));
      const rpIdHash = crypto.createHash("sha256").update(overrides.rpId ?? options.rpId).digest();
      const authData = Buffer.concat([
        rpIdHash,
        Buffer.from([0x05]), // UP + UV
        counterBytes(counter),
      ]);
      const clientDataHash = crypto.createHash("sha256").update(clientDataJSON).digest();
      const signature = crypto.sign("sha256", Buffer.concat([authData, clientDataHash]), privateKey);
      return {
        id,
        rawId: id,
        type: "public-key",
        response: {
          clientDataJSON: base64url(clientDataJSON),
          authenticatorData: base64url(authData),
          signature: base64url(signature),
          userHandle: null,
        },
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
      };
    },
  };
}

module.exports = { createSoftwareAuthenticator };
