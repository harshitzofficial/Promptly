import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.routes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
