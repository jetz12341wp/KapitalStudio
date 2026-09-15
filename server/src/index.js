const path = require('path');
const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');
const appointmentsRouter = require('./routes/appointments');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', appointmentsRouter);

// Sirve el front-end estático (public/) desde el mismo servidor.
const publicDir = path.join(__dirname, '..', '..', 'public');
app.use(express.static(publicDir));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`Barbería Skills backend escuchando en http://localhost:${PORT}`);
});
