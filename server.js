const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const conectDB = require('./config/dbconnect');
const userRoutes = require('./routes/User.routes');  // Import your user routes
const { isAuthenticatedUser, authorizeRoles } = require('./middleware/jwtToken'); // Import your middlewares
const ghlauthRoutes = require('./routes/Ghlauth.routes');  // Import your Ghlauth routes
// Connect to the database
conectDB();

// Initialize environment variables
require('dotenv').config();

const app = express();

// Middleware setup
app.use(express.json());  
app.use(bodyParser.json());  
app.use(cookieParser());  
app.use(cors({
    origin: '*', 
    credentials: true  
}));

// Routes setup
app.use('/api/v1', userRoutes);  
app.use('/api/v1', ghlauthRoutes);  

const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
