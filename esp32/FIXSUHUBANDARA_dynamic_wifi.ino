#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <time.h>

// ===================== WIFI DINAMIS =====================
// WiFi default dipakai pertama kali upload, atau fallback kalau WiFi baru gagal.
const char* DEFAULT_SSID = "FAZ NET";
const char* DEFAULT_PASSWORD = "Gantengkalem1";

// Ganti sesuai alat:
// ESP32-1, ESP32-2, atau ESP32-3
const char* DEVICE_NAME = "ESP32-3";

// Isi dengan URL Apps Script yang sama dengan API WiFi ESP32 di website.
const char* WIFI_CONFIG_API = "https://script.google.com/macros/s/URL_APPS_SCRIPT_WIFI_KAMU/exec";

Preferences preferences;

String activeSsid = "";
String activePassword = "";

unsigned long lastWifiConfigCheck = 0;
const unsigned long WIFI_CONFIG_CHECK_INTERVAL = 60000;

// URL Web App Google Apps Script /exec untuk data suhu
const char* serverName = "https://script.google.com/macros/s/AKfycbxBbwzVrk5j32jfOqizkF9HhREMuDQ0eICVY1yIDgx4t3wOZ3pPwdGYDcuzylyrdQ/exec";

// ===================== LCD I2C 20x4 =====================
// Jika alamat LCD berbeda, coba ganti 0x27 menjadi 0x3F
LiquidCrystal_I2C lcd(0x27, 20, 4);

// ===================== DHT11 =====================
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ===================== INTERVAL KIRIM DATA =====================
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 10000;

// ===================== WAKTU WIB =====================
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 7 * 3600;
const int daylightOffset_sec = 0;

const char* hariSingkat[] = {
  "Mg", "Sn", "Sl", "Rb", "Km", "Jm", "Sb"
};

// ===================== PRINT LCD 20 KARAKTER =====================
void printLCDLine(int row, String text) {
  while (text.length() < 20) {
    text += " ";
  }

  if (text.length() > 20) {
    text = text.substring(0, 20);
  }

  lcd.setCursor(0, row);
  lcd.print(text);
}

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

// ===================== TAMPILKAN WAKTU DI LCD =====================
void tampilkanWaktuLCD() {
  struct tm timeinfo;

  if (!getLocalTime(&timeinfo)) {
    printLCDLine(3, "Time Sync...");
    return;
  }

  char buffer[21];

  snprintf(
    buffer,
    sizeof(buffer),
    "%s %02d/%02d/%02d %02d:%02d:%02d",
    hariSingkat[timeinfo.tm_wday],
    timeinfo.tm_mday,
    timeinfo.tm_mon + 1,
    (timeinfo.tm_year + 1900) % 100,
    timeinfo.tm_hour,
    timeinfo.tm_min,
    timeinfo.tm_sec
  );

  printLCDLine(3, String(buffer));
}

// ===================== TAMPILAN DATA UTAMA LCD =====================
void tampilkanDataLCD(float suhu, float kelembaban) {
  printLCDLine(0, "    Shelter DVOR");

  String barisSuhu = "Suhu       : " + String(suhu, 1);
  barisSuhu += (char)223;
  barisSuhu += "C";

  String barisLembab = "Kelembaban : " + String(kelembaban, 1) + "%";

  printLCDLine(1, barisSuhu);
  printLCDLine(2, barisLembab);
  tampilkanWaktuLCD();
}

// ===================== TAMPILAN ERROR LCD =====================
void tampilkanErrorLCD() {
  printLCDLine(0, "    Shelter DVOR");
  printLCDLine(1, "Suhu       : ERROR");
  printLCDLine(2, "Kelembaban : ERROR");
  tampilkanWaktuLCD();
}

