from flask import Flask, jsonify, request
import yfinance as yf
from datetime import datetime
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'OK',
        'service': 'price-service',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/price/<symbol>', methods=['GET'])
def get_current_price(symbol):
    """
    Get current price for a single stock symbol
    Returns the most recent price data from Yahoo Finance
    """
    try:
        logger.info(f"Fetching price for {symbol}")
        
        # Create ticker object
        ticker = yf.Ticker(symbol.upper())
        
        # Get recent data (last 2 days, 1-minute intervals)
        # This ensures we get the most recent data even if market is closed
        data = ticker.history(period='2d', interval='1m')
        
        if data.empty:
            # Try daily data as fallback
            data = ticker.history(period='1d', interval='1d')
            
        if data.empty:
            logger.warning(f"No data found for {symbol}")
            return jsonify({
                'error': 'No data available',
                'symbol': symbol.upper()
            }), 404
        
        # Get the most recent data point
        latest = data.iloc[-1]
        timestamp = data.index[-1]
        
        result = {
            'symbol': symbol.upper(),
            'price': float(latest['Close']),
            'open': float(latest['Open']),
            'high': float(latest['High']),
            'low': float(latest['Low']),
            'volume': int(latest['Volume']),
            'timestamp': timestamp.isoformat()
        }
        
        logger.info(f"Successfully fetched price for {symbol}: ${result['price']:.2f}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error fetching price for {symbol}: {str(e)}")
        return jsonify({
            'error': str(e),
            'symbol': symbol.upper()
        }), 500

@app.route('/prices', methods=['POST'])
def get_multiple_prices():
    """
    Get current prices for multiple stock symbols
    Expects JSON body: { "symbols": ["AAPL", "GOOGL", ...] }
    """
    try:
        data = request.get_json()
        
        if not data or 'symbols' not in data:
            return jsonify({
                'error': 'Missing symbols in request body'
            }), 400
        
        symbols = data['symbols']
        
        if not isinstance(symbols, list):
            return jsonify({
                'error': 'symbols must be an array'
            }), 400
        
        logger.info(f"Fetching prices for {len(symbols)} symbols: {', '.join(symbols)}")
        
        results = {}
        errors = {}
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol.upper())
                
                # Get recent data
                ticker_data = ticker.history(period='2d', interval='1m')
                
                if ticker_data.empty:
                    ticker_data = ticker.history(period='1d', interval='1d')
                
                if not ticker_data.empty:
                    latest = ticker_data.iloc[-1]
                    timestamp = ticker_data.index[-1]
                    
                    results[symbol.upper()] = {
                        'price': float(latest['Close']),
                        'open': float(latest['Open']),
                        'high': float(latest['High']),
                        'low': float(latest['Low']),
                        'volume': int(latest['Volume']),
                        'timestamp': timestamp.isoformat()
                    }
                else:
                    errors[symbol.upper()] = 'No data available'
                    
            except Exception as e:
                logger.error(f"Error fetching {symbol}: {str(e)}")
                errors[symbol.upper()] = str(e)
        
        response = {
            'success': True,
            'count': len(results),
            'data': results
        }
        
        if errors:
            response['errors'] = errors
        
        logger.info(f"Successfully fetched {len(results)} prices, {len(errors)} errors")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in get_multiple_prices: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/quote/<symbol>', methods=['GET'])
def get_quote_info(symbol):
    """
    Get detailed quote information for a symbol
    Includes additional info like market cap, PE ratio, etc.
    """
    try:
        logger.info(f"Fetching quote info for {symbol}")
        
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info
        
        # Get current price data
        data = ticker.history(period='2d', interval='1m')
        
        if data.empty:
            data = ticker.history(period='1d', interval='1d')
        
        current_price = None
        timestamp = None
        
        if not data.empty:
            latest = data.iloc[-1]
            current_price = float(latest['Close'])
            timestamp = data.index[-1].isoformat()
        
        result = {
            'symbol': symbol.upper(),
            'currentPrice': current_price,
            'timestamp': timestamp,
            'name': info.get('longName') or info.get('shortName'),
            'currency': info.get('currency'),
            'exchange': info.get('exchange'),
            'marketCap': info.get('marketCap'),
            'volume': info.get('volume'),
            'averageVolume': info.get('averageVolume'),
            'peRatio': info.get('trailingPE'),
            'forwardPE': info.get('forwardPE'),
            'dividendYield': info.get('dividendYield'),
            'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh'),
            'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow'),
            'fiftyDayAverage': info.get('fiftyDayAverage'),
            'twoHundredDayAverage': info.get('twoHundredDayAverage')
        }
        
        logger.info(f"Successfully fetched quote info for {symbol}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error fetching quote info for {symbol}: {str(e)}")
        return jsonify({
            'error': str(e),
            'symbol': symbol.upper()
        }), 500

if __name__ == '__main__':
    logger.info("Starting Price Service on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=False)
