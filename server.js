require('dotenv').config();

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors'); // Add this line
const AlphaVantageAPI = require('alpha-vantage-cli').AlphaVantageAPI;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // Add this line
app.use(express.static('public'));

// Middleware to handle custom domain
app.use((req, res, next) => {
  const host = req.get('host');
  if (host === 'www.strictlyinvestmentadvice.com') {
    // Handle custom domain logic if needed
  }
  next();
});

// Add CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Helper function to format currency in millions with commas
function formatCurrencyInMillions(value) {
  if (!value || isNaN(value)) return null;
  const millions = parseFloat(value) / 1000000;
  return `$${millions.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}M`;
}

// Helper function to format percentage
function formatPercentage(value) {
  if (!value) return 'N/A';
  return `${(parseFloat(value) * 100).toFixed(1)}%`;
}

app.get('/api/company-overview/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    console.log(`Received request for symbol: ${symbol}`);
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    
    console.log(`Fetching data from Alpha Vantage API: ${url}`);
    const response = await fetch(url);
    const data = await response.json();
    console.log('Received data from Alpha Vantage:', data);

    // Format the data
    const formattedData = {
      ...data,
      MarketCapitalization: data.MarketCapitalization ? formatCurrencyInMillions(data.MarketCapitalization) : null,
      EBITDA: data.EBITDA ? formatCurrencyInMillions(data.EBITDA) : null,
      ProfitMargin: data.ProfitMargin ? formatPercentage(data.ProfitMargin) : null
    };

    console.log('Sending formatted data:', formattedData);
    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching company overview:', error);
    console.error('Error details:', error);
    console.error('API Key:', ALPHA_VANTAGE_API_KEY);
    res.status(500).json({ error: 'Failed to fetch company overview' });
  }
});

app.get('/api/historical-data/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${ALPHA_VANTAGE_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    console.error('Error details:', error);
    console.error('API Key:', ALPHA_VANTAGE_API_KEY);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// Catch-all route to serve the frontend for any unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});