// ===================== WIFI CONNECT =====================
void connectWiFi() {
  Serial.print("Connecting WiFi: ");
  Serial.println(activeSsid);

  lcd.clear();
  printLCDLine(0, "Connecting WiFi");
  printLCDLine(1, activeSsid);
  printLCDLine(2, "Please Wait...");
  printLCDLine(3, "");

  WiFi.mode(WIFI_STA);
  WiFi.begin(activeSsid.c_str(), activePassword.c_str());

  int retry = 0;

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    retry++;

    printLCDLine(2, "Retry: " + String(retry));

    if (retry > 40) {
      Serial.println();
      Serial.println("Gagal konek WiFi utama.");

      if (activeSsid != String(DEFAULT_SSID)) {
        Serial.println("Coba fallback ke WiFi default...");

        lcd.clear();
        printLCDLine(0, "WiFi Baru Gagal");
        printLCDLine(1, "Fallback Default");
        printLCDLine(2, DEFAULT_SSID);
        printLCDLine(3, "");

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

          printLCDLine(3, "Retry: " + String(retry));

          if (retry > 40) {
            Serial.println();
            Serial.println("Fallback juga gagal, ESP32 restart...");

            lcd.clear();
            printLCDLine(0, "WiFi Gagal");
            printLCDLine(1, "Restart ESP32");
            printLCDLine(2, "");
            printLCDLine(3, "");
            delay(2000);

            ESP.restart();
          }
        }
      } else {
        Serial.println("Gagal konek WiFi, ESP32 restart...");

        lcd.clear();
        printLCDLine(0, "WiFi Gagal");
        printLCDLine(1, "Restart ESP32");
        printLCDLine(2, "");
        printLCDLine(3, "");
        delay(2000);

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

  lcd.clear();
  printLCDLine(0, "WiFi Connected");
  printLCDLine(1, activeSsid);
  printLCDLine(2, WiFi.localIP().toString());
  printLCDLine(3, "");
  delay(2000);
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

  String newSsid = extractJsonValue(response, "ssid");
  String newPassword = extractJsonValue(response, "password");

  if (newSsid.length() == 0 || newPassword.length() == 0) {
    Serial.println("SSID/password dari API kosong atau JSON tidak sesuai.");
    return false;
  }

  if (newSsid != activeSsid || newPassword != activePassword) {
    Serial.println("WiFi baru terdeteksi. Simpan lalu restart ESP32...");

    lcd.clear();
    printLCDLine(0, "WiFi Baru Ada");
    printLCDLine(1, newSsid);
    printLCDLine(2, "Simpan Config");
    printLCDLine(3, "Restart...");

    saveWifiToMemory(newSsid, newPassword);
    delay(1500);
    ESP.restart();
    return true;
  }

  Serial.println("WiFi config belum berubah.");
  return false;
}

// ===================== SINKRONISASI WAKTU =====================
void syncTime() {
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  lcd.clear();
  printLCDLine(0, "Sinkron Waktu");
  printLCDLine(1, "NTP Server...");
  printLCDLine(2, "");
  printLCDLine(3, "");

  struct tm timeinfo;
  int retry = 0;

  while (!getLocalTime(&timeinfo) && retry < 20) {
    delay(500);
    retry++;
    printLCDLine(2, "Retry: " + String(retry));
  }

  if (getLocalTime(&timeinfo)) {
    printLCDLine(2, "Waktu OK");
    printLCDLine(3, "WIB Aktif");
  } else {
    printLCDLine(2, "Waktu Gagal");
    printLCDLine(3, "Cek Internet");
  }

  delay(1500);
}

// ===================== KIRIM DATA KE GOOGLE SHEET =====================
void sendToGoogleSheet(float suhu, float kelembaban, String keterangan) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi putus, reconnect...");
    connectWiFi();
    syncTime();
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

  String jsonData = "{";
  jsonData += "\"suhu\":\"" + String(suhu, 1) + "\",";
  jsonData += "\"kelembaban\":\"" + String(kelembaban, 1) + "\",";
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

  Wire.begin(21, 22);

  lcd.init();
  lcd.backlight();

  dht.begin();

  lcd.clear();
  printLCDLine(0, "");
  printLCDLine(1, "     Airnav IoT");
  printLCDLine(2, "  Monitoring Sys");
  printLCDLine(3, "");
  delay(2500);

  Serial.println("====================================");
  Serial.println("ESP32 DHT11 + LCD 20x4 + WiFi Dinamis");
  Serial.print("Device Name: ");
  Serial.println(DEVICE_NAME);
  Serial.println("====================================");

  loadWifiFromMemory();
  connectWiFi();
  fetchWifiConfigFromApi();
  syncTime();

  lcd.clear();
  printLCDLine(0, "    Shelter DVOR");
  printLCDLine(1, "System Ready");
  printLCDLine(2, "Monitoring...");
  printLCDLine(3, "WIB Active");
  delay(2000);
}

// ===================== LOOP =====================
void loop() {
  if (millis() - lastWifiConfigCheck > WIFI_CONFIG_CHECK_INTERVAL) {
    lastWifiConfigCheck = millis();
    fetchWifiConfigFromApi();
  }

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Sensor Error! Cek DHT11");

    tampilkanErrorLCD();

    if (millis() - lastSendTime >= sendInterval) {
      lastSendTime = millis();
      sendToGoogleSheet(0, 0, "Sensor Error");
    }
  } else {
    String keterangan = "Normal";

    if (temperature >= 35) {
      keterangan = "Suhu Panas";
    } else if (temperature <= 20) {
      keterangan = "Suhu Dingin";
    } else {
      keterangan = "Normal";
    }

    Serial.print("Suhu: ");
    Serial.print(temperature);
    Serial.print(" C | Kelembaban: ");
    Serial.print(humidity);
    Serial.print(" % | Ket: ");
    Serial.println(keterangan);

    tampilkanDataLCD(temperature, humidity);

    if (millis() - lastSendTime >= sendInterval) {
      lastSendTime = millis();
      sendToGoogleSheet(temperature, humidity, keterangan);
    }
  }

  delay(1000);
}
