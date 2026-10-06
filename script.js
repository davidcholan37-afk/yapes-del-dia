// =========================================================
// YAPES DEL DÍA — lógica de la app
// Datos guardados en el teléfono (localStorage), por día.
// =========================================================
(() => {
  const KEY = "yapes_app_v2";
  const $ = (id) => document.getElementById(id);

  // ---------- Estado ----------
  let state = { days: {}, dark: false };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.days) state = saved;
  } catch (e) {}

  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  const dayKey = (d = new Date()) => {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const money = (n) => Number(n).toFixed(2);
  const today = () => (state.days[dayKey()] ||= []);

  const stats = (list) => {
    const yapes = list.filter((r) => r.monto > 0).length;
    const total = list.reduce((s, r) => s + r.monto, 0);
    return { yapes, total };
  };

  // ---------- Aviso ----------
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  // ---------- Fecha ----------
  function pintarFecha() {
    $("fecha").textContent = new Date().toLocaleDateString("es-PE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }

  // ---------- Dibujar ----------
  function render() {
    const list = today();
    const { yapes, total } = stats(list);

    $("contador").textContent = yapes;
    $("total").textContent = yapes;
    $("resumenYapes").textContent = yapes;
    $("dinero").textContent = money(total);
    $("resumenDinero").textContent = money(total);
    $("promedio").textContent = money(yapes ? total / yapes : 0);

    // Registros de hoy (más reciente primero)
    $("lista").innerHTML = list
      .slice()
      .reverse()
      .map((r) => {
        const neg = r.monto < 0;
        return `<li>
          <div class="ico ${neg ? "neg" : ""}">${neg ? "−" : "+"}</div>
          <div class="info"><b>${neg ? "Devolución" : "Yape recibido"}</b><small>${r.hora}</small></div>
          <div class="amt ${neg ? "neg" : ""}">${neg ? "−" : "+"} S/ ${money(Math.abs(r.monto))}</div>
        </li>`;
      })
      .join("");

    renderHistorial();
  }

  function renderHistorial() {
    const keys = Object.keys(state.days)
      .filter((k) => state.days[k].length)
      .sort()
      .reverse();

    if (!keys.length) {
      $("historialLista").innerHTML = `<div class="empty">Todavía no hay días guardados</div>`;
      return;
    }

    $("historialLista").innerHTML = keys
      .map((k) => {
        const { yapes, total } = stats(state.days[k]);
        const [y, m, d] = k.split("-").map(Number);
        const label =
          k === dayKey()
            ? "Hoy"
            : new Date(y, m - 1, d).toLocaleDateString("es-PE", {
                weekday: "short", day: "numeric", month: "short",
              });
        return `<div class="day">
          <div class="ico">${d}</div>
          <div class="info"><b style="text-transform:capitalize">${label}</b><small>${yapes} yapes</small></div>
          <div class="amt">S/ ${money(total)}</div>
        </div>`;
      })
      .join("");
  }

  // ---------- Acciones ----------
  function leerMonto() {
    const v = parseFloat($("monto").value);
    if (!v || v <= 0) {
      toast("Escribe un monto válido");
      $("monto").focus();
      return null;
    }
    return Math.round(v * 100) / 100;
  }

  function agregar(signo) {
    const v = leerMonto();
    if (v === null) return;
    today().push({
      id: Date.now(),
      monto: signo * v,
      hora: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
    });
    $("monto").value = "";
    save();
    render();
    toast(signo > 0 ? `+ S/ ${money(v)} registrado` : `Devolución de S/ ${money(v)}`);
    if (navigator.vibrate) navigator.vibrate(30);
  }

  $("sumar").addEventListener("click", () => agregar(1));
  $("restar").addEventListener("click", () => agregar(-1));

  $("monto").addEventListener("keydown", (e) => {
    if (e.key === "Enter") agregar(1);
  });

  document.querySelectorAll("[data-quick]").forEach((b) =>
    b.addEventListener("click", () => {
      const actual = parseFloat($("monto").value) || 0;
      $("monto").value = money(actual + Number(b.dataset.quick));
    })
  );

  $("deshacer").addEventListener("click", () => {
    const list = today();
    if (!list.length) return toast("No hay nada que deshacer");
    list.pop();
    save();
    render();
    toast("Último registro eliminado");
  });

  $("reiniciar").addEventListener("click", () => {
    if (!today().length) return toast("El día ya está vacío");
    if (confirm("¿Borrar todos los registros de hoy?")) {
      state.days[dayKey()] = [];
      save();
      render();
      toast("Día reiniciado");
    }
  });

  $("exportar").addEventListener("click", () => {
    const list = today();
    if (!list.length) return toast("No hay registros para exportar");
    const { yapes, total } = stats(list);
    const filas = ["Hora,Tipo,Monto (S/)"]
      .concat(list.map((r) => `${r.hora},${r.monto < 0 ? "Devolución" : "Yape"},${money(r.monto)}`))
      .concat(["", `Yapes,${yapes}`, `Total,${money(total)}`]);
    const blob = new Blob(["\ufeff" + filas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `yapes-${dayKey()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Día exportado");
  });

  // ---------- Modo oscuro ----------
  function aplicarTema() {
    document.body.classList.toggle("dark", state.dark);
    $("modoOscuro").textContent = state.dark ? "☀️ Modo claro" : "🌙 Modo oscuro";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = state.dark ? "#0d0a1c" : "#5b21b6";
  }
  $("modoOscuro").addEventListener("click", () => {
    state.dark = !state.dark;
    save();
    aplicarTema();
  });

  // ---------- Menú inferior ----------
  document.querySelectorAll(".tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".view").forEach((v) =>
        v.classList.toggle("active", v.id === `view-${tab.dataset.tab}`)
      );
      window.scrollTo({ top: 0 });
    })
  );

  // ---------- Inicio ----------
  pintarFecha();
  aplicarTema();
  render();

  // Si la app queda abierta pasada la medianoche, cambia de día sola
  setInterval(() => { pintarFecha(); render(); }, 60 * 1000);
})();
