const { WebSocketServer } = require('ws');

const PUERTO = process.env.PORT || 3000;
const PUNTOS = 100;
const BONO_PRIMERO = 50;
const PREGUNTAS_POR_PARTIDA = 8;

// Banco de preguntas. "correcta" es el texto de la respuesta correcta.
const BANCO = [
  { texto: '¿Cuánto es el 15% de 200?', opciones: ['25', '30', '35', '40'], correcta: '30' },
  { texto: '¿Cuánto es 2³?', opciones: ['6', '8', '9', '10'], correcta: '8' },
  { texto: 'Si x + 7 = 12, ¿cuánto vale x?', opciones: ['3', '4', '5', '19'], correcta: '5' },
  { texto: '¿Cuál es el área de un cuadrado de lado 6?', opciones: ['12', '24', '36', '48'], correcta: '36' },
  { texto: 'Dos ángulos de un triángulo miden 60° y 70°. ¿Cuánto mide el tercero?', opciones: ['40°', '50°', '60°', '70°'], correcta: '50°' },
  { texto: '¿Cuánto es √81?', opciones: ['7', '8', '9', '10'], correcta: '9' },
  { texto: '¿Qué número sigue? 2, 4, 8, 16, ...', opciones: ['18', '24', '30', '32'], correcta: '32' },
  { texto: 'Un auto recorre 60 km en 1 hora. ¿Cuántos km recorre en 2.5 horas?', opciones: ['120', '130', '150', '160'], correcta: '150' },
  { texto: 'Un triángulo rectángulo tiene catetos de 3 y 4. ¿Cuánto mide la hipotenusa?', opciones: ['5', '6', '7', '12'], correcta: '5' },
  { texto: '¿Cuánto es el 25% de 80?', opciones: ['15', '20', '25', '30'], correcta: '20' },
  { texto: '¿Cuánto es 7 × 8?', opciones: ['48', '54', '56', '64'], correcta: '56' },
  { texto: 'Un producto cuesta $200 y tiene 10% de descuento. ¿Cuánto pagas?', opciones: ['160', '180', '190', '210'], correcta: '180' },
  { texto: '¿Cuál es el perímetro de un cuadrado de lado 5?', opciones: ['10', '15', '20', '25'], correcta: '20' },
  { texto: '¿Cuánto es 10² − 4²?', opciones: ['36', '60', '84', '96'], correcta: '84' },
  { texto: 'Si 3x = 27, ¿cuánto vale x?', opciones: ['6', '7', '9', '24'], correcta: '9' },
  { texto: '¿Cuántos grados suman los ángulos internos de un triángulo?', opciones: ['90°', '180°', '270°', '360°'], correcta: '180°' },
  { texto: '¿Cuál es la mitad de 3/4?', opciones: ['1/2', '3/4', '1/4', '3/8'], correcta: '3/8' },
  { texto: '¿Cuánto es 1000 ÷ 25?', opciones: ['20', '40', '250', '400'], correcta: '40' },
  { texto: 'Un rectángulo mide 4 de largo y 6 de ancho. ¿Cuál es su área?', opciones: ['10', '20', '24', '48'], correcta: '24' },
  { texto: '¿Cuánto es 0,2 + 0,03?', opciones: ['0,05', '0,23', '0,5', '2,3'], correcta: '0,23' },
  { texto: '¿Cuál de estos números es primo?', opciones: ['21', '27', '29', '33'], correcta: '29' },
  { texto: '¿Cuánto es 5! (5 factorial)?', opciones: ['25', '60', '120', '720'], correcta: '120' },
  { texto: 'Un auto gasta 8 litros cada 100 km. ¿Cuántos litros gasta en 250 km?', opciones: ['16', '18', '20', '25'], correcta: '20' },
  { texto: '¿Cuánto es (−3) × (−4)?', opciones: ['−12', '−7', '7', '12'], correcta: '12' },
  { texto: '¿Cuánto es el 10% de 1500?', opciones: ['15', '150', '1500', '15000'], correcta: '150' },
  { texto: 'Si el lado de un cubo mide 3, ¿cuál es su volumen?', opciones: ['9', '18', '27', '36'], correcta: '27' },
  { texto: '¿Cuánto es 2⁵?', opciones: ['10', '16', '25', '32'], correcta: '32' }
];

function barajar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Elige preguntas al azar y baraja sus opciones, guardando la posición correcta
function generarPartida() {
  return barajar(BANCO).slice(0, PREGUNTAS_POR_PARTIDA).map(p => {
    const opciones = barajar(p.opciones);
    return {
      texto: p.texto,
      opciones,
      correcta: opciones.indexOf(p.correcta)
    };
  });
}

