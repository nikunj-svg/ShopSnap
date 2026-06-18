/**
 * ShopSnap - Client-side Application Logic
 */

const DEFAULT_INVENTORY = [
  {
    id: "prod-1",
    name: "Coca Cola",
    category: "Beverages",
    description: "Classic carbonated soft drink, red label",
    variants: [
      { size: "250ml Can", price: 1.00 },
      { size: "500ml Bottle", price: 1.75 },
      { size: "1.5L Bottle", price: 2.75 }
    ],
    image: ""
  },
  {
    id: "prod-2",
    name: "Lays Classic Potato Chips",
    category: "Snacks",
    description: "Yellow bag of classic salted potato chips",
    variants: [
      { size: "30g bag", price: 0.60 },
      { size: "90g bag", price: 1.50 },
      { size: "170g bag", price: 2.80 }
    ],
    image: ""
  },
  {
    id: "prod-3",
    name: "Whole Milk",
    category: "Grocery",
    description: "Fresh pasteurized whole milk carton, blue branding",
    variants: [
      { size: "500ml Carton", price: 0.90 },
      { size: "1 Liter Bottle", price: 1.60 }
    ],
    image: ""
  },
  {
    id: "prod-4",
    name: "A4 Spiral Notebook",
    category: "Stationery",
    description: "Ruled paper notebook, spiral wire binding",
    variants: [
      { size: "100 Pages", price: 1.25 },
      { size: "200 Pages", price: 2.25 }
    ],
    image: ""
  }
];

class ShopSnapApp {
  constructor() {
    this.inventory = [];
    this.history = [];
    this.apiKey = "";
    this.demoMode = true;
    this.soundEnabled = true;
    
    this.currentView = "dashboard";
    this.cameraFacing = "environment"; // default to back camera
    this.activeStream = null;
    this.scannedTodayCount = 0;
    
    this.currentScanResult = null; // Hold current identified item
    this.webrtcActive = true;
  }

  init() {
    this.loadSettings();
    this.loadInventory();
    this.loadHistory();
    this.setupViewNavigation();
    
    this.updateDashboardStats();
    this.renderInventory();
    this.renderHistoryList();
    
    // Check if API key is set
    this.updateApiStatusUI();
  }

  // --- SETTINGS & LOCAL STORAGE ---
  loadSettings() {
    this.apiKey = localStorage.getItem("ss_api_key") || "";
    this.demoMode = localStorage.getItem("ss_demo_mode") !== "false";
    this.soundEnabled = localStorage.getItem("ss_sound_enabled") !== "false";
    this.scannedTodayCount = parseInt(localStorage.getItem("ss_scans_today") || "0");
    
    // Set settings UI values
    document.getElementById("settings-api-key").value = this.apiKey;
    document.getElementById("settings-demo-mode").checked = this.demoMode;
    document.getElementById("settings-sound-effects").checked = this.soundEnabled;
  }

  loadInventory() {
    const saved = localStorage.getItem("ss_inventory");
    if (saved) {
      this.inventory = JSON.parse(saved);
    } else {
      this.inventory = [...DEFAULT_INVENTORY];
      this.saveInventory();
    }
  }

  saveInventory() {
    localStorage.setItem("ss_inventory", JSON.stringify(this.inventory));
    this.updateDashboardStats();
  }

  loadHistory() {
    const saved = localStorage.getItem("ss_history");
    if (saved) {
      this.history = JSON.parse(saved);
    } else {
      this.history = [];
    }
  }

  saveHistory() {
    localStorage.setItem("ss_history", JSON.stringify(this.history));
  }

  updateDashboardStats() {
    document.getElementById("stats-scans-count").textContent = this.scannedTodayCount;
    document.getElementById("stats-products-count").textContent = this.inventory.length;
  }

  updateApiStatusUI() {
    const badge = document.getElementById("api-status-badge");
    const text = document.getElementById("api-status-text");
    
    if (this.apiKey) {
      badge.className = "header-status";
      text.textContent = "AI Active";
      this.demoMode = false;
      localStorage.setItem("ss_demo_mode", "false");
      document.getElementById("settings-demo-mode").checked = false;
    } else {
      badge.className = "header-status demo";
      text.textContent = "Demo Mode";
      this.demoMode = true;
      localStorage.setItem("ss_demo_mode", "true");
      document.getElementById("settings-demo-mode").checked = true;
    }
    
    // Update scanner view badge
    const scannerBadge = document.getElementById("scanner-badge");
    if (scannerBadge) {
      scannerBadge.textContent = this.demoMode ? "Demo Scanner" : "Gemini AI Scanner";
    }
  }

