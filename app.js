const express = require('express');


const app = express();

const config = require('./config'); // Import the config file

// Use the port from the config file
const PORT = config.port;

const cors = require('cors');
app.use(cors());

const routes = require('./routes');
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', routes);



app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app; // Export the Express app