const salas = new Map();
const wss = new WebSocketServer({ port: PUERTO });

const enviar = (ws, msg) => {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
};

const atodos = (sala, msg) => {
  enviar(sala.host, msg);
  sala.jugadores.forEach(j => enviar(j.ws, msg));
};

const ranking = sala =>
  sala.jugadores
    .map(j => ({ nombre: j.nombre, puntos: j.puntos }))
    .sort((a, b) => b.puntos - a.puntos);

function nuevoCodigo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do {
    c = Array.from({ length: 4 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');
  } while (salas.has(c));
  return c;
}

function preguntar(sala) {
  const p = sala.preguntas[sala.indice];
  sala.yaAcerto = false;
  sala.jugadores.forEach(j => (j.respondio = false));
  const base = { n: sala.indice + 1, total: sala.preguntas.length, texto: p.texto, opciones: p.opciones };
  enviar(sala.host, { tipo: 'pregunta', ...base, correcta: p.correcta });
  sala.jugadores.forEach(j => enviar(j.ws, { tipo: 'pregunta', ...base }));
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.tipo === 'crear') {
      const codigo = nuevoCodigo();
      salas.set(codigo, {
        codigo, host: ws, jugadores: [], estado: 'espera',
        preguntas: [], indice: -1, yaAcerto: false
      });
      ws.rol = 'host';
      ws.sala = codigo;
      return enviar(ws, { tipo: 'sala', codigo });
    }

    if (m.tipo === 'unirse') {
      const s = salas.get(String(m.codigo || '').toUpperCase());
      if (!s) return enviar(ws, { tipo: 'error', mensaje: 'Esa sala no existe' });
      if (s.estado !== 'espera') return enviar(ws, { tipo: 'error', mensaje: 'La competencia ya empezó' });
      if (s.jugadores.some(j => j.nombre === m.nombre)) {
        return enviar(ws, { tipo: 'error', mensaje: 'Ese nombre ya está en uso' });
      }
      s.jugadores.push({ nombre: m.nombre, ws, puntos: 0, respondio: false });
      ws.rol = 'jugador';
      ws.sala = s.codigo;
      enviar(ws, { tipo: 'unido' });
      return enviar(s.host, { tipo: 'jugadores', lista: s.jugadores.map(j => j.nombre) });
    }

    const sala = salas.get(ws.sala);
    if (!sala) return;

    if (ws.rol === 'host') {
      if (m.tipo === 'iniciar' && sala.estado === 'espera' && sala.jugadores.length) {
        sala.estado = 'juego';
        sala.preguntas = generarPartida();
        sala.indice = 0;
        return preguntar(sala);
      }
      if (m.tipo === 'revelar' && sala.estado === 'juego') {
        sala.estado = 'revelada';
        const p = sala.preguntas[sala.indice];
        return atodos(sala, { tipo: 'revelar', correcta: p.correcta, ranking: ranking(sala) });
      }
      if (m.tipo === 'siguiente' && sala.estado === 'revelada') {
        sala.indice++;
        if (sala.indice >= sala.preguntas.length) {
          sala.estado = 'fin';
          return atodos(sala, { tipo: 'fin', ranking: ranking(sala) });
        }
        sala.estado = 'juego';
        return preguntar(sala);
      }
    }

    if (ws.rol === 'jugador' && m.tipo === 'responder' && sala.estado === 'juego') {
      const j = sala.jugadores.find(x => x.ws === ws);
      if (!j || j.respondio) return;
      j.respondio = true;
      const correcto = m.opcion === sala.preguntas[sala.indice].correcta;
      if (correcto) {
        j.puntos += PUNTOS + (sala.yaAcerto ? 0 : BONO_PRIMERO);
        sala.yaAcerto = true;
      }
      enviar(ws, { tipo: 'resultado', correcto });
      enviar(sala.host, {
        tipo: 'respondieron',
        cuantos: sala.jugadores.filter(x => x.respondio).length,
        total: sala.jugadores.length
      });
    }
  });

  ws.on('close', () => {
    const sala = salas.get(ws.sala);
    if (!sala) return;
    if (ws.rol === 'host') {
      sala.jugadores.forEach(j => enviar(j.ws, { tipo: 'cerrada' }));
      salas.delete(sala.codigo);
    } else if (ws.rol === 'jugador') {
      sala.jugadores = sala.jugadores.filter(j => j.ws !== ws);
      enviar(sala.host, { tipo: 'jugadores', lista: sala.jugadores.map(j => j.nombre) });
    }
  });
});

console.log(`Servidor de competencia escuchando en el puerto ${PUERTO}`);