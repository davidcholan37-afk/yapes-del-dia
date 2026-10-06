window.addEventListener("load", function () {

  let yapes = Number(localStorage.getItem("yapes")) || 0;
  let registros = JSON.parse(localStorage.getItem("registros")) || [];
  let historial = JSON.parse(localStorage.getItem("historial")) || [];

  const contador = document.getElementById("contador");
  const total = document.getElementById("total");
  const dinero = document.getElementById("dinero");
  const monto = document.getElementById("monto");

  const sumar = document.getElementById("sumar");
  const restar = document.getElementById("restar");
  const deshacer = document.getElementById("deshacer");
  const reiniciar = document.getElementById("reiniciar");
  const exportar = document.getElementById("exportar");
  const historialBtn = document.getElementById("historial");
  const modoOscuro = document.getElementById("modoOscuro");

  const lista = document.getElementById("lista");
  const historialLista = document.getElementById("historialLista");

  const resumenYapes = document.getElementById("resumenYapes");
  const resumenDinero = document.getElementById("resumenDinero");
  const fecha = document.getElementById("fecha");

  function actualizar() {

    contador.textContent = yapes;
    total.textContent = yapes;

    let suma = 0;

    registros.forEach(function (registro) {
      suma += Number(registro.monto);
    });

    dinero.textContent = suma.toFixed(2);

    if (resumenYapes) {
      resumenYapes.textContent = yapes;
    }

    if (resumenDinero) {
      resumenDinero.textContent = suma.toFixed(2);
    }

    if (fecha) {
      fecha.textContent = new Date().toLocaleDateString("es-PE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }

    localStorage.setItem("yapes", yapes);
    localStorage.setItem("registros", JSON.stringify(registros));

    mostrarRegistros();
  }

  function mostrarRegistros() {

    if (!lista) return;

    lista.innerHTML = "";

    registros.forEach(function (registro, index) {

      const elemento = document.createElement("li");

      elemento.textContent =
        "Yape #" + (index + 1) +
        " • S/ " + Number(registro.monto).toFixed(2) +
        " • " + registro.hora;

      lista.appendChild(elemento);
    });
  }

  function mostrarHistorial() {

    if (!historialLista) return;

    historialLista.innerHTML = "";

    historial.forEach(function (dia) {

      const elemento = document.createElement("div");

      elemento.className = "historial-card";

      elemento.innerHTML =
        "<div class='historial-fecha'>📅 " + dia.fecha + "</div>" +
        "<div class='historial-datos'>🟣 " + dia.yapes + " Yapes</div>" +
        "<div class='historial-total'>💰 S/ " +
        Number(dia.total).toFixed(2) +
        "</div>";

      historialLista.appendChild(elemento);
    });
  }

  sumar.addEventListener("click", function () {

    const valor = Number(monto.value);

    if (valor <= 0 || isNaN(valor)) {
      alert("Escribe un monto válido.");
      return;
    }

    const ahora = new Date();

    const hora = ahora.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    registros.push({
      monto: valor,
      hora: hora
    });

    yapes++;

    monto.value = "";

    actualizar();
  });

  restar.addEventListener("click", function () {

    if (yapes > 0 && registros.length > 0) {
      yapes--;
      registros.pop();
      actualizar();
    }

  });

  deshacer.addEventListener("click", function () {

    if (registros.length === 0) {
      alert("No hay ningún Yape para deshacer.");
      return;
    }

    registros.pop();
    yapes--;

    actualizar();
  });

  reiniciar.addEventListener("click", function () {

    if (registros.length === 0) {
      alert("No hay Yapes registrados.");
      return;
    }

    const confirmar = confirm(
      "¿Seguro que quieres cerrar el día y guardar este resumen?"
    );

    if (!confirmar) return;

    let suma = 0;

    registros.forEach(function (registro) {
      suma += Number(registro.monto);
    });

    historial.push({
      fecha: new Date().toLocaleDateString("es-PE"),
      yapes: registros.length,
      total: suma
    });

    localStorage.setItem(
      "historial",
      JSON.stringify(historial)
    );

    yapes = 0;
    registros = [];

    actualizar();
    mostrarHistorial();
  });

  historialBtn.addEventListener("click", function () {
    mostrarHistorial();
  });

  exportar.addEventListener("click", function () {

    if (registros.length === 0) {
      alert("No hay Yapes para exportar.");
      return;
    }

    let texto = "YAPES DEL DÍA\n\n";

    registros.forEach(function (registro, index) {

      texto +=
        "Yape #" + (index + 1) +
        " | S/ " + Number(registro.monto).toFixed(2) +
        " | " + registro.hora + "\n";
    });

    let suma = 0;

    registros.forEach(function (registro) {
      suma += Number(registro.monto);
    });

    texto += "\n----------------\n";
    texto += "TOTAL DE YAPES: " + registros.length + "\n";
    texto += "DINERO RECIBIDO: S/ " + suma.toFixed(2);

    const archivo = new Blob([texto], {
      type: "text/plain"
    });

    const url = URL.createObjectURL(archivo);

    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = "yapes-del-dia.txt";

    enlace.click();

    URL.revokeObjectURL(url);
  });

  // 🌙 MODO OSCURO

  if (modoOscuro) {

    if (localStorage.getItem("modoOscuro") === "true") {
      document.body.classList.add("oscuro");
      modoOscuro.textContent = "☀️ Modo claro";
    }

    modoOscuro.addEventListener("click", function () {

      document.body.classList.toggle("oscuro");

      const oscuro =
        document.body.classList.contains("oscuro");

      localStorage.setItem("modoOscuro", oscuro);

      modoOscuro.textContent =
        oscuro
          ? "☀️ Modo claro"
          : "🌙 Modo oscuro";
    });

  }

  actualizar();
  mostrarHistorial();

});
