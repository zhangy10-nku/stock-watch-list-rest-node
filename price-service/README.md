# Price Service

Python Flask microservice for fetching real-time stock prices using yfinance (Yahoo Finance scraper).

## Features

- **Current Price**: Get latest price for a single stock
- **Bulk Prices**: Fetch multiple stock prices in one request
- **Quote Info**: Get detailed quote information including market cap, PE ratio, etc.
- **Health Check**: Monitor service status

## API Endpoints

### Health Check
```
GET /health
```

### Single Stock Price
```
GET /price/{symbol}
```
Example: `GET /price/AAPL`

### Multiple Stock Prices
```
POST /prices
Content-Type: application/json

{
  "symbols": ["AAPL", "GOOGL", "NVDA"]
}
```

### Detailed Quote
```
GET /quote/{symbol}
```
Example: `GET /quote/TSLA`

## Running Locally

```bash
cd price-service
pip install -r requirements.txt
python app.py
```

## Running with Docker

```bash
docker build -t price-service .
docker run -p 5000:5000 price-service
```

## Data Source

Uses yfinance library to scrape Yahoo Finance data. Data is typically delayed by ~15 minutes for free tier.
