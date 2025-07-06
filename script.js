const openWeatherKey = '4a34142e740b8484c773427a69950549';
    const pexelsKey = 'HdUCOJQ2B5mrlPLSj6woSOSEovwElbuUqObLRED5KbZyWanUnmxeeWlu';
    let chart, compareCity = null;

    function startApp() {
      document.getElementById('welcomeScreen').style.display = 'none';
      document.getElementById('appContainer').style.display = 'block';
      loadSavedCities();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(error => console.log('Service Worker registration failed:', error));
        setupPushNotifications();
      }
    }

    function handleKeyPress(event) {
      if (event.key === 'Enter') searchWeather();
    }

    function searchWeather() {
      const city = document.getElementById('cityInput').value;
      if (!city) return alert('Please enter a city!');
      fetchWeather(city, 'weatherMain1');
      fetchBackground(city);
      saveCity(city);
    }

    async function fetchWeather(city, targetId) {
      const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=metric&appid=${openWeatherKey}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.cod !== "200") throw new Error('City not found');
        
        updateWeatherDisplay(data, targetId);
        fetchHistoricalWeather();
        fetchAlerts(data.city.coord.lat, data.city.coord.lon, data.list[0].weather[0].main.toLowerCase());
        updateChart(data);
      } catch (error) {
        alert('Error fetching weather: ' + error.message);
      }
    }

    function updateWeatherDisplay(data, targetId) {
      document.getElementById(`cityName${targetId.slice(-1)}`).innerText = data.city.name;
      document.getElementById(`weatherDescription${targetId.slice(-1)}`).innerText = data.list[0].weather[0].description;
      document.getElementById(`temperature${targetId.slice(-1)}`).innerText = `${Math.round(data.list[0].main.temp)}°C`;
      document.getElementById(`humidity${targetId.slice(-1)}`).innerText = `Humidity: ${data.list[0].main.humidity}%`;
      document.getElementById(`windSpeed${targetId.slice(-1)}`).innerText = `Wind Speed: ${data.list[0].wind.speed} m/s`;
      document.getElementById(`pressure${targetId.slice(-1)}`).innerText = `Pressure: ${data.list[0].main.pressure} hPa`;
      updateDaylight(data.city.timezone, data.city.sunrise, data.city.sunset, targetId);

      const hourlyContainer = document.getElementById('hourlyData');
      hourlyContainer.innerHTML = '';
      for (let i = 0; i < 8; i++) {
        const hourData = data.list[i];
        const time = new Date(hourData.dt * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        hourlyContainer.innerHTML += `<p>${time}: ${Math.round(hourData.main.temp)}°C, ${hourData.weather[0].description}</p>`;
      }

      const dailyContainer = document.getElementById('dailyData');
      dailyContainer.innerHTML = '';
      const daysAdded = new Set();
      for (let item of data.list) {
        const day = new Date(item.dt_txt).toLocaleDateString(undefined, { weekday: 'long' });
        if (!daysAdded.has(day) && daysAdded.size < 7) {
          daysAdded.add(day);
          const dailyTemps = data.list.filter(d => new Date(d.dt_txt).toLocaleDateString() === new Date(item.dt_txt).toLocaleDateString()).map(d => d.main.temp);
          const minTemp = Math.min(...dailyTemps);
          const maxTemp = Math.max(...dailyTemps);
          dailyContainer.innerHTML += `<p>${day}: ${Math.round(minTemp)}°C - ${Math.round(maxTemp)}°C, ${item.weather[0].main}</p>`;
        }
      }
    }

    function fetchHistoricalWeather() {
      const historicalContainer = document.getElementById('historicalData');
      historicalContainer.innerHTML = '';
      for (let i = 1; i <= 5; i++) {
        const date = new Date(Date.now() - i * 86400000);
        const formattedDate = date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
        const temp = Math.round(Math.random() * 30);
        const description = ['Sunny', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 3)];
        historicalContainer.innerHTML += `<p>${formattedDate}: ${temp}°C, ${description}</p>`;
      }
    }

    async function fetchAlerts(lat, lon, weather) {
      const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&appid=${openWeatherKey}`;
      try {
        const response = await fetch(url);
        const data = await response.json();

        const alertsData = document.getElementById('alertsData');
        alertsData.innerHTML = '';
        if (data.alerts) {
          data.alerts.forEach(alert => {
            alertsData.innerHTML += `<p><strong>${alert.event}:</strong> ${alert.description}</p>`;
            sendPushNotification(alert.event, alert.description);
          });
        } else {
          alertsData.innerHTML = '<p>No alerts for this area.</p>';
        }

        const tips = {
          rain: 'Carry an umbrella as rain is expected!',
          clear: 'Stay hydrated—it’s a sunny day!',
          snow: 'Wear layers to stay warm in the snow.'
        };
        document.getElementById('awarenessTip').innerText = tips[weather] || 'Check the forecast before heading out!';
      } catch (error) {
        console.log('Error fetching alerts:', error);
      }
    }

    async function fetchBackground(city) {
      const weatherDescription = document.getElementById('weatherDescription1').innerText.split(' ')[0]; // Get first word of weather description
      const query = `${city} ${weatherDescription}`;
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`;
      try {
        const response = await fetch(url, { headers: { Authorization: pexelsKey } });
        const data = await response.json();
        if (data.photos.length > 0) {
          document.body.style.backgroundImage = `url(${data.photos[0].src.landscape})`;
        } else {
          document.body.style.backgroundImage = 'linear-gradient(135deg, #4facfe, #00f2fe)';
        }
      } catch (error) {
        console.log('Error fetching background:', error);
        document.body.style.backgroundImage = 'linear-gradient(135deg, #4facfe, #00f2fe)';
      }
    }

    function togglePopup(id) {
      const popup = document.getElementById(id);
      if (popup.style.display === 'block') {
        popup.style.opacity = 0;
        setTimeout(() => popup.style.display = 'none', 300);
      } else {
        popup.style.display = 'block';
        setTimeout(() => popup.style.opacity = 1, 10);
      }
    }

    function updateDaylight(timezoneOffset, sunrise, sunset, targetId) {
      const nowUTC = new Date(new Date().toUTCString());
      const localTime = new Date(nowUTC.getTime() + timezoneOffset * 1000);
      const hours = localTime.getHours();

      const emoji = document.getElementById('dayEmoji');
      if (hours >= 6 && hours <= 18) emoji.innerText = '🌞';
      else emoji.innerText = '🌙';

      const sunriseTime = new Date(sunrise * 1000).toLocaleTimeString();
      const sunsetTime = new Date(sunset * 1000).toLocaleTimeString();
      document.getElementById(`sunTimes${targetId.slice(-1)}`).innerText = `Sunrise: ${sunriseTime} | Sunset: ${sunsetTime}`;
    }

    function toggleUnits() {
      [1, 2].forEach(i => {
        const tempElement = document.getElementById(`temperature${i}`);
        if (!tempElement.innerText) return;
        const isMetric = tempElement.innerText.includes('°C');
        const temp = parseInt(tempElement.innerText);
        tempElement.innerText = isMetric ? `${Math.round((temp * 9/5) + 32)}°F` : `${Math.round((temp - 32) * 5/9)}°C`;
      });
    }

    function shareWeather() {
      const text = `${document.getElementById('cityName1').innerText}: ${document.getElementById('temperature1').innerText}, ${document.getElementById('weatherDescription1').innerText}`;
      if (navigator.share) navigator.share({ title: 'ClimaVista', text });
      else alert('Sharing not supported on this device.');
    }

    function saveCity(city) {
      let cities = JSON.parse(localStorage.getItem('savedCities') || '[]');
      if (!cities.includes(city)) cities.push(city);
      localStorage.setItem('savedCities', JSON.stringify(cities));
      loadSavedCities();
    }

    function loadSavedCities() {
      const cities = JSON.parse(localStorage.getItem('savedCities') || '[]');
      const select = document.getElementById('savedCities');
      select.innerHTML = '<option value="">Select City</option>' + cities.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    function loadCityWeather() {
      const city = document.getElementById('savedCities').value;
      if (city) fetchWeather(city, 'weatherMain1');
    }

    function compareWeather() {
      const selectedCity = document.getElementById('savedCities').value;
      const enteredCity = document.getElementById('cityInput').value;
      if (!selectedCity || !enteredCity) return alert('Please select and enter cities to compare.');
      if (selectedCity === enteredCity) return alert('Both cities are the same.');
      fetchWeather(selectedCity, 'weatherMain1');
      fetchWeather(enteredCity, 'weatherMain2');
      document.getElementById('weatherMain2').style.display = 'block';
    }

    function setupPushNotifications() {
      if ('PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
          registration.pushManager.subscribe({ userVisibleOnly: true }).then(subscription => {
            console.log('Push subscription successful:', subscription);
          }).catch(error => console.log('Push subscription failed:', error));
        });
      }
    }

    function sendPushNotification(title, body) {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, { body, icon: '/icon.png' });
        });
      }
    }

    function updateChart(data) {
      const ctx = document.getElementById('weatherChart').getContext('2d');
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.list.slice(0, 8).map(d => new Date(d.dt * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})),
          datasets: [{
            label: 'Temperature (°C)',
            data: data.list.slice(0, 8).map(d => d.main.temp),
            borderColor: '#00f2fe',
            fill: false
          }]
        },
        options: {
          scales: {
            x: { ticks: { color: 'white', font: { size: 14, weight: 'bold' } } },
            y: { ticks: { color: 'white', font: { size: 14, weight: 'bold' } } }
          }
        }
      });
    }

    function startVoiceSearch() {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.onresult = event => {
        const city = event.results[0][0].transcript;
        document.getElementById('cityInput').value = city;
        searchWeather();
      };
      recognition.onerror = () => alert('Voice recognition failed.');
      recognition.start();
    }
