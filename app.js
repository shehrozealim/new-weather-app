const CONFIG = {
  API_KEY: 'c1869f6e334ec8f43743350ce6189b4d',
  BASE_URL: 'https://api.openweathermap.org/data/2.5/',
  MAX_RECENT_SEARCHES: 4
};

const state = {
  unit: 'metric',
  currentCity: '',
  weatherData: null,
  forecastData: null,
  recentSearches: JSON.parse(localStorage.getItem('weather_recent')) || []
};


const DOM = {
  appContainer: document.querySelector('.app-container'),
  searchForm: document.getElementById('search-form'),
  searchInput: document.getElementById('search-input'),
  geoBtn: document.getElementById('geo-btn'),
  unitToggleBtn: document.getElementById('unit-toggle'),
  unitC: document.getElementById('unit-c'),
  unitF: document.getElementById('unit-f'),
  recentChips: document.getElementById('recent-chips'),
  errorContainer: document.getElementById('error-container'),
  errorMessage: document.getElementById('error-message'),
  mainContent: document.getElementById('main-content'),
  skeletonLoader: document.getElementById('skeleton-loader'),
  
  cityName: document.getElementById('city-name'),
  currentDate: document.getElementById('current-date'),
  weatherStatusTag: document.getElementById('weather-status-tag'),
  weatherIcon: document.getElementById('weather-icon'),
  currentTemp: document.getElementById('current-temp'),
  feelsLike: document.getElementById('feels-like'),
  humidity: document.getElementById('humidity'),
  windSpeed: document.getElementById('wind-speed'),
  tempUnits: document.querySelectorAll('.temp-unit'),

  forecastGrid: document.getElementById('forecast-grid'),
  forecastCardTemplate: document.getElementById('forecast-card-template')
};

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  renderRecentSearches();

  const initialCity = state.recentSearches[0] || 'Mumbai';
  fetchWeatherDataByCity(initialCity);
});

function initEventListeners() {
  DOM.searchForm.addEventListener('submit', handleSearchSubmit);
  DOM.geoBtn.addEventListener('click', handleGeolocationRequest);
  DOM.unitToggleBtn.addEventListener('click', toggleUnit);
}

function handleSearchSubmit(e) {
  e.preventDefault();
  const query = DOM.searchInput.value.trim();
  if (!query) return;
  fetchWeatherDataByCity(query);
  DOM.searchInput.value = '';
}

function handleGeolocationRequest() {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }

  setLoadingState(true);
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetchWeatherDataByCoords(latitude, longitude);
    },
    (error) => {
      setLoadingState(false);
      showError('Unable to retrieve your location. Please check browser permissions.');
    }
  );
}

async function fetchWeatherDataByCity(city) {
  setLoadingState(true);
  hideError();

  try {
    const currentUrl = `${CONFIG.BASE_URL}weather?q=${encodeURIComponent(city)}&units=${state.unit}&appid=${CONFIG.API_KEY}`;
    const forecastUrl = `${CONFIG.BASE_URL}forecast?q=${encodeURIComponent(city)}&units=${state.unit}&appid=${CONFIG.API_KEY}`;

    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentUrl),
      fetch(forecastUrl)
    ]);

    if (!currentRes.ok || !forecastRes.ok) {
      if (currentRes.status === 404) throw new Error('City not found. Please verify the name.');
      if (currentRes.status === 401) throw new Error('Invalid API key provided.');
      throw new Error('Failed to retrieve weather data.');
    }

    state.weatherData = await currentRes.json();
    state.forecastData = await forecastRes.json();
    state.currentCity = state.weatherData.name;

    saveRecentSearch(state.currentCity);
    updateUI();
  } catch (err) {
    showError(err.message);
  } finally {
    setLoadingState(false);
  }
}

async function fetchWeatherDataByCoords(lat, lon) {
  setLoadingState(true);
  hideError();

  try {
    const currentUrl = `${CONFIG.BASE_URL}weather?lat=${lat}&lon=${lon}&units=${state.unit}&appid=${CONFIG.API_KEY}`;
    const forecastUrl = `${CONFIG.BASE_URL}forecast?lat=${lat}&lon=${lon}&units=${state.unit}&appid=${CONFIG.API_KEY}`;

    const [currentRes, forecastRes] = await Promise.all([
      fetch(currentUrl),
      fetch(forecastUrl)
    ]);

    if (!currentRes.ok || !forecastRes.ok) {
      throw new Error('Error fetching location weather data.');
    }

    state.weatherData = await currentRes.json();
    state.forecastData = await forecastRes.json();
    state.currentCity = state.weatherData.name;

    saveRecentSearch(state.currentCity);
    updateUI();
  } catch (err) {
    showError(err.message);
  } finally {
    setLoadingState(false);
  }
}

