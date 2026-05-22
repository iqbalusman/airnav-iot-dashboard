/*
  ESP32 + Nextion NX3224T028 - Airnav Monitoring Display

  File ini dibuat untuk menampilkan data dashboard IoTOps ke LCD Nextion
  melalui ESP32. Nextion tidak membaca website secara langsung; ESP32 yang
  mengambil data dari API Google Apps Script, lalu mengirim command serial
  ke komponen Nextion.

  Wiring umum ESP32 ke Nextion:
  - Nextion TX  -> ESP32 RX2 GPIO16
  - Nextion RX  -> ESP32 TX2 GPIO17
  - Nextion 5V  -> Supply 5V stabil
  - Nextion GND -> GND ESP32

  Komponen teks yang perlu dibuat di Nextion Editor:
  - tWifi
  - tJam
  - tSuhu
  - tKelembaban
  - tStatusSuhu
  - tRfidAlat
  - tRfidStatus
  - tAtsStatus
  - tAtsPln
  - tAtsGen
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ===================== WIFI =====================
const char* WIFI_SSID = "ISI_NAMA_WIFI_KAMU";
const char* WIFI_PASSWORD = "ISI_PASSWORD_WIFI_KAMU";

// ===================== API DASHBOARD =====================
// Isi dengan URL Apps Script /exec masing-masing fitur.
const char* API_SUHU = "https://script.google.com/macros/s/ISI_API_SUHU/exec";
const char* API_RFID = "https://script.google.com/macros/s/ISI_API_RFID/exec";
const char* API_ATS  = "https://script.google.com/macros/s/ISI_API_ATS/exec";

// ===================== NEXTION SERIAL =====================
#define NEXTION_RX_PIN 16
#define NEXTION_TX_PIN 17
#define NEXTION_BAUD   9600

HardwareSerial nextion(2);

// ===================== TIMER =====================
unsigned long lastUpdate = 0;
const unsigned long UPDATE_INTERVAL = 10000;

// ===================== NEXTION HELPER =====================
void nextionEndCommand() {
  nextion.write(0xFF);
  nextion.write(0xFF);
  nextion.write(0xFF);
}

String escapeNextionText(String text) {
  text.replace("\\", "\\\\");
  text.replace("\"", "'");
  text.replace("\r", " ");
  text.replace("\n", " ");
  return text;
}

void setNextionText(String component, String value) {
  String command = component + ".txt=\"" + escapeNextionText(value) + "\"";
  nextion.print(command);
  nextionEndCommand();
}

void showBootScreen() {
  setNextionText("tWifi", "Menghubungkan WiFi...");
  setNextionText("tJam", "-");
  setNextionText("tSuhu", "-");
  setNextionText("tKelembaban", "-");
  setNextionText("tStatusSuhu", "-");
  setNextionText("tRfidAlat", "-");
  setNextionText("tRfidStatus", "-");
  setNextionText("tAtsStatus", "-");
  setNextionText("tAtsPln", "-");
  setNextionText("tAtsGen", "-");
}

// ===================== WIFI =====================
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Menghubungkan WiFi");
  setNextionText("tWifi", "Connecting...");

  int retry = 0;

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    retry++;

    if (retry > 40) {
      Serial.println();
      Serial.println("WiFi gagal, restart ESP32...");
      setNextionText("tWifi", "WiFi gagal");
      delay(1500);
      ESP.restart();
    }
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.println(WiFi.localIP());
  setNextionText("tWifi", "Connected");
}

// ===================== HTTP =====================
String httpGet(String url) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  if (!http.begin(client, url)) {
    Serial.println("HTTP begin gagal: " + url);
    return "";
  }

  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setTimeout(15000);

  int httpCode = http.GET();
  Serial.print("GET ");
  Serial.print(url);
  Serial.print(" -> ");
  Serial.println(httpCode);

  if (httpCode <= 0) {
    Serial.println(http.errorToString(httpCode));
    http.end();
    return "";
  }

  String response = http.getString();
  http.end();

  return response;
}

// ===================== JSON SEDERHANA =====================
// Mengambil value terakhir dari response JSON. Cocok untuk API spreadsheet
// yang mengembalikan array data, karena data terbaru biasanya berada di akhir.
String extractLastJsonValue(String json, String key) {
  String quotedPattern = "\"" + key + "\":";
  String plainPattern = key + ":";

  int start = json.lastIndexOf(quotedPattern);

  if (start < 0) {
    start = json.lastIndexOf(plainPattern);
  }

  if (start < 0) return "";

  int colon = json.indexOf(":", start);
  if (colon < 0) return "";

  start = colon + 1;

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
  int endBracket = json.indexOf("]", start);
  int end = -1;

  if (endComma >= 0) end = endComma;
  if (endBrace >= 0 && (end < 0 || endBrace < end)) end = endBrace;
  if (endBracket >= 0 && (end < 0 || endBracket < end)) end = endBracket;

  if (end < 0) return "";

  String value = json.substring(start, end);
  value.trim();
  return value;
}

String firstNotEmpty(String a, String b, String c = "") {
  if (a.length() > 0) return a;
  if (b.length() > 0) return b;
  return c;
}

String formatSuhu(String value) {
  if (value.length() == 0) return "-";
  if (value.indexOf("°C") >= 0 || value.indexOf("C") >= 0) return value;
  return value + " C";
}

String formatPersen(String value) {
  if (value.length() == 0) return "-";
  if (value.indexOf("%") >= 0) return value;
  return value + "%";
}

// ===================== UPDATE DATA =====================
void updateSuhu() {
  String response = httpGet(API_SUHU);

  if (response.length() == 0) {
    setNextionText("tStatusSuhu", "API suhu gagal");
    return;
  }

  String jam = firstNotEmpty(
    extractLastJsonValue(response, "Jam"),
    extractLastJsonValue(response, "jam")
  );

  String suhu = firstNotEmpty(
    extractLastJsonValue(response, "Suhu"),
    extractLastJsonValue(response, "suhu")
  );

  String kelembaban = firstNotEmpty(
    extractLastJsonValue(response, "Kelembaban"),
    extractLastJsonValue(response, "kelembaban")
  );

  String status = firstNotEmpty(
    extractLastJsonValue(response, "Keterangan"),
    extractLastJsonValue(response, "ket"),
    extractLastJsonValue(response, "status")
  );

  setNextionText("tJam", jam.length() > 0 ? jam : "-");
  setNextionText("tSuhu", formatSuhu(suhu));
  setNextionText("tKelembaban", formatPersen(kelembaban));
  setNextionText("tStatusSuhu", status.length() > 0 ? status : "-");
}

void updateRfid() {
  String response = httpGet(API_RFID);

  if (response.length() == 0) {
    setNextionText("tRfidStatus", "API RFID gagal");
    return;
  }

  String alat = firstNotEmpty(
    extractLastJsonValue(response, "Alat"),
    extractLastJsonValue(response, "alat"),
    extractLastJsonValue(response, "namaAlat")
  );

  String status = firstNotEmpty(
    extractLastJsonValue(response, "Status"),
    extractLastJsonValue(response, "status"),
    extractLastJsonValue(response, "ket")
  );

  setNextionText("tRfidAlat", alat.length() > 0 ? alat : "-");
  setNextionText("tRfidStatus", status.length() > 0 ? status : "-");
}

void updateAts() {
  String response = httpGet(API_ATS);

  if (response.length() == 0) {
    setNextionText("tAtsStatus", "API ATS gagal");
    return;
  }

  String status = firstNotEmpty(
    extractLastJsonValue(response, "Status"),
    extractLastJsonValue(response, "status"),
    extractLastJsonValue(response, "keterangan")
  );

  String teganganPln = firstNotEmpty(
    extractLastJsonValue(response, "Tegangan PLN"),
    extractLastJsonValue(response, "teganganPln"),
    extractLastJsonValue(response, "pln")
  );

  String teganganGenerator = firstNotEmpty(
    extractLastJsonValue(response, "Tegangan Generator"),
    extractLastJsonValue(response, "teganganGenerator"),
    extractLastJsonValue(response, "generator")
  );

  setNextionText("tAtsStatus", status.length() > 0 ? status : "-");
  setNextionText("tAtsPln", teganganPln.length() > 0 ? teganganPln : "-");
  setNextionText("tAtsGen", teganganGenerator.length() > 0 ? teganganGenerator : "-");
}

void updateAllData() {
  Serial.println("Update data ke Nextion...");
  setNextionText("tWifi", "Updating...");

  updateSuhu();
  updateRfid();
  updateAts();

  setNextionText("tWifi", "Connected");
  Serial.println("Update selesai.");
}

// ===================== SETUP =====================
void setup() {
  Serial.begin(115200);
  delay(1000);

  nextion.begin(NEXTION_BAUD, SERIAL_8N1, NEXTION_RX_PIN, NEXTION_TX_PIN);
  delay(500);

  Serial.println("====================================");
  Serial.println("ESP32 + Nextion NX3224T028");
  Serial.println("Airnav Monitoring Display");
  Serial.println("====================================");

  showBootScreen();
  connectWiFi();
  updateAllData();
}

// ===================== LOOP =====================
void loop() {
  if (millis() - lastUpdate >= UPDATE_INTERVAL) {
    lastUpdate = millis();
    updateAllData();
  }
}
