const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");

const SessionContext = React.createContext(null);
const TabsContext = React.createContext(null);
const NativeFormData = global.FormData;

global.FormData = class extends NativeFormData {
  constructor(source) {
    super();
    if (source && typeof source.entries === "function") {
      for (const [key, value] of source.entries()) this.append(key, value);
    }
  }
};

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

let initialSession,
  nextSession,
  setSession,
  calls,
  pushes,
  replacements,
  openChanges,
  loginResult,
  registerResult,
  profileResult;

const profile = {
  id: "mock-only",
  email: "person@example.com",
  firstName: "First",
  lastName: "Last",
  avatar: null,
  role: "USER",
};

const tag =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next-intl") return require("./next-intl-stub.cjs");
  if (name === "next-intl/server") return require("./next-intl-stub.cjs");
  if (name === "next/link") return tag("a");
  if (name === "next/image") return (props) => React.createElement("img", props);
  if (name === "next/navigation") {
    return {
      useRouter: () => ({
        push: (p) => pushes.push(p),
        replace: (p) => replacements.push(p),
        refresh() {},
      }),
      usePathname: () => "/",
    };
  }
  if (name === "next-auth/react") {
    return {
      useSession: () => React.useContext(SessionContext),
      signOut: async () => {
        calls.push(["signOut"]);
        setSession(null);
      },
    };
  }
  if (name === "@/app/actions/auth") {
    return {
      loginUser: async (input) => {
        calls.push(["login", input]);
        return loginResult;
      },
      registerUser: async (input) => {
        calls.push(["register", input]);
        return registerResult;
      },
      updateUserProfile: async (input) => {
        calls.push(["profile", input]);
        return profileResult;
      },
      logout: async () => {
        calls.push(["logout"]);
        return { ok: true, success: true };
      },
    };
  }
  if (name === "@/app/actions/mfa") {
    return {
      getMfaPasskeyOptions: async () => ({ ok: false, error: "MFA is not configured in this component test." }),
    };
  }
  if (name === "@/app/actions/user") {
    return {
      updateUserProfile: async (input) => {
        calls.push(["profile-page", input]);
        return profileResult;
      },
      changePassword: async (input) => {
        calls.push(["change-password", input]);
        return { ok: true };
      },
    };
  }
  if (name === "@/components/ui/use-toast") {
    return { toast() {} };
  }
  if (name === "@/components/ui/dialog") {
    return {
      Dialog: ({ open, children }) =>
        open ? React.createElement(React.Fragment, null, children) : null,
      DialogContent: tag("section"),
      DialogHeader: tag("div"),
      DialogTitle: tag("h2"),
      DialogDescription: tag("p"),
    };
  }
  if (name === "@/components/ui/tabs") {
    return {
      Tabs: ({ value, onValueChange, children }) =>
        React.createElement(
          TabsContext.Provider,
          { value: { value, onValueChange } },
          children
        ),
      TabsList: tag("div"),
      TabsTrigger: ({ value, children, ...props }) => {
        const tabs = React.useContext(TabsContext);
        return React.createElement(
          "button",
          { ...props, role: "tab", onClick: () => tabs.onValueChange(value) },
          children
        );
      },
      TabsContent: ({ value, children }) =>
        React.useContext(TabsContext).value === value ? children : null,
    };
  }
  if (name === "@/components/ui/switch") {
    return {
      Switch: ({ checked, onCheckedChange, ...props }) =>
        React.createElement("button", {
          ...props,
          role: "switch",
          "aria-checked": checked,
          onClick: () => onCheckedChange(!checked),
        }),
    };
  }
  if (name === "motion/react") {
    return {
      motion: new Proxy(
        {},
        {
          get: (_target, prop) => tag(String(prop)),
        }
      ),
      AnimatePresence: ({ children }) => children,
      MotionConfig: ({ children }) => children,
      useReducedMotion: () => false,
    };
  }
  if (name.startsWith("@/")) {
    name = path.resolve(__dirname, "..", name.slice(2));
  }
  return originalLoad.call(this, name, parent, isMain);
};

const { AccountModal } = require("../components/site/account-modal.tsx");
const { Signup10 } = require("../components/blocks/signup10.tsx");
const { ProfileForm } = require("../components/site/profile-form.tsx");
const { UserAvatar } = require("../components/site/user-avatar.tsx");
const LoginPage = require("../app/(site)/login/page.tsx").default;

beforeEach(() => {
  initialSession = null;
  nextSession = { user: { ...profile } };
  calls = [];
  pushes = [];
  replacements = [];
  openChanges = [];
  loginResult = { ok: true, success: true, isAdmin: false };
  registerResult = { ok: true, success: true, isAdmin: false };
  profileResult = { ok: true, success: true };
  global.window = {
    scrollY: 0,
    addEventListener() {},
    removeEventListener() {},
  };
  global.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  };
});

