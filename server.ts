import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;
const DATA_DIR = path.join(__dirname, 'data-storage');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Created data directory at ${DATA_DIR}`);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files from dist folder (for production build)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server running', dataDir: DATA_DIR });
});

// Save all data to one JSON file
app.post('/api/save-all', (req, res) => {
  try {
    const data = req.body;
    const filePath = path.join(DATA_DIR, 'all-data.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Saved all data to all-data.json`);
    res.json({ success: true, message: 'All data saved to all-data.json' });
  } catch (error: any) {
    console.error(`❌ Error saving all data:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Load all data from one JSON file
app.get('/api/load-all', (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'all-data.json');
    if (!fs.existsSync(filePath)) {
      console.log('⚠️  File not found: all-data.json');
      return res.json({ success: true, data: null });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log('✅ Loaded all-data.json');
    res.json({ success: true, data });
  } catch (error: any) {
    console.error(`❌ Error loading all data:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a file
app.delete('/api/delete/:key', (req, res) => {
  try {
    const { key } = req.params;
    const filePath = path.join(DATA_DIR, `${key}.json`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Deleted: ${key}.json`);
      res.json({ success: true, message: `Deleted ${key}.json` });
    } else {
      res.json({ success: false, message: 'File not found' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Build not found. Run: npm run build');
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   Smart Shop Data Server Running        ║
╠════════════════════════════════════════╣
║  🌐 Server: http://localhost:${PORT}     ║
║  💾 Data Dir: ${DATA_DIR}
║  📁 Endpoints:                          ║
║    POST   /api/save-all                 ║
║    GET    /api/load-all                 ║
║    GET    /api/health                   ║
╚════════════════════════════════════════╝
  `);
});

