const express = require('express');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API backend funcionando');
});

//rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/exercises', require('./routes/exercises'));
app.use('/api/routines', require('./routes/routines'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend server running at http://localhost:${PORT}`));

const db = require('./config/db');
db.query('SHOW TABLES')
  .catch(err => console.error('Error al conectar con la BBDD:', err.message));
