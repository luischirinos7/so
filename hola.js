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
        this.terminado = false; // Estado de finalización
    }

    calcularMetricas() {
        this.tiempo_retorno = this.tiempo_final - this.tiempo_llegada;
        this.tiempo_espera = this.tiempo_retorno - this.duracion;
        this.indice_servicio = this.tiempo_retorno > 0 ? this.duracion / this.tiempo_retorno : 0;
    }
}

// --- Función para leer datos desde archivo ---
async function obtenerDatosDesdeArchivo(rl) {
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
        console.log(`${act.nombre.padEnd(9)} | ${act.tiempo_llegada.toString().padEnd(3)} | ${act.duracion.toString().padEnd(3)} | ${act.tiempo_final.toString().padEnd(3)} | ${act.tiempo_retorno.toString().padEnd(3)} | ${act.tiempo_espera.toString().padEnd(3)} | ${act.indice_servicio.toFixed(4)}`);
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
    // Clonamos las actividades preservando el orden original (A, B, C...)
    const actividades = actividadesOriginales.map(a => new Actividad(a.nombre, a.tiempo_llegada, a.duracion));
    
    let tiempoActual = 0;
    let completados = 0;

    // Bucle principal hasta terminar todos
    while (completados < actividades.length) {
        let ejecutoAlgo = false;

        // Escaneo estricto desde el inicio de la lista (A -> L)
        // Ejecuta el PRIMERO que encuentre que ya llegó y no ha terminado
        for (let i = 0; i < actividades.length; i++) {
            let act = actividades[i];
            
            if (!act.terminado && act.tiempo_llegada <= tiempoActual) {
                tiempoActual += act.duracion;
                act.tiempo_final = tiempoActual;
                act.calcularMetricas();
                act.terminado = true;
                
                completados++;
                ejecutoAlgo = true;
                break; // Reiniciamos la búsqueda desde A
            }
        }

        // Si nadie podía ejecutarse (CPU ociosa), avanzamos el reloj
        if (!ejecutoAlgo) {
            tiempoActual++;
        }
    }

    return imprimirResultados(actividades, "FIFO");
}

function simulacionLIFO(actividadesOriginales) {
    const actividades = actividadesOriginales.map(a => new Actividad(a.nombre, a.tiempo_llegada, a.duracion));
    
    let tiempoActual = 0;
    let completados = 0;

    while (completados < actividades.length) {
        let ejecutoAlgo = false;

        // Escaneo estricto INVERSO (desde el final hacia el principio, L -> A)
        // Prioriza a los que están abajo en la lista
        for (let i = actividades.length - 1; i >= 0; i--) {
            let act = actividades[i];
            
            if (!act.terminado && act.tiempo_llegada <= tiempoActual) {
                tiempoActual += act.duracion;
                act.tiempo_final = tiempoActual;
                act.calcularMetricas();
                act.terminado = true;
                
                completados++;
                ejecutoAlgo = true;
                break; // Reiniciamos la búsqueda
            }
        }

        if (!ejecutoAlgo) {
            tiempoActual++;
        }
    }

    return imprimirResultados(actividades, "LIFO");
}

function simulacionRoundRobin(actividadesOriginales, quantum) {
    const actividades = actividadesOriginales.map(a => new Actividad(a.nombre, a.tiempo_llegada, a.duracion));
    
    let tiempoActual = 0;
    let completados = 0;
    let index = 0; // Puntero circular

    while (completados < actividades.length) {
        let cpuOciosa = true;

        // Intentamos recorrer la lista una vez completa desde la posición actual
        let inicioCiclo = index;
        
        for (let i = 0; i < actividades.length; i++) {
            // Cálculo del índice circular
            let actualIdx = (inicioCiclo + i) % actividades.length;
            let act = actividades[actualIdx];

            // Si el proceso apuntado ya llegó y no ha terminado
            if (!act.terminado && act.tiempo_llegada <= tiempoActual) {
                cpuOciosa = false;
                
                // Ejecutamos un Quantum o lo que reste
                let tiempoEjecucion = Math.min(quantum, act.duracion_restante);
                tiempoActual += tiempoEjecucion;
                act.duracion_restante -= tiempoEjecucion;

                if (act.duracion_restante === 0) {
                    act.tiempo_final = tiempoActual;
                    act.calcularMetricas();
                    act.terminado = true;
                    completados++;
                }
                
                // IMPORTANTE: Movemos el puntero al siguiente para la próxima iteración
                index = (actualIdx + 1) % actividades.length;
                break; // Salimos del for para volver al while principal y re-evaluar
            }
        }

        if (cpuOciosa) {
            tiempoActual++;
        }
    }

    return imprimirResultados(actividades, "Round Robin");
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
    // Creamos la interfaz UNA sola vez al inicio
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    // Pasamos 'rl' a la función
    const actividades = await obtenerDatosDesdeArchivo(rl); 
    
    if (!actividades) {
        rl.close();
        return;
    }

    function pregunta(query) { return new Promise(resolve => rl.question(query, resolve)); }

    let quantum = 0;
    while (quantum <= 0) {
        const entrada = await pregunta("\nIngrese el quantum (Q) para Round Robin: ");
        quantum = parseInt(entrada);
        if (isNaN(quantum) || quantum <= 0) console.log("Quantum inválido. Debe ser un número entero positivo.");
    }
    rl.close(); // Cerramos aquí, al final de toda la entrada de datos

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
