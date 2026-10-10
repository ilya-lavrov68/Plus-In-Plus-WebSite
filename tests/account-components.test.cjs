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
// Supply form contents without a browser DOM. Runtime server/action tests use native FormData.
global.FormData = class extends NativeFormData {
  constructor(source) { super(); if (source) for (const [key, value] of source.entries()) this.append(key, value); }
};
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let initialSession, nextSession, setSession, calls, pushes, replacements, loginResult, registerResult, profileResult;
const profile = { id: "mock-only", email: "person@example.com", firstName: "First", lastName: "Last", avatar: null, role: "USER" };
const tag = (name) => ({ children, ...props }) => React.createElement(name, props, children);
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next/link") return tag("a");
  if (name === "next/image") return (props) => React.createElement("img", props);
  if (name === "next/navigation") return { useRouter: () => ({ push: (p) => pushes.push(p), replace: (p) => replacements.push(p), refresh() {} }), usePathname: () => "/" };
  if (name === "next-auth/react") return { useSession: () => React.useContext(SessionContext), signOut: async () => { setSession(null); } };
  if (name === "@/app/actions/auth") return {
    loginUser: async (input) => { calls.push(["login", input]); return loginResult; },
    registerUser: async (input) => { calls.push(["register", input]); return registerResult; },
    updateUserProfile: async (input) => { calls.push(["profile", input]); return profileResult; },
    logout: async () => { calls.push(["logout"]); return { ok: true }; },
  };
  if (name === "@/components/ui/dialog") return {
    Dialog: ({ open, children }) => open ? React.createElement(React.Fragment, null, children) : null,
    DialogContent: tag("section"), DialogHeader: tag("div"), DialogTitle: tag("h2"), DialogDescription: tag("p"),
  };
  if (name === "@/components/ui/tabs") return {
    Tabs: ({ value, onValueChange, children }) => React.createElement(TabsContext.Provider, { value: { value, onValueChange } }, children),
    TabsList: tag("div"),
    TabsTrigger: ({ value, children, ...props }) => { const tabs = React.useContext(TabsContext); return React.createElement("button", { ...props, role: "tab", onClick: () => tabs.onValueChange(value) }, children); },
    TabsContent: ({ value, children }) => React.useContext(TabsContext).value === value ? children : null,
  };
  if (name === "@/components/ui/switch") return { Switch: ({ checked, onCheckedChange, ...props }) => React.createElement("button", { ...props, role: "switch", "aria-checked": checked, onClick: () => onCheckedChange(!checked) }) };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};
const { AccountModal } = require("../components/site/account-modal.tsx");
const { Header } = require("../components/site/header.tsx");
const { UserAvatar } = require("../components/site/user-avatar.tsx");

beforeEach(() => {
  initialSession = null; nextSession = { user: { ...profile } }; calls = []; pushes = []; replacements = [];
  loginResult = { ok: true }; registerResult = { ok: true }; profileResult = { ok: true };
  global.window = { scrollY: 0, addEventListener() {}, removeEventListener() {} };
  // The header's navigation dropdowns (Radix menu) attach document listeners on mount.
  global.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
});
function Harness({ children }) {
  const [session, change] = React.useState(initialSession); setSession = change;
  const update = async () => { change(nextSession); return nextSession; };
  return React.createElement(SessionContext.Provider, { value: { data: session, status: session ? "authenticated" : "unauthenticated", update } }, children);
}
function mount(child) { let view; act(() => { view = create(React.createElement(Harness, null, child)); }); return view; }
const content = (node) => node.children.map((child) => typeof child === "string" ? child : content(child)).join("");
const button = (view, label) => view.root.findAllByType("button").find((node) => content(node) === label);
const alert = (view) => view.root.findAll((n) => n.type === "p" && n.props.role === "alert").map(content).join(" ");
const modal = () => React.createElement(AccountModal, { open: true, onOpenChange() {} });
async function submit(view, label, fields) {
  const form = new FormData(); for (const [key, value] of Object.entries(fields)) form.set(key, value);
  await act(async () => { await view.root.findByProps({ "aria-label": label }).props.onSubmit({ preventDefault() {}, currentTarget: form }); });
}

test("Admin mode defaults off, highlights on, and disappears/reset on Register", () => {
  const view = mount(modal());
  let toggle = view.root.findByProps({ role: "switch" });
  assert.equal(toggle.props["aria-checked"], false);
  act(() => toggle.props.onClick());
  assert.equal(view.root.findByProps({ role: "switch" }).props["aria-checked"], true);
  assert.ok(view.root.findAllByType("div").some((n) => n.props.className?.includes("border-[#397248]")));
  act(() => button(view, "Register").props.onClick());
  assert.equal(view.root.findAllByProps({ role: "switch" }).length, 0);
  assert.deepEqual(view.root.findAllByType("input").map((n) => n.props.name), ["firstName", "lastName", "email", "password", "confirmPassword"]);
  act(() => button(view, "Log in").props.onClick());
  assert.equal(view.root.findByProps({ role: "switch" }).props["aria-checked"], false);
  act(() => view.unmount());
});

