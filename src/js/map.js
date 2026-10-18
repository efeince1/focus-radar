import { getState, subscribe, visiblePlaces } from './state.js';

const TYPE_COLOR = { library: '#57f1db', cafe: '#ffb95f', coworking: '#a78bfa' };
const TYPE_LABEL = { library: 'Library', cafe: 'Cafe', coworking: 'Coworking' };
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let map;
let layer;
let previous = null;
let lastPoints = [];

function fit() {
  if (lastPoints.length > 1) map.fitBounds(lastPoints, { padding: [40, 40], maxZoom: 16 });
  else if (lastPoints.length === 1) map.setView(lastPoints[0], 14);
}
const markers = new Map();

const dotIcon = (color) =>
  L.divIcon({
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
    html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #0c141f;box-shadow:0 0 0 2px ${color}99"></span>`,
  });

const popupHtml = (place) => `
  <strong>${escapeHtml(place.name)}</strong><br>
  <span style="color:#bacac5">${TYPE_LABEL[place.type]} · ${place.distanceKm.toFixed(1)} km</span><br>
  <a href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}" target="_blank" rel="noopener noreferrer">Directions</a>`;

function render(state) {
  // Sadece harita verisini etkileyen değişimlerde yeniden çiz
  if (previous && ['workspaces', 'activeFilter', 'currentCity'].every((key) => previous[key] === state[key])) return;
  previous = state;

  layer.clearLayers();
  markers.clear();
  const points = [];

  const { currentCity } = state;
  if (currentCity) {
    L.circleMarker([currentCity.lat, currentCity.lon], {
      radius: 7, color: '#57f1db', weight: 2, fillColor: '#57f1db', fillOpacity: 0.3,
    })
      .bindTooltip(currentCity.name)
      .addTo(layer);
    points.push([currentCity.lat, currentCity.lon]);
  }

  visiblePlaces(state).forEach((place) => {
    const marker = L.marker([place.lat, place.lon], { icon: dotIcon(TYPE_COLOR[place.type]) })
      .bindPopup(popupHtml(place))
      .addTo(layer);
    markers.set(place.id, marker);
    points.push([place.lat, place.lon]);
  });

    lastPoints = points;
  fit();
}

// Karta tıklayınca haritada o mekana git
export function focusPlace(id) {
  const marker = markers.get(id);
  if (!marker) return;
  map.getContainer().scrollIntoView({ behavior: 'smooth', block: 'center' });
  map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 16), { duration: 0.8 });
  marker.openPopup();
}

export function initMap() {
  map = L.map('map', {
    scrollWheelZoom: false, // sayfa kaydırırken harita zoom'a takılmasın
    dragging: !L.Browser.mobile, // mobilde tek parmakla sayfa kayabilsin
  }).setView([25, 10], 2);

    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19, className: 'dark-tiles' }).addTo(map);
  layer = L.layerGroup().addTo(map);

  // Konteyner boyutu oturunca haritayı düzelt ve işaretçilere yakınlaş
  new ResizeObserver(() => {
    map.invalidateSize();
    fit();
  }).observe(map.getContainer());

  subscribe(render);
  render(getState());
}