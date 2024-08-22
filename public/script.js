document.addEventListener('DOMContentLoaded', () => {
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

    async function fetchCompanyOverview(symbol) {
        try {
            console.log(`Fetching data for ${symbol}`);
            const response = await fetch(`${window.location.origin}/api/company-overview/${symbol}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Full API response:', JSON.stringify(data, null, 2));
            if (Object.keys(data).length === 0) {
                throw new Error('No data received from API');
            }
            console.log('EBITDA value:', data.EBITDA);
            updateCompanyInfo(data);
        } catch (error) {
            console.error('Error fetching company overview:', error);
        } finally {
            setLoadingState(false);
        }
    }

    function updateCompanyInfo(data) {
        console.log('Updating company info:', data);
        document.getElementById('market-cap').textContent = data.MarketCapitalization || 'N/A';
        document.getElementById('ebitda').textContent = data.EBITDA || 'N/A';
        document.getElementById('pe-ratio').textContent = data.PERatio || 'N/A';
        document.getElementById('profit-margin').textContent = data.ProfitMargin || 'N/A';
        document.getElementById('company-description').textContent = data.Description || 'No description available.';
        document.getElementById('company-name').textContent = data.Name || 'Company Name';

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

        return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
    }

    async function fetchHistoricalData(symbol) {
        try {
            const response = await fetch(`${window.location.origin}/api/historical-data/${symbol}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
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
                }
            }
        });
    }

    function createDayOfWeekChart(data) {
        const ctx = document.getElementById('dayOfWeekChart').getContext('2d');
        
        if (dayOfWeekChart) {
            dayOfWeekChart.destroy();
        }

        dayOfWeekChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => item.day),
                datasets: [{
                    label: 'Average Price Change (%)',
                    data: data.map(item => item.avgChange),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)'
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

        window.monthlyReturnChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedMonths,
                datasets: [{
                    label: 'Average Monthly Return (%)',
                    data: sortedData,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
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
                }
            }
        });
    }
});