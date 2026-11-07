# FloodChat

A lightweight Chromium browser extension for fast, automated batch message delivery across Telegram Web and WhatsApp Web.

---

## Project Structure

```text
floodchat/
├── manifest.json         # Extension manifest
├── mensagem.txt          # Sample file with line-by-line messages
├── _locales/             # Localization files
├── icons/                # Extension icons
├── popup/
│   ├── popup.html        # Control panel interface
│   ├── popup.css         # Theme and styling
│   └── popup.js          # Interface logic and event handling
├── scripts/
│   └── content.js        # Injection script for the active tab
└── README.md
```

---

## Installation

1. Open your Chromium-based browser (Google Chrome, Brave, Microsoft Edge, or Opera).
2. Navigate to the extensions management page:
   - **Chrome / Brave:** `chrome://extensions/`
   - **Edge:** `edge://extensions/`
   - **Opera:** `opera://extensions/`
3. Enable **Developer mode** in the upper-right corner.
4. Click **Load unpacked**.
5. Select the project directory (`floodchat`).
6. The extension is installed and ready to use.

---

## How to Use

1. Open [Telegram Web](https://web.telegram.org/a/) or [WhatsApp Web](https://web.whatsapp.com/) and navigate to the target chat or group.
2. Click the FloodChat icon in your browser toolbar.
3. Load your messages:
   - Click **Import .txt** or drag and drop a `.txt` file directly into the editor area;
   - Or type/paste your messages manually (each line represents a single message).
4. Configure dispatch options:
   - **Interval:** Delay between messages in milliseconds;
   - **Continuous mode:** Enable this toggle to repeat the list continuously in a loop until manually stopped.
5. Click **Send** to start.
6. Monitor progress in the status bar. You can click **Stop** at any time to halt delivery.

---

## Key Features

- **Cross-Platform Compatibility:** Supports Telegram Web (Web A and Web K) and WhatsApp Web.
- **Adaptive Visual Identity:** The interface automatically adopts the accent color of the active chat platform (Blue for Telegram and Green for WhatsApp).
- **Background Persistence:** Delivery continues running seamlessly even if the extension popup is closed during transmission.
- **Automatic Line Filtering:** Empty lines and whitespace-only entries are automatically skipped and never dispatched.
- **Rate Limit Protection:** Automatically pauses delivery if a rate limit or Flood Wait notification is detected on the page.
- **Automatic Multi-Language Support:** Detects and applies the system language (English, Portuguese, Spanish, and Russian), defaulting to English.
