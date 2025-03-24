const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const conectDB = require('./config/dbconnect');
const path = require('path');

require('dotenv').config();
conectDB();

const app = express();

// Middleware setup
app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());
app.options('*', cors());

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static('public'));

// Routes setup
const userRoutes = require('./routes/User.routes');
const ghlauthRoutes = require('./routes/Ghlauth.routes');
const Settings = require('./routes/Settings.routes');
const autoauth = require('./routes/autoauth.routes');
const customfields = require('./routes/customfields.routes');
const uploadcontact = require('./routes/upload.routes');
const displaycf = require('./routes/displaycf.routes');
const webhook = require('./routes/webhook.routes');
const gallery = require('./routes/Gallery.routes');

app.use('/api/v1', gallery);
app.use('/api/v1', webhook);
app.use('/api/v1', displaycf);
app.use('/api/v1', uploadcontact);
app.use('/api/v1', customfields);
app.use('/api/v1', autoauth);
app.use('/api/v1', userRoutes);
app.use('/api/v1', ghlauthRoutes);
app.use('/api/v1', Settings);

// Route to check environment
app.get('/api/v1/status', (req, res) => {
    res.json({
        status: "Server is running",
        environment: process.env.NODE_ENV || "development"
    });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client/build')));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});