function Harness({ children }) {
  const [session, change] = React.useState(initialSession);
  setSession = change;
  const update = async () => {
    change(nextSession);
    return nextSession;
  };
  return React.createElement(
    SessionContext.Provider,
    {
      value: {
        data: session,
        status: session ? "authenticated" : "unauthenticated",
        update,
      },
    },
    children
  );
}

function mount(child) {
  let view;
  act(() => {
    view = create(React.createElement(Harness, null, child));
  });
  return view;
}

const content = (node) =>
  node.children
    .map((child) => (typeof child === "string" ? child : content(child)))
    .join("");
const button = (view, label) =>
  view.root.findAllByType("button").find((node) => content(node) === label);
const alert = (view) =>
  view.root
    .findAll((n) => n.type === "p" && n.props.role === "alert")
    .map(content)
    .join(" ");
const modal = () =>
  React.createElement(AccountModal, {
    open: true,
    onOpenChange: (value) => openChanges.push(value),
  });

async function submit(view, label, fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  await act(async () => {
    await view.root
      .findByProps({ "aria-label": label })
      .props.onSubmit({ preventDefault() {}, currentTarget: form });
  });
}

test("Signup10 switches Log in / Register modes with Admin mode only on Log in", async () => {
  const view = mount(React.createElement(Signup10, { defaultMode: "login" }));
  // Режим переключается вкладками Log in / Register.
  assert.equal(view.root.findAllByProps({ role: "tablist" }).length, 1);
  const tabs = view.root.findAllByProps({ role: "tab" });
  assert.equal(tabs.length, 2);
  assert.deepEqual(tabs.map((tab) => tab.props["aria-selected"]), [true, false]);
  assert.deepEqual(
    view.root.findAllByType("input").map((node) => node.props.name),
    ["email", "password"]
  );
  assert.equal(
    view.root.findAllByProps({ role: "switch" }).length,
    1,
    "admin mode is offered on the login form only"
  );

  act(() => tabs[1].props.onClick());
  assert.equal(view.root.findAllByProps({ role: "switch" }).length, 0);
  assert.deepEqual(
    view.root.findAllByType("input").map((node) => node.props.name),
    ["firstName", "lastName", "email", "password", "confirmPassword"]
  );
  act(() => view.unmount());
});

test("Signup10 applies the same 12-character password policy as the server", async () => {
  const view = mount(React.createElement(Signup10, { defaultMode: "register" }));
  const values = {
    firstName: "First",
    lastName: "Last",
    email: "person@example.com",
    password: "ten-chars!",
    confirmPassword: "ten-chars!",
  };
  for (const [name, value] of Object.entries(values)) {
    act(() => view.root.findByProps({ name }).props.onChange({ target: { value } }));
  }
  await act(async () => {
    await view.root
      .findByProps({ "aria-label": "Register" })
      .props.onSubmit({ preventDefault() {} });
  });
  assert.match(alert(view), /at least 12 characters/);
  assert.equal(calls.some(([name]) => name === "register"), false);
  act(() => view.unmount());
});

test("Staff sign-in can be preselected without changing the two-mode login flow", async () => {
  const page = await LoginPage({ searchParams: Promise.resolve({ mode: "admin" }) });
  // Страница обёрнута в MotionPreference (локальная политика анимаций).
  const signup = page.props.children;
  assert.equal(signup.type, Signup10);
  assert.equal(signup.props.defaultAdminMode, true);
  assert.equal(signup.props.defaultMode, "login");

  const view = mount(page);
  assert.equal(view.root.findByProps({ role: "switch" }).props["aria-checked"], true);
  await submit(view, "Log in", {
    email: profile.email,
    password: "valid-passphrase",
  });
  assert.equal(calls[0][0], "login");
  assert.equal(calls[0][1].adminMode, true);
  act(() => view.unmount());
});

test("AccountModal Admin mode defaults off, highlights with semantic tokens, and resets on Register", () => {
  const view = mount(modal());
  const toggle = view.root.findByProps({ role: "switch" });
  assert.equal(toggle.props["aria-checked"], false);
  act(() => toggle.props.onClick());
  assert.equal(view.root.findByProps({ role: "switch" }).props["aria-checked"], true);
  assert.ok(
    view.root
      .findAllByType("div")
      .some((n) => n.props.className?.includes("bg-secondary")),
    "включённый режим админа подсвечивается подложкой, а не обводкой",
  );
  act(() => button(view, "Register").props.onClick());
  assert.equal(view.root.findAllByProps({ role: "switch" }).length, 0);
  assert.deepEqual(
    view.root.findAllByType("input").map((n) => n.props.name),
    ["firstName", "lastName", "email", "password", "confirmPassword"]
  );
  act(() => button(view, "Log in").props.onClick());
  assert.equal(view.root.findByProps({ role: "switch" }).props["aria-checked"], false);
  act(() => view.unmount());
});

