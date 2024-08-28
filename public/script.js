document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');

    const searchInput = document.getElementById('search-input');
    const searchButton = document.querySelector('.search-container button');
    const scoreItems = document.querySelectorAll('.score-item p');
    const stockChartSpinner = document.getElementById('stockChartSpinner');
    const dayOfWeekChartSpinner = document.getElementById('dayOfWeekChartSpinner');

    let stockChart, dayOfWeekChart;

    searchButton.addEventListener('click', () => {
        const symbol = searchInput.value.trim().toUpperCase();
        if (symbol) {
            console.log(`Searching for ticker: ${symbol}`);
            setLoadingState(true);
            fetchCompanyOverview(symbol);
            fetchHistoricalData(symbol);
            searchInput.blur(); // Add this line to remove focus from the input
        }
    });

    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            searchButton.click();
        }
    });

    function setLoadingState(isLoading) {
        scoreItems.forEach(item => {
            item.className = isLoading ? 'loading-ellipsis' : '';
        });
        stockChartSpinner.style.display = isLoading ? 'block' : 'none';
        dayOfWeekChartSpinner.style.display = isLoading ? 'block' : 'none';
        document.getElementById('monthlyReturnChartSpinner').style.display = isLoading ? 'block' : 'none';
        document.getElementById('priceChangeDistributionChartSpinner').style.display = isLoading ? 'block' : 'none';
    }

    async function fetchWithRetry(url, retries = 3) {
        const apiKey = 'MZAR5IPMLGKX3KII';
        const fullUrl = `${url}&apikey=${apiKey}`;
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(fullUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);
                if (i === retries - 1) throw error;
            }
        }
    }

    async function fetchCompanyOverview(symbol) {
        try {
            console.log(`Fetching data for ${symbol}`);
            const data = await fetchWithRetry(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}`);
            const priceData = await fetchWithRetry(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}`);
            console.log('Full API response:', JSON.stringify(data, null, 2));
            if (Object.keys(data).length === 0) {
                throw new Error('No data received from API');
            }
            console.log('EBITDA value:', data.EBITDA);
            updateCompanyInfo(data, priceData);
        } catch (error) {
            console.error('Error fetching company overview:', error);
        } finally {
            setLoadingState(false);
        }
    }

    function updateCompanyInfo(data, priceData) {
        console.log('Updating company info:', data);
        document.getElementById('market-cap').textContent = formatCurrencyInMillions(data.MarketCapitalization) || 'N/A';
        document.getElementById('ebitda').textContent = formatCurrencyInMillions(data.EBITDA) || 'N/A';
        document.getElementById('pe-ratio').textContent = data.PERatio || 'N/A';
        document.getElementById('profit-margin').textContent = formatPercentage(data.ProfitMargin) || 'N/A';
        document.getElementById('company-description').textContent = data.Description || 'No description available.';
        document.getElementById('company-name').textContent = data.Name || 'Company Name';

        // Update current stock price
        const currentPrice = priceData['Global Quote']['05. price'];
        document.getElementById('current-stock-price').textContent = currentPrice ? `$${parseFloat(currentPrice).toFixed(2)}` : 'N/A';

        // Calculate and display average analyst rating
        const analystRating = calculateAnalystRating(data);
        document.getElementById('analyst-rating').innerHTML = getStarRating(analystRating);

        const companyMap = document.getElementById('company-map');
        const mapImage = document.getElementById('company-map-image');
        
        if (data.Address && data.City && data.State && data.Country) {
            const address = `${data.Address}, ${data.City}, ${data.State}, ${data.Country}`;
            const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=13&size=300x200&key=AIzaSyCX3JFGYldpilk2nfv1I8_lhOIwDqLFRok`;
            mapImage.src = mapUrl;
            companyMap.style.display = 'block';
        } else {
            mapImage.src = '';
            companyMap.style.display = 'none';
        }
    }

    function formatCurrencyInMillions(value) {
        if (!value || isNaN(value)) return null;
        const millions = parseFloat(value) / 1000000;
        return `$${millions.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}M`;
    }

    function formatPercentage(value) {
        if (!value) return 'N/A';
        return `${(parseFloat(value) * 100).toFixed(1)}%`;
    }

    function calculateAnalystRating(data) {
        const strongBuy = parseInt(data.AnalystRatingStrongBuy) || 0;
        const buy = parseInt(data.AnalystRatingBuy) || 0;
        const hold = parseInt(data.AnalystRatingHold) || 0;
        const sell = parseInt(data.AnalystRatingSell) || 0;
        const strongSell = parseInt(data.AnalystRatingStrongSell) || 0;

        const totalRatings = strongBuy + buy + hold + sell + strongSell;
        if (totalRatings === 0) return 0;

        const weightedSum = (strongBuy * 5 + buy * 4 + hold * 3 + sell * 2 + strongSell * 1);
        return weightedSum / totalRatings;
    }

    function getStarRating(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5 ? 1 : 0;
        const emptyStars = 5 - fullStars - halfStar;

        return '<span class="star-rating">' +
               '★'.repeat(fullStars) + 
               (halfStar ? '<span class="half-star"></span>' : '') + 
               '☆'.repeat(emptyStars) +
               '</span>';
    }

    async function fetchHistoricalData(symbol) {
        try {
            const data = await fetchWithRetry(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full`);
            const timeSeriesData = data['Time Series (Daily)'];
            if (!timeSeriesData) {
                throw new Error('No historical data received from API');
            }
            const processedData = processHistoricalData(timeSeriesData);
            console.log('Processed historical data:', processedData);
            createStockChart(processedData.priceData);
            createDayOfWeekChart(processedData.dayOfWeekData);
            createMonthlyReturnChart(processedData.monthlyReturnData);
            createPriceChangeDistributionChart(processedData.priceChangeDistributionData);
        } catch (error) {
            console.error('Error fetching historical data:', error);
        } finally {
            setLoadingState(false);
        }
    }

    function processHistoricalData(timeSeriesData) {
        const priceData = [];
        const dayOfWeekData = {
            Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: []
        };
        const monthlyReturnData = {
            Jan: [], Feb: [], Mar: [], Apr: [], May: [], Jun: [],
            Jul: [], Aug: [], Sep: [], Oct: [], Nov: [], Dec: []
        };
        const priceChangeDistribution = {};

        const currentDate = new Date();
        const startDate = new Date(currentDate.setDate(currentDate.getDate() - 1461));

        Object.entries(timeSeriesData).forEach(([date, values]) => {
            const [year, month, day] = date.split('-');
            const dateObj = new Date(Date.UTC(year, month - 1, day));
            
            if (dateObj >= startDate && values['8. split coefficient'] === '1.0') {
                const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getUTCDay()];
                const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dateObj.getUTCMonth()];
                
                const closePrice = parseFloat(values['4. close']);
                const openPrice = parseFloat(values['1. open']);
                const adjustedClosePrice = parseFloat(values['5. adjusted close']);
                
                priceData.push({ x: date, y: adjustedClosePrice });
                
                const priceChange = ((closePrice - openPrice) / openPrice) * 100;
                
                if (dayOfWeek in dayOfWeekData) {
                    dayOfWeekData[dayOfWeek].push(priceChange);
                }
                
                monthlyReturnData[monthName].push(priceChange);
                
                const roundedChange = Math.round(priceChange * 2) / 2;
                const clampedChange = Math.max(Math.min(roundedChange, 2.5), -2.5);
                priceChangeDistribution[clampedChange] = (priceChangeDistribution[clampedChange] || 0) + 1;
            }
        });

        const avgDayOfWeekData = Object.entries(dayOfWeekData).map(([day, changes]) => ({
            day,
            avgChange: changes.length > 0 ? changes.reduce((sum, change) => sum + change, 0) / changes.length : 0
        }));

        const avgMonthlyReturnData = Object.entries(monthlyReturnData).map(([month, changes]) => ({
            month,
            avgReturn: changes.length > 0 ? changes.reduce((sum, change) => sum + change, 0) / changes.length : 0
        }));

        console.log('Processed monthly return data:', avgMonthlyReturnData);

        const sortedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        avgDayOfWeekData.sort((a, b) => sortedDays.indexOf(a.day) - sortedDays.indexOf(b.day));

        const sortedMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        avgMonthlyReturnData.sort((a, b) => sortedMonths.indexOf(a.month) - sortedMonths.indexOf(b.month));

        const priceChangeDistributionData = Array.from({ length: 11 }, (_, i) => i * 0.5 - 2.5)
            .map(change => ({ change, count: priceChangeDistribution[change] || 0 }));

        return {
            priceData: priceData.reverse(),
            dayOfWeekData: avgDayOfWeekData,
            monthlyReturnData: avgMonthlyReturnData,
            priceChangeDistributionData
        };
    }

    function createStockChart(data) {
        const ctx = document.getElementById('stockChart').getContext('2d');
        
        if (stockChart) {
            stockChart.destroy();
        }

        stockChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Stock Price',
                    data: data,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Price'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Stock Price Movement',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });
    }

    function createDayOfWeekChart(data) {
        const ctx = document.getElementById('dayOfWeekChart').getContext('2d');
        
        if (dayOfWeekChart) {
            dayOfWeekChart.destroy();
        }

        // Find the best and worst performing days
        const maxChange = Math.max(...data.map(item => item.avgChange));
        const minChange = Math.min(...data.map(item => item.avgChange));

        // Function to interpolate between two colors
        function interpolateColor(color1, color2, factor) {
            const result = color1.slice();
            for (let i = 0; i < 3; i++) {
                result[i] = Math.round(result[i] + factor * (color2[i] - result[i]));
            }
            return result;
        }

        // Convert RGB array to CSS color string
        function rgbToCss(rgb) {
            return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        }

        // Define the colors for the gradient
        const startColor = [220, 20, 60]; // Crimson
        const midColor = [255, 215, 0]; // Gold
        const endColor = [34, 139, 34]; // Forest Green

        const backgroundColors = data.map(item => {
            let factor;
            let color;
            if (item.avgChange < 0) {
                factor = (item.avgChange - minChange) / (0 - minChange);
                color = interpolateColor(startColor, midColor, factor);
            } else {
                factor = (item.avgChange - 0) / (maxChange - 0);
                color = interpolateColor(midColor, endColor, factor);
            }
            return rgbToCss(color);
        });

        dayOfWeekChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => item.day),
                datasets: [{
                    label: 'Average Price Change (%)',
                    data: data.map(item => item.avgChange),
                    backgroundColor: backgroundColors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Average Price Change (%)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(2) + '%';
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toFixed(2) + '%';
                            }
                        }
                    },
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Avg. Price Change by Day',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });
    }

    function createMonthlyReturnChart(data) {
        console.log('Monthly return chart data:', data);

        const ctx = document.getElementById('monthlyReturnChart').getContext('2d');
        
        if (window.monthlyReturnChart instanceof Chart) {
            window.monthlyReturnChart.destroy();
        }

        const sortedMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const sortedData = sortedMonths.map(month => {
            const monthData = data.find(item => item.month === month);
            return monthData ? monthData.avgReturn : 0;
        });

        console.log('Sorted monthly return data:', sortedData);

        // Find the best and worst performing months
        const maxChange = Math.max(...sortedData);
        const minChange = Math.min(...sortedData);

        // Function to interpolate between two colors
        function interpolateColor(color1, color2, factor) {
            const result = color1.slice();
            for (let i = 0; i < 3; i++) {
                result[i] = Math.round(result[i] + factor * (color2[i] - result[i]));
            }
            return result;
        }

        // Convert RGB array to CSS color string
        function rgbToCss(rgb) {
            return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        }

        // Define the colors for the gradient
        const startColor = [220, 20, 60]; // Crimson
        const midColor = [255, 215, 0]; // Gold
        const endColor = [34, 139, 34]; // Forest Green

        const backgroundColors = sortedData.map(item => {
            let factor;
            let color;
            if (item < 0) {
                factor = (item - minChange) / (0 - minChange);
                color = interpolateColor(startColor, midColor, factor);
            } else {
                factor = (item - 0) / (maxChange - 0);
                color = interpolateColor(midColor, endColor, factor);
            }
            return rgbToCss(color);
        });

        window.monthlyReturnChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedMonths,
                datasets: [{
                    label: 'Average Monthly Return (%)',
                    data: sortedData,
                    backgroundColor: backgroundColors,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Average Return (%)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(2) + '%';
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toFixed(2) + '%';
                            }
                        }
                    },
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Avg. Price Change by Month',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });
    }

    function createPriceChangeDistributionChart(data) {
        console.log('Price change distribution chart data:', data);

        const ctx = document.getElementById('priceChangeDistributionChart').getContext('2d');
        
        if (window.priceChangeDistributionChart instanceof Chart) {
            window.priceChangeDistributionChart.destroy();
        }

        window.priceChangeDistributionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => `${item.change.toFixed(1)}%`),
                datasets: [{
                    label: 'Frequency',
                    data: data.map(item => item.count),
                    backgroundColor: 'rgba(153, 102, 255, 0.6)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Frequency'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Daily Price Change (%)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toFixed(1);
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Daily Volatility',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });
    }

    const randomButton = document.querySelector('.search-container .random-button');

    randomButton.addEventListener('click', async () => {
        const randomTicker = await fetchRandomTicker();
        if (randomTicker) {
            console.log(`Searching for random ticker: ${randomTicker}`);
            searchInput.value = randomTicker; // Set the random ticker in the search input
            setLoadingState(true);
            fetchCompanyOverview(randomTicker);
            fetchHistoricalData(randomTicker);
        }
    });

    async function fetchRandomTicker() {
        const tickers = [
            'AAPL',
            'NVDA',
            'MSFT',
            'GOOGL',
            'GOOG',
            'AMZN',
            'META',
            'BRK-B',
            'LLY',
            'AVGO',
            'TSLA',
            'JPM',
            'WMT',
            'UNH',
            'XOM',
            'V',
            'MA',
            'PG',
            'JNJ',
            'COST',
            'ORCL',
            'HD',
            'ABBV',
            'BAC',
            'KO',
            'NFLX',
            'MRK',
            'CVX',
            'CRM',
            'ADBE',
            'AMD',
            'PEP',
            'TMUS',
            'TMO',
            'LIN',
            'ACN',
            'MCD',
            'CSCO',
            'ABT',
            'DHR',
            'WFC',
            'TXN',
            'QCOM',
            'PM',
            'GE',
            'IBM',
            'AXP',
            'AMGN',
            'VZ',
            'INTU',
            'NOW',
            'ISRG',
            'CAT',
            'BX',
            'DIS',
            'NEE',
            'MS',
            'PFE',
            'AMAT',
            'GS',
            'RTX',
            'SPGI',
            'CMCSA',
            'UBER',
            'UNP',
            'LOW',
            'PGR',
            'T',
            'TJX',
            'SYK',
            'LMT',
            'HON',
            'REGN',
            'COP',
            'BLK',
            'BKNG',
            'NKE',
            'ELV',
            'VRTX',
            'PLD',
            'ETN',
            'SCHW',
            'C',
            'BSX',
            'MDT',
            'PANW',
            'KKR',
            'ADI',
            'CB',
            'UPS',
            'ADP',
            'MMC',
            'MU',
            'SBUX',
            'ANET',
            'KLAC',
            'BA',
            'LRCX',
            'DE',
            'AMT',
            'HCA',
            'CI',
            'BMY',
            'FI',
            'GILD',
            'MDLZ',
            'SO',
            'ICE',
            'SHW',
            'MO',
            'MCO',
            'DUK',
            'INTC',
            'CL',
            'WM',
            'ZTS',
            'SNPS',
            'APH',
            'CTAS',
            'GD',
            'TT',
            'EQIX',
            'PH',
            'CME',
            'CMG',
            'NOC',
            'EOG',
            'CVS',
            'ITW',
            'PYPL',
            'CDNS',
            'AON',
            'TGT',
            'ABNB',
            'TDG',
            'FDX',
            'WELL',
            'MMM',
            'MSI',
            'USB',
            'MCK',
            'PNC',
            'ECL',
            'BDX',
            'CSX',
            'ORLY',
            'RSG',
            'FCX',
            'SLB',
            'CARR',
            'CRWD',
            'NXPI',
            'MAR',
            'AJG',
            'SPG',
            'APD',
            'DHI',
            'CEG',
            'AFL',
            'EMR',
            'NEM',
            'PSA',
            'TFC',
            'ROP',
            'MPC',
            'FTNT',
            'PSX',
            'WMB',
            'ADSK',
            'NSC',
            'GM',
            'COF',
            'AZO',
            'O',
            'HLT',
            'AEP',
            'OXY',
            'MET',
            'SRE',
            'OKE',
            'ROST',
            'TRV',
            'CHTR',
            'CPRT',
            'GEV',
            'DLR',
            'PCAR',
            'LEN',
            'PCG',
            'BK',
            'URI',
            'CCI',
            'KDP',
            'KMB',
            'ALL',
            'AIG',
            'JCI',
            'KMI',
            'GWW',
            'D',
            'PAYX',
            'TEL',
            'MNST',
            'COR',
            'VLO',
            'MPWR',
            'MSCI',
            'IQV',
            'STZ',
            'F',
            'FIS',
            'KHC',
            'LHX',
            'AMP',
            'MCHP',
            'ODFL',
            'HES',
            'CMI',
            'HUM',
            'PRU',
            'KVUE',
            'FICO',
            'RCL',
            'EW',
            'ACGL',
            'CNC',
            'NDAQ',
            'A',
            'PEG',
            'PWR',
            'IDXX',
            'HSY',
            'GIS',
            'HWM',
            'EA',
            'EXR',
            'AME',
            'FAST',
            'GEHC',
            'CTVA',
            'VRSK',
            'KR',
            'CTSH',
            'EXC',
            'YUM',
            'DOW',
            'SYY',
            'OTIS',
            'EFX',
            'IT',
            'IR',
            'GLW',
            'SMCI',
            'CBRE',
            'NUE',
            'BKR',
            'FANG',
            'ED',
            'HPQ',
            'VICI',
            'GRMN',
            'XEL',
            'DD',
            'LULU',
            'EL',
            'DFS',
            'IRM',
            'MLM',
            'RMD',
            'HIG',
            'VMC',
            'XYL',
            'EIX',
            'ON',
            'CSGP',
            'TRGP',
            'LYB',
            'MRNA',
            'AVB',
            'CDW',
            'ROK',
            'MTD',
            'LVS',
            'BIIB',
            'PPG',
            'DXCM',
            'TSCO',
            'WEC',
            'BRO',
            'VST',
            'ADM',
            'WTW',
            'WAB',
            'EBAY',
            'EQR',
            'FITB',
            'DVN',
            'NVR',
            'HAL',
            'TTWO',
            'GPN',
            'ANSS',
            'MTB',
            'K',
            'PHM',
            'VLTO',
            'AWK',
            'DG',
            'AXON',
            'NTAP',
            'CAH',
            'KEYS',
            'DAL',
            'DTE',
            'IFF',
            'FTV',
            'ETR',
            'STT',
            'DOV',
            'FE',
            'FSLR',
            'HPE',
            'CHD',
            'HST',
            'VTR',
            'SBAC',
            'BR',
            'TYL',
            'RJF',
            'TROW',
            'ROL',
            'DECK',
            'SW',
            'ES',
            'PPL',
            'ZBH',
            'STE',
            'GDDY',
            'TSN',
            'WY',
            'LYV',
            'CBOE',
            'WRB',
            'AEE',
            'STX',
            'WST',
            'INVH',
            'CCL',
            'TER',
            'WDC',
            'BF-B',
            'ARE',
            'MKC',
            'HBAN',
            'PTC',
            'CPAY',
            'LDOS',
            'RF',
            'DLTR',
            'CINF',
            'HUBB',
            'BLDR',
            'MOH',
            'CMS',
            'ATO',
            'WBD',
            'WAT',
            'GPC',
            'TDY',
            'EQT',
            'ESS',
            'BALL',
            'BAX',
            'OMC',
            'LH',
            'SYF',
            'CLX',
            'BBY',
            'CFG',
            'MAA',
            'STLD',
            'COO',
            'J',
            'HOLX',
            'DRI',
            'PFG',
            'PKG',
            'FOXA',
            'FOX',
            'JBHT',
            'ZBRA',
            'NTRS',
            'ULTA',
            'CTRA',
            'EXPE',
            'HRL',
            'VRSN',
            'CNP',
            'L',
            'MAS',
            'AVY',
            'EXPD',
            'ALGN',
            'NRG',
            'SWKS',
            'DGX',
            'APTV',
            'IP',
            'LUV',
            'TXT',
            'EG',
            'ENPH',
            'UDR',
            'AMCR',
            'NWS',
            'NWSA',
            'GEN',
            'MRO',
            'KIM',
            'KEY',
            'DOC',
            'FDS',
            'UHS',
            'SWK',
            'IEX',
            'AKAM',
            'CPB',
            'RVTY',
            'LNT',
            'SNA',
            'CAG',
            'DPZ',
            'CF',
            'NI',
            'NDSN',
            'CE',
            'PNR',
            'BG',
            'UAL',
            'VTRS',
            'TRMB',
            'POOL',
            'EVRG',
            'KMX',
            'CPT',
            'BXP',
            'REG',
            'DVA',
            'SJM',
            'JNPR',
            'AES',
            'PODD',
            'INCY',
            'JBL',
            'JKHY',
            'IPG',
            'AOS',
            'CHRW',
            'ALLE',
            'EMN',
            'FFIV',
            'MGM',
            'TFX',
            'EPAM',
            'TECH',
            'LKQ',
            'TAP',
            'HII',
            'BEN',
            'CTLT',
            'APA',
            'QRVO',
            'SOLV',
            'RL',
            'CRL',
            'ALB',
            'AIZ',
            'PNW',
            'MHK',
            'FRT',
            'MTCH',
            'HAS',
            'GNRC',
            'PAYC',
            'TPR',
            'DAY',
            'GL',
            'MOS',
            'HSIC',
            'WBA',
            'LW',
            'MKTX',
            'BIO',
            'WYNN',
            'FMC',
            'CZR',
            'PARA',
            'BBWI',
            'IVZ',
            'BWA',
            'NCLH',
            'AAL',
            'ETSY'];
        const randomIndex = Math.floor(Math.random() * tickers.length);
        return tickers[randomIndex];
    }
    
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM fully loaded');

        const searchInput = document.getElementById('search-input');
        const searchButton = document.querySelector('.search-container button');
        const scoreItems = document.querySelectorAll('.score-item p');
        const stockChartSpinner = document.getElementById('stockChartSpinner');
        
        const newsletterForm = document.getElementById('newsletter-form');
        if (newsletterForm) {
            console.log('Newsletter form found');
            newsletterForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('newsletter-email').value;
                
                console.log('Form submitted with email:', email);
                
                if (!isValidEmail(email)) {
                    console.log('Invalid email address');
                    alert('Please enter a valid email address.');
                    return;
                }

                try {
                    console.log('Sending POST request to /api/subscribe');
                    const response = await fetch('/api/subscribe', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email })
                    });

                    console.log('Response status:', response.status);
                    console.log('Response OK:', response.ok);

                    if (response.ok) {
                        const result = await response.json();
                        console.log('Subscription successful:', result);
                        alert(result.message);
                        newsletterForm.reset();
                    } else {
                        console.log('Subscription failed');
                        throw new Error('Subscription failed');
                    }
                } catch (error) {
                    console.error('Error during subscription:', error);
                    alert('An error occurred. Please try again later.');
                }
            });
        } else {
            console.log('Newsletter form not found');
        }

        function isValidEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        }

        console.log('Event listeners set up');
    });

    console.log('Script loaded');
});