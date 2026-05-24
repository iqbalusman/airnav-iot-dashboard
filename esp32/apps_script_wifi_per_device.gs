const SHEET_ID = "1-fANkDb9WtmTugbAreelZlvS21FnuctLDyn9CJBPZv8";
const WIFI_SHEET = "WifiESP32";
const TIMEZONE = "Asia/Makassar";

const WIFI_HEADERS = [
  "DEVICE",
  "SSID",
  "PASSWORD",
  "UPDATED_AT"
];

const DEFAULT_DEVICES = ["ESP32-1", "ESP32-2", "ESP32-3"];

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    setupSheet();

    const data = parseRequest(e);
    const action = String(data.action || "getdevicewifi").toLowerCase();

    switch (action) {
      case "setup":
        setupSheet();
        return jsonResponse({
          success: true,
          message: "Sheet WiFi ESP32 berhasil disiapkan."
        });

      case "updatedevicewifi":
      case "updatewifi":
        return updateDeviceWifi(
          data.device,
          data.wifiSsid || data.ssid || data.username,
          data.wifiPassword || data.password
        );

      case "getdevicewifi":
      case "getwifi":
        return getDeviceWifi(data.device);

      default:
        return jsonResponse({
          success: false,
          message: "Action " + String(data.action || "").toUpperCase() + " tidak dikenali.",
          received: data
        });
    }
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message || error.toString()
    });
  }
}

function parseRequest(e) {
  const result = {};

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(key => {
      result[key] = e.parameter[key];
    });
  }

  if (e && e.postData && e.postData.contents) {
    const content = e.postData.contents;

    try {
      const json = JSON.parse(content);
      Object.keys(json).forEach(key => {
        result[key] = json[key];
      });
    } catch (err) {
      content.split("&").forEach(pair => {
        const parts = pair.split("=");
        const key = decodeURIComponent(parts[0] || "");
        const value = decodeURIComponent(parts[1] || "");
        if (key) result[key] = value;
      });
    }
  }

  return result;
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getWifiSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(WIFI_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(WIFI_SHEET);
  }

  return sheet;
}

function setupSheet() {
  const sheet = getWifiSheet();

  sheet.getRange(1, 1, 1, WIFI_HEADERS.length).setValues([WIFI_HEADERS]);
  sheet.getRange("A:D").setNumberFormat("@");

  const now = nowText();

  DEFAULT_DEVICES.forEach(device => {
    const rowIndex = findDeviceRow(sheet, device);

    if (rowIndex === -1) {
      sheet.appendRow([device, "", "", now]);
    }
  });
}

function updateDeviceWifi(device, ssid, password) {
  const targetDevice = normalizeDevice(device);
  const wifiSsid = String(ssid || "").trim();
  const wifiPassword = String(password || "").trim();

  if (!targetDevice) {
    return jsonResponse({
      success: false,
      message: "Device ESP32 wajib diisi, contoh ESP32-1, ESP32-2, atau ESP32-3."
    });
  }

  if (!wifiSsid || !wifiPassword) {
    return jsonResponse({
      success: false,
      message: "SSID/username WiFi dan password WiFi wajib diisi."
    });
  }

  const sheet = getWifiSheet();
  setupSheet();

  const now = nowText();
  const rowIndex = findDeviceRow(sheet, targetDevice);
  const rowData = [targetDevice, wifiSsid, wifiPassword, now];

  sheet.getRange("A:D").setNumberFormat("@");

  if (rowIndex === -1) {
    sheet.appendRow(rowData);
  } else {
    sheet.getRange(rowIndex, 1, 1, WIFI_HEADERS.length).setValues([rowData]);
  }

  return jsonResponse({
    success: true,
    message: "WiFi " + targetDevice + " berhasil disimpan.",
    device: targetDevice,
    ssid: wifiSsid,
    password: wifiPassword,
    updatedAt: now
  });
}

function getDeviceWifi(device) {
  const targetDevice = normalizeDevice(device) || "ESP32-1";
  const sheet = getWifiSheet();
  setupSheet();

  const rowIndex = findDeviceRow(sheet, targetDevice);

  if (rowIndex === -1) {
    return jsonResponse({
      success: false,
      device: targetDevice,
      message: "Konfigurasi WiFi untuk " + targetDevice + " belum tersedia."
    });
  }

  sheet.getRange("A:D").setNumberFormat("@");

  const selected = sheet
    .getRange(rowIndex, 1, 1, WIFI_HEADERS.length)
    .getDisplayValues()[0];

  return jsonResponse({
    success: true,
    device: String(selected[0] || ""),
    ssid: String(selected[1] || ""),
    password: String(selected[2] || ""),
    updatedAt: String(selected[3] || "")
  });
}

function findDeviceRow(sheet, device) {
  const targetDevice = normalizeDevice(device);
  const lastRow = sheet.getLastRow();

  if (!targetDevice || lastRow <= 1) {
    return -1;
  }

  const values = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getDisplayValues();

  for (let i = 0; i < values.length; i++) {
    const rowDevice = normalizeDevice(values[i][0]);

    if (rowDevice === targetDevice) {
      return i + 2;
    }
  }

  return -1;
}

function normalizeDevice(device) {
  return String(device || "").trim().toUpperCase();
}

function nowText() {
  return Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy HH:mm:ss");
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
