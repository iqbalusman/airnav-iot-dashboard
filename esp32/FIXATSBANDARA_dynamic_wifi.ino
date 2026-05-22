#include <Arduino.h>
#include <PZEM004Tv30.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>

// ===================== WIFI DINAMIS =====================
// WiFi default dipakai pertama kali upload, atau fallback kalau WiFi baru gagal.
const char* DEFAULT_SSID = "FAZ NET";
const char* DEFAULT_PASSWORD = "Gantengkalem1";

// Ganti sesuai alat:
// ESP32-1, ESP32-2, atau ESP32-3
const char* DEVICE_NAME = "ESP32-1";

// Isi dengan URL Apps Script yang sama dengan API WiFi ESP32 di website.
const char* WIFI_CONFIG_API = "https://script.google.com/macros/s/URL_APPS_SCRIPT_WIFI_KAMU/exec";

Preferences preferences;

String activeSsid = "";
String activePassword = "";

unsigned long lastWifiConfigCheck = 0;
const unsigned long WIFI_CONFIG_CHECK_INTERVAL = 60000;

// URL Web App Google Apps Script /exec untuk data ATS
const char* serverName = "https://script.google.com/macros/s/AKfycbwkiLcIQmgitSybFX_su69XR33A73hcmgfglXfrzBbYn2p8biFOv0ubHJfxcejIAOxW/exec";

// ===================== PIN PZEM / RELAY =====================
#define PLN_RX_PIN   21
#define PLN_TX_PIN   22

#define GEN_RX_PIN   26
#define GEN_TX_PIN   27

#define RELAY_PIN    25

const bool RELAY_ACTIVE_LOW = true;

const float V_ON_THRESHOLD  = 180.0;
const float V_OFF_THRESHOLD = 150.0;

HardwareSerial SerialPLN(1);
HardwareSerial SerialGEN(2);

PZEM004Tv30 pzemPLN(SerialPLN, PLN_RX_PIN, PLN_TX_PIN);
PZEM004Tv30 pzemGEN(SerialGEN, GEN_RX_PIN, GEN_TX_PIN);

enum SourceState {
  SOURCE_NONE,
  SOURCE_PLN,
  SOURCE_GEN
};

SourceState activeSource = SOURCE_NONE;

bool plnPresent = false;
bool genPresent = false;

// ===================== JSON SEDERHANA =====================
// Bisa membaca value JSON yang berupa string ataupun angka.
String extractJsonValue(String json, String key) {
  String pattern = "\"" + key + "\":";
  int start = json.indexOf(pattern);

  if (start < 0) return "";

  start += pattern.length();

  while (start < json.length() && (json[start] == ' ' || json[start] == '\t')) {
    start++;
  }

  if (start >= json.length()) return "";

  if (json[start] == '"') {
    start++;
    int end = json.indexOf("\"", start);
    if (end < 0) return "";
    return json.substring(start, end);
  }

  int endComma = json.indexOf(",", start);
  int endBrace = json.indexOf("}", start);

  int end = -1;

  if (endComma >= 0 && endBrace >= 0) {
    end = min(endComma, endBrace);
  } else if (endComma >= 0) {
    end = endComma;
  } else {
    end = endBrace;
  }

  if (end < 0) return "";

  String value = json.substring(start, end);
  value.trim();
  return value;
}

String firstNotEmpty(String first, String second, String third) {
  if (first.length() > 0) return first;
  if (second.length() > 0) return second;
  return third;
}

// ===================== WIFI MEMORY =====================
void loadWifiFromMemory() {
  preferences.begin("wifi-config", false);

  activeSsid = preferences.getString("ssid", DEFAULT_SSID);
  activePassword = preferences.getString("password", DEFAULT_PASSWORD);

  Serial.println("WiFi aktif dari memori:");
  Serial.println(activeSsid);
}

void saveWifiToMemory(String newSsid, String newPassword) {
  preferences.putString("ssid", newSsid);
  preferences.putString("password", newPassword);

  activeSsid = newSsid;
  activePassword = newPassword;
}

// ===================== RELAY / SOURCE =====================
void setRelay(bool on) {
  digitalWrite(RELAY_PIN, (RELAY_ACTIVE_LOW ? !on : on));
}

bool detectSource(float voltage, bool prevState) {
  if (isnan(voltage)) return false;

  if (prevState) {
    return voltage >= V_OFF_THRESHOLD;
  }

  return voltage >= V_ON_THRESHOLD;
}

const char* sourceToText(SourceState s) {
  switch (s) {
    case SOURCE_PLN:
      return "PLN";
    case SOURCE_GEN:
      return "GENERATOR";
    default:
      return "TIDAK ADA";
  }
}

