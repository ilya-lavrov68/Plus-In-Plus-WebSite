const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");

for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) =>
    module._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      filename
    );
}

const messages = require("../messages/en.json");
const tag =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);

let paymentStatus = null;
let paymentConfig = null;
let signatureValid = false;

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next/link") return tag("a");
  if (name === "@/lib/prisma") return { prisma: {
    payment: {
      findFirst: async () => paymentStatus ? { status: paymentStatus } : null,
    },
  } };
  if (name === "@/lib/payments/robokassa-config") {
    return { resolveRobokassaConfig: async () => ({ config: paymentConfig }) };
  }
  if (name === "@/lib/payments/robokassa") {
    return {
      signatureMatches: () => signatureValid,
      successSignature: () => "expected-signature",
    };
  }
  if (name === "@/lib/server-i18n") {
    return {
      getRequestTranslations: async (namespace) => (key) =>
        messages[namespace][key],
    };
  }
  if (name.startsWith("@/")) {
    name = path.resolve(__dirname, "..", name.slice(2));
  }
  return originalLoad.call(this, name, parent, isMain);
};

const PaymentSuccessPage = require("../app/payment/success/page.tsx").default;

const textOf = (node) =>
  node.children
    .map((child) => (typeof child === "string" ? child : textOf(child)))
    .join("");

beforeEach(() => {
  paymentStatus = null;
  paymentConfig = null;
  signatureValid = false;
});

test("payment success renders two independent Radix Slot actions without crashing", async () => {
  const page = await PaymentSuccessPage({
    searchParams: Promise.resolve({}),
  });
  let view;
  act(() => {
    view = create(page);
  });

  const actions = view.root
    .findAllByType("a")
    .filter((link) => ["/orders", "/"].includes(link.props.href));
  assert.deepEqual(
    actions.map((link) => ({ href: link.props.href, text: textOf(link) })),
    [
      { href: "/orders", text: "My orders" },
      { href: "/", text: "Back to the homepage" },
    ]
  );
  for (const action of actions) {
    assert.equal(action.props["data-slot"], "button");
  }
  assert.match(textOf(view.root), /Payment is not confirmed yet/);
  act(() => view.unmount());
});

test("unsigned return never displays paid, while a signed return can show the stored payment", async () => {
  paymentStatus = "succeeded";
  paymentConfig = { merchantLogin: "shop" };
  const query = {
    OutSum: "100.00",
    InvId: "7000",
    SignatureValue: "forged",
    shp_OrderId: "ord-7",
  };
  const unsignedPage = await PaymentSuccessPage({ searchParams: Promise.resolve(query) });
  let unsignedView;
  act(() => {
    unsignedView = create(unsignedPage);
  });
  const unsignedText = textOf(unsignedView.root);
  assert.match(unsignedText, /Payment is not confirmed yet/);
  assert.match(unsignedText, /could not verify this return link/);
  assert.doesNotMatch(unsignedText, /Thank you, the payment went through/);
  act(() => unsignedView.unmount());

  signatureValid = true;
  const signedPage = await PaymentSuccessPage({ searchParams: Promise.resolve(query) });
  let signedView;
  act(() => {
    signedView = create(signedPage);
  });
  assert.match(textOf(signedView.root), /Thank you, the payment went through/);
  act(() => signedView.unmount());
});
