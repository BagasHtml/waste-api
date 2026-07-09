// server.js
import app from './src/app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`|===========================================|`);
  console.log(`| SERVER RUNNING ON PORT: ${PORT}              |`);
  console.log(`| URL: http://localhost:${PORT}               |`);
  console.log(`|===========================================|`);
});