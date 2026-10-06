// =========================================================
// ARQUEO DEL DÍA — lógica de la app
// Todo se guarda en el teléfono (localStorage), separado por día.
// =========================================================
(() => {
  const KEY = "yapes_app_v2";
  const $ = (id) => document.getElementById(id);
  const DEN = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1];

  const nuevoDia = () => ({ apertura: 0, conteo: {}, yapeApp: null, movs: [] });

  // ---------- Estado ----------
  let state = { days: {}, dark: false };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.days) state = saved;
  } catch (e) {}

  // Compatibilidad: convierte los datos de la versión anterior (solo yapes)
  function normalizar() {
    Object.keys(state.days).forEach((k) => {
      const d = state.days[k];
      if (Array.isArray(d)) {
        state.days[k] = {
          ...nuevoDia(),
          movs: d.map((r, i) => ({
            id: r.id || Date.now() + i,
            tipo: "yape",
            monto: r.monto,
            hora: r.hora || "",
            nota: "",
          })),
        };
      } else {
        state.days[k] = { ...nuevoDia(), ...d };
      }
    });
  }
  normalizar();

  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => (state.days[dayKey()] ||= nuevoDia());

  const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const money = (n) => r2(n).toFixed(2);
  const soles = (n) => `${n < 0 ? "−" : ""}S/ ${money(Math.abs(n))}`;
  const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const horaAhora = () => new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

  // ---------- Cálculos ----------
  function calc(d) {
    const sum = (f) => r2(d.movs.filter(f).reduce((s, m) => s + m.monto, 0));
    const yape = sum((m) => m.tipo === "yape");
    const efectivo = sum((m) => m.tipo === "efectivo");
    const pagosEf = sum((m) => m.tipo === "pago" && m.metodo === "efectivo");
    const pagosDig = sum((m) => m.tipo === "pago" && m.metodo !== "efectivo");
    const pagos = r2(pagosEf + pagosDig);
    const nYape = d.movs.filter((m) => m.tipo === "yape" && m.monto > 0).length;
    const nEfectivo = d.movs.filter((m) => m.tipo === "efectivo" && m.monto > 0).length;
    const ventas = r2(yape + efectivo);
    const apertura = d.apertura || 0;
    const esperado = r2(apertura + efectivo - pagosEf);
    const contado = r2(DEN.reduce((s, v) => s + v * (d.conteo[v] || 0), 0));
    return { yape, efectivo, pagosEf, pagosDig, pagos, nYape, nEfectivo, ventas, apertura, esperado, contado, resultado: r2(ventas - pagos) };
  }

  // ---------- Aviso ----------
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
  }
  const vibrar = () => navigator.vibrate && navigator.vibrate(30);

  function pintarFecha() {
    $("fecha").textContent = new Date().toLocaleDateString("es-PE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }

  // ---------- Dibujar ----------
  function itemMov(m) {
    let ico, icoClass = "", titulo, sub, neg = false, monto = m.monto;
    if (m.tipo === "yape") {
      ico = monto < 0 ? "−" : "Y";
      titulo = monto < 0 ? "Devolución Yape" : m.nota || "Yape recibido";
      sub = `Yape · ${m.hora}`;
      neg = monto < 0;
    } else if (m.tipo === "efectivo") {
      ico = "S/";
      icoClass = "cash";
      titulo = m.nota || "Venta en efectivo";
      sub = `Efectivo · ${m.hora}`;
      neg = monto < 0;
    } else {
      ico = "↑";
      icoClass = "out";
      titulo = m.proveedor || "Pago";
      sub = `${m.metodo === "efectivo" ? "Efectivo" : "Yape/Transf."} · ${m.hora}${m.nota ? " · " + m.nota : ""}`;
      neg = true;
      monto = -Math.abs(monto);
    }
    return `<li>
      <div class="ico ${icoClass}">${ico}</div>
      <div class="info"><b>${esc(titulo)}</b><small>${esc(sub)}</small></div>
      <div class="amt ${neg ? "neg" : ""}">${neg ? "−" : "+"} S/ ${money(Math.abs(monto))}</div>
      <button class="del" data-del="${m.id}" aria-label="Eliminar">✕</button>
    </li>`;
  }

  function render() {
    const d = today();
    const c = calc(d);
    const set = (id, v) => ($(id).textContent = v);

    // Inicio
    set("ventasTotal", money(c.ventas));
    set("nVentas", c.nYape + c.nEfectivo);
    set("resultado", money(c.resultado));
    set("miYape", money(c.yape));
    set("miEfectivo", money(c.efectivo));
    set("miPagos", money(c.pagos));
    set("miCaja", money(c.esperado));
    $("lista").innerHTML = d.movs.slice().reverse().map(itemMov).join("");

    // Yapes
    set("contador", c.nYape);
    set("total", c.nYape);
    set("dinero", money(c.yape));

    // Efectivo
    set("totalEfectivo", money(c.efectivo));
    set("nEfectivo", c.nEfectivo);
    if (document.activeElement !== $("apertura")) $("apertura").value = d.apertura ? d.apertura : "";

    // Pagos
    set("pagosEf", money(c.pagosEf));
    set("pagosDig", money(c.pagosDig));
    renderProveedores(d);

    // Arqueo
    set("arqApertura", money(c.apertura));
    set("arqEfectivo", money(c.efectivo));
    set("arqPagos", money(c.pagosEf));
    set("arqEsperado", money(c.esperado));
    set("arqContado", money(c.contado));
    set("yapeRegistrado", money(c.yape));
    set("resVentas", money(c.ventas));
    set("resPagos", money(c.pagos));
    set("resFinal", money(c.resultado));
    renderDenoms(d);
    renderResultados(d, c);

    renderHistorial();
  }

  function renderProveedores(d) {
    const pagos = d.movs.filter((m) => m.tipo === "pago");
    const por = {};
    pagos.forEach((m) => { por[m.proveedor] = r2((por[m.proveedor] || 0) + m.monto); });
    $("resumenProv").innerHTML = Object.entries(por)
      .sort((a, b) => b[1] - a[1])
      .map(([n, t]) => `<div class="prov"><div class="ico out">${esc(n.charAt(0).toUpperCase())}</div><div class="info"><b>${esc(n)}</b></div><div class="amt neg">− S/ ${money(t)}</div></div>`)
      .join("");

    // Sugerencias de proveedores usados antes
    const nombres = new Set();
    Object.values(state.days).forEach((dd) => dd.movs.forEach((m) => m.tipo === "pago" && m.proveedor && nombres.add(m.proveedor)));
    $("proveedores").innerHTML = [...nombres].map((n) => `<option value="${esc(n)}">`).join("");
  }

  // Denominaciones: se crean una vez y luego solo se actualizan valores
  function crearDenoms() {
    const fila = (v) => `<div class="den">
      <b>S/ ${v >= 1 ? v : v.toFixed(2)}</b>
      <div class="step">
        <button type="button" data-den="${v}" data-d="-1">−</button>
        <input type="number" inputmode="numeric" min="0" step="1" data-deninput="${v}" value="0">
        <button type="button" data-den="${v}" data-d="1">+</button>
      </div>
      <span class="sub" data-sub="${v}">S/ 0.00</span>
    </div>`;
    $("denoms").innerHTML =
      `<p class="den-group">Billetes</p>` + DEN.filter((v) => v >= 10).map(fila).join("") +
      `<p class="den-group">Monedas</p>` + DEN.filter((v) => v < 10).map(fila).join("");
  }

  function renderDenoms(d) {
    DEN.forEach((v) => {
      const q = d.conteo[v] || 0;
      const inp = document.querySelector(`[data-deninput="${v}"]`);
      if (inp && document.activeElement !== inp) inp.value = q;
      const sub = document.querySelector(`[data-sub="${v}"]`);
      if (sub) sub.textContent = `S/ ${money(q * v)}`;
    });
  }

  function renderResultados(d, c) {
    const res = $("arqResultado");
    const hayConteo = DEN.some((v) => (d.conteo[v] || 0) > 0);
    if (!hayConteo) {
      res.className = "res";
      res.innerHTML = "Cuenta tu efectivo para ver el resultado";
    } else {
      const dif = r2(c.contado - c.esperado);
      if (dif === 0) {
        res.className = "res ok";
        res.innerHTML = `✅ Caja cuadrada<b>Diferencia S/ 0.00</b>`;
      } else if (dif > 0) {
        res.className = "res warn";
        res.innerHTML = `Te sobra efectivo<b>+ S/ ${money(dif)}</b>`;
      } else {
        res.className = "res bad";
        res.innerHTML = `Te falta efectivo<b>− S/ ${money(Math.abs(dif))}</b>`;
      }
    }

    const y = $("yapeResultado");
    if (d.yapeApp === null || d.yapeApp === "" || isNaN(d.yapeApp)) {
      y.className = "res small";
      y.textContent = "";
      if (document.activeElement !== $("yapeApp")) $("yapeApp").value = "";
    } else {
      const dif = r2(d.yapeApp - c.yape);
      if (document.activeElement !== $("yapeApp")) $("yapeApp").value = d.yapeApp;
      if (dif === 0) { y.className = "res small ok"; y.textContent = "✅ Tus Yapes cuadran"; }
      else if (dif > 0) { y.className = "res small warn"; y.textContent = `Te falta registrar S/ ${money(dif)} de Yapes`; }
      else { y.className = "res small bad"; y.textContent = `Registraste S/ ${money(Math.abs(dif))} de más`; }
    }
  }

  function renderHistorial() {
    const keys = Object.keys(state.days).filter((k) => state.days[k].movs.length).sort().reverse();
    if (!keys.length) {
      $("historialLista").innerHTML = `<div class="empty">Todavía no hay días guardados</div>`;
      return;
    }
    $("historialLista").innerHTML = keys
      .map((k) => {
        const d = state.days[k];
        const c = calc(d);
        const [y, m, dd] = k.split("-").map(Number);
        const label = k === dayKey() ? "Hoy" : new Date(y, m - 1, dd).toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" });
        let estado = "Sin arqueo";
        if (DEN.some((v) => (d.conteo[v] || 0) > 0)) {
          const dif = r2(c.contado - c.esperado);
          estado = dif === 0 ? "Caja cuadrada ✅" : `Dif. ${dif > 0 ? "+" : "−"}S/ ${money(Math.abs(dif))}`;
        }
        return `<div class="day">
          <div class="ico">${dd}</div>
          <div class="info"><b style="text-transform:capitalize">${label}</b><small>Ventas S/ ${money(c.ventas)} · Pagos S/ ${money(c.pagos)} · ${estado}</small></div>
          <div class="amt ${c.resultado < 0 ? "neg" : ""}">S/ ${money(c.resultado)}</div>
        </div>`;
      })
      .join("");
  }

  // ---------- Registrar movimientos ----------
  const num = (id) => {
    const v = parseFloat(String($(id).value).replace(",", "."));
    return v > 0 ? r2(v) : null;
  };

  function agregar(mov) {
    today().movs.push({ id: Date.now() + Math.random(), hora: horaAhora(), ...mov });
    save();
    render();
    vibrar();
  }

  function deshacerTipo(tipo, msg) {
    const movs = today().movs;
    for (let i = movs.length - 1; i >= 0; i--) {
      if (movs[i].tipo === tipo) {
        movs.splice(i, 1);
        save();
        render();
        return toast(msg);
      }
    }
    toast("No hay nada que deshacer");
  }

  function yape(signo) {
    const v = num("monto");
    if (!v) { toast("Escribe un monto válido"); return $("monto").focus(); }
    agregar({ tipo: "yape", monto: signo * v, nota: signo > 0 ? $("notaYape").value.trim() : "" });
    $("monto").value = "";
    $("notaYape").value = "";
    toast(signo > 0 ? `+ S/ ${money(v)} Yape registrado` : `Devolución de S/ ${money(v)}`);
  }
  $("sumar").addEventListener("click", () => yape(1));
  $("restar").addEventListener("click", () => yape(-1));
  $("deshacer").addEventListener("click", () => deshacerTipo("yape", "Último Yape eliminado"));
  $("monto").addEventListener("keydown", (e) => e.key === "Enter" && yape(1));

  $("sumarEfectivo").addEventListener("click", () => {
    const v = num("montoEfectivo");
    if (!v) { toast("Escribe un monto válido"); return $("montoEfectivo").focus(); }
    agregar({ tipo: "efectivo", monto: v, nota: $("notaEfectivo").value.trim() });
    $("montoEfectivo").value = "";
    $("notaEfectivo").value = "";
    toast(`+ S/ ${money(v)} en efectivo`);
  });
  $("deshacerEfectivo").addEventListener("click", () => deshacerTipo("efectivo", "Última venta eliminada"));
  $("montoEfectivo").addEventListener("keydown", (e) => e.key === "Enter" && $("sumarEfectivo").click());

  $("registrarPago").addEventListener("click", () => {
    const prov = $("proveedor").value.trim();
    const v = num("montoPago");
    if (!prov) { toast("Escribe el proveedor"); return $("proveedor").focus(); }
    if (!v) { toast("Escribe el monto pagado"); return $("montoPago").focus(); }
    const metodo = document.querySelector('input[name="metodo"]:checked').value;
    agregar({ tipo: "pago", monto: v, proveedor: prov, metodo, nota: $("notaPago").value.trim() });
    $("proveedor").value = "";
    $("montoPago").value = "";
    $("notaPago").value = "";
    toast(`Pago de S/ ${money(v)} a ${prov}`);
  });
  $("deshacerPago").addEventListener("click", () => deshacerTipo("pago", "Último pago eliminado"));

  // Botones rápidos (+5, +10…)
  document.querySelectorAll("[data-quick]").forEach((b) =>
    b.addEventListener("click", () => {
      const inp = $(b.dataset.target);
      inp.value = money((parseFloat(inp.value) || 0) + Number(b.dataset.quick));
    })
  );

  // Eliminar un movimiento específico
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    const id = b.dataset.del;
    const d = today();
    d.movs = d.movs.filter((m) => String(m.id) !== id);
    save();
    render();
    toast("Movimiento eliminado");
  });

  // ---------- Caja inicial ----------
  $("apertura").addEventListener("input", () => {
    today().apertura = Math.max(0, parseFloat($("apertura").value) || 0);
    save();
    render();
  });

  // ---------- Conteo de billetes y monedas ----------
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-den]");
    if (!b) return;
    const v = b.dataset.den;
    const d = today();
    d.conteo[v] = Math.max(0, (d.conteo[v] || 0) + Number(b.dataset.d));
    save();
    render();
  });
  document.addEventListener("input", (e) => {
    const i = e.target.closest("[data-deninput]");
    if (!i) return;
    today().conteo[i.dataset.deninput] = Math.max(0, parseInt(i.value, 10) || 0);
    save();
    render();
  });
  $("limpiarConteo").addEventListener("click", () => {
    today().conteo = {};
    save();
    render();
    toast("Conteo limpio");
  });

  $("yapeApp").addEventListener("input", () => {
    const v = parseFloat($("yapeApp").value);
    today().yapeApp = isNaN(v) ? null : v;
    save();
    render();
  });

  // ---------- Compartir resumen ----------
  function resumenTexto() {
    const d = today();
    const c = calc(d);
    const hayConteo = DEN.some((v) => (d.conteo[v] || 0) > 0);
    const fecha = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
    let t = `📒 Arqueo del ${fecha}\n\n`;
    t += `Ventas: ${soles(c.ventas)}\n`;
    t += `  • Yapes (${c.nYape}): ${soles(c.yape)}\n`;
    t += `  • Efectivo (${c.nEfectivo}): ${soles(c.efectivo)}\n`;
    t += `Pagos a proveedores: ${soles(c.pagos)}\n`;
    t += `Resultado del día: ${soles(c.resultado)}\n\n`;
    t += `Caja inicial: ${soles(c.apertura)}\n`;
    t += `Efectivo esperado: ${soles(c.esperado)}\n`;
    if (hayConteo) {
      const dif = r2(c.contado - c.esperado);
      t += `Efectivo contado: ${soles(c.contado)}\n`;
      t += dif === 0 ? `✅ Caja cuadrada` : `Diferencia: ${dif > 0 ? "+" : "−"}S/ ${money(Math.abs(dif))} (${dif > 0 ? "sobra" : "falta"})`;
    }
    return t;
  }

  $("compartir").addEventListener("click", async () => {
    const t = resumenTexto();
    if (navigator.share) {
      try { await navigator.share({ text: t }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(t); toast("Resumen copiado"); }
    catch (e) { prompt("Copia el resumen:", t); }
  });

  // ---------- Exportar / respaldo ----------
  function descargar(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  $("exportar").addEventListener("click", () => {
    const d = today();
    if (!d.movs.length) return toast("No hay registros para exportar");
    const c = calc(d);
    const filas = ["Hora,Tipo,Detalle,Método,Monto (S/)"];
    d.movs.forEach((m) => {
      const tipo = m.tipo === "yape" ? "Yape" : m.tipo === "efectivo" ? "Venta efectivo" : "Pago proveedor";
      const det = (m.tipo === "pago" ? m.proveedor + (m.nota ? " - " + m.nota : "") : m.nota || "").replace(/,/g, " ");
      const met = m.tipo === "pago" ? (m.metodo === "efectivo" ? "Efectivo" : "Yape/Transf.") : m.tipo === "yape" ? "Yape" : "Efectivo";
      const monto = m.tipo === "pago" ? -m.monto : m.monto;
      filas.push(`${m.hora},${tipo},${det},${met},${money(monto)}`);
    });
    filas.push("", `Ventas,,,,${money(c.ventas)}`, `Pagos,,,,${money(c.pagos)}`, `Resultado,,,,${money(c.resultado)}`, `Efectivo esperado,,,,${money(c.esperado)}`, `Efectivo contado,,,,${money(c.contado)}`);
    descargar(`arqueo-${dayKey()}.csv`, "\ufeff" + filas.join("\n"), "text/csv;charset=utf-8");
    toast("Día exportado");
  });

  $("respaldar").addEventListener("click", () => {
    descargar(`respaldo-yapes-${dayKey()}.json`, JSON.stringify(state), "application/json");
    toast("Copia de seguridad descargada");
  });
  $("restaurar").addEventListener("click", () => $("archivoRespaldo").click());
  $("archivoRespaldo").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (!data || typeof data.days !== "object") throw new Error();
        if (!confirm("Esto reemplazará todos tus datos actuales. ¿Continuar?")) return;
        state = { days: data.days, dark: !!data.dark };
        normalizar();
        save();
        aplicarTema();
        render();
        toast("Copia restaurada");
      } catch (err) {
        toast("Archivo no válido");
      }
    };
    rd.readAsText(f);
    e.target.value = "";
  });

  $("reiniciar").addEventListener("click", () => {
    if (!today().movs.length && !today().apertura) return toast("El día ya está vacío");
    if (confirm("¿Borrar todos los registros y el conteo de hoy?")) {
      state.days[dayKey()] = nuevoDia();
      save();
      render();
      toast("Día reiniciado");
    }
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

  // ---------- Navegación ----------
  function ir(nombre) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === nombre));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${nombre}`));
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => ir(t.dataset.tab)));
  $("btnMas").addEventListener("click", () => ir("mas"));

  // ---------- Inicio ----------
  crearDenoms();
  pintarFecha();
  aplicarTema();
  render();

  // Si la app queda abierta pasada la medianoche, cambia de día sola
  setInterval(() => { pintarFecha(); render(); }, 60 * 1000);
})();
