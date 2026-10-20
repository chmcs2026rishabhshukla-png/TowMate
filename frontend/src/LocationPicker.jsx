
import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./LocationPicker.css";

// Fix default marker icons in Vite
const markerIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const defaultCenter = [20.5937, 78.9629];

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function MapCenter({ position }) {
  const map = useMap();

  if (position) {
    map.setView(position, 15);
  }

  return null;
}

export default function LocationPicker({
  onLocationSelect,
  initialLatitude = null,
  initialLongitude = null,
}) {
  const hasInitialLocation =
    initialLatitude !== null &&
    initialLongitude !== null &&
    Number.isFinite(Number(initialLatitude)) &&
    Number.isFinite(Number(initialLongitude));

  const [position, setPosition] = useState(
    hasInitialLocation
      ? [Number(initialLatitude), Number(initialLongitude)]
      : null
  );

  const [center, setCenter] = useState(
    hasInitialLocation
      ? [Number(initialLatitude), Number(initialLongitude)]
      : defaultCenter
  );

  const [message, setMessage] = useState("");

  function selectLocation(latitude, longitude) {
    const nextPosition = [latitude, longitude];

    setPosition(nextPosition);
    setCenter(nextPosition);
    setMessage("Location selected successfully.");

    if (onLocationSelect) {
      onLocationSelect({
        latitude,
        longitude,
      });
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Your browser does not support location access.");
      return;
    }

    setMessage("Getting your current location...");

    navigator.geolocation.getCurrentPosition(
      (result) => {
        selectLocation(
          result.coords.latitude,
          result.coords.longitude
        );
      },
      (error) => {
        if (error.code === 1) {
          setMessage(
            "Location permission denied. Allow location access in your browser."
          );
        } else if (error.code === 2) {
          setMessage("Your current location could not be determined.");
        } else {
          setMessage("Location request timed out. Please try again.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  return (
    <section className="location-picker">
      <div className="location-picker-heading">
        <div>
          <h3>Select Your Breakdown Location</h3>
          <p>Click on the map or use your current location.</p>
        </div>

        <button
          type="button"
          className="location-button"
          onClick={useCurrentLocation}
        >
          Use My Current Location
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={hasInitialLocation ? 15 : 5}
        className="location-map"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler
          onSelect={selectLocation}
        />

        <MapCenter position={position} />

        {position && (
          <Marker
            position={position}
            icon={markerIcon}
          />
        )}
      </MapContainer>

      {position && (
        <div className="selected-location">
          <strong>Selected Coordinates</strong>
          <p>
            Latitude: {position[0].toFixed(6)}
          </p>
          <p>
            Longitude: {position[1].toFixed(6)}
          </p>
        </div>
      )}

      {message && (
        <p className="location-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