// ===================== WIFI CONNECT =====================
void connectWiFi() {
  Serial.print("Connecting WiFi: ");
  Serial.println(activeSsid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(activeSsid.c_str(), activePassword.c_str());

  int retry = 0;

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    retry++;

    if (retry > 40) {
      Serial.println();
      Serial.println("Gagal konek WiFi utama.");

      if (activeSsid != String(DEFAULT_SSID)) {
        Serial.println("Coba fallback ke WiFi default...");

        activeSsid = DEFAULT_SSID;
        activePassword = DEFAULT_PASSWORD;

        WiFi.disconnect(true);
        delay(1000);
        WiFi.begin(activeSsid.c_str(), activePassword.c_str());

        retry = 0;

        while (WiFi.status() != WL_CONNECTED) {
          delay(500);
          Serial.print(".");
          retry++;

          if (retry > 40) {
            Serial.println();
            Serial.println("Fallback juga gagal, ESP32 restart...");
            ESP.restart();
          }
        }
      } else {
        Serial.println("Gagal konek WiFi, ESP32 restart...");
        ESP.restart();
      }
    }
  }

  Serial.println();
  Serial.println("WiFi Connected!");
  Serial.print("SSID: ");
  Serial.println(activeSsid);
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

bool fetchWifiConfigFromApi() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Tidak bisa cek config WiFi, ESP32 belum online.");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  String url = String(WIFI_CONFIG_API) + "?action=getdevicewifi&device=" + String(DEVICE_NAME);

  Serial.println("Cek WiFi config dari API:");
  Serial.println(url);

  if (!http.begin(client, url)) {
    Serial.println("Gagal mulai HTTP WiFi config.");
    return false;
  }

  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setTimeout(15000);

  int httpCode = http.GET();

  Serial.print("HTTP WiFi Config: ");
  Serial.println(httpCode);

  if (httpCode <= 0) {
    Serial.println(http.errorToString(httpCode));
    http.end();
    return false;
  }

  String response = http.getString();
  http.end();

  Serial.println("Response WiFi config:");
  Serial.println(response);

  String newSsid = firstNotEmpty(
    extractJsonValue(response, "ssid"),
    extractJsonValue(response, "wifiSsid"),
    extractJsonValue(response, "SSID")
  );
  String newPassword = firstNotEmpty(
    extractJsonValue(response, "password"),
    extractJsonValue(response, "wifiPassword"),
    extractJsonValue(response, "Password")
  );

  if (newSsid.length() == 0 || newPassword.length() == 0) {
    Serial.println("SSID/password dari API kosong atau JSON tidak sesuai.");
    return false;
  }

  if (newSsid != activeSsid || newPassword != activePassword) {
    Serial.println("WiFi baru terdeteksi. Simpan lalu restart ESP32...");
    saveWifiToMemory(newSsid, newPassword);
    delay(1000);
    ESP.restart();
    return true;
  }

  Serial.println("WiFi config belum berubah.");
  return false;
}

float safeValue(float value) {
  if (isnan(value)) {
    return 0.0;
  }

  return value;
}

// ===================== KIRIM DATA KE GOOGLE SHEET =====================
void sendToGoogleSheet(
  float vPLN,
  float iPLN,
  float pPLN,
  float vGEN,
  float iGEN,
  float pGEN,
  bool pln,
  bool gen,
  String source
) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi putus, reconnect...");
    connectWiFi();
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  Serial.println("Connecting to Google Apps Script...");

  if (!http.begin(client, serverName)) {
    Serial.println("Gagal connect HTTP");
    return;
  }

  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setTimeout(15000);
  http.addHeader("Content-Type", "application/json");

  float safeVPLN = safeValue(vPLN);
  float safeIPLN = safeValue(iPLN);
  float safePPLN = safeValue(pPLN);

  float safeVGEN = safeValue(vGEN);
  float safeIGEN = safeValue(iGEN);
  float safePGEN = safeValue(pGEN);

  String relayState = (activeSource == SOURCE_GEN) ? "ON" : "OFF";
  String keterangan;

  if (activeSource == SOURCE_PLN) {
    keterangan = "Normal PLN";
  } else if (activeSource == SOURCE_GEN) {
    keterangan = "Backup Genset";
  } else {
    keterangan = "Semua sumber mati";
  }

  String jsonData = "{";

  jsonData += "\"vPLN\":" + String(safeVPLN, 2) + ",";
  jsonData += "\"iPLN\":" + String(safeIPLN, 2) + ",";
  jsonData += "\"pPLN\":" + String(safePPLN, 2) + ",";

  jsonData += "\"vGEN\":" + String(safeVGEN, 2) + ",";
  jsonData += "\"iGEN\":" + String(safeIGEN, 2) + ",";
  jsonData += "\"pGEN\":" + String(safePGEN, 2) + ",";

  jsonData += "\"pln\":\"" + String(pln ? "YA" : "TIDAK") + "\",";
  jsonData += "\"gen\":\"" + String(gen ? "YA" : "TIDAK") + "\",";
  jsonData += "\"source\":\"" + source + "\",";
  jsonData += "\"relay\":\"" + relayState + "\",";
  jsonData += "\"ket\":\"" + keterangan + "\"";

  jsonData += "}";

  Serial.println("Kirim JSON ke Spreadsheet:");
  Serial.println(jsonData);

  int httpResponseCode = http.POST(jsonData);

  Serial.print("HTTP Response: ");
  Serial.println(httpResponseCode);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("Response dari Apps Script:");
    Serial.println(response);
  } else {
    Serial.print("HTTP Error: ");
    Serial.println(http.errorToString(httpResponseCode));
  }

  http.end();
}