  saveApiKey() {
    const val = document.getElementById("settings-api-key").value.trim();
    if (val) {
      this.apiKey = val;
      localStorage.setItem("ss_api_key", val);
      alert("Gemini API Key saved successfully!");
      this.updateApiStatusUI();
    } else {
      alert("Please enter a valid API Key.");
    }
  }

  clearApiKey() {
    this.apiKey = "";
    localStorage.removeItem("ss_api_key");
    document.getElementById("settings-api-key").value = "";
    alert("API Key cleared.");
    this.updateApiStatusUI();
  }

  toggleDemoMode(checked) {
    if (!checked && !this.apiKey) {
      alert("You need to save a Gemini API Key to turn off Demo Mode!");
      document.getElementById("settings-demo-mode").checked = true;
      return;
    }
    this.demoMode = checked;
    localStorage.setItem("ss_demo_mode", checked);
    this.updateApiStatusUI();
  }

  toggleSound(checked) {
    this.soundEnabled = checked;
    localStorage.setItem("ss_sound_enabled", checked);
  }

  resetFactoryData() {
    if (confirm("Are you absolutely sure you want to delete all custom products and scan logs? This cannot be undone.")) {
      localStorage.removeItem("ss_inventory");
      localStorage.removeItem("ss_history");
      localStorage.removeItem("ss_scans_today");
      this.scannedTodayCount = 0;
      this.loadInventory();
      this.loadHistory();
      this.updateDashboardStats();
      this.renderInventory();
      this.renderHistoryList();
      alert("App data reset to defaults!");
    }
  }

  // --- VIEW ROUTING ---
  switchView(viewId) {
    // Deactivate current active nav-tab
    const oldTab = document.querySelector(`.nav-tab.active`);
    if (oldTab) oldTab.classList.remove("active");
    
    // Activate nav-tab associated with viewId
    const newTab = document.getElementById(`nav-tab-${viewId}`);
    if (newTab) newTab.classList.add("active");
    
    // Stop camera if leaving scanner
    if (this.currentView === "scanner" && viewId !== "scanner") {
      this.stopCamera();
      this.resetScanner();
    }
    
    // Hide old view and show new view
    const oldView = document.querySelector(`.view.active`);
    if (oldView) oldView.classList.remove("active");
    
    const newView = document.getElementById(`view-${viewId}`);
    if (newView) {
      newView.classList.add("active");
      this.currentView = viewId;
    }
    
    // Start camera if entering scanner
    if (viewId === "scanner") {
      this.startCamera();
    }
  }

  setupViewNavigation() {
    // Add view parameter hooks if needed
  }

  // --- WEBAUDIO SOUND CHIME ---
  playBeep() {
    if (!this.soundEnabled) return;
    
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Chime notes: G5 (784Hz) -> C6 (1046.5Hz)
      const playNote = (frequency, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, startTime);
        
        gainNode.gain.setValueAtTime(0.001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.15, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = audioCtx.currentTime;
      playNote(784, now, 0.15);       // First note
      playNote(1046.5, now + 0.08, 0.25); // Second note
    } catch (e) {
      console.warn("Web Audio API is not supported or blocked: ", e);
    }
  }

  // --- CAMERA UTILITIES ---
  async startCamera() {
    const video = document.getElementById("camera-stream");
    const viewfinder = document.getElementById("scanner-viewfinder");
    const fallbackScreen = document.getElementById("camera-fallback-screen");
    const authScreen = document.getElementById("camera-auth-screen");
    const switchBtn = document.getElementById("camera-switch-btn");
    
    // Hide screens initially
    if (fallbackScreen) fallbackScreen.style.display = "none";
    if (authScreen) authScreen.style.display = "none";
    if (video) video.style.display = "block";
    if (viewfinder) {
      viewfinder.className = "viewfinder active";
      viewfinder.style.display = "block";
    }
    if (switchBtn) {
      switchBtn.style.opacity = "1";
      switchBtn.style.pointerEvents = "auto";
    }
    
    if (this.activeStream) {
      this.stopCamera();
    }
    
    // Check support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("Camera stream not supported in this browser context.");
      this.activateCameraFallback();
      return;
    }