function updateUI() {
  renderCurrentWeather();
  renderForecast();
  applyDynamicTheme();
}

function renderCurrentWeather() {
  const data = state.weatherData;
  const speedUnit = state.unit === 'metric' ? 'm/s' : 'mph';

  DOM.cityName.textContent = `${data.name}, ${data.sys.country}`;
  DOM.currentDate.textContent = formatDate(new Date());
  DOM.weatherStatusTag.textContent = data.weather[0].description;
  DOM.currentTemp.textContent = Math.round(data.main.temp);
  DOM.feelsLike.textContent = `${Math.round(data.main.feels_like)}°`;
  DOM.humidity.textContent = `${data.main.humidity}%`;
  DOM.windSpeed.textContent = `${data.wind.speed} ${speedUnit}`;

  const iconCode = data.weather[0].icon;
  DOM.weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  DOM.weatherIcon.classList.remove('hidden');

  DOM.tempUnits.forEach(el => el.textContent = state.unit === 'metric' ? '°C' : '°F');
}

function renderForecast() {
  DOM.forecastGrid.innerHTML = '';

  const dailyList = filterDailyForecasts(state.forecastData.list);

  dailyList.forEach(item => {
    const card = DOM.forecastCardTemplate.content.cloneNode(true);
    const dateObj = new Date(item.dt * 1000);

    card.querySelector('.forecast-day').textContent = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    card.querySelector('.forecast-date').textContent = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    card.querySelector('.forecast-icon').src = `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`;
    card.querySelector('.forecast-condition').textContent = item.weather[0].description;
    card.querySelector('.temp-max').textContent = `${Math.round(item.main.temp_max)}°`;
    card.querySelector('.temp-min').textContent = `${Math.round(item.main.temp_min)}°`;

    DOM.forecastGrid.appendChild(card);
  });
}

function filterDailyForecasts(list) {
  const dailyMap = {};
  list.forEach(entry => {
    const date = entry.dt_txt.split(' ')[0];
    if (!dailyMap[date] || entry.dt_txt.includes('12:00:00')) {
      dailyMap[date] = entry;
    }
  });

  return Object.values(dailyMap).slice(0, 5);
}

function applyDynamicTheme() {
  if (!state.weatherData) return;

  const mainCondition = state.weatherData.weather[0].main.toLowerCase();
  const iconCode = state.weatherData.weather[0].icon;
  const isNight = iconCode.endsWith('n');

  let theme = 'default';

  if (mainCondition.includes('clear')) {
    theme = isNight ? 'clear-night' : 'clear-day';
  } else if (mainCondition.includes('rain') || mainCondition.includes('drizzle') || mainCondition.includes('thunderstorm')) {
    theme = 'rain';
  } else if (mainCondition.includes('clouds')) {
    theme = 'clouds';
  }

  DOM.appContainer.setAttribute('data-theme', theme);
}

function toggleUnit() {
  state.unit = state.unit === 'metric' ? 'imperial' : 'metric';
  DOM.unitC.classList.toggle('active', state.unit === 'metric');
  DOM.unitF.classList.toggle('active', state.unit === 'imperial');

  if (state.currentCity) {
    fetchWeatherDataByCity(state.currentCity);
  }
}

function saveRecentSearch(city) {
  let list = state.recentSearches.filter(c => c.toLowerCase() !== city.toLowerCase());
  list.unshift(city);
  if (list.length > CONFIG.MAX_RECENT_SEARCHES) {
    list = list.slice(0, CONFIG.MAX_RECENT_SEARCHES);
  }
  state.recentSearches = list;
  localStorage.setItem('weather_recent', JSON.stringify(list));
  renderRecentSearches();
}

function renderRecentSearches() {
  DOM.recentChips.innerHTML = '';
  state.recentSearches.forEach(city => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = city;
    chip.addEventListener('click', () => fetchWeatherDataByCity(city));
    DOM.recentChips.appendChild(chip);
  });
}

function setLoadingState(isLoading) {
  if (isLoading) {
    DOM.skeletonLoader.classList.remove('hidden');
    DOM.errorContainer.classList.add('hidden');
  } else {
    DOM.skeletonLoader.classList.add('hidden');
  }
}

function showError(msg) {
  DOM.errorMessage.textContent = msg;
  DOM.errorContainer.classList.remove('hidden');
}

function hideError() {
  DOM.errorContainer.classList.add('hidden');
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}