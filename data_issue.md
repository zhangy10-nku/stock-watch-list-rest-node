# Stock Data Split Adjustment Issue

## Problem Identified
Historical stock data in the database contains **unadjusted prices** that don't account for stock splits, causing wildly incorrect calculations across all query templates.

### Example: NVDA Data
```
2025-11-14: $190.17   (post 10:1 split - June 2024)
2024-06-07: $1,208.88 (pre-split, unadjusted)
2021-07-19: $751.19   (pre 4:1 split - July 2021)
```

### Impact
- **Simplified Bollinger %B**: Shows 14.87% when current price ($190.17) should be ~92% of range
  - Calculation: (190.17 - 10.81) / (1216.92 - 10.81) = 14.87%
  - **Wrong because**: $1,216.92 high is pre-split price, not comparable to current $190.17
- All queries comparing historical prices are affected (totalReturn, volatility, moving averages, etc.)

## Root Cause Analysis

### Database Schema
Table: `historical_stock_data`
- Has `close` and `adjusted_close` columns
- Both contain **same values** (unadjusted prices)
- No `split_adjusted` or `adjustment_factor` columns

### Current Architecture
1. **Data Storage**: Raw unadjusted prices stored in SQLite
2. **Split Adjustment**: `splitAdjustmentService.js` applies adjustments **in-memory** during queries
3. **Split Data**: `stock_splits` table has split ratios (e.g., NVDA: 10-for-1 on 2024-06-10, 4-for-1 on 2021-07-20)

### The Adjustment Bug
In `splitAdjustmentService.js` lines 86-91:
```javascript
open: Number((record.open / adjustmentFactor).toFixed(4)),
high: Number((record.high / adjustmentFactor).toFixed(4)),
low: Number((record.low / adjustmentFactor).toFixed(4)),
close: Number((record.close / adjustmentFactor).toFixed(4)),
```

**Issue**: The adjustment logic divides old prices by the cumulative split ratio, which is correct for normalizing to current scale, BUT:
- The adjustment is only applied when queries run
- Not persisted in database
- `getHistoricalData()` fetches raw DB data, then adjusts in-memory

## Why Alpha Vantage Refresh Won't Work (Yet)
Attempted: `POST /api/stocks/refresh/NVDA?fullRefresh=true`

**Result**: Rate limited (25 requests/day on free tier)
```json
{
  "error": "Alpha Vantage API Info: We have detected your API key... standard API rate limit is 25 requests per day"
}
```

## Solution Options

### Option 1: Fix In-Memory Adjustment (Quick)
**Status**: Current approach, but not working correctly
- Split adjustment service exists but may have bugs
- Add `split_adjusted` and `adjustment_factor` columns to DB
- Apply adjustments retroactively using existing split data

**Pros**: No API calls needed, works immediately
**Cons**: Complex logic, potential for bugs

### Option 2: Use Alpha Vantage Adjusted Prices (Correct)
**Status**: Blocked by rate limit until tomorrow
- Alpha Vantage returns both `close` and `adjusted_close`
- `adjusted_close` accounts for all historical splits
- Re-fetch all data using adjusted prices

**Pros**: Authoritative source, always correct
**Cons**: Rate limited, requires re-fetching 1000s of records

### Option 3: Hybrid Approach
- Use Alpha Vantage's `adjusted_close` field instead of `close` when storing
- Update data refresh service to populate both fields correctly
- Gradually refresh symbols as API limits allow

## Recommended Next Steps (Tomorrow)

1. **Verify Alpha Vantage Response Structure**
   ```bash
   # Check what AV actually returns for NVDA
   curl "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=NVDA&apikey=${API_KEY}&outputsize=full" | jq '.["Time Series (Daily)"] | to_entries[0:3]'
   ```

2. **Update Data Refresh Service**
   - File: `src/services/dataRefreshService.js`
   - Use `adjusted_close` from AV instead of `close`
   - Store split-adjusted prices in `close` field
   - OR: Add schema migration to properly use both fields

3. **Trigger Full Refresh**
   ```bash
   # For each stock (wait for rate limit reset)
   curl -X POST "http://localhost:3000/api/stocks/refresh/NVDA?fullRefresh=true"
   curl -X POST "http://localhost:3000/api/stocks/refresh/AAPL?fullRefresh=true"
   # etc...
   ```

4. **Verify Fix**
   ```bash
   # Check Simplified Bollinger %B after refresh
   # Should show ~92% instead of 14.87%
   curl -X POST http://localhost:3000/api/stocks/query/NVDA \
     -H "Content-Type: application/json" \
     -d '{"queries": {"result": "(data[0].close - $min(data.low)) / ($max(data.high) - $min(data.low)) * 100"}, "startDate": "2020-01-01", "endDate": "2025-11-15"}'
   ```

## Implementation Details

### Files to Modify
1. **src/services/dataRefreshService.js** (lines ~40-120)
   - `storeHistoricalData()` method
   - Use `adjusted_close` from Alpha Vantage response
   
2. **src/services/splitAdjustmentService.js**
   - May need to disable or remove if using AV adjusted prices
   - OR: Keep for volume adjustments only

3. **Database Migration** (optional)
   - Add columns: `split_adjusted BOOLEAN`, `adjustment_factor REAL`
   - Populate retroactively

### Testing Checklist
- [ ] NVDA Simplified Bollinger %B shows correct percentage (~90%+)
- [ ] NVDA Traditional Bollinger %B uses correct 20-day window
- [ ] totalReturn calculates correctly across split dates
- [ ] Moving averages use consistent price scale
- [ ] All queries return sensible results

## Current Status
- **Blocked**: Rate limited until tomorrow (Nov 16, 2025)
- **Frontend**: Working correctly, issue is data-layer only
- **Workaround**: None - all price-based queries are affected

## Session Summary (Nov 15, 2025)
### Completed Today
✅ Implemented React frontend with dark mode
✅ Created chart visualization system (Option 3: hybrid template + inference)
✅ Added StatCard component for single-value displays
✅ Fixed multiple JSONata template expressions (removed `..` range operator issues)
✅ Fixed moving averages, gapUps, highestVolumeDay queries
✅ Added two new Bollinger %B indicators (Simplified and Traditional)
✅ Identified root cause of data inconsistency issue

### To Resume Tomorrow
1. Check Alpha Vantage API response format for `adjusted_close` field
2. Modify `dataRefreshService.js` to use adjusted prices
3. Trigger full refresh for all Magnificent 7 stocks
4. Verify all queries return correct results
5. Test Bollinger %B indicators with fixed data

## Notes
- Free Alpha Vantage tier: 25 requests/day, 5 requests/minute
- Full refresh requires ~1 request per symbol
- Magnificent 7 stocks = 7 requests (< daily limit)
- Consider premium tier ($50/month) for unlimited access if needed frequently
