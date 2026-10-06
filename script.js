// =========================================================
// ARQUEO DEL DÍA — lógica de la app
// Todo se guarda en el dispositivo (localStorage), separado por día.
// =========================================================
(() => {
  "use strict";

  const KEY = "yapes_app_v2"; // misma llave: conserva los datos que ya tenías
  const $ = (id) => document.getElementById(id);
  const DEN = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1];
  const nuevoDia = () => ({ apertura: 0, conteo: {}, yapeApp: null, movs: [] });
  const svg = (id) => `<svg class="ic"><use href="#${id}"/></svg>`;

  // ---------- Estado ----------
  let state = { days: {}, dark: false, pin: null };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.days) state = { days: {}, dark: false, pin: null, ...saved };
  } catch (e) {}
  if (!state.pin) document.body.classList.remove("locked-boot");
  window.__arqueoOK = true;

  // Compatibilidad con versiones anteriores (solo yapes)
  function normalizar() {
    Object.keys(state.days).forEach((k) => {
      const d = state.days[k];
      if (Array.isArray(d)) {
        state.days[k] = {
          ...nuevoDia(),
          movs: d.map((r, i) => ({ id: r.id || Date.now() + i, tipo: "yape", monto: r.monto, hora: r.hora || "", nota: "" })),
        };
      } else {
        state.days[k] = { ...nuevoDia(), ...d };
      }
    });
  }
  normalizar();

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

  // ---------- Utilidades ----------
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const money = (n) => r2(n).toFixed(2);
  const soles = (n) => `${n < 0 ? "−" : ""}S/ ${money(Math.abs(n))}`;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const horaAhora = () => new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const fecha = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmtCorta = (k) => fecha(k).toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  const fmtLarga = (k) => fecha(k).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ---------- Día que se está viendo ----------
  let hoyKey = dayKey();
  let viewKey = hoyKey;
  const cur = () => {
    if (!state.days[viewKey]) state.days[viewKey] = nuevoDia();
    return state.days[viewKey];
  };

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
  const hayConteo = (d) => DEN.some((v) => (d.conteo[v] || 0) > 0);

  // ---------- Aviso ----------
  let toastTimer, toastFn = null;
  function toast(msg, label, fn) {
    $("toastMsg").textContent = msg;
    toastFn = fn || null;
    const b = $("toastAct");
    b.hidden = !fn;
    if (fn) b.textContent = label || "Deshacer";
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").classList.remove("show"); toastFn = null; }, fn ? 5000 : 2000);
  }
  $("toastAct").addEventListener("click", () => {
    if (!toastFn) return;
    const f = toastFn;
    toastFn = null;
    $("toast").classList.remove("show");
    f();
  });
  const vibrar = (ms = 30) => navigator.vibrate && navigator.vibrate(ms);

  // ---------- Dibujo ----------
  const emptyHTML = (tag, titulo, sub) =>
    `<${tag} class="empty"><svg viewBox="0 0 120 90" aria-hidden="true"><circle cx="74" cy="22" r="11" fill="#fde047"/><circle cx="74" cy="22" r="6.5" fill="none" stroke="#d97706" stroke-width="2"/><rect x="22" y="32" width="76" height="46" rx="12" fill="#ede9fe"/><rect x="22" y="32" width="76" height="14" rx="7" fill="#ddd6fe"/><rect x="68" y="52" width="30" height="16" rx="8" fill="#7c3aed"/><circle cx="76" cy="60" r="3.5" fill="#fff"/></svg><b>${titulo}</b><span>${sub}</span></${tag}>`;

  function itemMov(m, conBorrar) {
    const neg = m.monto < 0;
    let cls = "", ico, titulo, partes, rojo = false;
    if (m.tipo === "yape") {
      ico = neg ? "i-refund" : "i-phone";
      cls = neg ? "out" : "";
      titulo = neg ? "Devolución Yape" : m.nota || "Yape recibido";
      partes = ["Yape", m.hora, neg ? m.nota : ""];
      rojo = neg;
    } else if (m.tipo === "efectivo") {
      ico = neg ? "i-refund" : "i-cash";
      cls = neg ? "out" : "cash";
      titulo = neg ? "Devolución en efectivo" : m.nota || "Venta en efectivo";
      partes = ["Efectivo", m.hora, neg ? m.nota : ""];
      rojo = neg;
    } else {
      ico = "i-out";
      cls = "out";
      titulo = m.proveedor || "Pago";
      partes = ["Pago " + (m.metodo === "efectivo" ? "en efectivo" : "Yape/Transf."), m.hora, m.nota];
      rojo = true;
    }
    return `<li class="mov">
      <span class="mico ${cls}">${svg(ico)}</span>
      <div class="info"><b>${esc(titulo)}</b><small>${esc(partes.filter(Boolean).join(" · "))}</small></div>
      <div class="amt ${rojo ? "neg" : ""}">${rojo ? "−" : "+"} S/ ${money(Math.abs(m.monto))}</div>
      ${conBorrar ? `<button class="del" data-del="${esc(m.id)}" type="button" aria-label="Eliminar">${svg("i-trash")}</button>` : ""}
    </li>`;
  }

  let filtro = "todos";

  function render() {
    const d = cur();
    const c = calc(d);
    const set = (id, v) => { $(id).textContent = v; };
    const esHoy = viewKey === hoyKey;

    // Fecha y aviso de "otro día"
    set("fecha", esHoy ? "Hoy" : fmtCorta(viewKey));
    set("heroBadge", esHoy ? "Hoy" : fmtCorta(viewKey));
    $("banner").hidden = esHoy;
    set("bannerFecha", fmtLarga(viewKey));
    const fi = $("fechaInput");
    fi.max = hoyKey;
    if (fi.value !== viewKey) fi.value = viewKey;

    // Inicio
    set("ventasTotal", money(c.ventas));
    set("miYape", money(c.yape));
    set("miEfectivo", money(c.efectivo));
    set("miPagos", money(c.pagos));
    set("miCaja", money(c.esperado));
    set("resultado", money(c.resultado));
    set("nVentas", c.nYape + c.nEfectivo);
    const recientes = d.movs.slice(-5).reverse();
    $("listaRecientes").innerHTML = recientes.length
      ? recientes.map((m) => itemMov(m, false)).join("")
      : emptyHTML("li", "Aún no hay movimientos", "Toca uno de los botones de arriba para anotar el primero.");

    // Movimientos (con filtro)
    const movs = d.movs.filter((m) => filtro === "todos" || m.tipo === filtro).slice().reverse();
    $("lista").innerHTML = movs.length
      ? movs.map((m) => itemMov(m, true)).join("")
      : emptyHTML("li", "Sin movimientos", "Aquí aparecerán tus yapes, ventas y pagos.");
    const resumen = {
      todos: ["Resultado del día", c.resultado],
      yape: ["Total Yapes", c.yape],
      efectivo: ["Total efectivo", c.efectivo],
      pago: ["Total pagado", c.pagos],
    }[filtro];
    $("resumenFiltro").innerHTML = `<span>${movs.length} ${movs.length === 1 ? "movimiento" : "movimientos"} · ${resumen[0]}</span><b>${soles(resumen[1])}</b>`;
    renderProveedores(d);

    // Arqueo
    if (document.activeElement !== $("apertura")) $("apertura").value = d.apertura ? d.apertura : "";
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
    const por = {};
    d.movs.filter((m) => m.tipo === "pago").forEach((m) => { por[m.proveedor] = r2((por[m.proveedor] || 0) + m.monto); });
    const filas = Object.entries(por).sort((a, b) => b[1] - a[1]);
    $("provBox").hidden = !(filtro === "pago" && filas.length);
    $("resumenProv").innerHTML = filas
      .map(([n, t]) => `<div class="prov"><span class="mico out">${esc((n || "?").charAt(0).toUpperCase())}</span><div class="info"><b>${esc(n)}</b></div><div class="amt neg">− S/ ${money(t)}</div></div>`)
      .join("");

    const nombres = new Set();
    Object.values(state.days).forEach((dd) => dd.movs.forEach((m) => m.tipo === "pago" && m.proveedor && nombres.add(m.proveedor)));
    $("proveedores").innerHTML = [...nombres].map((n) => `<option value="${esc(n)}">`).join("");
  }

  function crearDenoms() {
    const fila = (v) => `<div class="den">
      <b>S/ ${v >= 1 ? v : v.toFixed(2)}</b>
      <div class="step">
        <button type="button" data-den="${v}" data-d="-1" aria-label="Quitar uno">−</button>
        <input type="number" inputmode="numeric" min="0" step="1" data-deninput="${v}" value="0" aria-label="Cantidad de S/ ${v}">
        <button type="button" data-den="${v}" data-d="1" aria-label="Agregar uno">+</button>
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
    if (!hayConteo(d)) {
      res.className = "res";
      res.innerHTML = "Cuenta tu efectivo para ver el resultado";
    } else {
      const dif = r2(c.contado - c.esperado);
      if (dif === 0) { res.className = "res ok"; res.innerHTML = `✅ Caja cuadrada<b>Diferencia S/ 0.00</b>`; }
      else if (dif > 0) { res.className = "res warn"; res.innerHTML = `Te sobra efectivo<b>+ S/ ${money(dif)}</b>`; }
      else { res.className = "res bad"; res.innerHTML = `Te falta efectivo<b>− S/ ${money(Math.abs(dif))}</b>`; }
    }

    const y = $("yapeResultado");
    const yp = d.yapeApp;
    if (yp === null || yp === "" || isNaN(yp)) {
      y.className = "res small";
      y.textContent = "";
      if (document.activeElement !== $("yapeApp")) $("yapeApp").value = "";
    } else {
      const dif = r2(yp - c.yape);
      if (document.activeElement !== $("yapeApp")) $("yapeApp").value = yp;
      if (dif === 0) { y.className = "res small ok"; y.textContent = "✅ Tus Yapes cuadran"; }
      else if (dif > 0) { y.className = "res small warn"; y.textContent = `Te falta registrar S/ ${money(dif)} de Yapes`; }
      else { y.className = "res small bad"; y.textContent = `Registraste S/ ${money(Math.abs(dif))} de más`; }
    }
  }

  function renderHistorial() {
    // Resumen del mes
    const ym = hoyKey.slice(0, 7);
    let v = 0, p = 0;
    Object.keys(state.days).forEach((k) => {
      if (k.startsWith(ym)) { const c = calc(state.days[k]); v += c.ventas; p += c.pagos; }
    });
    const mes = new Date().toLocaleDateString("es-PE", { month: "long" });
    $("mesResumen").innerHTML =
      `<div><small>Ventas de ${esc(mes)}</small><b>S/ ${money(v)}</b></div>` +
      `<div><small>Pagos</small><b>S/ ${money(p)}</b></div>` +
      `<div><small>Resultado</small><b>S/ ${money(v - p)}</b></div>`;

    const keys = Object.keys(state.days).filter((k) => state.days[k].movs.length).sort().reverse();
    if (!keys.length) {
      $("historialLista").innerHTML = emptyHTML("div", "Todavía no hay días guardados", "Cuando anotes movimientos aparecerán aquí.");
      return;
    }
    $("historialLista").innerHTML = keys
      .map((k) => {
        const d = state.days[k];
        const c = calc(d);
        let estado = "Sin arqueo";
        if (hayConteo(d)) {
          const dif = r2(c.contado - c.esperado);
          estado = dif === 0 ? "Caja cuadrada ✅" : `Dif. ${dif > 0 ? "+" : "−"}S/ ${money(Math.abs(dif))}`;
        }
        return `<button class="day ${k === viewKey ? "current" : ""}" data-day="${k}" type="button">
          <span class="dnum">${Number(k.slice(8))}</span>
          <span class="info"><b style="text-transform:capitalize">${k === hoyKey ? "Hoy" : esc(fmtCorta(k))}</b><small>Ventas S/ ${money(c.ventas)} · Pagos S/ ${money(c.pagos)} · ${estado}</small></span>
          <span class="amt ${c.resultado < 0 ? "neg" : ""}">S/ ${money(c.resultado)}</span>
        </button>`;
      })
      .join("");
  }

  // ---------- Agregar movimientos ----------
  function agregar(mov) {
    const k = viewKey;
    const m = { id: nuevoId(), hora: k === hoyKey ? horaAhora() : "", ...mov };
    cur().movs.push(m);
    save();
    render();
    vibrar();
    return { k, m };
  }
  function quitarMov(k, id) {
    const dd = state.days[k];
    if (!dd) return;
    dd.movs = dd.movs.filter((x) => String(x.id) !== String(id));
    save();
    render();
  }

  // ---------- Hoja para anotar (teclado grande) ----------
  const SHEET = {
    yape:     { t: "Recibí un Yape",    s: "Escribe cuánto te yapearon", ico: "i-phone", cls: "yape", btn: "Registrar Yape",  b: "primary" },
    efectivo: { t: "Vendí en efectivo", s: "Escribe cuánto recibiste",   ico: "i-cash",  cls: "cash", btn: "Registrar venta", b: "primary cash" },
    pago:     { t: "Pagué a proveedor", s: "Escribe cuánto pagaste",     ico: "i-out",   cls: "out",  btn: "Registrar pago",  b: "primary out" },
  };
  const sh = { tipo: null, amt: "" };

  function pintarMonto() { $("sheetAmount").textContent = sh.amt || "0"; }

  function abrirSheet(tipo) {
    const cfg = SHEET[tipo];
    if (!cfg) return;
    sh.tipo = tipo;
    sh.amt = "";
    $("sheetTitulo").textContent = cfg.t;
    $("sheetSub").textContent = viewKey === hoyKey ? cfg.s : `${cfg.s} · para ${fmtCorta(viewKey)}`;
    $("sheetIco").className = "mico " + (cfg.cls === "yape" ? "" : cfg.cls);
    $("sheetIco").innerHTML = svg(cfg.ico);
    const ok = $("sheetOk");
    ok.className = "btn " + cfg.b;
    ok.textContent = cfg.btn;
    $("rowProv").hidden = tipo !== "pago";
    $("rowDevol").hidden = tipo === "pago";
    $("proveedor").value = "";
    $("notaSheet").value = "";
    $("esDevol").checked = false;
    document.querySelector('input[name="metodo"][value="efectivo"]').checked = true;
    pintarMonto();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    $("sheet").hidden = false;
    document.body.classList.add("noscroll");
  }
  function cerrarSheet() {
    $("sheet").hidden = true;
    if ($("lock").hidden) document.body.classList.remove("noscroll");
  }

  function teclaMonto(k) {
    if (k === "del") sh.amt = sh.amt.slice(0, -1);
    else if (k === ".") {
      if (sh.amt.includes(".")) return;
      sh.amt = sh.amt ? sh.amt + "." : "0.";
    } else {
      if (sh.amt === "0") sh.amt = k;
      else {
        if (sh.amt.includes(".") && sh.amt.split(".")[1].length >= 2) return;
        if (sh.amt.length >= 9) return;
        sh.amt += k;
      }
    }
    pintarMonto();
  }

  function crearTeclados() {
    $("keypad").innerHTML =
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-k="${n}">${n}</button>`).join("") +
      `<button type="button" data-k=".">.</button><button type="button" data-k="0">0</button>` +
      `<button type="button" data-k="del" aria-label="Borrar">${svg("i-back")}</button>`;
    $("lockPad").innerHTML =
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-p="${n}">${n}</button>`).join("") +
      `<span></span><button type="button" data-p="0">0</button>` +
      `<button type="button" data-p="del" aria-label="Borrar">${svg("i-back")}</button>`;
  }

  $("keypad").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) teclaMonto(b.dataset.k); });
  $("sheetQuick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]");
    if (!b) return;
    sh.amt = String(r2((parseFloat(sh.amt) || 0) + Number(b.dataset.q)));
    pintarMonto();
  });
  $("sheet").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) cerrarSheet(); });

  function sacudirMonto() {
    const a = document.querySelector(".amount-display");
    a.classList.remove("shake");
    void a.offsetWidth;
    a.classList.add("shake");
    vibrar(80);
  }

  $("sheetOk").addEventListener("click", () => {
    const v = r2(parseFloat(sh.amt));
    if (!(v > 0)) { sacudirMonto(); return toast("Escribe un monto"); }
    const nota = $("notaSheet").value.trim();
    let r, msg;

    if (sh.tipo === "pago") {
      const prov = $("proveedor").value.trim();
      if (!prov) { toast("Escribe el proveedor"); return $("proveedor").focus(); }
      const metodo = document.querySelector('input[name="metodo"]:checked').value;
      r = agregar({ tipo: "pago", monto: v, proveedor: prov, metodo, nota });
      msg = `Pago de S/ ${money(v)} a ${prov}`;
    } else {
      const signo = $("esDevol").checked ? -1 : 1;
      r = agregar({ tipo: sh.tipo, monto: signo * v, nota });
      msg = signo < 0 ? `Devolución de S/ ${money(v)}` : sh.tipo === "yape" ? `+ S/ ${money(v)} Yape registrado` : `+ S/ ${money(v)} en efectivo`;
    }
    cerrarSheet();
    toast(msg, "Deshacer", () => quitarMov(r.k, r.m.id));
  });

  document.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => abrirSheet(b.dataset.act)));

  // ---------- Borrar un movimiento ----------
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    const k = viewKey;
    const dd = state.days[k];
    const i = dd.movs.findIndex((m) => String(m.id) === b.dataset.del);
    if (i < 0) return;
    const [m] = dd.movs.splice(i, 1);
    save();
    render();
    toast("Movimiento eliminado", "Deshacer", () => {
      const d2 = state.days[k];
      if (!d2) return;
      d2.movs.splice(Math.min(i, d2.movs.length), 0, m);
      save();
      render();
    });
  });

  // ---------- Filtros ----------
  $("filtros").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    filtro = b.dataset.f;
    document.querySelectorAll(".fbtn").forEach((x) => x.classList.toggle("active", x === b));
    render();
  });

  // ---------- Arqueo ----------
  $("apertura").addEventListener("input", () => {
    cur().apertura = Math.max(0, parseFloat($("apertura").value) || 0);
    save();
    render();
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-den]");
    if (!b) return;
    const v = b.dataset.den;
    const d = cur();
    d.conteo[v] = Math.max(0, (d.conteo[v] || 0) + Number(b.dataset.d));
    save();
    render();
  });
  document.addEventListener("input", (e) => {
    const i = e.target.closest("[data-deninput]");
    if (!i) return;
    cur().conteo[i.dataset.deninput] = Math.max(0, parseInt(i.value, 10) || 0);
    save();
    render();
  });
  $("limpiarConteo").addEventListener("click", () => {
    cur().conteo = {};
    save();
    render();
    toast("Conteo limpio");
  });
  $("yapeApp").addEventListener("input", () => {
    const v = parseFloat($("yapeApp").value);
    cur().yapeApp = isNaN(v) ? null : v;
    save();
    render();
  });

  // ---------- Compartir ----------
  function resumenTexto() {
    const d = cur();
    const c = calc(d);
    let t = `📒 Arqueo del ${fmtLarga(viewKey)}\n\n`;
    t += `Ventas: ${soles(c.ventas)}\n`;
    t += `  • Yapes (${c.nYape}): ${soles(c.yape)}\n`;
    t += `  • Efectivo (${c.nEfectivo}): ${soles(c.efectivo)}\n`;
    t += `Pagos a proveedores: ${soles(c.pagos)}\n`;
    t += `Resultado del día: ${soles(c.resultado)}\n\n`;
    t += `Caja inicial: ${soles(c.apertura)}\n`;
    t += `Efectivo esperado: ${soles(c.esperado)}\n`;
    if (hayConteo(d)) {
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

  // ---------- Exportar y copia de seguridad ----------
  function descargar(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  $("exportar").addEventListener("click", () => {
    const d = cur();
    if (!d.movs.length) return toast("No hay registros para exportar");
    const c = calc(d);
    const filas = ["Hora,Tipo,Detalle,Método,Monto (S/)"];
    d.movs.forEach((m) => {
      const tipo = m.tipo === "yape" ? "Yape" : m.tipo === "efectivo" ? "Venta efectivo" : "Pago proveedor";
      const det = (m.tipo === "pago" ? m.proveedor + (m.nota ? " - " + m.nota : "") : m.nota || "").replace(/[,\n]/g, " ");
      const met = m.tipo === "pago" ? (m.metodo === "efectivo" ? "Efectivo" : "Yape/Transf.") : m.tipo === "yape" ? "Yape" : "Efectivo";
      filas.push(`${m.hora},${tipo},${det},${met},${money(m.tipo === "pago" ? -m.monto : m.monto)}`);
    });
    filas.push("", `Ventas,,,,${money(c.ventas)}`, `Pagos,,,,${money(c.pagos)}`, `Resultado,,,,${money(c.resultado)}`, `Efectivo esperado,,,,${money(c.esperado)}`, `Efectivo contado,,,,${money(c.contado)}`);
    descargar(`arqueo-${viewKey}.csv`, "﻿" + filas.join("\n"), "text/csv;charset=utf-8");
    toast("Día exportado");
  });

  $("respaldar").addEventListener("click", () => {
    descargar(`respaldo-arqueo-${hoyKey}.json`, JSON.stringify({ days: state.days, dark: state.dark }), "application/json");
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
        if (!data || typeof data.days !== "object" || Array.isArray(data.days)) throw new Error();
        if (!confirm("Esto reemplazará todos tus datos actuales. ¿Continuar?")) return;
        state = { ...state, days: data.days, dark: !!data.dark };
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
    const d = cur();
    if (!d.movs.length && !d.apertura && !hayConteo(d)) return toast("Este día ya está vacío");
    if (confirm("¿Borrar todos los registros y el conteo de este día?")) {
      state.days[viewKey] = nuevoDia();
      save();
      render();
      toast("Día reiniciado");
    }
  });

  // ---------- Cambiar de fecha ----------
  $("fechaInput").addEventListener("click", () => {
    try { if ($("fechaInput").showPicker) $("fechaInput").showPicker(); } catch (e) {}
  });
  $("fechaInput").addEventListener("change", (e) => {
    let v = e.target.value;
    if (!v) { e.target.value = viewKey; return; }
    if (v > hoyKey) v = hoyKey;
    viewKey = v;
    render();
    toast(v === hoyKey ? "Viendo hoy" : `Viendo ${fmtCorta(v)}`);
  });
  $("volverHoy").addEventListener("click", () => { viewKey = hoyKey; render(); toast("Viendo hoy"); });
  $("historialLista").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]");
    if (!b) return;
    viewKey = b.dataset.day;
    render();
    ir("inicio");
  });

  // ---------- Tema ----------
  function aplicarTema() {
    document.body.classList.toggle("dark", !!state.dark);
    $("modoOscuro").innerHTML = `${svg(state.dark ? "i-sun" : "i-moon")}<span>${state.dark ? "Modo claro" : "Modo oscuro"}</span>`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = state.dark ? "#0d0a1c" : "#5b21b6";
  }
  $("modoOscuro").addEventListener("click", () => { state.dark = !state.dark; save(); aplicarTema(); });

  // ---------- Navegación ----------
  const TITULOS = { inicio: "Resumen", movimientos: "Movimientos", arqueo: "Arqueo de caja", mas: "Más opciones" };
  function ir(nombre) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === nombre));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${nombre}`));
    $("tituloVista").textContent = TITULOS[nombre] || "";
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => ir(t.dataset.tab)));
  document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => ir(b.dataset.go)));

  function saludo() {
    const h = new Date().getHours();
    $("saludo").textContent = (h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches") + " 👋";
  }

  // ---------- Clave de acceso ----------
  // Aviso: la clave bloquea la pantalla de la app. Los datos siguen guardados en el
  // dispositivo, así que protege de miradas ajenas, no de alguien con acceso técnico.
  const lockEl = $("lock");
  const L = { mode: "enter", buf: "", first: "", after: null, cancelable: false, fails: 0, until: 0, busy: false };

  async function hashPin(pin, salt, forzarSimple) {
    const data = new TextEncoder().encode(salt + ":" + pin);
    if (!forzarSimple && window.crypto && crypto.subtle) {
      try {
        const buf = await crypto.subtle.digest("SHA-256", data);
        return "s:" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch (e) {}
    }
    let h1 = 5381, h2 = 52711;
    for (let r = 0; r < 2000; r++) {
      for (const b of data) { h1 = ((h1 * 33) ^ b) >>> 0; h2 = ((h2 * 31) + b + h1) >>> 0; }
    }
    return "f:" + h1.toString(16) + h2.toString(16);
  }
  const nuevaSal = () => {
    try { return [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
    catch (e) { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  };
  async function verificarPin(pin) {
    const h = await hashPin(pin, state.pin.salt, state.pin.hash.startsWith("f:"));
    return h === state.pin.hash;
  }
  async function guardarPin(pin) {
    const salt = nuevaSal();
    state.pin = { salt, hash: await hashPin(pin, salt) };
    save();
  }

  const TXT = {
    enter:   ["Ingresa tu clave", "Tus ventas están protegidas"],
    verify:  ["Ingresa tu clave actual", "Para continuar"],
    new:     ["Crea tu clave", "Elige 4 números que recuerdes"],
    confirm: ["Repite tu clave", "Para confirmarla"],
  };
  function lockTextos() {
    const t = TXT[L.mode];
    $("lockTitle").textContent = t[0];
    $("lockSub").textContent = t[1];
    $("lockCancel").hidden = !L.cancelable;
    $("lockForgot").hidden = !(L.mode === "enter" || L.mode === "verify");
  }
  function lockPuntos() { [...$("lockDots").children].forEach((d, i) => d.classList.toggle("on", i < L.buf.length)); }

  function mostrarLock(mode, opts = {}) {
    cerrarSheet();
    L.mode = mode; L.buf = ""; L.first = ""; L.after = opts.after || null; L.cancelable = !!opts.cancelable;
    $("lockMsg").textContent = "";
    lockTextos(); lockPuntos();
    lockEl.hidden = false;
    document.body.classList.add("locked", "noscroll");
    document.body.classList.remove("locked-boot");
  }
  function ocultarLock() {
    lockEl.hidden = true;
    document.body.classList.remove("locked", "noscroll", "locked-boot");
  }
  function errorPin(msg) {
    $("lockMsg").textContent = msg;
    L.buf = "";
    lockPuntos();
    const d = $("lockDots");
    d.classList.remove("shake");
    void d.offsetWidth;
    d.classList.add("shake");
    vibrar(120);
  }

  async function procesarPin() {
    if (L.busy) return;
    L.busy = true;
    const pin = L.buf;
    try {
      if (L.mode === "enter" || L.mode === "verify") {
        if (await verificarPin(pin)) {
          L.fails = 0;
          const f = L.after;
          ocultarLock();
          if (f) f();
        } else {
          L.fails++;
          errorPin("Clave incorrecta");
          if (L.fails >= 5) {
            L.fails = 0;
            L.until = Date.now() + 30000;
            $("lockMsg").textContent = "Demasiados intentos. Espera 30 segundos.";
          }
        }
      } else if (L.mode === "new") {
        L.first = pin; L.mode = "confirm"; L.buf = "";
        lockTextos(); lockPuntos();
      } else if (L.mode === "confirm") {
        if (pin === L.first) {
          await guardarPin(pin);
          ocultarLock();
          renderSeguridad();
          toast("Clave activada ✓");
        } else {
          L.mode = "new"; L.first = "";
          lockTextos();
          errorPin("No coinciden, intenta de nuevo");
        }
      }
    } finally { L.busy = false; }
  }

  function teclaPin(k) {
    if (L.busy) return;
    if (Date.now() < L.until) { $("lockMsg").textContent = "Espera unos segundos…"; return; }
    $("lockMsg").textContent = "";
    if (k === "del") L.buf = L.buf.slice(0, -1);
    else if (L.buf.length < 4) L.buf += k;
    lockPuntos();
    if (L.buf.length === 4) setTimeout(procesarPin, 120);
  }
  $("lockPad").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) teclaPin(b.dataset.p); });
  $("lockCancel").addEventListener("click", () => { if (L.cancelable) ocultarLock(); });
  $("lockForgot").addEventListener("click", () => {
    if (!confirm("Si olvidaste tu clave, la única forma de volver a entrar es borrar todos los datos de este dispositivo (después puedes restaurar una copia de seguridad). ¿Borrar todo y quitar la clave?")) return;
    state = { days: {}, dark: state.dark, pin: null };
    save();
    viewKey = hoyKey;
    ocultarLock();
    render();
    renderSeguridad();
    toast("Datos borrados");
  });

  function renderSeguridad() {
    const on = !!state.pin;
    $("btnClave").hidden = on;
    $("btnCambiar").hidden = !on;
    $("btnBloquear").hidden = !on;
    $("btnQuitar").hidden = !on;
  }
  $("btnClave").addEventListener("click", () => mostrarLock("new", { cancelable: true }));
  $("btnCambiar").addEventListener("click", () =>
    mostrarLock("verify", { cancelable: true, after: () => mostrarLock("new", { cancelable: true }) }));
  $("btnQuitar").addEventListener("click", () =>
    mostrarLock("verify", { cancelable: true, after: () => { state.pin = null; save(); renderSeguridad(); toast("Clave desactivada"); } }));
  $("btnBloquear").addEventListener("click", () => mostrarLock("enter"));

  // Bloqueo automático al volver a la app después de un rato
  let ocultoDesde = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { ocultoDesde = Date.now(); return; }
    if (state.pin && lockEl.hidden && ocultoDesde && Date.now() - ocultoDesde > 30000) mostrarLock("enter");
    tick();
  });

  // ---------- Teclado de la computadora ----------
  document.addEventListener("keydown", (e) => {
    const enTexto = e.target && e.target.matches && e.target.matches('input[type="text"], input[type="number"], input[type="date"]');
    if (!lockEl.hidden) {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); teclaPin(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); teclaPin("del"); }
      else if (e.key === "Escape" && L.cancelable) ocultarLock();
      return;
    }
    if (!$("sheet").hidden) {
      if (e.key === "Escape") return cerrarSheet();
      if (enTexto) return;
      // preventDefault evita que Enter vuelva a "pulsar" el botón que tenía el foco
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); teclaMonto(e.key); }
      else if (e.key === "." || e.key === ",") { e.preventDefault(); teclaMonto("."); }
      else if (e.key === "Backspace") { e.preventDefault(); teclaMonto("del"); }
      else if (e.key === "Enter") { e.preventDefault(); $("sheetOk").click(); }
    }
  });

  // ---------- Instalar como app ----------
  let promptInstalar = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); promptInstalar = e; });
  window.addEventListener("appinstalled", () => { $("instalar").hidden = true; toast("App instalada ✓"); });
  if ((window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone) $("instalar").hidden = true;
  $("instalar").addEventListener("click", async () => {
    if (promptInstalar) {
      promptInstalar.prompt();
      try { await promptInstalar.userChoice; } catch (e) {}
      promptInstalar = null;
      return;
    }
    const ua = navigator.userAgent;
    alert(
      /iPhone|iPad|iPod/.test(ua)
        ? "En iPhone: abre esta página en Safari, toca el botón Compartir (el cuadrado con la flecha) y elige «Agregar a inicio»."
        : /Android/.test(ua)
        ? "En Android: toca el menú ⋮ de Chrome y elige «Instalar aplicación» (o «Agregar a la pantalla principal»)."
        : "En computadora: en Chrome o Edge toca el ícono de instalar que aparece a la derecha de la barra de direcciones, o abre el menú ⋮ y elige «Instalar»."
    );
  });

  // ---------- Reloj: cambio de día automático ----------
  function tick() {
    const nk = dayKey();
    if (nk !== hoyKey) {
      if (viewKey === hoyKey) viewKey = nk;
      hoyKey = nk;
    }
    saludo();
    render();
  }

  // ---------- Inicio ----------
  crearDenoms();
  crearTeclados();
  saludo();
  aplicarTema();
  renderSeguridad();
  render();
  if (state.pin) mostrarLock("enter");
  setInterval(tick, 60 * 1000);

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();

