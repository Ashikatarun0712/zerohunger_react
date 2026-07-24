# 🍞 ZeroHunger P2P Platform

ZeroHunger is a decentralized, peer-to-peer (P2P) web application designed to connect surplus food donors with individuals, NGOs, and verified Trusts in need. The platform leverages modern frontend technologies and AI to streamline the donation process, verify food safety, and encourage community engagement through gamification.

## 🚀 The Tech Stack & Architecture
- **Frontend Framework**: React 18 (Vite)
- **Styling**: Pure CSS (Glassmorphism, custom responsive UI, CSS Variables for seamless Light/Dark mode)
- **Database/Backend**: Supabase (PostgreSQL) — Real-time state syncing and backend storage.
- **Mapping & Geolocation**: Leaflet.js with Nominatim API for reverse geocoding and proximity-based P2P matching.
- **AI Vision Engine**: 
  - *Primary*: TensorFlow.js + MobileNet CNN (running entirely on-device) for instant food type and freshness detection.
  - *Fallback*: OpenRouter API (stepfun/step-1v-8k) for complex analysis, expiry date calculation, and conversational AI.

## 🌟 Integrated Methods & Features

### 1. AI-Powered Food Safety & Expiry Prediction
When a donor uploads an image, the on-device **MobileNet CNN** instantly scans the image to identify the food type and gauge preliminary freshness without server latency. If more context is needed, the system falls back to a remote AI engine to calculate safe consumption windows (e.g., 24h for cooked food, 20 days for raw produce).

### 2. Proximity-Based P2P Matching (Haversine Logic)
The system calculates the exact physical distance between donors and receivers using the Haversine formula based on live GPS coordinates. The `Receiver` module automatically sorts available donations so the nearest options appear first, ensuring food is transported quickly before expiry.

### 3. Partial Fulfillment System
A flexible matching mechanism allows donors to partially fulfill large requests. If a request needs 100 units and a donor only has 30, the system automatically subtracts 30 from the required amount, keeps the request pending for the remaining 70, and creates a secure handshake for the processed 30 units. 

### 4. Verified Trust Module & Bulk Requests
To prevent fraud and ensure massive donations reach the right people, NGOs and Trusts must undergo an **AI Document Verification** process. Once the system validates their registration certificate, the Trust account is unlocked, allowing them to:
- Post bulk food requests (visually badged as `🏛️ TRUST` for donors).
- Request monetary funds via UPI integration.

### 5. Micro-Volunteer System
Users can sign up as Micro-Volunteers. Receivers can explicitly check a box to request volunteer delivery. The system scans the volunteer's radius and pushes the delivery job to their radar.

### 6. Offline-Capable ChatBot
An integrated assistant handles both online live-chat processing via LLMs and an intelligent offline fallback layer. When offline, it detects user intent (e.g., "how to donate", "leaderboard", "trust verification") and provides rich text and quick-action buttons to navigate the platform.

### 7. Automated Request Pruning
Standard (non-Trust) food requests that remain unfulfilled for 48 hours are automatically filtered from the active feed to keep the platform clean and prevent donors from committing to stale, outdated requests.

## 💡 Advantages
- **Zero-Latency AI**: Offloading basic vision tasks to the browser ensures the platform works lightning-fast and saves API costs.
- **High Security**: Mandatory NGO certificate scanning ensures financial donations are safe.
- **Frictionless UX**: Features like map-clicking to auto-fill accurate local area names, and smart location detection eliminate tedious manual data entry.
