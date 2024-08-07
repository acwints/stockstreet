const express = require('express');
const fetch = require('node-fetch');
const AlphaVantageAPI = require('alpha-vantage-cli').AlphaVantageAPI;
const yahooFinance = require('yahoo-finance2').default;

const app = express();
const port = 3000;
const av = new AlphaVantageAPI('MZAR5IPMLGKX3KII', 'full', true);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.use(express.static('public'));

app.get('/api/stock/:ticker', async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const { range } = req.query;

    try {
        const dailyData = await av.getDailyData(ticker, 'full');

        if (!Array.isArray(dailyData) || dailyData.length === 0) {
            console.error(`No daily data available for ticker: ${ticker}`);
            throw new Error(`No daily data available for ticker: ${ticker}. Please check if the ticker is correct.`);
        }

        const timeSeriesData = dailyData.reduce((acc, item) => {
            acc[item.Timestamp] = {
                '1. open': item.Open,
                '4. close': item.Close,
            };
            return acc;
        }, {});

        // Fetch company information from Yahoo Finance
        await delay(1000); // 1 second delay
        const yahooQuote = await yahooFinance.quote(ticker);
        await delay(1000); // 1 second delay
        const yahooAssetProfile = await yahooFinance.quoteSummary(ticker, { modules: ['assetProfile'] });

        const ceoName = yahooAssetProfile.assetProfile.companyOfficers[0]?.name || 'N/A';
        const ipoDate = yahooQuote.firstTradeDateEpochUtc ? new Date(yahooQuote.firstTradeDateEpochUtc * 1000).toISOString().split('T')[0] : 'N/A';

        // Fetch historical data to get IPO price
        let firstTradingDay = ipoDate;
        let firstTradingPrice = 'N/A';

        if (ipoDate !== 'N/A') {
            try {
                const ipoYearData = await yahooFinance.historical(ticker, {
                    period1: ipoDate,
                    period2: ipoDate
                });

                if (ipoYearData.length > 0) {
                    firstTradingPrice = ipoYearData[0].close.toFixed(2);
                }
            } catch (error) {
                console.error('Error fetching IPO data:', error);
            }
        }

        const endDate = new Date();
        let startDate;

        switch (range) {
            case 'this_month':
                startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                break;
            case 'this_quarter':
                const quarterStartMonth = Math.floor(endDate.getMonth() / 3) * 3;
                startDate = new Date(endDate.getFullYear(), quarterStartMonth, 1);
                break;
            case 'this_year':
                startDate = new Date(endDate.getFullYear(), 0, 1);
                break;
            case 'last_5_years':
                startDate = new Date(endDate.getFullYear() - 5, endDate.getMonth(), endDate.getDate());
                break;
            case 'max':
            default:
                startDate = new Date(0);
                break;
        }

        const historicalData = Object.entries(timeSeriesData)
            .map(([date, values]) => ({
                date: new Date(date),
                open: parseFloat(values['1. open']),
                close: parseFloat(values['4. close']),
                dayOfWeek: new Date(date).getDay()
            }))
            .sort((a, b) => a.date - b.date);

        const filteredHistoricalData = historicalData.filter(item => item.date >= startDate);

        if (filteredHistoricalData.length === 0) {
            throw new Error(`No historical data available for ticker: ${ticker} in the specified range.`);
        }

        const dates = filteredHistoricalData.map(item => item.date);
        const prices = filteredHistoricalData.map(item => item.close);

        const dayOfWeekMovement = Array(7).fill(0).map(() => ({ total: 0, count: 0 }));
        filteredHistoricalData.forEach(item => {
            const movement = (item.close - item.open) / item.open;
            dayOfWeekMovement[item.dayOfWeek].total += movement;
            dayOfWeekMovement[item.dayOfWeek].count += 1;
        });
        const avgDayOfWeekMovement = dayOfWeekMovement.map(day => day.count ? (day.total / day.count) * 100 : 0);

        const currentPrice = yahooQuote.regularMarketPrice.toFixed(2);
        const diffPercent = firstTradingPrice !== 'N/A' ? ((currentPrice - firstTradingPrice) / firstTradingPrice * 100).toFixed(2) : 'N/A';

        res.json({ dates, prices, ipoDate, ceoName, firstTradingDay, firstTradingPrice, currentPrice, diffPercent, avgDayOfWeekMovement });
    } catch (error) {
        console.error('Error fetching stock data:', error);
        console.error('Ticker:', ticker);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});