// ===================== SETUP =====================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RELAY_PIN, OUTPUT);
  setRelay(false);

  Serial.println("================================");
  Serial.println("  SYSTEM ATS MONITOR DINAMIS    ");
  Serial.print("Device Name: ");
  Serial.println(DEVICE_NAME);
  Serial.println("================================");

  loadWifiFromMemory();
  connectWiFi();
  fetchWifiConfigFromApi();
}

// ===================== LOOP =====================
void loop() {
  if (millis() - lastWifiConfigCheck > WIFI_CONFIG_CHECK_INTERVAL) {
    lastWifiConfigCheck = millis();
    fetchWifiConfigFromApi();
  }

  float vPLN = pzemPLN.voltage();
  float iPLN = pzemPLN.current();
  float pPLN = pzemPLN.power();

  float vGEN = pzemGEN.voltage();
  float iGEN = pzemGEN.current();
  float pGEN = pzemGEN.power();

  plnPresent = detectSource(vPLN, plnPresent);
  genPresent = detectSource(vGEN, genPresent);

  SourceState newSource = SOURCE_NONE;

  if (plnPresent) {
    newSource = SOURCE_PLN;
  } else if (genPresent) {
    newSource = SOURCE_GEN;
  } else {
    newSource = SOURCE_NONE;
  }

  if (newSource != activeSource) {
    activeSource = newSource;

    if (activeSource == SOURCE_GEN) {
      setRelay(true);
    } else {
      setRelay(false);
    }

    Serial.println("=== PERUBAHAN SUMBER ===");
    Serial.print("Sumber aktif: ");
    Serial.println(sourceToText(activeSource));
  }

  Serial.println("------------------------");

  Serial.print("Tegangan PLN: ");
  if (isnan(vPLN)) {
    Serial.println("Tidak terbaca");
  } else {
    Serial.print(vPLN);
    Serial.println(" V");
  }

  Serial.print("Arus PLN: ");
  if (isnan(iPLN)) {
    Serial.println("Tidak terbaca");
  } else {
    Serial.print(iPLN);
    Serial.println(" A");
  }

  Serial.print("Daya PLN: ");
  if (isnan(pPLN)) {
    Serial.println("Tidak terbaca");
  } else {
    Serial.print(pPLN);
    Serial.println(" W");
  }

  Serial.print("Tegangan GEN: ");
  if (isnan(vGEN)) {
    Serial.println("Tidak terbaca");
  } else {
    Serial.print(vGEN);
    Serial.println(" V");
  }

  Serial.print("Arus GEN: ");
  if (isnan(iGEN)) {
    Serial.println("Tidak terbaca");
  } else {
    Serial.print(iGEN);
    Serial.println(" A");
  }

  Serial.print("Daya GEN: ");
  if (isnan(pGEN)) {
    Serial.println("Tidak terbaca");
  } else {
    Serial.print(pGEN);
    Serial.println(" W");
  }

  Serial.print("PLN Present: ");
  Serial.println(plnPresent ? "YA" : "TIDAK");

  Serial.print("GEN Present: ");
  Serial.println(genPresent ? "YA" : "TIDAK");

  Serial.print("Source: ");
  Serial.println(sourceToText(activeSource));

  Serial.print("Relay: ");
  Serial.println((activeSource == SOURCE_GEN) ? "ON" : "OFF");

  static unsigned long lastSend = 0;

  if (millis() - lastSend > 10000) {
    lastSend = millis();

    sendToGoogleSheet(
      vPLN,
      iPLN,
      pPLN,
      vGEN,
      iGEN,
      pGEN,
      plnPresent,
      genPresent,
      String(sourceToText(activeSource))
    );
  }

  delay(2000);
}
