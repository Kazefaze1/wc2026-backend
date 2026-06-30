const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage (resets when server restarts, but fine for this)
let results = {
  "0-0": { a: 1, b: 1, status: "live", minuteBase: 93 },
  "0-2": { a: 1, b: 0, status: "finished" },
  "0-8": { a: 2, b: 1, status: "finished" },
};

// GET all results
app.get('/api/results', (req, res) => {
  res.json(results);
});

// POST update a result
app.post('/api/results/:key', (req, res) => {
  const { key } = req.params;
  const { a, b, status, minuteBase } = req.body;
  results[key] = { a, b, status, minuteBase };
  res.json({ ok: true, key, data: results[key] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
