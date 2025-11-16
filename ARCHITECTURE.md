# Startup Refresh & Real-Time Price Architecture

## Overview

This document describes the hybrid architecture that combines:
1. **Alpha Vantage** (free tier) for historical data and stock splits
2. **Yahoo Finance** (via yfinance) for real-time/near-real-time current prices

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Docker Compose Environment                             │
│                                                          │
│  ┌────────────────────────┐  ┌─────────────────────┐  │
│  │  Node.js Backend       │  │  Python Price       │  │
│  │  (Port 3000)           │◄─┤  Service            │  │
│  │                        │  │  (Port 5000)        │  │
│  │  On Startup:           │  │                     │  │
│  │  1. Check DB for       │  │  - Flask API        │  │
│  │     last_data_refresh  │  │  - yfinance         │  │
│  │  2. If stale (not      │  │  - Yahoo Finance    │  │
│  │     today) →           │  │    scraping         │  │
│  │     Fetch from Alpha   │  │                     │  │
│  │     Vantage            │  │  Endpoints:         │  │
│  │  3. Check for splits   │  │  - /price/{symbol}  │  │
│  │  4. Mark refreshed     │  │  - /prices (bulk)   │  │
│  │                        │  │  - /quote/{symbol}  │  │
│  │  During Runtime:       │  │  - /health          │  │
│  │  - Query prices from   │  └─────────────────────┘  │
│  │    Python service      │                            │
│  │  - Serve JSONata       │                            │
│  │    queries             │                            │
│  └────────────────────────┘                            │
│            │                                            │
│            ▼                                            │
│  ┌────────────────────────┐                            │
│  │  SQLite Database       │                            │
│  │                        │                            │
│  │  Tables:               │                            │
│  │  - tracked_stocks      │                            │
│  │    • last_data_refresh │   ← NEW                   │
│  │    • last_split_check  │   ← NEW                   │
│  │  - historical_stock_   │                            │
│  │    data                │                            │
│  │  - stock_splits        │                            │
│  └────────────────────────┘                            │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. Database Changes (`src/database.js`)

Added two new columns to `tracked_stocks` table:
- `last_data_refresh DATE` - Tracks when historical data was last refreshed
- `last_split_check DATE` - Tracks when splits were last checked

### 2. Startup Refresh Service (`src/services/startupRefreshService.js`)

**Purpose**: Automatically refresh data on server startup if not already done today.

**Key Methods**:
- `needsDataRefresh(symbol)` - Check if data refresh needed (not done today)
- `needsSplitCheck(symbol)` - Check if split check needed (not done today)
- `fetchAndStoreSplits(symbol)` - Call Alpha Vantage SPLITS endpoint
- `refreshSymbol(symbol)` - Refresh both data and splits for one symbol
- `performStartupRefresh()` - Main entry point, processes all tracked stocks

**API Calls Per Stock**:
- Historical data: 1 call to `TIME_SERIES_DAILY` (compact, 100 days)
- Split check: 1 call to `SPLITS`
- **Total: 2 calls per stock**

**For 7 Magnificent 7 stocks**: 14 API calls (well under 25/day limit)

### 3. Python Price Service (`price-service/`)

**Tech Stack**:
- Flask (Python web framework)
- yfinance (Yahoo Finance scraper)
- Gunicorn (production WSGI server)

**Endpoints**:

#### `GET /health`
Health check endpoint
```json
{
  "status": "OK",
  "service": "price-service",
  "timestamp": "2025-11-16T10:30:00"
}
```

#### `GET /price/{symbol}`
Get current price for a single stock
```json
{
  "symbol": "NVDA",
  "price": 145.23,
  "open": 143.50,
  "high": 146.00,
  "low": 142.80,
  "volume": 45678900,
  "timestamp": "2025-11-16T10:29:00"
}
```

#### `POST /prices`
Get prices for multiple stocks
```json
// Request
{
  "symbols": ["NVDA", "TSLA", "AAPL"]
}

// Response
{
  "success": true,
  "count": 3,
  "data": {
    "NVDA": { "price": 145.23, ... },
    "TSLA": { "price": 404.35, ... },
    "AAPL": { "price": 272.41, ... }
  }
}
```

#### `GET /quote/{symbol}`
Get detailed quote information
```json
{
  "symbol": "NVDA",
  "currentPrice": 145.23,
  "name": "NVIDIA Corporation",
  "marketCap": 3560000000000,
  "peRatio": 72.5,
  "fiftyTwoWeekHigh": 212.19,
  "fiftyTwoWeekLow": 10.81,
  ...
}
```

### 4. Node.js Price Service Client (`src/services/priceService.js`)

**Purpose**: Wrapper to call Python price service from Node backend.

**Key Methods**:
- `getCurrentPrice(symbol)` - Get price for one stock
- `getCurrentPrices(symbols)` - Bulk fetch multiple stocks
- `getQuoteInfo(symbol)` - Get detailed quote
- `isAvailable()` - Health check
- `getPriceWithFallback(symbol, fallbackFn)` - Use price service or fall back to DB

