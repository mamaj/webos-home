/* ES2017-compatible webOS UI. All assets and preferences are local. */
(function () {
  'use strict';
  var config = window.HOME_CONFIG || {}, storageKey = 'personal-home.v1';
  var page = 'favorites', savedFocus = null, holdTimer = null, held = false;
  var cinema = {items: []}, featured = null, backdropIndex = 0;
  var suppressClickUntil = 0, wakeBlockUntil = 0, lastActivity = Date.now(), toastTimer, bridges = [];
  var $ = function (id) { return document.getElementById(id); };
  var appId = /^[a-z0-9][a-z0-9._-]{1,150}$/;
  var apps = (config.apps || []).filter(function (a) { return a && appId.test(a.id) && typeof a.title === 'string'; });
  var inputs = [1, 2, 3, 4].map(function (i) { return {id: 'com.webos.app.hdmi' + i, title: 'HDMI ' + i, label: 'Open input', input: true}; });
  inputs.push({id: 'com.webos.app.livetv', title: 'Live TV', label: 'Antenna / cable', input: true});
  var allowed = apps.concat(inputs, [{id: 'com.palm.app.settings'}, {id: 'com.webos.app.home'}]).map(function (a) { return a.id; });
  var prefs = {favorites: (config.favorites || []).slice(), hidden: []};
  try {
    var stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (stored && Array.isArray(stored.favorites) && Array.isArray(stored.hidden)) prefs = stored;
  } catch (e) { /* Damaged storage must never prevent startup. */ }
  function known(id) { return apps.some(function (a) { return a.id === id; }); }
  function unique(ids) { return ids.filter(function (id, i) { return known(id) && ids.indexOf(id) === i; }); }
  prefs.favorites = unique(prefs.favorites); prefs.hidden = unique(prefs.hidden);
  function save() { try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch (e) { toast('Your changes could not be saved.'); } }
  // Apply the requested favorite change once, preserving later customization.
  if (!prefs.browserFavoriteV1 && known('com.webos.app.browser')) {
    prefs.favorites = unique(prefs.favorites.map(function (id) { return id === 'ca.bellmedia.crave' ? 'com.webos.app.browser' : id; }));
    prefs.browserFavoriteV1 = true;
    save();
  }
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { $('toast').hidden = true; }, 4500); }
  function visibleButtons() {
    var root = $('dialog-backdrop').hidden ? $('stage') : $('dialog');
    return [].filter.call(root.querySelectorAll('button'), function (b) { return b.offsetWidth > 0 && b.offsetHeight > 0 && !b.disabled; });
  }
  function focus(button) {
    if (!button) return;
    try { button.focus({preventScroll: true}); } catch (e) { button.focus(); }
    var row = button.closest('.scroll-row');
    if (row) { var r = button.getBoundingClientRect(), edge = row.getBoundingClientRect(), scaleX = Math.min(innerWidth / 1920, innerHeight / 1080); if (r.right > edge.right - 6) row.scrollLeft += (r.right - edge.right + 12) / scaleX; if (r.left < edge.left + 6) row.scrollLeft -= (edge.left - r.left + 12) / scaleX; }
    if (page === 'favorites' || !$('content').contains(button)) return;
    var rect = button.getBoundingClientRect(), area = $('content').getBoundingClientRect(), scale = Math.min(innerWidth / 1920, innerHeight / 1080);
    if (rect.bottom > area.bottom - 8) $('content').scrollTop += (rect.bottom - area.bottom + 16) / scale;
    if (rect.top < area.top + 8) $('content').scrollTop -= (area.top - rect.top + 16) / scale;
  }
  function findButton(id) {
    var buttons = visibleButtons();
    return buttons.filter(function (b) { return b.dataset.app === id || b.id === id; })[0];
  }
  function launch(id, params) {
    if (allowed.indexOf(id) < 0) return toast('That shortcut is not available.');
    if (typeof window.PalmServiceBridge !== 'function') return toast('Preview: would open ' + id);
    params = id === 'com.webos.app.browser' && params && (/^https:\/\/www\.themoviedb\.org\/(movie|tv)\/\d+\/watch\?locale=CA$/.test(params.target || '') || /^https:\/\/30nama\.com\/(play\/\d+|search\?q=[^\s]+)$/.test(params.target || '') || /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(params.target || '') || params.target === 'https://open-meteo.com/en/licence') ? {target: params.target} : {};
    var bridge = new window.PalmServiceBridge(), finished = false;
    bridges.push(bridge);
    function done() { finished = true; bridges = bridges.filter(function (b) { return b !== bridge; }); }
    var timer = setTimeout(function () { if (!finished) { done(); toast('The TV did not respond. Try again.'); } }, 6000);
    bridge.onservicecallback = function (reply) {
      if (finished) return;
      clearTimeout(timer); done();
      try { var result = JSON.parse(reply); if (!result.returnValue) toast(result.errorText || 'Could not open this app.'); }
      catch (e) { toast('The TV returned an unreadable response.'); }
    };
    try { bridge.call('luna://com.webos.applicationManager/launch', JSON.stringify({id: id, params: params})); }
    catch (e) { clearTimeout(timer); done(); toast('Could not open this app.'); }
  }
  function button(label, className, callback) {
    var b = document.createElement('button'); b.className = className;
    if (label) b.textContent = label;
    b.activate = callback;
    b.addEventListener('click', function (event) { if (event.detail === 0 && Date.now() < suppressClickUntil) return; callback(event); });
    b.addEventListener('mouseenter', function () { focus(b); });
    return b;
  }
  function element(tag, className, value) { var e = document.createElement(tag); if (className) e.className = className; if (value) e.textContent = value; return e; }
  function tile(app) {
    var b = button('', 'tile ' + (app.input ? 'input-tile' : 'theme-' + (/^(red|blue|dark|white|purple|green|slate)$/.test(app.theme) ? app.theme : 'slate')), function () { launch(app.id); });
    b.dataset.app = app.id; b.setAttribute('aria-label', app.title);
    var face = element('span', 'tile-face'), brand = element('span', 'brand', app.brand || app.title);
    face.appendChild(brand);
    if (!app.input && /^icons\/[a-z0-9._-]+\.(png|jpg)$/.test(app.icon || '')) {
      var icon = element('img', 'app-icon'); icon.alt = ''; icon.draggable = false;
      icon.setAttribute('aria-hidden', 'true'); icon.width = 132; icon.height = 132;
      icon.onerror = function () { icon.hidden = true; brand.hidden = false; b.classList.remove('has-icon'); };
      brand.hidden = true; b.classList.add('has-icon'); icon.src = app.icon; face.appendChild(icon);
    }
    b.appendChild(face); b.appendChild(element('span', 'caption', app.label || app.title));
    if (!app.input) {
      b.app = app;
      if (prefs.favorites.indexOf(app.id) >= 0 && page !== 'favorites') b.appendChild(element('span', 'pin', '★'));
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); appMenu(app); });
    }
    return b;
  }
  function render(restoreId) {
    var list = page === 'inputs' ? inputs : page === 'favorites'
      ? prefs.favorites.map(function (id) { return apps.filter(function (a) { return a.id === id; })[0]; }) : apps;
    list = list.filter(function (a) { return a && prefs.hidden.indexOf(a.id) < 0; });
    $('grid').textContent = ''; list.forEach(function (a) { $('grid').appendChild(tile(a)); });
    $('empty').hidden = list.length > 0; $('stage').className = page === 'favorites' ? 'home-page' : 'secondary-page';
    $('heading').textContent = page === 'favorites' ? 'Your apps' : page === 'apps' ? 'All apps' : 'Inputs';
    $('subtitle').textContent = page === 'apps' ? 'Hold OK to pin an app, move it, or hide a tile.' : 'Choose an input.';
    [].forEach.call(document.querySelectorAll('[data-page]'), function (b) { b.classList.toggle('active', b.dataset.page === page); b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false'); });
    if (restoreId) focus(findButton(restoreId) || $('grid').querySelector('button') || document.querySelector('[data-page="apps"]'));
  }
  function setPage(next) { page = next; $('content').scrollTop = 0; render(); }
  function closeDialog() { $('dialog-backdrop').hidden = true; focus(findButton(savedFocus) || document.querySelector('[data-page="' + page + '"]')); }
  function dialog(title, copy, actions) {
    var active = document.activeElement;
    if ($('dialog-backdrop').hidden) savedFocus = active && (active.dataset.app || active.id);
    $('dialog-label').textContent = 'PERSONAL HOME'; $('dialog-credit').hidden = true;
    $('dialog-title').textContent = title; $('dialog-copy').textContent = copy; $('dialog-actions').textContent = '';
    actions.concat([{label: 'Back', run: closeDialog}]).forEach(function (action) { $('dialog-actions').appendChild(button(action.label, 'dialog-button', action.run)); });
    $('dialog-backdrop').hidden = false; focus($('dialog-actions').querySelector('button'));
  }
  function appMenu(app) {
    var index = prefs.favorites.indexOf(app.id), actions = [];
    function finish(message) { save(); render(); closeDialog(); toast(message); }
    if (index < 0) actions.push({label: 'Add to favorites', run: function () { prefs.favorites.push(app.id); finish('Added to favorites'); }});
    else {
      if (index > 0) actions.push({label: 'Move favorite left', run: function () { var prior = prefs.favorites[index - 1]; prefs.favorites[index - 1] = app.id; prefs.favorites[index] = prior; finish('Favorite moved'); }});
      if (index < prefs.favorites.length - 1) actions.push({label: 'Move favorite right', run: function () { var next = prefs.favorites[index + 1]; prefs.favorites[index + 1] = app.id; prefs.favorites[index] = next; finish('Favorite moved'); }});
      actions.push({label: 'Remove from favorites', run: function () { prefs.favorites.splice(index, 1); finish('Removed from favorites'); }});
    }
    actions.push({label: 'Hide this tile', run: function () { prefs.hidden.push(app.id); finish('Tile hidden. Customize can bring it back.'); }});
    dialog(app.title, 'Arrange this home screen. Hiding a tile leaves the app installed.', actions);
  }
  function customize() {
    dialog('Customize Home', 'Arrange your apps and browse your content rows. The idle clock appears after three quiet minutes.', [
      {label: 'About recommendations', run: showFeedAbout},
      {label: 'About weather', run: showWeatherAbout},
      {label: 'Show hidden tiles', run: function () { prefs.hidden = []; save(); render(); closeDialog(); toast('All tiles are visible again'); }},
      {label: 'Restore default favorites', run: function () { prefs.favorites = unique(config.favorites || []); prefs.hidden = []; save(); render(); closeDialog(); toast('Default favorites restored'); }},
      {label: config.systemHome ? 'LG Home recovery' : 'Open LG Home', run: function () {
        closeDialog();
        if (config.systemHome) dialog('LG Home recovery', 'On the Mac used to set up this TV, open Restore LG Home.command in the WebOS project folder. LG Home will stay the default until you run Enable Personal Home.command. Your privacy controls will stay enabled.', []);
        else launch('com.webos.app.home');
      }}
    ]);
  }
  function move(code) {
    if (window.HOME_MOVE && window.HOME_MOVE(code)) return;
    var current = document.activeElement, buttons = visibleButtons(), here = current && current.getBoundingClientRect();
    if (!here || buttons.indexOf(current) < 0) return focus(buttons[0]);
    var horizontal = code === 37 || code === 39, direction = code === 37 || code === 38 ? -1 : 1;
    var best = null, bestScore = Infinity;
    buttons.forEach(function (b) {
      if (b === current) return;
      var r = b.getBoundingClientRect(), dx = (r.left + r.right - here.left - here.right) / 2, dy = (r.top + r.bottom - here.top - here.bottom) / 2;
      var forward = direction * (horizontal ? dx : dy), cross = Math.abs(horizontal ? dy : dx);
      if (forward <= 2) return;
      var aligned = horizontal ? r.top < here.bottom && r.bottom > here.top : r.left < here.right && r.right > here.left;
      var score = forward + cross * 3 + (aligned ? 0 : 1500);
      if (score < bestScore) { bestScore = score; best = b; }
    });
    focus(best);
  }
  function activity(event) {
    lastActivity = Date.now();
    if (event && event.type === 'click' && Date.now() < wakeBlockUntil) { event.preventDefault(); event.stopImmediatePropagation(); return true; }
    if (!$('idle').hidden) { $('idle').hidden = true; wakeBlockUntil = Date.now() + 600; if (event) { event.preventDefault(); event.stopImmediatePropagation(); } return true; }
    return false;
  }
  document.addEventListener('keydown', function (e) {
    if (activity(e)) return;
    var code = e.keyCode;
    if (code >= 37 && code <= 40) { e.preventDefault(); clearTimeout(holdTimer); holdTimer = null; return move(code); }
    if (code === 13) {
      e.preventDefault(); if (e.repeat || holdTimer) return;
      var target = document.activeElement; held = false;
      holdTimer = setTimeout(function () { holdTimer = null; held = true; if (target && target.app) appMenu(target.app); }, 650);
    }
    if (code === 461 || code === 27 || code === 8) {
      e.preventDefault(); clearTimeout(holdTimer); holdTimer = null;
      if (!$('dialog-backdrop').hidden) closeDialog();
      else if (page !== 'favorites') { setPage('favorites'); focus($('grid').querySelector('button') || document.querySelector('[data-page="apps"]')); }
      else if (config.systemHome) toast('Choose an app or input. Customize includes LG Home recovery.');
      else dialog('Back to LG Home?', 'You can return to Personal Home from the app list.', [{label: 'Open LG Home', run: function () { closeDialog(); launch('com.webos.app.home'); }}]);
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.keyCode !== 13) return;
    e.preventDefault(); suppressClickUntil = Date.now() + 250;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; var target = document.activeElement; if (!held && target && target.activate) target.activate(); }
    held = false;
  });
  ['click', 'mousemove', 'wheel', 'mousedown'].forEach(function (name) { window.addEventListener(name, activity, {capture: true, passive: false}); });
  document.addEventListener('visibilitychange', function () { lastActivity = Date.now(); $('idle').hidden = true; clearTimeout(holdTimer); holdTimer = null; });
  function handleRelaunch() {
    try { if (window.PalmSystem) window.PalmSystem.activate(); } catch (e) {}
    activity();
    // Native Home and the fallback may both request activation. Re-activating
    // the existing Home page must preserve its tiles, selected row and focus.
    if (page !== 'favorites') {
      $('dialog-backdrop').hidden = true;
      setPage('favorites');
      focus($('grid').querySelector('button'));
    } else if (!$('dialog-backdrop').hidden) {
      closeDialog();
    } else if (visibleButtons().indexOf(document.activeElement) < 0) {
      focus($('grid').querySelector('button'));
    }
  }
  document.addEventListener('webOSRelaunch', handleRelaunch);
  [].forEach.call(document.querySelectorAll('[data-page]'), function (b) { b.activate = function () { setPage(b.dataset.page); }; b.onclick = function (e) { if (e.detail !== 0 || Date.now() >= suppressClickUntil) b.activate(); }; });
  $('settings').activate = function () { launch('com.palm.app.settings'); }; $('settings').onclick = function (e) { if (e.detail !== 0 || Date.now() >= suppressClickUntil) $('settings').activate(); };
  $('customize').activate = customize; $('customize').onclick = function (e) { if (e.detail !== 0 || Date.now() >= suppressClickUntil) customize(); };

  function safeArtwork(value) { return typeof value === 'string' && /^cinema\/tmdb-(movie|tv)-\d+-[a-f0-9]{12}\.jpg$/.test(value); }
  function showFeatured(item) {
    if (!item) return;
    var changed = !featured || featured.image !== item.image; featured = item;
    $('hero-kicker').textContent = (Date.now() - Date.parse(cinema.updatedAt) > 36 * 3600000 ? 'RECENTLY POPULAR' : 'POPULAR TODAY') + '  ·  ' + (item.type === 'tv' ? 'SERIES' : 'MOVIE');
    $('hero-title').textContent = item.title; $('hero-overview').textContent = item.overview || 'Explore this title and find where to watch.';
    $('hero-meta').textContent = '';
    if (/^\d{4}$/.test(item.year)) $('hero-meta').appendChild(element('span', '', item.year));
    if (item.rating > 0) $('hero-meta').appendChild(element('span', 'rating', 'TMDB ' + item.rating.toFixed(1)));
    $('hero-details').hidden = false;
    if (!changed) return;
    var next = $(backdropIndex ? 'backdrop-a' : 'backdrop-b'), previous = $(backdropIndex ? 'backdrop-b' : 'backdrop-a');
    next.onload = function () { if (featured.image !== item.image) return; next.classList.add('on'); previous.classList.remove('on'); backdropIndex = backdropIndex ? 0 : 1; };
    next.src = item.image;
  }
  function showTitle(item) {
    if (!item) return;
    dialog(item.title, (item.overview || 'No summary is available for this title.') + '\n\nAvailability varies by country and service.', [
      {label: 'Where to watch in Canada', run: function () { closeDialog(); launch('com.webos.app.browser', {target: 'https://www.themoviedb.org/' + item.type + '/' + item.id + '/watch?locale=CA'}); }},
      {label: 'About this row', run: showFeedAbout}
    ]);
    $('dialog-label').textContent = (item.type === 'tv' ? 'SERIES' : 'MOVIE') + (item.year ? '  ·  ' + item.year : '');
    if (window.HOME_ON_TITLE) window.HOME_ON_TITLE(item);
  }
  function showFeedAbout() {
    if (window.HOME_ABOUT) return window.HOME_ABOUT();
    var updated = cinema.updatedAt ? new Date(cinema.updatedAt).toLocaleString('en-CA', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Not yet available';
    dialog('Popular today', 'One row of worldwide daily trending movies and shows from TMDB. This is a general popularity feed, not a personal recommendation profile.\n\nUpdated: ' + updated + '. The TV refreshes its cache every six hours. The launcher does not read or send your viewing history. Opening availability uses the TV browser.', []);
    $('dialog-credit').hidden = false;
  }
  function applyCinemaFeed(data) {
    if (window.HOME_DATA) return;
    if (!data || !Array.isArray(data.items) || !isFinite(Date.parse(data.updatedAt))) { if (!cinema.items.length) $('feed-empty').hidden = false; return; }
    if (data.updatedAt === cinema.updatedAt) return;
    var items = data.items.filter(function (a) { return a && /^(movie|tv)$/.test(a.type) && Number.isSafeInteger(a.id) && a.id > 0 && typeof a.title === 'string' && safeArtwork(a.image); }).slice(0,10);
    if (!items.length) { $('feed-empty').hidden = false; return; }
    var active = document.activeElement && document.activeElement.dataset.content;
    cinema = {items: items, updatedAt: data.updatedAt}; $('popular-row').textContent = ''; $('feed-empty').hidden = true;
    $('popular-heading').textContent = Date.now() - Date.parse(data.updatedAt) > 36 * 3600000 ? 'Recently popular' : 'Popular today';
    items.forEach(function (item) {
      var b = button('', 'poster', function () { showTitle(item); }); b.id = 'content-' + item.type + '-' + item.id; b.dataset.content = item.type + ':' + item.id; b.setAttribute('aria-label', item.title);
      var image = element('img', ''); image.alt = ''; image.draggable = false; image.src = item.image; b.appendChild(image);
      b.appendChild(element('span', 'poster-kind', item.type === 'tv' ? 'Series' : 'Movie')); b.appendChild(element('span', 'poster-name', item.title));
      b.addEventListener('focus', function () { showFeatured(item); }); $('popular-row').appendChild(b);
    });
    var selected = featured && items.filter(function (i) { return i.id === featured.id && i.type === featured.type; })[0];
    showFeatured(selected || items[0]);
    if (active) focus([].filter.call($('popular-row').querySelectorAll('button'), function (b) { return b.dataset.content === active; })[0]);
  }
  function refreshCinemaFeed() {
    if (document.visibilityState !== 'visible') return;
    var script = document.createElement('script'); script.src = 'cinema/feed.js?v=' + Date.now();
    script.onload = function () { applyCinemaFeed(window.CINEMA_FEED); script.remove(); }; script.onerror = function () { script.remove(); };
    document.head.appendChild(script);
  }
  var weather = null;
  var weatherLabels = {0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Freezing fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Rain showers',81:'Rain showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorms',96:'Thunderstorms',97:'Thunderstorms',99:'Thunderstorms'};
  var cloudIcon = '<path class="weather-cloud" stroke="currentColor" d="M13 33h23a8 8 0 0 0 0-16 12 12 0 0 0-23-2 9 9 0 0 0 0 18Z"/>';
  var weatherIcons = {
    sun:'<circle cx="24" cy="24" r="8"/><path d="M24 4v5m0 30v5M4 24h5m30 0h5M10 10l4 4m20 20 4 4M10 38l4-4m20-20 4-4"/>',
    moon:'<path d="M40 28.5A17 17 0 0 1 19.5 8 17 17 0 1 0 40 28.5Z"/><path d="M34 6v6m-3-3h6"/>',
    partly:'<circle cx="17" cy="15" r="7"/><path d="M17 2v3M4 15h3M7 5l3 3m15-3-3 3"/><path class="weather-cloud" fill="#111923" stroke="currentColor" d="M17 38h20a7 7 0 0 0 0-14 10 10 0 0 0-19-2 8 8 0 0 0-1 16Z"/>',
    'partly-night':'<path d="M25 17A11 11 0 0 1 12 4 11 11 0 1 0 25 17Z"/><path class="weather-cloud" fill="#111923" stroke="currentColor" d="M17 38h20a7 7 0 0 0 0-14 10 10 0 0 0-19-2 8 8 0 0 0-1 16Z"/>',
    cloud:cloudIcon,
    rain:cloudIcon+'<path d="m16 39-2 5m11-5-2 5m11-5-2 5"/>',
    snow:cloudIcon+'<path d="M16 38v7m-3.5-5.3 7 3.6m0-3.6-7 3.6M32 38v7m-3.5-5.3 7 3.6m0-3.6-7 3.6"/>',
    storm:cloudIcon+'<path class="weather-bolt" stroke="currentColor" d="m25 32-5 8h7l-4 7"/>',
    fog:cloudIcon+'<path d="M9 39h30m-25 6h20"/>',
    unavailable:'<path d="M8 24h32"/>'
  };
  function weatherKind(code, day) {
    if (code === 0 || code === 1) return day ? 'sun' : 'moon';
    if (code === 2) return day ? 'partly' : 'partly-night';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    return weatherLabels[code] ? 'rain' : 'unavailable';
  }
  function renderWeather() {
    var age = weather ? Date.now() - Date.parse(weather.observedAt) : Infinity;
    var fresh = weather && age >= -1800000 && age < 3 * 3600000;
    var temperature = fresh ? Math.round(weather.temperature) + '°C' : '—';
    var condition = fresh ? weatherLabels[weather.code] || 'Unavailable' : 'Unavailable';
    var kind = fresh ? weatherKind(weather.code, weather.isDay !== false) : 'unavailable';
    $('weather-temperature').textContent = temperature; $('weather-condition').textContent = condition;
    $('weather').setAttribute('aria-label', fresh ? 'Toronto · ' + temperature + ' · ' + condition : 'Toronto · Weather unavailable');
    if ($('weather-icon').getAttribute('data-kind') !== kind) { $('weather-icon').innerHTML = weatherIcons[kind]; $('weather-icon').setAttribute('data-kind', kind); }
  }
  function applyWeather(data) {
    if (data && data.city === 'Toronto' && typeof data.temperature === 'number' && isFinite(data.temperature) && data.temperature >= -80 && data.temperature <= 60 && Number.isInteger(data.code) && data.code >= 0 && data.code <= 99 && isFinite(Date.parse(data.observedAt))) weather = data;
    renderWeather();
  }
  function refreshWeather() {
    if (document.visibilityState !== 'visible') return;
    var script = document.createElement('script'); script.src = 'weather/feed.js?v=' + Date.now();
    script.onload = function () { applyWeather(window.WEATHER_FEED); script.remove(); }; script.onerror = function () { renderWeather(); script.remove(); };
    document.head.appendChild(script);
  }
  function showWeatherAbout() {
    var time = weather ? new Date(weather.observedAt).toLocaleString('en-CA', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Unavailable';
    dialog('Toronto weather', 'Weather data by Open-Meteo, licensed under CC BY 4.0. Temperature is rounded; conditions describe weather model estimates.\n\nUpdated conditions: ' + time + '. Refreshed every 30 minutes. Data older than three hours is hidden.\n\nUses Toronto city-centre coordinates. No IP geolocation, viewing history, or TV identifier is sent. The weather provider receives your public IP address with the request.', [
      {label:'Open-Meteo source & licence',run:function(){closeDialog();launch('com.webos.app.browser',{target:'https://open-meteo.com/en/licence'});}}
    ]);
  }
  applyWeather(window.WEATHER_FEED);
  setInterval(refreshWeather, 60000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refreshWeather(); });
  $('hero-details').activate = function () { showTitle(featured); }; $('hero-details').onclick = function (e) { if (e.detail !== 0 || Date.now() >= suppressClickUntil) $('hero-details').activate(); };
  $('feed-info').activate = showFeedAbout; $('feed-info').onclick = function (e) { if (e.detail !== 0 || Date.now() >= suppressClickUntil) showFeedAbout(); };
  if (!window.HOME_DATA) {
    setInterval(refreshCinemaFeed, 60000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refreshCinemaFeed(); });
  }
  function resize() { $('stage').style.transform = 'scale(' + Math.min(innerWidth / 1920, innerHeight / 1080) + ')'; }
  function clock() { var d = new Date(), time = d.toLocaleTimeString('en-CA', {hour: 'numeric', minute: '2-digit', hour12: true}), parts = time.split(/\s+/); $('clock-value').textContent = parts[0]; $('clock-period').textContent = parts.slice(1).join('').replace(/\./g, '').toUpperCase(); $('clock').setAttribute('aria-label', time); $('date').textContent = d.toLocaleDateString('en-CA', {weekday: 'long', month: 'long', day: 'numeric'}); $('idle-clock').textContent = time; renderWeather(); }
  var idlePositions = [[180, 160], [1070, 650], [240, 700], [1100, 200]];
  setInterval(function () {
    if (document.visibilityState !== 'visible' || Date.now() - lastActivity < 180000) return;
    $('idle').hidden = false; var p = idlePositions[Math.floor(Date.now() / 30000) % idlePositions.length]; $('idle-clock').style.left = p[0] + 'px'; $('idle-clock').style.top = p[1] + 'px';
  }, 10000);
  window.addEventListener('resize', resize); resize(); clock(); setInterval(clock, 10000); render(); applyCinemaFeed(window.CINEMA_FEED); focus($('grid').querySelector('button') || document.querySelector('[data-page="apps"]'));
  window.HOME_UI={dialog:dialog,closeDialog:closeDialog,button:button,element:element,focus:focus,toast:toast,launch:launch,showFeatured:showFeatured,showTitle:showTitle,featured:function(){return featured;}};
})();