test("mismatched passwords fail client check before calling registerUser", async () => {
  const view = mount(modal());
  act(() => button(view, "Don't have an account? Register").props.onClick());
  await submit(view, "Register", {
    firstName: "First",
    lastName: "Last",
    email: "person@example.com",
    password: "valid-passphrase",
    confirmPassword: "different",
  });
  assert.match(alert(view), /Passwords do not match/);
  assert.equal(calls.length, 0);
  act(() => view.unmount());
});

test("admin login redirects to /admin while ordinary login stays on page", async () => {
  let view = mount(modal());
  await submit(view, "Log in", {
    email: profile.email,
    password: "valid-passphrase",
  });
  assert.equal(calls[0][1].adminMode, false);
  assert.equal(pushes.length, 0);
  assert.deepEqual(openChanges, [false]);
  act(() => view.unmount());

  openChanges = [];
  view = mount(modal());
  loginResult = {
    ok: true,
    success: true,
    isAdmin: true,
    redirectTo: "/admin",
  };
  nextSession = { user: { ...profile, role: "ADMIN" } };
  act(() => view.root.findByProps({ role: "switch" }).props.onClick());
  await submit(view, "Log in", {
    email: profile.email,
    password: "valid-passphrase",
  });
  assert.equal(calls.at(-1)[1].adminMode, true);
  assert.deepEqual(pushes, ["/admin"]);
  act(() => view.unmount());
});

test("authenticated account dialog exposes the customer session and logs out", async () => {
  initialSession = { user: { ...profile } };
  const view = mount(modal());
  assert.match(content(view.root), /Customer session/);

  await act(async () => {
    await button(view, "Log out").props.onClick();
  });
  assert.ok(calls.some(([name]) => name === "logout"));
  assert.deepEqual(openChanges, [false]);
  act(() => view.unmount());
});

test("profile distinguishes account role from session mode and offers staff reauthentication only when needed", () => {
  initialSession = { user: { ...profile } };
  let view = mount(
    React.createElement(ProfileForm, {
      sessionRole: "USER",
      initialUser: { ...profile, role: "FOUNDER" },
    })
  );
  assert.match(content(view.root), /Account role: FOUNDER/);
  assert.match(content(view.root), /Customer session/);
  assert.match(content(view.root), /Staff tools require a separate sign-in/);
  assert.ok(view.root.findAllByType("a").some((link) => link.props.href === "/login?mode=admin"));
  act(() => view.unmount());

  view = mount(
    React.createElement(ProfileForm, {
      sessionRole: "USER",
      initialUser: { ...profile, role: "USER" },
    })
  );
  assert.doesNotMatch(content(view.root), /Staff tools require a separate sign-in/);
  act(() => view.unmount());

  initialSession = { user: { ...profile, role: "FOUNDER" } };
  view = mount(
    React.createElement(ProfileForm, {
      sessionRole: "FOUNDER",
      initialUser: { ...profile, role: "FOUNDER" },
    })
  );
  assert.match(content(view.root), /Staff session/);
  assert.doesNotMatch(content(view.root), /Staff tools require a separate sign-in/);
  act(() => view.unmount());
});

test("profile password form submits only password fields and signs out after success", async () => {
  initialSession = { user: { ...profile } };
  const view = mount(React.createElement(ProfileForm, {
    sessionRole: "USER",
    initialUser: profile,
  }));
  const values = {
    "current-password": "current-password",
    "new-password": "a-new-long-passphrase",
    "confirm-new-password": "a-new-long-passphrase",
  };
  for (const [id, value] of Object.entries(values)) {
    act(() => view.root.findByProps({ id }).props.onChange({ target: { value } }));
  }
  await act(async () => {
    await view.root.findAllByType("form")[1].props.onSubmit({ preventDefault() {} });
  });
  assert.deepEqual(calls.find(([name]) => name === "change-password"), [
    "change-password",
    {
      currentPassword: "current-password",
      newPassword: "a-new-long-passphrase",
      confirmPassword: "a-new-long-passphrase",
    },
  ]);
  assert.ok(calls.some(([name]) => name === "signOut"));
  assert.ok(pushes.includes("/login"));
  act(() => view.unmount());
});

test("avatars use initials, refuse external services, and recover when local file fails", () => {
  let view;
  act(() => {
    view = create(
      React.createElement(UserAvatar, {
        user: { ...profile, avatar: "https://gravatar.com/avatar/test" },
      })
    );
  });
  assert.equal(view.root.findAllByType("img").length, 0);
  assert.equal(content(view.root), "FL");
  const local = "/uploads/avatars/11111111-1111-4111-a111-111111111111.webp";
  act(() =>
    view.update(
      React.createElement(UserAvatar, { user: { ...profile, avatar: local } })
    )
  );
  act(() => view.root.findByType("img").props.onError());
  assert.equal(view.root.findAllByType("img").length, 0);
  assert.equal(content(view.root), "FL");
  act(() => view.unmount());
});
