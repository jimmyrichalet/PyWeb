/* PyPad — exécution de Python (Pyodide) dans un Web Worker.
   Le worker peut être arrêté à tout moment (bouton Arrêter) sans bloquer la page. */

let py = null;
let runner = null;
let inputURL = null;

let buf = "";
let bufType = "stdout";
let last = Date.now();

function flush() {
  if (buf) { postMessage({ type: bufType, text: buf }); buf = ""; }
  last = Date.now();
}
function emit(type, text) {
  if (!text) return;
  if (type !== bufType) { flush(); bufType = type; }
  buf += text;
  if (buf.length > 4096 || Date.now() - last > 40) flush();
}

self.pypadFlush = flush;
self.pypadImage = function (b64) { flush(); postMessage({ type: "image", text: b64 }); };

// input() : requête synchrone interceptée par le service worker, qui attend la réponse de la page.
self.pypadInput = function (prompt) {
  flush();
  if (!inputURL) {
    throw new Error("input() n'est pas disponible : recharge la page (connexion Internet nécessaire la première fois).");
  }
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  postMessage({ type: "input", id: id, text: prompt });
  const xhr = new XMLHttpRequest();
  xhr.open("GET", inputURL + "?id=" + encodeURIComponent(id), false);
  xhr.send(null);
  if (xhr.status !== 200) throw new Error("La saisie a échoué (" + xhr.status + ").");
  const r = JSON.parse(xhr.responseText);
  return r.cancel ? null : String(r.value);
};

const SETUP = `
import sys, os, builtins, traceback, warnings, linecache
import js

os.makedirs("/home/pyodide/pypad", exist_ok=True)
sys.path.insert(0, "/home/pyodide/pypad")
with open("/home/pyodide/pypad/pypad_backend.py", "w") as f:
    f.write('''
import sys, io, base64, js
from matplotlib.backend_bases import _Backend
from matplotlib.backends.backend_agg import _BackendAgg

def flush_figures():
    import matplotlib.pyplot as plt
    sys.stdout.flush()
    sys.stderr.flush()
    js.pypadFlush()
    for num in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(num).savefig(buf, format="png", dpi=144, bbox_inches="tight")
        js.pypadImage(base64.b64encode(buf.getvalue()).decode("ascii"))
    plt.close("all")

@_Backend.export
class _BackendPyPad(_BackendAgg):
    @staticmethod
    def show(*args, **kwargs):
        flush_figures()
''')
# plt.show() affiche les graphiques tout de suite dans la console
os.environ["MPLBACKEND"] = "module://pypad_backend"

def _pypad_input(prompt=""):
    sys.stdout.flush()
    sys.stderr.flush()
    answer = js.pypadInput(str(prompt))
    if answer is None:
        raise KeyboardInterrupt("saisie annulée")
    return str(answer)

builtins.input = _pypad_input

def _pypad_figures():
    backend = sys.modules.get("pypad_backend")
    if backend is not None:
        backend.flush_figures()
        return
    plt = sys.modules.get("matplotlib.pyplot")
    if plt is None:
        return
    import io, base64
    for num in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(num).savefig(buf, format="png", dpi=144, bbox_inches="tight")
        js.pypadImage(base64.b64encode(buf.getvalue()).decode("ascii"))
    plt.close("all")

def _pypad_run(code, filename):
    linecache.cache[filename] = (len(code), None, code.splitlines(True), filename)
    ns = {"__name__": "__main__", "__file__": filename, "__builtins__": builtins}
    try:
        exec(compile(code, filename, "exec"), ns)
    except SystemExit as e:
        if e.code not in (None, 0):
            print(f"SystemExit: {e.code}", file=sys.stderr)
    except KeyboardInterrupt as e:
        print(f"\\nKeyboardInterrupt: {e}" if str(e) else "\\nKeyboardInterrupt", file=sys.stderr)
    except BaseException as e:
        tb = e.__traceback__
        while tb is not None and tb.tb_frame.f_code.co_filename != filename:
            tb = tb.tb_next
        traceback.print_exception(type(e), e, tb)
    finally:
        try:
            _pypad_figures()
        except Exception as e:
            print(f"(graphique impossible : {e})", file=sys.stderr)
        sys.stdout.flush()
        sys.stderr.flush()
`;

async function init(indexURL) {
  try {
    importScripts(indexURL + "pyodide.js");
  } catch (e) {
    postMessage({ type: "fatal", text: "Impossible de télécharger Python. Vérifie la connexion Internet (nécessaire au premier lancement)." });
    return;
  }
  try {
    py = await loadPyodide({ indexURL: indexURL });
    const dOut = new TextDecoder();
    const dErr = new TextDecoder();
    py.setStdout({ write: (b) => { emit("stdout", dOut.decode(b, { stream: true })); return b.length; } });
    py.setStderr({ write: (b) => { emit("stderr", dErr.decode(b, { stream: true })); return b.length; } });
    py.runPython(SETUP);
    runner = py.globals.get("_pypad_run");
    postMessage({ type: "ready", text: py.runPython("import sys; sys.version.split()[0]") });
  } catch (e) {
    postMessage({ type: "fatal", text: "Python n'a pas pu démarrer : " + ((e && e.message) || e) });
  }
}

async function run(code, name) {
  try {
    try {
      await py.loadPackagesFromImports(code, {
        messageCallback: (m) => { flush(); postMessage({ type: "status", text: m }); },
        errorCallback: (m) => emit("stderr", m + "\n"),
      });
    } catch (e) { /* erreur de syntaxe : affichée à l'exécution */ }
    runner(code, name);
  } catch (e) {
    emit("stderr", ((e && e.message) || e) + "\n");
  } finally {
    flush();
    postMessage({ type: "done" });
  }
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    inputURL = m.inputURL || null;
    init(m.indexURL);
  } else if (m.type === "run") {
    run(m.code, m.name);
  }
};
