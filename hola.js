// --- Librerías necesarias ---
const fs = require("fs");
const readline = require("readline");

// --- Clase Actividad ---
class Actividad {
    constructor(nombre, tiempo_llegada, duracion) {
        this.nombre = nombre;
        this.tiempo_llegada = tiempo_llegada;
        this.duracion = duracion;
        this.tiempo_final = 0;
        this.tiempo_retorno = 0;
        this.tiempo_espera = 0;
        this.indice_servicio = 0;
        this.duracion_restante = duracion; // Para Round Robin
    }

    calcularMetricas() {
        this.tiempo_retorno = this.tiempo_final - this.tiempo_llegada;
        this.tiempo_espera = this.tiempo_retorno - this.duracion;
        this.indice_servicio = this.tiempo_retorno > 0 ? this.duracion / this.tiempo_retorno : 0;
    }
}

// --- Función para leer datos desde archivo ---
async function obtenerDatosDesdeArchivo() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function pregunta(query) {
        return new Promise(resolve => rl.question(query, resolve));
    }

    let actividades = [];
    const linePattern = /(\w+)\s*\((\d+)\s*,\s*(\d+)\)/;

    while (true) {
        let filename = (await pregunta("Ingrese el nombre del archivo de datos (ej. datos.txt): ")).trim();
        if (!filename) {
            console.log("No se ingresó un nombre.");
            continue;
        }

        try {
            const contenido = fs.readFileSync(filename, "utf-8");
            actividades = [];

            contenido.split(/\r?\n/).forEach((linea, idx) => {
                linea = linea.trim();
                if (!linea) return;

                const match = linea.match(linePattern);
                if (match) {
                    const nombre = match[1];
                    const tiempo_llegada = parseInt(match[2]);
                    const duracion = parseInt(match[3]);
                    actividades.push(new Actividad(nombre, tiempo_llegada, duracion));
                } else {
                    console.log(`Advertencia: La línea ${idx + 1} ('${linea}') no tiene el formato esperado.`);
                }
            });

            if (actividades.length === 0) {
                console.log(`No se pudo leer ninguna actividad válida del archivo '${filename}'.`);
                continue;
            }

            console.log(`Se cargaron ${actividades.length} actividades desde '${filename}'.`);
            rl.close();
            return actividades;

        } catch (e) {
            console.log(`Error al leer el archivo: ${e.message}`);
        }
    }
}

// --- Función para imprimir resultados ---
function imprimirResultados(actividades, nombreAlgoritmo) {
    console.log(`\n--- Resultados para el algoritmo: ${nombreAlgoritmo} ---`);
    let total_T = 0, total_E = 0, total_I = 0;

    if (!actividades.length) {
        console.log("No hay actividades para mostrar.");
        return null;
    }

    console.log("Actividad | ti  | t   | tf  | T   | E   | I");
    console.log("-".repeat(50));

    actividades.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(act => {
        console.log(`${act.nombre.padEnd(9)} | ${act.tiempo_llegada.toString().padEnd(3)} | ${act.duracion.toString().padEnd(3)} | ${act.tiempo_final.toString().padEnd(3)} | ${act.tiempo_retorno.toString().padEnd(3)} | ${act.tiempo_espera.toString().padEnd(3)} | ${act.indice_servicio.toFixed(2)}`);
        total_T += act.tiempo_retorno;
        total_E += act.tiempo_espera;
        total_I += act.indice_servicio;
    });

    const n = actividades.length;
    const prom_T = total_T / n;
    const prom_E = total_E / n;
    const prom_I = total_I / n;

    console.log("-".repeat(50));
    console.log(`Promedio T: ${prom_T.toFixed(2)}`);
    console.log(`Promedio E: ${prom_E.toFixed(2)}`);
    console.log(`Promedio I: ${prom_I.toFixed(2)}`);

    return { prom_T, prom_E, prom_I };
}

// --- Algoritmos de planificación ---
function simulacionFIFO(actividadesOriginales) {
    const actividades = actividadesOriginales
        .map(a => new Actividad(a.nombre, a.tiempo_llegada, a.duracion))
        .sort((a, b) => a.tiempo_llegada - b.tiempo_llegada);

    let tiempoActual = 0;
    for (const act of actividades) {
        if (tiempoActual < act.tiempo_llegada) tiempoActual = act.tiempo_llegada;
        act.tiempo_final = tiempoActual + act.duracion;
        act.calcularMetricas();
        tiempoActual = act.tiempo_final;
    }

    return imprimirResultados(actividades, "FIFO");
}

