const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config(); 
require('./config/db'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: 'http://localhost:5173' })); 
app.use(bodyParser.json());

const categoryRoutes = require('./routes/categoryRoutes');
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');

app.use('/api/categories', categoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/menus', menuRoutes); 

app.get('/', (req, res) => {
    res.send('RasoSehat Backend API is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});