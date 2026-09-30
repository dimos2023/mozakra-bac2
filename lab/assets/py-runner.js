/* ===================================================
   مشغّل بايثون المشترك (Pyodide) — بيستخدمه معمل بايثون ومعمل فحص HTTPS
   محتاج قبله: https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js
   =================================================== */

const PY_HARNESS = `
import sys, io, traceback, json, hashlib

def __friendly(e, tb):
    if isinstance(e, SyntaxError):
        return f"❌ خطأ في كتابة الكود (SyntaxError) في السطر {e.lineno}: {e.msg}"
    line = None
    for fr in traceback.extract_tb(tb):
        if fr.filename == "<code>":
            line = fr.lineno
    where = f" في السطر {line}" if line else ""
    return f"❌ {type(e).__name__}{where}: {e}"

def __same(got, expected):
    is_num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)
    return (type(got) == type(expected) or (is_num(got) and is_num(expected))) and got == expected

def __run(code, tests_json):
    buf = io.StringIO()
    old = (sys.stdout, sys.stderr)
    sys.stdout = sys.stderr = buf
    res = {"err": None, "tests": []}
    ns = {"__name__": "__main__"}
    try:
        exec(compile(code, "<code>", "exec"), ns)
        for call, exp_src in json.loads(tests_json):
            expected = eval(exp_src, {"hashlib": hashlib})
            try:
                got = eval(call, ns)
                res["tests"].append({"call": call, "expected": repr(expected), "got": repr(got), "ok": __same(got, expected)})
            except Exception as e:
                res["tests"].append({"call": call, "expected": repr(expected), "got": f"{type(e).__name__}: {e}", "ok": False})
    except Exception as e:
        res["err"] = __friendly(e, e.__traceback__)
    finally:
        sys.stdout, sys.stderr = old
    res["out"] = buf.getvalue()
    return json.dumps(res, ensure_ascii=False)

def __eval(code, expr, vars_json):
    """ينفذ كود الطالب، وبعدين يحسب تعبير واحد بمتغيرات جاية من JavaScript"""
    buf = io.StringIO()
    old = (sys.stdout, sys.stderr)
    sys.stdout = sys.stderr = buf
    res = {"err": None, "value": None}
    ns = {"__name__": "__main__"}
    try:
        exec(compile(code, "<code>", "exec"), ns)
        ns.update(json.loads(vars_json))
        res["value"] = eval(expr, ns)
        json.dumps(res["value"])  # لازم الناتج يبقى قابل للتحويل
    except TypeError:
        res["value"] = repr(res["value"])
    except Exception as e:
        res["err"] = __friendly(e, e.__traceback__)
    finally:
        sys.stdout, sys.stderr = old
    res["out"] = buf.getvalue()
    return json.dumps(res, ensure_ascii=False)
`;

const PyRunner = {
  py: null,
  async load() {
    this.py = await loadPyodide();
    this.py.runPython(PY_HARNESS);
    return this;
  },
  _call(fn, ...args) {
    const f = this.py.globals.get(fn);
    try { return JSON.parse(f(...args)); } finally { f.destroy(); }
  },
  // يشغّل الكود ويختبره: tests = [[call, expected_python_source], ...]
  run(code, tests = []) { return this._call('__run', code, JSON.stringify(tests)); },
  // يشغّل الكود ويرجّع قيمة تعبير: vars = متغيرات بتتحط قبل التقييم
  evaluate(code, expr, vars = {}) { return this._call('__eval', code, expr, JSON.stringify(vars)); },
};

// جدول نتايج الاختبارات
function renderTestsTable(tests) {
  return `<table class="ltr"><thead><tr><th>الاختبار</th><th>المتوقع</th><th>الناتج</th><th></th></tr></thead><tbody>${
    tests.map(t => `<tr><td><code>${escapeHtml(t.call)}</code></td><td><code>${escapeHtml(t.expected)}</code></td>
      <td><code>${escapeHtml(t.got)}</code></td><td>${t.ok ? '✅' : '❌'}</td></tr>`).join('')}</tbody></table>`;
}

// Tab = مسافات في محرر الكود
function tabIndent(textarea, spaces = 4) {
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      textarea.setRangeText(' '.repeat(spaces), textarea.selectionStart, textarea.selectionEnd, 'end');
      textarea.dispatchEvent(new Event('input'));
    }
  });
}
