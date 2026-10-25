const assert = require("node:assert/strict");
const { test } = require("node:test");
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
      filename,
    );
}

function RichTextEditorDouble({ name, initialValue = "", canvaInsertion }) {
  const [html, setHtml] = React.useState(initialValue);
  React.useEffect(() => {
    if (canvaInsertion) {
      setHtml((current) => `${current}<iframe src="${canvaInsertion.url}"></iframe>`);
    }
  }, [canvaInsertion]);
  return React.createElement("textarea", {
    "data-rich-editor": true,
    name,
    value: html,
    onChange: (event) => setHtml(event.target.value),
  });
}

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next-intl") {
    return {
      useTranslations: () => (key, values = {}) =>
        `${key}${values.name ? `:${values.name}` : ""}`,
    };
  }
  if (name === "lucide-react") {
    return new Proxy({}, { get: () => (props) => React.createElement("svg", props) });
  }
  if (name === "@/components/admin/lazy-rich-text-editor") {
    return { LazyRichTextEditor: RichTextEditorDouble };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { PostContentEditor } = require("../components/admin/post-content-editor.tsx");

const textOf = (node) =>
  node.children
    .map((child) => (typeof child === "string" ? child : textOf(child)))
    .join("");

function button(view, label) {
  return view.root.findAllByType("button").find((node) => textOf(node).includes(label));
}

function renderEditor(initialContent) {
  const textareaNode = {
    style: {},
    scrollHeight: 0,
    selectionStart: 0,
    selectionEnd: 0,
    focus() {},
    setSelectionRange(start) {
      this.selectionStart = start;
      this.selectionEnd = start;
    },
  };
  let view;
  act(() => {
    view = create(React.createElement(PostContentEditor, { initialContent }), {
      createNodeMock: (element) => {
        if (element.type === "textarea" && element.props.id === "post-content-markdown") {
          return textareaNode;
        }
        if (element.type === "input" && element.props.type === "file") {
          return { click() {} };
        }
        return {};
      },
    });
  });
  return { view, textareaNode };
}

async function importFile(view, file) {
  const input = view.root.findAllByType("input").find((node) => node.props.type === "file");
  const event = { currentTarget: { files: [file], value: "selected" } };
  await act(async () => {
    await input.props.onChange(event);
  });
  assert.equal(event.currentTarget.value, "", "the same file can be imported again");
}

test("Markdown import preserves the inactive rich-text draft and both modes survive switching", async () => {
  const { view } = renderEditor("<p>Initial rich draft</p>");
  const rich = view.root.findByProps({ "data-rich-editor": true });
  act(() => rich.props.onChange({ target: { value: "<p>Edited rich draft</p>" } }));

  await importFile(view, {
    name: "article.md",
    text: async () => "\uFEFF## Imported\r\n\r\nAuthor body.\r\n",
  });
  const markdown = view.root.findByProps({ id: "post-content-markdown" });
  assert.equal(markdown.props.value, "## Imported\n\nAuthor body.");
  assert.equal(markdown.props.name, "content");
  assert.equal(rich.props.name, undefined);
  assert.equal(rich.props.value, "<p>Edited rich draft</p>");
  assert.equal(view.root.findByProps({ name: "contentFormat" }).props.value, "markdown");

  act(() => button(view, "form.richMode").props.onClick());
  assert.equal(rich.props.value, "<p>Edited rich draft</p>");
  assert.equal(rich.props.name, "content");
  assert.equal(markdown.props.name, undefined);
  act(() => button(view, "form.markdownMode").props.onClick());
  assert.equal(markdown.props.value, "## Imported\n\nAuthor body.");
  act(() => view.unmount());
});

test("Canva is inserted at the Markdown cursor with a normalized URL", () => {
  const { view, textareaNode } = renderEditor("<!-- pip:markdown -->\n# Title\n\nBody");
  const markdown = view.root.findByProps({ id: "post-content-markdown" });
  assert.equal(markdown.props.value, "# Title\n\nBody");
  textareaNode.selectionStart = 9;
  textareaNode.selectionEnd = 9;
  const input = view.root.findByProps({ id: "post-canva-url" });
  act(() => input.props.onChange({ target: { value: "https://canva.com/design/ABC_123/view?utm=1" } }));
  act(() => button(view, "form.insertCanva").props.onClick());

  assert.equal(
    markdown.props.value,
    "# Title\n\n:::canva\nhttps://www.canva.com/design/ABC_123/view?embed\n:::\n\nBody",
  );
  assert.equal(input.props.value, "");
  act(() => view.unmount());
});

test("invalid embeds, wrong file extensions and oversized Markdown do not replace the draft", async () => {
  const { view } = renderEditor("<!-- pip:markdown -->\nOriginal draft");
  const markdown = view.root.findByProps({ id: "post-content-markdown" });
  const canvaInput = view.root.findByProps({ id: "post-canva-url" });
  act(() => canvaInput.props.onChange({ target: { value: "https://evil.example/embed" } }));
  act(() => button(view, "form.insertCanva").props.onClick());
  assert.equal(markdown.props.value, "Original draft");
  assert.match(textOf(view.root), /form.canvaInvalid/);

  let read = false;
  await importFile(view, { name: "article.txt", text: async () => { read = true; return "bad"; } });
  assert.equal(read, false);
  assert.equal(markdown.props.value, "Original draft");
  await importFile(view, { name: "article.md", text: async () => "x".repeat(100_001) });
  assert.equal(markdown.props.value, "Original draft");
  assert.match(textOf(view.root), /form.markdownTooLong/);
  act(() => view.unmount());
});
