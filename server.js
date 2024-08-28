require('dotenv').config();

console.log('GOOGLE_CREDENTIALS:', process.env.GOOGLE_CREDENTIALS ? 'Set' : 'Not set');

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors'); // Add this line
const AlphaVantageAPI = require('alpha-vantage-cli').AlphaVantageAPI;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 3000;

app.use(morgan('dev'));

app.use(cors()); // Add this line
app.use(express.static('public'));
app.use(express.json()); // Add this line

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

const { google } = require('googleapis');

// Set up Google Sheets API
let auth;
try {
  const credentials = process.env.GOOGLE_CREDENTIALS;
  if (!credentials) {
    throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
  }
  
  const parsedCredentials = JSON.parse(credentials);
  console.log('Parsed credentials:', JSON.stringify(parsedCredentials, null, 2));
  
  auth = new google.auth.GoogleAuth({
    credentials: parsedCredentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  console.log('Google Sheets credentials successfully parsed and auth object created.');
} catch (error) {
  console.error('Error setting up Google Sheets authentication:', error.message);
  console.error('Google Sheets functionality will be disabled.');
  auth = null;
}

let sheets;
if (auth) {
  sheets = google.sheets({ version: 'v4', auth });
  console.log('Google Sheets API client created successfully.');
} else {
  console.log('Google Sheets API client not created due to authentication issues.');
}

app.post('/api/subscribe', async (req, res) => {
  console.log('Received subscription request');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);

  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.log('Invalid email address:', email);
    return res.status(400).json({ message: 'Invalid email address' });
  }

  if (!sheets) {
    console.error('Google Sheets functionality is disabled. Unable to process subscription.');
    return res.status(500).json({ message: 'Subscription service is currently unavailable.' });
  }

  try {
    console.log('Attempting to append email to Google Sheet');
    const spreadsheetId = '1U-xHCV-oTh0-zh_PyQMU0ynQl54dFona7QAcc1J2R1U';
    const range = 'emails!A:A';

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [[email]],
      },
    });

    console.log('Google Sheets API response:', JSON.stringify(response, null, 2));
    console.log('Email successfully appended to Google Sheet');
    res.status(200).json({ message: 'Thank you for subscribing!' });
  } catch (error) {
    console.error('Error during subscription:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ message: 'An error occurred. Please try again later.' });
  }
});