    // Check if we have permission or need to prompt
    let permissionState = "prompt";
    
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: "camera" });
        permissionState = result.state; // 'granted', 'prompt', 'denied'
        
        // Listen for change
        result.onchange = () => {
          if (this.currentView === "scanner") {
            this.startCamera();
          }
        };
      } else {
        // Fallback for Safari (does not support permission query for camera)
        const previouslyGranted = localStorage.getItem("ss_camera_granted") === "true";
        permissionState = previouslyGranted ? "granted" : "prompt";
      }
    } catch (e) {
      // If permissions query throws error (e.g. Firefox doesn't support 'camera' in query)
      const previouslyGranted = localStorage.getItem("ss_camera_granted") === "true";
      permissionState = previouslyGranted ? "granted" : "prompt";
    }

    if (permissionState === "granted") {
      // Attempt to start stream directly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: this.cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        this.activeStream = stream;
        video.srcObject = stream;
        this.webrtcActive = true;
        localStorage.setItem("ss_camera_granted", "true");
      } catch (err) {
        console.error("Failed to start camera even though permission was granted: ", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          localStorage.setItem("ss_camera_granted", "false");
          this.showCameraAuthScreen();
        } else {
          this.activateCameraFallback();
        }
      }
    } else if (permissionState === "denied") {
      this.activateCameraFallback();
    } else {
      // "prompt"
      this.showCameraAuthScreen();
    }
  }

  showCameraAuthScreen() {
    this.webrtcActive = true; // Still trying WebRTC
    const video = document.getElementById("camera-stream");
    const viewfinder = document.getElementById("scanner-viewfinder");
    const authScreen = document.getElementById("camera-auth-screen");
    const fallbackScreen = document.getElementById("camera-fallback-screen");
    const switchBtn = document.getElementById("camera-switch-btn");
    
    if (video) video.style.display = "none";
    if (viewfinder) viewfinder.style.display = "none";
    if (fallbackScreen) fallbackScreen.style.display = "none";
    if (authScreen) authScreen.style.display = "flex";
    if (switchBtn) {
      switchBtn.style.opacity = "0.3";
      switchBtn.style.pointerEvents = "none";
    }
  }

  async requestCameraPermission() {
    const video = document.getElementById("camera-stream");
    const authScreen = document.getElementById("camera-auth-screen");
    
    try {
      this.showLoading("Accessing camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      this.hideLoading();
      this.activeStream = stream;
      if (video) {
        video.srcObject = stream;
        video.style.display = "block";
      }
      
      this.webrtcActive = true;
      localStorage.setItem("ss_camera_granted", "true");
      
      // Reset view to active scanner
      if (authScreen) authScreen.style.display = "none";
      const viewfinder = document.getElementById("scanner-viewfinder");
      if (viewfinder) {
        viewfinder.className = "viewfinder active";
        viewfinder.style.display = "block";
      }
      const switchBtn = document.getElementById("camera-switch-btn");
      if (switchBtn) {
        switchBtn.style.opacity = "1";
        switchBtn.style.pointerEvents = "auto";
      }
    } catch (err) {
      this.hideLoading();
      console.error("Camera permission denied or failed: ", err);
      localStorage.setItem("ss_camera_granted", "false");
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        alert("Camera permission denied. Switching to Native Camera Photo Mode.");
      } else {
        alert("Failed to initialize live camera feed: " + err.message);
      }
      
      this.activateCameraFallback();
    }
  }

  activateCameraFallback() {
    this.webrtcActive = false;
    const video = document.getElementById("camera-stream");
    const viewfinder = document.getElementById("scanner-viewfinder");
    const fallbackScreen = document.getElementById("camera-fallback-screen");
    const authScreen = document.getElementById("camera-auth-screen");
    const switchBtn = document.getElementById("camera-switch-btn");
    
    if (video) video.style.display = "none";
    if (viewfinder) viewfinder.style.display = "none";
    if (authScreen) authScreen.style.display = "none";
    if (fallbackScreen) fallbackScreen.style.display = "flex";
    if (switchBtn) {
      switchBtn.style.opacity = "0.3";
      switchBtn.style.pointerEvents = "none";
    }
  }

  stopCamera() {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach(track => track.stop());
      this.activeStream = null;
    }
    const video = document.getElementById("camera-stream");
    if (video) video.srcObject = null;
  }

  toggleCameraFacing() {
    this.cameraFacing = this.cameraFacing === "environment" ? "user" : "environment";
    this.startCamera();
  }

  // --- VISUAL PRICING LOGIC ---
  showLoading(text) {
    const loading = document.getElementById("scanner-loading");
    document.getElementById("scanner-loading-text").textContent = text;
    loading.classList.add("active");
  }

  hideLoading() {
    document.getElementById("scanner-loading").classList.remove("active");
  }

  // Capture frame from video feed
  captureFrame() {
    const video = document.getElementById("camera-stream");
    if (!video.srcObject) {
      return null;
    }
    
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Compress image to 350px max width for AI scanning speed & LocalStorage resizing
    return canvas.toDataURL("image/jpeg", 0.75);
  }

  // Compress any base64 image helper
  resizeBase64(base64Str, maxWidth, maxHeight, callback) {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL("image/jpeg", 0.65));
    };
  }

  // Process capture or upload
  async handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.showLoading("Loading uploaded image...");
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawBase64 = event.target.result;
      this.resizeBase64(rawBase64, 500, 500, async (resizedBase64) => {
        this.hideLoading();
        this.runAnalysis(resizedBase64);
      });
    };
    reader.readAsDataURL(file);
    
    // Clear input
    e.target.value = "";
  }

  async captureAndAnalyze() {
    if (!this.webrtcActive) {
      // In fallback mode, tapping the snap button triggers native camera upload
      document.getElementById('image-upload-input').click();
      return;
    }
    
    const frame = this.captureFrame();
    if (!frame) {
      alert("Camera feed is active but couldn't snap picture. Try importing an image file instead.");
      return;
    }
    
    // Perform analysis
    this.runAnalysis(frame);
  }

  async runAnalysis(base64Image) {
    this.showLoading("Identifying product...");
    
    try {
      let result;
      if (this.demoMode) {
        result = await this.simulateAIPricingMatch();
      } else {
        result = await this.callGeminiAIPricing(base64Image);
      }
      
      if (result && result.matched) {
        this.displayScanResult(result);
      } else {
        this.hideLoading();
        // Prompt to create a new product if match fails
        if (confirm(`Product not recognized.\n\nDescription: ${result?.reason || "Unknown item"}\n\nWould you like to add it as a new product in your inventory?`)) {
          this.openAddProductModal(result?.detectedName || "Unknown Product", resizedBase64Image => {
            // Keep image callback
          }, base64Image);
        }
      }
    } catch (err) {
      console.error(err);
      this.hideLoading();
      alert("Error recognizing product: " + err.message);
    }
  }

  // Real API Call to Gemini
  async callGeminiAIPricing(base64DataUrl) {
    const base64Clean = base64DataUrl.split(",")[1];
    
    // Generate context of all inventory items
    const inventoryContext = this.inventory.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      sizes: item.variants.map(v => v.size)
    }));

    const prompt = `You are a shop assistant running on a mobile scanner app. 
Here is a list of products in the shop's inventory (represented in JSON format):
${JSON.stringify(inventoryContext, null, 2)}

Look at the uploaded photo of a product taken in the shop.
Analyze the image (look at packaging, text labels, color scheme, sizes) and identify if it matches any product in our inventory.
If there is a match:
1. Return which product (by its id) was matched.
2. Determine which size/variant is shown in the image based on the packaging labels or size ratios.
3. Provide a short reason for the match.

If it does NOT match any item in the inventory, set "matched" to false, and estimate a name and category for the item, explaining what it looks like.

You MUST reply with ONLY a raw JSON object matching this schema (do NOT wrap in markdown \`\`\`json blocks):
{
  "matched": true,
  "productId": "matched-product-id",
  "matchedSize": "the exact size variant name matched from the inventory sizes, or null",
  "confidence": 0.95,
  "reason": "Briefly state visual reasons for match",
  "detectedName": "Estimated product name if not matched",
  "detectedCategory": "Estimated product category if not matched"
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Clean
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    try {
      const responseText = data.candidates[0].content.parts[0].text;
      return JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse Gemini output: ", data, e);
      throw new Error("Invalid output structure received from Gemini AI.");
    }
  }

  // Simulated AI for Demo Mode
  simulateAIPricingMatch() {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.inventory.length === 0) {
          resolve({
            matched: false,
            reason: "Inventory is completely empty. Add some products in the Inventory tab first!"
          });
          return;
        }

        // Randomly pick a product from inventory
        const product = this.inventory[Math.floor(Math.random() * this.inventory.length)];
        
        // Pick random variant size
        const variant = product.variants[Math.floor(Math.random() * product.variants.length)];
        
        resolve({
          matched: true,
          productId: product.id,
          matchedSize: variant.size,
          confidence: Math.round((0.85 + Math.random() * 0.14) * 100) / 100, // 85% to 99%
          reason: `Demo matched product '${product.name}' based on shape and label highlights.`
        });
      }, 1500); // 1.5 seconds delay for realistic scanning feel
    });
  }

  displayScanResult(result) {
    this.hideLoading();
    
    const product = this.inventory.find(p => p.id === result.productId);
    if (!product) {
      alert("Matched product not found in database.");
      return;
    }
    
    // Play chime sound
    this.playBeep();
    
    this.currentScanResult = {
      product: product,
      matchedSize: result.matchedSize
    };
    
    // Populate Results drawer UI
    document.getElementById("result-prod-name").textContent = product.name;
    document.getElementById("result-prod-category").textContent = product.category || "General";
    document.getElementById("result-prod-desc").textContent = product.description || "No description provided.";
    
    const confidencePct = Math.round(result.confidence * 100);
    const confBadge = document.getElementById("result-prod-confidence");
    confBadge.textContent = `${confidencePct}% Match`;
    if (confidencePct > 75) {
      confBadge.className = "result-confidence";
    } else {
      confBadge.className = "result-confidence low";
    }
    
    // Render variants list
    const variantsContainer = document.getElementById("result-variants-list");
    variantsContainer.innerHTML = "";
    
    product.variants.forEach(variant => {
      const isMatched = variant.size === result.matchedSize;
      const row = document.createElement("div");
      row.className = `variant-price-row ${isMatched ? 'matched-variant' : ''}`;
      
      row.innerHTML = `
        <div class="variant-size-name">
          ${variant.size} ${isMatched ? '⚙️' : ''}
        </div>
        <div class="variant-size-price">₹${variant.price.toFixed(2)}</div>
      `;
      
      variantsContainer.appendChild(row);
    });
    
    // Slide open drawer
    document.getElementById("scanner-result-drawer").classList.add("active");
    
    // De-focus viewfinder
    document.getElementById("scanner-viewfinder").className = "viewfinder";
  }

  confirmScanResult() {
    if (this.currentScanResult) {
      // Add scan history
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const matchedVariant = this.currentScanResult.product.variants.find(
        v => v.size === this.currentScanResult.matchedSize
      ) || this.currentScanResult.product.variants[0];
      
      const historyItem = {
        name: this.currentScanResult.product.name,
        size: matchedVariant.size,
        price: matchedVariant.price,
        time: timeStr,
        timestamp: now.getTime()
      };
      
      this.history.unshift(historyItem);
      if (this.history.length > 20) {
        this.history.pop(); // Keep last 20
      }
      
      this.saveHistory();
      this.renderHistoryList();
      
      // Update stats counts
      this.scannedTodayCount++;
      localStorage.setItem("ss_scans_today", this.scannedTodayCount);
      this.updateDashboardStats();
    }
    
    this.resetScanner();
    this.switchView("dashboard");
  }

  resetScanner() {
    // Hide drawer
    document.getElementById("scanner-result-drawer").classList.remove("active");
    // Re-focus viewfinder
    document.getElementById("scanner-viewfinder").className = "viewfinder active";
    this.currentScanResult = null;
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
    this.renderHistoryList();
  }

  renderHistoryList() {
    const list = document.getElementById("dashboard-history-list");
    if (!list) return;

    list.innerHTML = "";
    
    if (this.history.length === 0) {
      list.innerHTML = `<div class="empty-state">No recent scans. Snapped items will appear here!</div>`;
      return;
    }
    
    this.history.forEach(item => {
      const el = document.createElement("div");
      el.className = "history-item";
      el.innerHTML = `
        <div class="history-item-info">
          <div class="history-item-name">${item.name} (${item.size})</div>
          <div class="history-item-time">${item.time}</div>
        </div>
        <div class="history-item-price">₹${item.price.toFixed(2)}</div>
      `;
      list.appendChild(el);
    });
  }

  // --- INVENTORY MANAGEMENT ---
  renderInventory() {
    const list = document.getElementById("inventory-products-list");
    if (!list) return;

    list.innerHTML = "";
    
    const searchVal = document.getElementById("inventory-search").value.toLowerCase();
    
    const filtered = this.inventory.filter(prod => 
      prod.name.toLowerCase().includes(searchVal) || 
      (prod.category && prod.category.toLowerCase().includes(searchVal))
    );
    
    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-state">No items found matching "${searchVal}"</div>`;
      return;
    }
    
    filtered.forEach(product => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.onclick = () => this.openEditProductModal(product.id);
      
      // Determine price range
      const prices = product.variants.map(v => v.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceStr = minPrice === maxPrice 
        ? `₹${minPrice.toFixed(2)}` 
        : `₹${minPrice.toFixed(2)} - ₹${maxPrice.toFixed(2)}`;
      
      let imageContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      `;
      
      if (product.image) {
        imageContent = `<img src="${product.image}" alt="${product.name}">`;
      }
      
      // Build variants tag row
      const tagsHtml = product.variants.map(v => 
        `<span class="variant-tag">${v.size}: ₹${v.price.toFixed(2)}</span>`
      ).join("");
      
      card.innerHTML = `
        <div class="product-card-top">
          <div class="product-image-placeholder">
            ${imageContent}
          </div>
          <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-meta-row">
              <span class="product-cat">${product.category || "General"}</span>
              <span class="product-price-range">${priceStr}</span>
            </div>
          </div>
        </div>
        <div class="product-card-variants">
          ${tagsHtml}
        </div>
      `;
      
      list.appendChild(card);
    });
  }

  // CSV Export
  exportToCSV() {
    if (this.inventory.length === 0) {
      alert("Inventory is empty. Nothing to export.");
      return;
    }
    
    // Header
    let csvContent = "Product Name,Category,Description,Size/Variant,Price\n";
    
    // Rows
    this.inventory.forEach(product => {
      product.variants.forEach(variant => {
        const nameEsc = `"${product.name.replace(/"/g, '""')}"`;
        const catEsc = `"${(product.category || "").replace(/"/g, '""')}"`;
        const descEsc = `"${(product.description || "").replace(/"/g, '""')}"`;
        const sizeEsc = `"${variant.size.replace(/"/g, '""')}"`;
        const price = variant.price;
        
        csvContent += `${nameEsc},${catEsc},${descEsc},${sizeEsc},${price}\n`;
      });
    });
    
    // Download trigger
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "shopsnap_inventory.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // CSV Import
  importFromCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this.parseCSVAndMerge(text);
    };
    reader.readAsText(file);
    
    // Clear input
    event.target.value = "";
  }

  parseCSVAndMerge(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length <= 1) {
      alert("Invalid CSV file structure.");
      return;
    }
    
    // Simple CSV parser that handles quotes
    const parseCSVRow = (text) => {
      let p = '', row = [''], q = false;
      for (let i = 0; i < text.length; i++) {
        let c = text[i];
        if (c === '"') {
          if (q && text[i+1] === '"') { row[row.length-1] += '"'; i++; } // Escaped quote
          else { q = !q; }
        } else if (c === ',' && !q) {
          row.push('');
        } else {
          row[row.length-1] += c;
        }
      }
      return row;
    };
    
    const importedProductsMap = new Map();
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = parseCSVRow(line);
      if (columns.length < 5) continue;
      
      const name = columns[0].trim();
      const category = columns[1].trim();
      const description = columns[2].trim();
      const size = columns[3].trim();
      const price = parseFloat(columns[4].trim()) || 0;
      
      if (!name || !size) continue;
      
      const key = `${name.toLowerCase()}||${category.toLowerCase()}`;
      
      if (!importedProductsMap.has(key)) {
        importedProductsMap.set(key, {
          name: name,
          category: category,
          description: description,
          variants: []
        });
      }
      
      importedProductsMap.get(key).variants.push({
        size: size,
        price: price
      });
    }
    
    if (importedProductsMap.size === 0) {
      alert("No valid product data found in CSV.");
      return;
    }
    
    if (confirm(`Do you want to clear your current inventory before importing, or merge the CSV products into your existing list?\n\nChoose 'OK' to REPLACE current list.\nChoose 'Cancel' to MERGE/ADD to current list.`)) {
      this.inventory = [];
    }
    
    // Re-map IDs and save
    let addedCount = 0;
    importedProductsMap.forEach((val) => {
      // Look for existing item if merging
      const existing = this.inventory.find(p => p.name.toLowerCase() === val.name.toLowerCase());
      if (existing) {
        // Merge variants
        val.variants.forEach(newVar => {
          const varExistIndex = existing.variants.findIndex(v => v.size.toLowerCase() === newVar.size.toLowerCase());
          if (varExistIndex >= 0) {
            existing.variants[varExistIndex].price = newVar.price; // Update price
          } else {
            existing.variants.push(newVar); // Add variant
          }
        });
      } else {
        const id = "prod-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
        this.inventory.push({
          id: id,
          name: val.name,
          category: val.category,
          description: val.description,
          variants: val.variants,
          image: ""
        });
        addedCount++;
      }
    });
    
    this.saveInventory();
    this.renderInventory();
    alert(`Successfully loaded CSV! Processed ${importedProductsMap.size} products.`);
  }

  // --- PRODUCT DIALOG FORM ---
  openAddProductModal(prefilledName = "", callbackOnSave = null, imageBase64 = "") {
    document.getElementById("product-modal-title").textContent = "Add New Product";
    document.getElementById("form-product-id").value = "";
    document.getElementById("form-product-name").value = prefilledName;
    document.getElementById("form-product-category").value = "";
    document.getElementById("form-product-desc").value = "";
    
    // Clear preview image
    const preview = document.getElementById("form-product-image-preview");
    const widgetText = document.getElementById("image-widget-text");
    document.getElementById("form-product-image-base64").value = imageBase64;
    
    if (imageBase64) {
      preview.src = imageBase64;
      preview.style.display = "block";
      widgetText.style.display = "none";
    } else {
      preview.style.display = "none";
      widgetText.style.display = "block";
    }

    // Default size row
    const builder = document.getElementById("form-variants-builder");
    builder.innerHTML = "";
    this.addVariantRow("Single Size", 1.00);

    const modal = document.getElementById("modal-product");
    modal.classList.add("active");
  }

  openEditProductModal(productId) {
    const product = this.inventory.find(p => p.id === productId);
    if (!product) return;

    document.getElementById("product-modal-title").textContent = "Edit Product Details";
    document.getElementById("form-product-id").value = product.id;
    document.getElementById("form-product-name").value = product.name;
    document.getElementById("form-product-category").value = product.category || "";
    document.getElementById("form-product-desc").value = product.description || "";
    
    // Preview Image
    const preview = document.getElementById("form-product-image-preview");
    const widgetText = document.getElementById("image-widget-text");
    document.getElementById("form-product-image-base64").value = product.image || "";
    
    if (product.image) {
      preview.src = product.image;
      preview.style.display = "block";
      widgetText.style.display = "none";
    } else {
      preview.style.display = "none";
      widgetText.style.display = "block";
    }

    // Build variant rows
    const builder = document.getElementById("form-variants-builder");
    builder.innerHTML = "";
    product.variants.forEach(v => {
      this.addVariantRow(v.size, v.price);
    });

    // Add a delete button to modal actions if editing
    const form = document.getElementById("product-form");
    let deleteBtn = document.getElementById("form-delete-btn");
    if (!deleteBtn) {
      deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.id = "form-delete-btn";
      deleteBtn.className = "btn btn-rose";
      deleteBtn.textContent = "Delete Item";
      deleteBtn.style.width = "auto";
      deleteBtn.style.marginRight = "auto";
      deleteBtn.onclick = () => this.deleteProduct(product.id);
      
      const btnRow = form.querySelector("div[style*='display: flex']");
      btnRow.insertBefore(deleteBtn, btnRow.firstChild);
    } else {
      deleteBtn.style.display = "block";
    }

    const modal = document.getElementById("modal-product");
    modal.classList.add("active");
  }

  closeProductModal(event, force = false) {
    if (force || event.target === document.getElementById("modal-product")) {
      document.getElementById("modal-product").classList.remove("active");
      
      // Hide delete button if it exists
      const deleteBtn = document.getElementById("form-delete-btn");
      if (deleteBtn) deleteBtn.style.display = "none";
    }
  }

  addVariantRow(size = "", price = "") {
    const builder = document.getElementById("form-variants-builder");
    const rowId = "row-" + Date.now() + "-" + Math.floor(Math.random() * 100);
    
    const row = document.createElement("div");
    row.className = "builder-row";
    row.id = rowId;
    
    row.innerHTML = `
      <input type="text" class="form-control size-input" placeholder="e.g. 500ml or Small" value="${size}" required>
      <input type="number" step="0.01" class="form-control price-input" placeholder="Price" value="${price}" required>
      <button type="button" class="remove-row-btn" onclick="document.getElementById('${rowId}').remove()">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    
    builder.appendChild(row);
  }

  handleProductImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawBase64 = event.target.result;
      
      // Resize to very small size (120x120) for localStorage thumbnail saving
      this.resizeBase64(rawBase64, 120, 120, (resizedBase64) => {
        const preview = document.getElementById("form-product-image-preview");
        const widgetText = document.getElementById("image-widget-text");
        
        document.getElementById("form-product-image-base64").value = resizedBase64;
        preview.src = resizedBase64;
        preview.style.display = "block";
        widgetText.style.display = "none";
      });
    };
    reader.readAsDataURL(file);
  }

  saveProductForm(e) {
    e.preventDefault();
    
    const id = document.getElementById("form-product-id").value;
    const name = document.getElementById("form-product-name").value.trim();
    const category = document.getElementById("form-product-category").value.trim();
    const description = document.getElementById("form-product-desc").value.trim();
    const image = document.getElementById("form-product-image-base64").value;
    
    // Parse variants builder
    const builder = document.getElementById("form-variants-builder");
    const rows = builder.querySelectorAll(".builder-row");
    const variants = [];
    
    rows.forEach(row => {
      const sizeInput = row.querySelector(".size-input").value.trim();
      const priceInput = parseFloat(row.querySelector(".price-input").value) || 0;
      
      if (sizeInput) {
        variants.push({
          size: sizeInput,
          price: priceInput
        });
      }
    });

    if (variants.length === 0) {
      alert("Please specify at least one size variant & price!");
      return;
    }

    if (id) {
      // Edit mode
      const index = this.inventory.findIndex(p => p.id === id);
      if (index >= 0) {
        this.inventory[index] = {
          ...this.inventory[index],
          name,
          category,
          description,
          image,
          variants
        };
      }
    } else {
      // Add mode
      const newId = "prod-" + Date.now();
      this.inventory.push({
        id: newId,
        name,
        category,
        description,
        image,
        variants
      });
    }

    this.saveInventory();
    this.renderInventory();
    
    document.getElementById("modal-product").classList.remove("active");
    
    // Reset scanner drawer if visible to reflect updates
    if (this.currentScanResult && this.currentScanResult.product.id === id) {
      this.resetScanner();
    }
    
    alert("Product saved successfully!");
  }

  deleteProduct(productId) {
    if (confirm("Are you sure you want to delete this product from your shop inventory?")) {
      this.inventory = this.inventory.filter(p => p.id !== productId);
      this.saveInventory();
      this.renderInventory();
      document.getElementById("modal-product").classList.remove("active");
      
      // Hide delete btn
      const deleteBtn = document.getElementById("form-delete-btn");
      if (deleteBtn) deleteBtn.style.display = "none";
      
      alert("Product deleted.");
    }
  }
}

// Instantiate and initiate the app
const app = new ShopSnapApp();
window.addEventListener("DOMContentLoaded", () => {
  app.init();
});
