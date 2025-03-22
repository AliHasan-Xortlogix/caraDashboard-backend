const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const conectDB = require('./config/dbconnect');
const userRoutes = require('./routes/User.routes');  // Import your user routes
const { isAuthenticatedUser, authorizeRoles } = require('./middleware/jwtToken'); // Import your middlewares
const ghlauthRoutes = require('./routes/Ghlauth.routes');
const Settings = require('./routes/Settings.routes')
const path = require('path');
const autoauth = require('./routes/autoauth.routes')
const customfields = require('./routes/customfields.routes')
const uploadcontact = require('./routes/upload.routes')
const displaycf = require('./routes/displaycf.routes')
const webhook = require('./routes/webhook.routes')
const gallery = require('./routes/Gallery.routes')
conectDB();

// Initialize environment variables
require('dotenv').config();
const app = express();
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static('public'));

// Middleware setup
app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());
app.options('*', cors());

// Routes setup
app.use('/api/v1', gallery)
app.use('/api/v1', webhook)
app.use('/api/v1', displaycf)
app.use('/api/v1', uploadcontact)
app.use('/api/v1', customfields)
app.use('/api/v1', autoauth)
app.use('/api/v1', userRoutes);
app.use('/api/v1', ghlauthRoutes);
app.use('/api/v1', Settings)
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
