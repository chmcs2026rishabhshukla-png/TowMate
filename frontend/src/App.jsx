
import { useEffect, useState } from "react";
import "./App.css";
import LocationPicker from "./LocationPicker";

const API_URL = "http://localhost:3000";

const emptyForm = {
  customerName: "",
  vehicleNumber: "",
  vehicleType: "Car",
  problem: "",
  location: "",
  providerName: "",
  estimatedCost: "",
  latitude: null,
  longitude: null,
};

const initialStats = {
  total: 0,
  pending: 0,
  accepted: 0,
  inProgress: 0,
  completed: 0,
  cancelled: 0,
  rejected: 0,
  totalCost: 0,
  completedCost: 0,
};

function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [formData, setFormData] = useState({ ...emptyForm });
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(initialStats);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [nearbyProviders, setNearbyProviders] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [providerMessage, setProviderMessage] = useState("");
  const [selectingProviderId, setSelectingProviderId] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Request failed (${response.status})`);
    }

    return data;
  }

  async function loadDashboard() {
    await Promise.all([
      fetchRequests(),
      fetchStats(),
      fetchMonthlyStats(),
    ]);
  }

  async function fetchRequests() {
    try {
      const data = await apiRequest("/api/towing-requests");
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Requests error:", err);
      setError("Requests load nahi hui. Backend check karo.");
    }
  }

  async function fetchStats() {
    try {
      const data = await apiRequest("/api/towing-requests/stats");
      setStats({ ...initialStats, ...data });
    } catch (err) {
      console.error("Stats error:", err);
    }
  }

  async function fetchMonthlyStats() {
    try {
      const year = new Date().getFullYear();
      const data = await apiRequest(
        `/api/towing-requests/monthly-stats?year=${year}`
      );
      setMonthlyStats(
        Array.isArray(data.monthlyStats) ? data.monthlyStats : []
      );
    } catch (err) {
      console.error("Monthly stats error:", err);
    }
  }

  function goToPage(page) {
    setCurrentPage(page);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleInputChange(event) {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  }

  function handleLocationSelect(coords) {
    setFormData((previous) => ({
      ...previous,
      latitude: coords.latitude,
      longitude: coords.longitude,
    }));
    setMessage("Map location selected successfully.");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (
      !formData.customerName.trim() ||
      !formData.vehicleNumber.trim() ||
      !formData.vehicleType ||
      !formData.problem.trim() ||
      !formData.location.trim()
    ) {
      setError("Please fill all required fields.");
      return;
    }

    if (formData.latitude == null || formData.longitude == null) {
      setError("Please select your breakdown location on the map.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        ...formData,
        estimatedCost: Number(formData.estimatedCost || 0),
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
      };

      await apiRequest("/api/towing-requests", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setFormData({ ...emptyForm });
      setMessage("Towing request submitted successfully!");
      await loadDashboard();
      setCurrentPage("dashboard");
    } catch (err) {
      setError(err.message || "Request submit nahi hui.");
    } finally {
      setLoading(false);
    }
  }

  async function findNearbyProviders(request) {
    if (request.latitude == null || request.longitude == null) {
      setSelectedRequestId(request._id);
      setNearbyProviders([]);
      setProviderError(
        "Is request ke coordinates saved nahi hain. Map par location select karke nayi request banao."
      );
      setProviderMessage("");
      return;
    }

    setSelectedRequestId(request._id);
    setNearbyProviders([]);
    setProviderError("");
    setProviderMessage("");
    setProviderLoading(true);

    try {
      const params = new URLSearchParams({
        latitude: String(request.latitude),
        longitude: String(request.longitude),
        radius: "100",
      });

      const data = await apiRequest(
        `/api/providers/nearby?${params.toString()}`
      );

      const providers = Array.isArray(data)
        ? data
        : Array.isArray(data.providers)
          ? data.providers
          : Array.isArray(data.results)
            ? data.results
            : [];

      setNearbyProviders(providers);

      setProviderMessage(
        providers.length
          ? `${providers.length} nearby provider(s) found within 100 km.`
          : "100 km ke andar koi provider nahi mila. Provider coordinates aur backend filter check karo."
      );
    } catch (err) {
      setProviderError(err.message || "Providers load nahi ho paaye.");
    } finally {
      setProviderLoading(false);
    }
  }

  async function selectProvider(request, provider) {
    if (!provider.providerName) {
      setProviderError("Provider name is missing.");
      return;
    }

    if (request.providerName === provider.providerName) {
      setProviderMessage("Ye provider pehle se request ke saath assigned hai.");
      setProviderError("");
      return;
    }

    const confirmed = window.confirm(
      `Assign ${provider.providerName} to request ${request.vehicleNumber}?`
    );

    if (!confirmed) return;

    const providerId = provider._id || provider.providerName;
    setSelectingProviderId(providerId);
    setProviderError("");
    setProviderMessage("");

    try {
      await apiRequest(`/api/towing-requests/${request._id}/provider`, {
        method: "PATCH",
        body: JSON.stringify({
          providerName: provider.providerName,
        }),
      });

      setProviderMessage(`${provider.providerName} assigned successfully!`);
      await loadDashboard();
    } catch (err) {
      setProviderError(
        err.message || "Provider assign nahi hua. Backend route check karo."
      );
    } finally {
      setSelectingProviderId(null);
    }
  }

  async function updateRequestStatus(id, status) {
    setError("");
    setMessage("");

    try {
      await apiRequest(`/api/towing-requests/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setMessage("Request status updated.");
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Status update nahi hua.");
    }
  }

  async function deleteRequest(id) {
    if (!window.confirm("Delete this towing request?")) return;

    try {
      await apiRequest(`/api/towing-requests/${id}`, {
        method: "DELETE",
      });

      if (selectedRequestId === id) {
        setSelectedRequestId(null);
        setNearbyProviders([]);
        setProviderError("");
        setProviderMessage("");
      }

      setMessage("Towing request deleted.");
      setError("");
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Request delete nahi hui.");
    }
  }

  function renderHome() {
    return (
      <>
        <section className="hero">
          <div className="hero-content">
            <div className="hero-text">
              <span className="hero-badge">24/7 Roadside Assistance</span>
              <h1>
                Fast &amp; Reliable
                <br />
                <span>Towing Assistance</span>
              </h1>
              <p>
                Vehicle breakdown hone par TowMate se towing request submit
                karo aur nearby providers find karo.
              </p>
              <div className="hero-buttons">
                <button className="primary-btn" onClick={() => goToPage("request")}>
                  Request Tow
                </button>
                <button className="secondary-btn" onClick={() => goToPage("dashboard")}>
                  View Dashboard
                </button>
              </div>
            </div>

            <div className="hero-card">
              <div className="hero-card-icon">🚨</div>
              <h3>Need Towing Assistance?</h3>
              <p>Vehicle details aur breakdown location enter karo.</p>
              <button className="primary-btn full-btn" onClick={() => goToPage("request")}>
                Get Help Now
              </button>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <span>WHY TOWMATE?</span>
            <h2>Roadside Assistance Made Simple</h2>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📍</div>
              <h3>Interactive Map</h3>
              <p>Select your breakdown location on the map.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🚗</div>
              <h3>Towing Requests</h3>
              <p>Submit and track towing requests.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🛻</div>
              <h3>Nearby Providers</h3>
              <p>Find available providers within 100 km.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Dashboard</h3>
              <p>Review history and statistics.</p>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderRequestPage() {
    return (
      <section className="request-page">
        <div className="section-heading">
          <span>REQUEST ASSISTANCE</span>
          <h2>Request a Towing Service</h2>
          <p>Enter your vehicle and breakdown details.</p>
        </div>

        <div className="request-container">
          <form className="request-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Customer Name *</label>
                <input name="customerName" value={formData.customerName} onChange={handleInputChange} required placeholder="Enter your name" />
              </div>
              <div className="form-group">
                <label>Vehicle Number *</label>
                <input name="vehicleNumber" value={formData.vehicleNumber} onChange={handleInputChange} required placeholder="MH01AB1234" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Vehicle Type *</label>
                <select name="vehicleType" value={formData.vehicleType} onChange={handleInputChange} required>
                  <option value="Car">Car</option>
                  <option value="Bike">Bike</option>
                  <option value="SUV">SUV</option>
                  <option value="Truck">Truck</option>
                  <option value="Bus">Bus</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Problem *</label>
                <input name="problem" value={formData.problem} onChange={handleInputChange} required placeholder="Flat tyre, engine failure..." />
              </div>
            </div>

            <div className="form-group">
              <label>Breakdown Location / Address *</label>
              <input name="location" value={formData.location} onChange={handleInputChange} required placeholder="Enter area or landmark" />
            </div>

            <LocationPicker
              onLocationSelect={handleLocationSelect}
              initialLatitude={formData.latitude}
              initialLongitude={formData.longitude}
            />

            {formData.latitude != null && formData.longitude != null && (
              <div className="selected-location">
                <strong>Location selected</strong>
                <p>Latitude: {formData.latitude.toFixed(6)}</p>
                <p>Longitude: {formData.longitude.toFixed(6)}</p>
              </div>
            )}

            <div className="form-group">
              <label>Provider Name (Optional)</label>
              <input name="providerName" value={formData.providerName} onChange={handleInputChange} placeholder="Provider name if known" />
            </div>

            <div className="form-group">
              <label>Estimated Cost (₹)</label>
              <input type="number" min="0" name="estimatedCost" value={formData.estimatedCost} onChange={handleInputChange} placeholder="Estimated cost" />
            </div>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            <button className="primary-btn submit-btn" type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Towing Request"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  function renderProviderCard(provider, request) {
    const providerId = provider._id || provider.providerName;
    const distance = provider.distance ?? provider.distanceKm ?? provider.distanceInKm;

    return (
      <div className="nearby-provider-card" key={providerId}>
        <div className="provider-card-heading">
          <h4>{provider.providerName || "Towing Provider"}</h4>
          <span className={provider.availability === "available" ? "provider-available" : "provider-status"}>
            {provider.availability || "Status unavailable"}
          </span>
        </div>

        <p><strong>Phone:</strong> {provider.phone || "Not provided"}</p>
        <p><strong>Location:</strong> {provider.location || "Not provided"}</p>
        <p>
          <strong>Distance:</strong>{" "}
          {distance != null && Number.isFinite(Number(distance))
            ? `${Number(distance).toFixed(2)} km`
            : "Not provided by API"}
        </p>
        <p><strong>ETA:</strong> {provider.eta != null ? `${provider.eta} minutes` : "Not provided"}</p>
        <p><strong>Rating:</strong> {provider.rating != null ? `⭐ ${provider.rating}` : "Not rated"}</p>
        <p><strong>Estimated Price:</strong> {provider.estimatedPrice != null ? `₹${provider.estimatedPrice}` : "Not provided"}</p>
        <p><strong>Service:</strong> {provider.serviceType || "Vehicle Towing"}</p>

        {request.providerName === provider.providerName && (
          <p className="provider-message">Currently assigned to this request.</p>
        )}

        <button
          type="button"
          className="select-provider-btn"
          disabled={selectingProviderId !== null}
          onClick={() => selectProvider(request, provider)}
        >
          {selectingProviderId === providerId
            ? "Assigning..."
            : request.providerName === provider.providerName
              ? "Already Selected"
              : "Select Provider"}
        </button>
      </div>
    );
  }

  function renderNearbyProviders(request) {
    if (selectedRequestId !== request._id) return null;

    return (
      <div className="nearby-providers-section">
        <h4>Nearby Towing Providers</h4>
        <p className="nearby-radius">
          Search radius: 100 km from this breakdown location
        </p>

        {providerLoading && <p>Searching for nearby providers...</p>}
        {providerError && <p className="error-message">{providerError}</p>}
        {providerMessage && !providerError && <p className="provider-message">{providerMessage}</p>}

        {!providerLoading && nearbyProviders.length > 0 && (
          <div className="nearby-providers-grid">
            {nearbyProviders.map((provider) => renderProviderCard(provider, request))}
          </div>
        )}
      </div>
    );
  }

  function renderDashboard() {
    const maxMonthlyTows = Math.max(
      ...monthlyStats.map((month) => Number(month.totalTows) || 0),
      1
    );

    return (
      <section className="dashboard-page">
        <div className="section-heading">
          <span>TOWMATE DASHBOARD</span>
          <h2>Towing Overview</h2>
          <p>Manage requests, provider assignments and service history.</p>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="stats-grid">
          {[
            ["Total Requests", stats.total],
            ["Pending", stats.pending],
            ["Accepted", stats.accepted],
            ["In Progress", stats.inProgress],
            ["Completed", stats.completed],
            ["Cancelled", stats.cancelled],
            ["Total Cost", `₹${stats.totalCost}`],
            ["Completed Cost", `₹${stats.completedCost}`],
          ].map(([label, value]) => (
            <div className="stat-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h3>Monthly Towing Statistics</h3>
              <p>Monthly request counts.</p>
            </div>
          </div>

          <div className="monthly-chart">
            {monthlyStats.map((month) => {
              const total = Number(month.totalTows) || 0;
              const height = (total / maxMonthlyTows) * 100;

              return (
                <div className="chart-column" key={month.monthNumber}>
                  <div className="chart-value">{total}</div>
                  <div className="chart-bar-wrapper">
                    <div className="chart-bar" style={{ height: `${height}%` }} />
                  </div>
                  <span>{month.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h3>Towing Request History</h3>
              <p>Select a provider for any request with saved coordinates.</p>
            </div>
          </div>

          {requests.length === 0 ? (
            <div className="empty-state">
              <h3>No towing requests yet</h3>
              <button className="primary-btn" onClick={() => goToPage("request")}>
                Request Towing
              </button>
            </div>
          ) : (
            <div className="history-list">
              {requests.map((request) => (
                <div className="history-item" key={request._id}>
                  <div className="history-main">
                    <div>
                      <h3>{request.vehicleNumber}</h3>
                      <p>{request.customerName}</p>
                    </div>
                    <span className={`status-badge status-${request.status}`}>
                      {request.status}
                    </span>
                  </div>

                  <div className="history-details">
                    <span>Vehicle: {request.vehicleType}</span>
                    <span>Problem: {request.problem}</span>
                    <span>Location: {request.location}</span>
                    <span>Cost: ₹{request.estimatedCost}</span>
                    {request.providerName && <span>Assigned provider: {request.providerName}</span>}
                    {request.latitude != null && request.longitude != null && (
                      <span>
                        Coordinates: {Number(request.latitude).toFixed(5)}, {Number(request.longitude).toFixed(5)}
                      </span>
                    )}
                  </div>

                  <div className="history-actions">
                    <select
                      aria-label="Update request status"
                      value={request.status}
                      onChange={(event) => updateRequestStatus(request._id, event.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="accepted">Accepted</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="rejected">Rejected</option>
                    </select>

                    <button className="delete-btn" onClick={() => deleteRequest(request._id)}>
                      Delete
                    </button>
                  </div>

                  <button
                    type="button"
                    className="find-providers-btn"
                    onClick={() => findNearbyProviders(request)}
                    disabled={providerLoading}
                  >
                    {providerLoading && selectedRequestId === request._id
                      ? "Finding Providers..."
                      : "Find Nearby Providers"}
                  </button>

                  {renderNearbyProviders(request)}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <button className="logo" onClick={() => goToPage("home")}>
          <span className="logo-icon">🚗</span> TowMate
        </button>

        <div className="nav-links">
          <button className={currentPage === "home" ? "active" : ""} onClick={() => goToPage("home")}>Home</button>
          <button className={currentPage === "request" ? "active" : ""} onClick={() => goToPage("request")}>Request Tow</button>
          <button className={currentPage === "dashboard" ? "active" : ""} onClick={() => goToPage("dashboard")}>Dashboard</button>
        </div>

        <button className="nav-request-btn" onClick={() => goToPage("request")}>
          Get Help
        </button>
      </nav>

      <main>
        {currentPage === "home" && renderHome()}
        {currentPage === "request" && renderRequestPage()}
        {currentPage === "dashboard" && renderDashboard()}
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div>
            <h3>🚗 TowMate</h3>
            <p>Roadside towing request management.</p>
          </div>
          <div>
            <h4>Quick Links</h4>
            <button onClick={() => goToPage("home")}>Home</button>
            <button onClick={() => goToPage("request")}>Request Tow</button>
            <button onClick={() => goToPage("dashboard")}>Dashboard</button>
          </div>
          <div>
            <h4>Assistance</h4>
            <p>Map-based location selection</p>
            <p>Nearby towing provider search</p>
          </div>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} TowMate. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default App;
