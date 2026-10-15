const { WebSocketServer } = require('ws');

const PUERTO = process.env.PORT || 3000;
const PUNTOS = 100;
const BONO_PRIMERO = 50;

const PREGUNTAS = [
  { texto: '¿Cuánto es el 15% de 200?', opciones: ['25', '30', '35', '40'], correcta: 1 },
  { texto: '¿Cuánto es 2³?', opciones: ['6', '8', '9', '10'], correcta: 1 },
  { texto: 'Si x + 7 = 12, ¿cuánto vale x?', opciones: ['3', '4', '5', '19'], correcta: 2 },
  { texto: '¿Cuál es el área de un cuadrado de lado 6?', opciones: ['12', '24', '36', '48'], correcta: 2 },
  { texto: 'Dos ángulos de un triángulo miden 60° y 70°. ¿Cuánto mide el tercero?', opciones: ['40°', '50°', '60°', '70°'], correcta: 1 },
  { texto: '¿Cuánto es √81?', opciones: ['7', '8', '9', '10'], correcta: 2 },
  { texto: '¿Qué número sigue? 2, 4, 8, 16, ...', opciones: ['18', '24', '30', '32'], correcta: 3 },
  { texto: 'Un auto recorre 60 km en 1 hora. ¿Cuántos km recorre en 2.5 horas?', opciones: ['120', '130', '150', '160'], correcta: 2 }
];

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
  const p = PREGUNTAS[sala.indice];
  sala.yaAcerto = false;
  sala.jugadores.forEach(j => (j.respondio = false));
  const base = { n: sala.indice + 1, total: PREGUNTAS.length, texto: p.texto, opciones: p.opciones };
  enviar(sala.host, { tipo: 'pregunta', ...base, correcta: p.correcta });
  sala.jugadores.forEach(j => enviar(j.ws, { tipo: 'pregunta', ...base }));
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.tipo === 'crear') {
      const codigo = nuevoCodigo();
      salas.set(codigo, { codigo, host: ws, jugadores: [], estado: 'espera', indice: -1, yaAcerto: false });
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
        sala.indice = 0;
        return preguntar(sala);
      }
      if (m.tipo === 'revelar' && sala.estado === 'juego') {
        sala.estado = 'revelada';
        const p = PREGUNTAS[sala.indice];
        return atodos(sala, { tipo: 'revelar', correcta: p.correcta, ranking: ranking(sala) });
      }
      if (m.tipo === 'siguiente' && sala.estado === 'revelada') {
        sala.indice++;
        if (sala.indice >= PREGUNTAS.length) {
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
      const correcto = m.opcion === PREGUNTAS[sala.indice].correcta;
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