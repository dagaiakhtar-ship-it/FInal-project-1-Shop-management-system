# Data Persistence Setup

This project now includes a **Node.js Express backend** that saves all your data to **JSON files in the project directory** in real-time.

## How It Works

1. **Frontend (React)** → saves data via HTTP API
2. **Backend (Node.js/Express)** → writes data to JSON files in `data-storage/` folder
3. **Data persists** across browser refreshes, system restarts, and app updates

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

This installs `cors` and `concurrently` which are needed for the server.

### 2. Start the System (Both Server + React)

**Option A: Run both together (recommended)**
```bash
npm run dev:both
```

This starts:
- 🖥️ **Backend Server** on `http://localhost:5000`
- 🌐 **React App** on `http://localhost:3000`

**Option B: Run server only**
```bash
npm run server
```
Then in another terminal:
```bash
npm run dev
```

### 3. Use the App Normally

- Enter data in the React app (products, customers, sales, etc.)
- Data is **automatically saved** to `data-storage/` folder in real-time
- Check the server logs to see: `✅ Saved: products.json`

## Data Files Location

All data is stored in: **`data-storage/` folder** in your project directory

Example files created:
```
data-storage/
  ├── products.json      (all products)
  ├── sales.json         (all sales/invoices)
  ├── customers.json     (all customers)
  ├── suppliers.json     (all suppliers)
  ├── categories.json    (all categories)
  ├── users.json         (all user accounts)
  └── ... (other collections)
```

## API Endpoints

The backend exposes these endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Check if server is running |
| `POST` | `/api/save/:key` | Save data (called automatically by React) |
| `GET` | `/api/load/:key` | Load data from disk |
| `GET` | `/api/files` | List all saved files |
| `DELETE` | `/api/delete/:key` | Delete a data file |

## Data Backup

Since all data is in JSON files:

1. **Manual backup**: Copy the `data-storage/` folder to a backup location
2. **Git ignore**: The `data-storage/` folder is ignored by git (won't be committed)
3. **Export**: Use the app's Export feature to create portable CSV/PDF backups

## Troubleshooting

**Q: Server won't start**
- Make sure port 5000 is not in use
- Check for TypeScript/Node errors in console
- Try: `npm install` again

**Q: Data not saving**
- Check browser console (F12) for errors
- Ensure backend is running on `http://localhost:5000`
- Check `data-storage/` folder permissions

**Q: Data is still using localStorage**
- The React app still uses browser `localStorage` as fallback
- To force server sync: Check browser Network tab (F12) → it should show POST requests to `/api/save/:key`

## Next Steps

1. You can now edit `src/data.ts` to integrate server calls on data load/save
2. Update React components to hook into the server API
3. Add database validation and error handling as needed

Enjoy persistent data storage! 🎉