### 5. Docker Compose Configuration

**Services**:
1. **app** (Node.js backend)
   - Port 3000 (API)
   - Port 9229 (debugging)
   - Depends on `price-service`
   - Environment: `PRICE_SERVICE_URL=http://price-service:5000`

2. **price-service** (Python Flask)
   - Port 5001 (external) → 5000 (internal)
   - Health check enabled
   - Gunicorn with 2 workers

**Start Command**:
```bash
docker-compose up
```

### 6. Updated Server Startup (`src/index.js`)

**Startup Flow**:
1. Wait for database initialization
2. Check price service availability
3. Run startup refresh (if needed)
4. Start Express server

**Console Output**:
```
============================================================
🚀 STARTING STOCK WATCHLIST APPLICATION
============================================================

📈 Checking price service availability...
✅ Price service is available: OK

🚀 Starting startup refresh process...

📋 Found 7 tracked stocks: NVDA, TSLA, AAPL, GOOGL, AMZN, MSFT, META

============================================================
Processing NVDA (NVIDIA Corporation)
============================================================
✓ NVDA data already refreshed today, skipping
✓ NVDA splits already checked today, skipping

[... repeat for each stock ...]

============================================================
STARTUP REFRESH SUMMARY
============================================================
✅ Stocks processed: 7
📊 Data refreshed: 0
🔍 Splits checked: 0
📡 API calls used: 0
============================================================

============================================================
✅ Server running on port 3000
📊 Stock Watchlist API is ready!
🐛 Debug port: 9229
📈 Price service: Available
============================================================
```

## Daily Workflow

### First Startup of the Day

1. Server starts
2. Checks `tracked_stocks.last_data_refresh` for each stock
3. Finds dates are not today (or NULL)
4. **Fetches historical data** from Alpha Vantage (2 API calls × 7 stocks = 14 calls)
5. Applies split adjustments and stores in DB
6. **Fetches split data** from Alpha Vantage
7. Updates `last_data_refresh` and `last_split_check` to today
8. Server ready

**API Usage**: 14 calls (historical + splits)

### Subsequent Restarts Same Day

1. Server starts
2. Checks `tracked_stocks.last_data_refresh` for each stock
3. Finds dates ARE today
4. **Skips all API calls**
5. Server ready immediately

**API Usage**: 0 calls

### Runtime Price Queries

- User loads UI
- Frontend requests current prices
- Backend calls Python price service
- Python service scrapes Yahoo Finance (unlimited, free)
- Returns ~15-min delayed prices

**API Usage**: 0 Alpha Vantage calls, unlimited Yahoo Finance

## API Budget Management

**Alpha Vantage Free Tier**: 25 calls/day

**Daily Usage**:
- Startup refresh (first start): 14 calls
- Reserve for manual refreshes: 11 calls
- **Total**: Fits comfortably within limit

**Weekly Split Checks** (optional future enhancement):
- Could reduce split checks to once per week
- Would save ~7 calls/day
- Allow 21 calls for data refreshes

## Testing

### Test Price Service Standalone
```bash
# Start only price service
cd price-service
docker build -t price-service .
docker run -p 5000:5000 price-service

# Test health
curl http://localhost:5000/health

# Test single price
curl http://localhost:5000/price/NVDA

# Test multiple prices
curl -X POST http://localhost:5000/prices \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["NVDA", "TSLA", "AAPL"]}'
```

### Test Full Stack
```bash
# Start everything
docker-compose up

# Watch logs for startup refresh
# Should see data refresh happen (first time) or skip (subsequent)

# Test backend
curl http://localhost:3000/health

# Test price service through backend
# (Add endpoint to routes/stocks.js if needed)
```

## Future Enhancements

1. **Add Price Service Routes**
   - Add `/api/stocks/current-price/:symbol` endpoint
   - Calls `priceService.getCurrentPrice()`
   - Used by frontend for real-time prices

2. **Reduce Split Check Frequency**
   - Change to weekly instead of daily
   - Saves API calls

3. **Caching Layer**
   - Add Redis for price caching
   - Cache prices for 1-2 minutes
   - Reduce load on Python service

4. **Monitoring**
   - Track API call usage
   - Alert when approaching daily limit

## Troubleshooting

### Price Service Not Starting
- Check Docker logs: `docker-compose logs price-service`
- Verify requirements.txt installed: `pip install -r requirements.txt`

### Startup Refresh Fails
- Check Alpha Vantage API key in `.env`
- Verify API rate limits not exceeded
- Check network connectivity

### Database Columns Not Added
- Delete `data/stocks.db` and restart
- Or manually run: `ALTER TABLE tracked_stocks ADD COLUMN last_data_refresh DATE;`

### Docker Compose Issues
- Rebuild images: `docker-compose build --no-cache`
- Remove volumes: `docker-compose down -v`
- Check Docker daemon is running
