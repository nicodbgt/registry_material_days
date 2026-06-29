import 'dotenv/config.js'; // Load environment variables FIRST!
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // To parse JSON request bodies

// Set up Pug as the template engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(routes);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