function simulacionLIFO(actividadesOriginales) {
    const pendientes = actividadesOriginales.map(a => new Actividad(a.nombre, a.tiempo_llegada, a.duracion));
    const terminadas = [];
    let tiempoActual = 0;

    while (pendientes.length) {
        const listas = pendientes.filter(a => a.tiempo_llegada <= tiempoActual);
        if (!listas.length) {
            tiempoActual = Math.min(...pendientes.map(a => a.tiempo_llegada));
            continue;
        }

        const act = listas.reduce((prev, curr) => (curr.tiempo_llegada > prev.tiempo_llegada ? curr : prev));
        act.tiempo_final = tiempoActual + act.duracion;
        act.calcularMetricas();
        tiempoActual = act.tiempo_final;

        terminadas.push(act);
        pendientes.splice(pendientes.indexOf(act), 1);
    }

    return imprimirResultados(terminadas, "LIFO");
}

function simulacionRoundRobin(actividadesOriginales, quantum) {
    const actividades = actividadesOriginales.map(a => new Actividad(a.nombre, a.tiempo_llegada, a.duracion));
    const pendientes = actividades.sort((a, b) => a.tiempo_llegada - b.tiempo_llegada);
    const cola = [];
    const terminadas = [];
    let tiempoActual = 0;
    let idxPendientes = 0;

    while (terminadas.length < actividades.length) {
        while (idxPendientes < pendientes.length && pendientes[idxPendientes].tiempo_llegada <= tiempoActual) {
            cola.push(pendientes[idxPendientes]);
            idxPendientes++;
        }

        if (!cola.length) {
            if (idxPendientes < pendientes.length) {
                tiempoActual = pendientes[idxPendientes].tiempo_llegada;
            } else break;
            continue;
        }

        const act = cola.shift();
        const tiempoTurno = Math.min(quantum, act.duracion_restante);
        tiempoActual += tiempoTurno;
        act.duracion_restante -= tiempoTurno;

        while (idxPendientes < pendientes.length && pendientes[idxPendientes].tiempo_llegada <= tiempoActual) {
            cola.push(pendientes[idxPendientes]);
            idxPendientes++;
        }

        if (act.duracion_restante === 0) {
            act.tiempo_final = tiempoActual;
            act.calcularMetricas();
            terminadas.push(act);
        } else {
            cola.push(act);
        }
    }

    return imprimirResultados(terminadas, "Round Robin");
}

// --- Comparación de resultados ---
function compararResultados(resFIFO, resLIFO, resRR) {
    console.log("\n" + "=".repeat(50));
    console.log("      COMPARACIÓN FINAL DE ALGORITMOS      ");
    console.log("=".repeat(50));

    const resultados = {};
    if (resFIFO) resultados.FIFO = resFIFO;
    if (resLIFO) resultados.LIFO = resLIFO;
    if (resRR) resultados["Round Robin"] = resRR;

    const mejorT = Object.entries(resultados).reduce((a, b) => a[1].prom_T < b[1].prom_T ? a : b);
    const mejorE = Object.entries(resultados).reduce((a, b) => a[1].prom_E < b[1].prom_E ? a : b);
    const mejorI = Object.entries(resultados).reduce((a, b) => a[1].prom_I > b[1].prom_I ? a : b);

    console.log(`Mejor T (Retorno):    ${mejorT[0]} (T = ${mejorT[1].prom_T.toFixed(2)})`);
    console.log(`Mejor E (Espera):     ${mejorE[0]} (E = ${mejorE[1].prom_E.toFixed(2)})`);
    console.log(`Mejor I (Servicio):   ${mejorI[0]} (I = ${mejorI[1].prom_I.toFixed(2)})`);
}

// --- Función principal ---
async function main() {
    const actividades = await obtenerDatosDesdeArchivo();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    function pregunta(query) { return new Promise(resolve => rl.question(query, resolve)); }

    let quantum = 0;
    while (quantum <= 0) {
        const entrada = await pregunta("\nIngrese el quantum (Q) para Round Robin: ");
        quantum = parseInt(entrada);
        if (isNaN(quantum) || quantum <= 0) console.log("Quantum inválido. Debe ser un número entero positivo.");
    }
    rl.close();

    console.log("\n" + "=".repeat(50));
    console.log("      INICIANDO SIMULACIONES      ");
    console.log("=".repeat(50));

    const resFIFO = simulacionFIFO(actividades);
    const resLIFO = simulacionLIFO(actividades);
    const resRR = simulacionRoundRobin(actividades, quantum);

    compararResultados(resFIFO, resLIFO, resRR);
}

// --- Ejecutar programa ---
main();
