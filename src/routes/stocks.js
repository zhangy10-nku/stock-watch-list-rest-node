const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all stocks
router.get('/', (req, res) => {
  db.all('SELECT * FROM stocks ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ data: rows, count: rows.length });
  });
});

// Get a single stock by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM stocks WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    res.json({ data: row });
  });
});

// Create a new stock
router.post('/', (req, res) => {
  const { symbol, name, quantity, purchase_price, notes } = req.body;

  if (!symbol || !name) {
    return res.status(400).json({ error: 'Symbol and name are required' });
  }

  const sql = `
    INSERT INTO stocks (symbol, name, quantity, purchase_price, notes)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(sql, [symbol.toUpperCase(), name, quantity || 0, purchase_price, notes], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Stock symbol already exists' });
      }
      return res.status(500).json({ error: err.message });
    }
    
    // Return the created stock
    db.get('SELECT * FROM stocks WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ data: row, message: 'Stock added successfully' });
    });
  });
});

// Update a stock
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { symbol, name, quantity, purchase_price, notes } = req.body;

  const sql = `
    UPDATE stocks 
    SET symbol = COALESCE(?, symbol),
        name = COALESCE(?, name),
        quantity = COALESCE(?, quantity),
        purchase_price = COALESCE(?, purchase_price),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.run(sql, [symbol?.toUpperCase(), name, quantity, purchase_price, notes, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    db.get('SELECT * FROM stocks WHERE id = ?', [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ data: row, message: 'Stock updated successfully' });
    });
  });
});

// Delete a stock
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM stocks WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    res.json({ message: 'Stock deleted successfully' });
  });
});

module.exports = router;
