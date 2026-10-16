# Servidor de competencia de matemáticas

Servidor WebSocket que coordina una competencia de preguntas y respuestas en tiempo real. Forma parte del proyecto **matemaprende**: el presentador crea una sala desde la web, los alumnos se conectan desde sus celulares y responden cada pregunta.

Este repositorio contiene solo el servidor. La parte visual está en el proyecto de Angular.

## Qué hace

- Crea salas con un código de 4 caracteres.
- Permite que los alumnos se unan con su nombre mientras la sala está en espera.
- Elige 8 preguntas al azar de un banco de 26 en cada partida y baraja las opciones.
- Calcula puntos: 100 por respuesta correcta y 50 extra para la primera persona que acierta.
- Muestra el ranking al final y declara al ganador.

## Requisitos

- Node.js 18 o superior.

## Instalación local


npm install
npm start


El servidor queda escuchando en el puerto `3000`, o en el que indique la variable `PORT`.

## Cómo funciona la comunicación

El servidor usa WebSockets. Los mensajes se envían en formato JSON. Algunos ejemplos:

| Quién envía | Mensaje | Qué hace |
|---|---|---|
| Presentador | `{ "tipo": "crear" }` | Crea una sala y devuelve su código |
| Alumno | `{ "tipo": "unirse", "codigo": "ABCD", "nombre": "Ana" }` | Entra a la sala en espera |
| Presentador | `{ "tipo": "iniciar" }` | Empieza la competencia y envía la primera pregunta |
| Presentador | `{ "tipo": "revelar" }` | Muestra la respuesta correcta y el ranking parcial |
| Presentador | `{ "tipo": "siguiente" }` | Pasa a la siguiente pregunta o termina la partida |
| Alumno | `{ "tipo": "responder", "opcion": 2 }` | Envía la opción elegida (índice de 0 a 3) |

## Cómo cambiar las preguntas

Las preguntas están en el arreglo `BANCO` de `server.js`. Cada una tiene este formato:

js
{ texto: '¿Cuánto es 7 × 8?', opciones: ['48', '54', '56', '64'], correcta: '56' }


La respuesta en `correcta` debe escribirse exactamente igual que una de las opciones. Para cambiar cuántas preguntas tiene cada partida, modifica `PREGUNTAS_POR_PARTIDA`. Si el banco tiene menos preguntas que ese número, la partida usa todas las que haya.

## Despliegue en Render

Este repositorio está conectado a un servicio Web de Render con estas opciones:

- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Auto-Deploy:** On Commit (cada commit a `main` se despliega solo)

Render asigna el puerto automáticamente mediante la variable `PORT`, por eso el servidor no lo fija en el código.

## Limitaciones

- Las salas se guardan en memoria. Si el servicio se reinicia, las salas y los puntajes se pierden.
- En el plan gratuito, el servicio se duerme tras unos 15 minutos sin uso. La primera conexión puede tardar entre 30 y 60 segundos.
- Si el presentador cierra su conexión, la sala se cierra para todos.
- Un alumno que recarga la página durante el juego no puede volver a entrar.

## Conexión con la web

La página de Angular se conecta a este servidor mediante `wss://matemaprende.onrender.com`. Si cambias la dirección del servicio en Render, actualiza la constante `WS_URL` en el proyecto de Angular.