test("the registration link switches tabs and mismatched passwords never reach the action", async () => {
  const view = mount(modal());
  act(() => button(view, "Don't have an account? Register").props.onClick());
  await submit(view, "Register", { firstName: "First", lastName: "Last", email: "person@example.com", password: "valid-passphrase", confirmPassword: "different" });
  assert.match(alert(view), /Passwords do not match/); assert.equal(calls.length, 0);
  act(() => view.unmount());
});

test("successful registration stays in the dialog and shows the authenticated profile", async () => {
  const view = mount(modal());
  act(() => button(view, "Register").props.onClick());
  await submit(view, "Register", { firstName: "First", lastName: "Last", email: "person@example.com", password: "valid-passphrase", confirmPassword: "valid-passphrase" });
  assert.equal(calls[0][0], "register");
  assert.equal("adminMode" in calls[0][1], false); assert.equal("role" in calls[0][1], false);
  assert.ok(button(view, "Edit profile")); assert.ok(button(view, "Log out"));
  assert.equal(view.root.findAllByProps({ role: "switch" }).length, 0);
  assert.equal(pushes.length, 0);
  assert.match(content(view.root), /First Last/);
  act(() => view.unmount());
});

test("ordinary login shows the profile, while explicit admin login redirects", async () => {
  let view = mount(modal());
  await submit(view, "Log in", { email: profile.email, password: "valid-passphrase" });
  assert.equal(calls[0][1].adminMode, false); assert.ok(button(view, "Edit profile")); assert.equal(pushes.length, 0);
  act(() => view.unmount());
  view = mount(modal()); loginResult = { ok: true, redirectTo: "/admin/dashboard" };
  nextSession = { user: { ...profile, role: "ADMIN" } };
  act(() => view.root.findByProps({ role: "switch" }).props.onClick());
  await submit(view, "Log in", { email: profile.email, password: "valid-passphrase" });
  assert.equal(calls.at(-1)[1].adminMode, true); assert.deepEqual(pushes, ["/admin/dashboard"]);
  act(() => view.unmount());
});

test("failed admin lookup shows the server message without changing the session", async () => {
  loginResult = { ok: false, error: "Admin account not found. Please log in as a regular user." };
  const view = mount(modal());
  act(() => view.root.findByProps({ role: "switch" }).props.onClick());
  await submit(view, "Log in", { email: profile.email, password: "valid-passphrase" });
  assert.equal(alert(view), loginResult.error); assert.equal(pushes.length, 0);
  assert.equal(view.root.findAllByType("input").length, 2);
  act(() => view.unmount());
});

test("header opens the same profile dialog and profile save refreshes both avatars and names", async () => {
  initialSession = { user: { ...profile } };
  const view = mount(React.createElement(Header));
  act(() => view.root.findByProps({ "aria-label": "Open account" }).props.onClick());
  assert.ok(button(view, "Edit profile"));
  assert.equal(view.root.findAllByType(UserAvatar).length, 2);
  assert.deepEqual(view.root.findAllByType(UserAvatar).map((n) => n.props.size ?? 64), [36, 64]);
  act(() => button(view, "Edit profile").props.onClick());
  const avatar = "/uploads/avatars/11111111-1111-4111-a111-111111111111.webp";
  nextSession = { user: { ...profile, firstName: "Changed", avatar } };
  const file = new File(["local-only"], "photo.png", { type: "image/png" });
  await submit(view, "Edit profile", { firstName: "Changed", lastName: "Last", avatar: file });
  assert.equal(calls[0][0], "profile"); assert.equal(calls[0][1].get("avatar").name, "photo.png");
  assert.match(content(view.root), /Changed Last/);
  assert.equal(view.root.findAllByType("img").filter((n) => n.props.src === avatar).length, 2);
  assert.ok(view.root.findAllByProps({ role: "status" }).some((n) => content(n) === "Profile updated."));
  await act(async () => { await button(view, "Log out").props.onClick(); });
  assert.equal(calls.at(-1)[0], "logout");
  assert.ok(view.root.findByProps({ "aria-label": "Log in", "aria-haspopup": "dialog" }));
  act(() => view.unmount());
});

test("avatars use initials, refuse external services, and recover when the local file is missing", () => {
  let view;
  act(() => { view = create(React.createElement(UserAvatar, { user: { ...profile, avatar: "https://gravatar.com/avatar/test" } })); });
  assert.equal(view.root.findAllByType("img").length, 0); assert.equal(content(view.root), "FL");
  const local = "/uploads/avatars/11111111-1111-4111-a111-111111111111.webp";
  act(() => view.update(React.createElement(UserAvatar, { user: { ...profile, avatar: local } })));
  act(() => view.root.findByType("img").props.onError());
  assert.equal(view.root.findAllByType("img").length, 0); assert.equal(content(view.root), "FL");
  act(() => view.unmount());
});
