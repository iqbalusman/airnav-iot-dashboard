#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <time.h>

// ===================== MODE SISTEM =====================
// Pilihan:
// "MEMINJAM"
// "MENGEMBALIKAN"
String MODE_STATUS = "MENGEMBALIKAN";

// ===================== WIFI DINAMIS =====================
// WiFi default dipakai pertama kali upload.
// Setelah WiFi dari dashboard tersimpan di Preferences, sketch memakai data memori.
const char* DEFAULT_SSID = "FAZ NET";
const char* DEFAULT_PASSWORD = "Gantengkalem1";
const bool ENABLE_DEFAULT_FALLBACK = false; // true kalau ingin coba WiFi default saat WiFi tersimpan gagal.

// Ganti sesuai alat:
// ESP32-1, ESP32-2, atau ESP32-3
const char* DEVICE_NAME = "ESP32-2";

// Isi dengan URL Apps Script yang sama dengan API WiFi ESP32 di website.
const char* WIFI_CONFIG_API = "https://script.google.com/macros/s/URL_APPS_SCRIPT_WIFI_KAMU/exec";

Preferences preferences;
Preferences loanPreferences;

String activeSsid = "";
String activePassword = "";

unsigned long lastWifiConfigCheck = 0;
const unsigned long WIFI_CONFIG_CHECK_INTERVAL = 60000;

// ===================== WAKTU WITA =====================
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 8 * 3600; // WITA = UTC+8
const int daylightOffset_sec = 0;

// URL Web App Google Apps Script /exec untuk data RFID
const char* serverName = "https://script.google.com/macros/s/AKfycbxtiN6rKnkHZDJeaNGjsCCJimDGzhU12C3RsL2gA3zuy8jVEXEq5pd38Dlkb0NIq54F/exec";

// ===================== RFID PIN =====================
#define SS_PIN       5
#define RST_PIN      21

// ===================== OUTPUT PIN =====================
#define LED_OK       2
#define BUZZER_PIN   4

MFRC522 rfid(SS_PIN, RST_PIN);

// ===================== DATA UID ALAT =====================
String UID_OBENG      = "BD27B889";
String UID_TANG       = "FB7F8005";
String UID_MULTIMETER = "D065DF5F";
String UID_SOLDER     = "40EA4561";
String UID_TESPEN     = "D019CD5F";

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

// ===================== WAKTU PEMINJAMAN =====================
String loanKeyFromUid(String uid) {
  String key = "u";

  for (int i = 0; i < uid.length() && key.length() < 15; i++) {
    char c = uid[i];
    if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')) {
      key += c;
    }
  }

  return key;
}

unsigned long getCurrentEpoch() {
  time_t now;
  time(&now);

  if (now < 1700000000) {
    return 0;
  }

  return (unsigned long)now;
}

String formatDuration(unsigned long durationSeconds) {
  unsigned long days = durationSeconds / 86400UL;
  unsigned long hours = (durationSeconds % 86400UL) / 3600UL;
  unsigned long minutes = (durationSeconds % 3600UL) / 60UL;
  unsigned long seconds = durationSeconds % 60UL;

  String text = "";

  if (days > 0) {
    text += String(days) + " hari ";
  }
  if (hours > 0 || days > 0) {
    text += String(hours) + " jam ";
  }
  if (minutes > 0 || hours > 0 || days > 0) {
    text += String(minutes) + " menit ";
  }
  text += String(seconds) + " detik";

  return text;
}

void syncTime() {
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  Serial.println("Sinkron waktu NTP...");

  struct tm timeinfo;
  int retry = 0;

  while (!getLocalTime(&timeinfo) && retry < 20) {
    delay(500);
    retry++;
    Serial.print(".");
  }

  Serial.println();

  if (getLocalTime(&timeinfo)) {
    Serial.println("Waktu WITA aktif.");
  } else {
    Serial.println("Waktu NTP gagal. Durasi peminjaman mungkin tidak bisa dihitung.");
  }
}

unsigned long getLoanStartTime(String uid) {
  return loanPreferences.getULong(loanKeyFromUid(uid).c_str(), 0);
}

void saveLoanStartTime(String uid, unsigned long startTime) {
  loanPreferences.putULong(loanKeyFromUid(uid).c_str(), startTime);
}

void clearLoanStartTime(String uid) {
  loanPreferences.remove(loanKeyFromUid(uid).c_str());
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

      if (ENABLE_DEFAULT_FALLBACK && activeSsid != String(DEFAULT_SSID)) {
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

// ===================== AMBIL UID RFID =====================
String getUIDString() {
  String uid = "";

  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      uid += "0";
    }
    uid += String(rfid.uid.uidByte[i], HEX);
  }

  uid.toUpperCase();
  return uid;
}

// ===================== CARI NAMA ALAT DARI UID =====================
String getNamaAlat(String uid) {
  if (uid == UID_OBENG) {
    return "OBENG";
  } else if (uid == UID_TANG) {
    return "TANG";
  } else if (uid == UID_MULTIMETER) {
    return "MULTIMETER";
  } else if (uid == UID_SOLDER) {
    return "SOLDER";
  } else if (uid == UID_TESPEN) {
    return "TESPEN";
  }

  return "TIDAK TERDAFTAR";
}

// ===================== BUZZER =====================
void buzzerOK() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(150);
  digitalWrite(BUZZER_PIN, LOW);
}

void buzzerError() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

// ===================== KIRIM DATA KE GOOGLE SHEET =====================
void sendToGoogleSheet(String uid, String namaAlat, String status, String keterangan, String durasi, unsigned long durasiDetik) {
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

  String jsonData = "{";
  jsonData += "\"uid\":\"" + uid + "\",";
  jsonData += "\"alat\":\"" + namaAlat + "\",";
  jsonData += "\"status\":\"" + status + "\",";
  jsonData += "\"ket\":\"" + keterangan + "\",";
  jsonData += "\"durasi\":\"" + durasi + "\",";
  jsonData += "\"durasiDetik\":" + String(durasiDetik);
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

  pinMode(LED_OK, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(LED_OK, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println("====================================");
  Serial.println("RFID + WiFi Dinamis + Spreadsheet");
  Serial.print("Mode Sistem: ");
  Serial.println(MODE_STATUS);
  Serial.print("Device Name: ");
  Serial.println(DEVICE_NAME);
  Serial.println("Alat: OBENG, TANG, MULTIMETER, SOLDER, TESPEN");
  Serial.println("====================================");

  loadWifiFromMemory();
  loanPreferences.begin("rfid-loans", false);
  connectWiFi();
  fetchWifiConfigFromApi();
  syncTime();

  // SCK, MISO, MOSI, SS
  SPI.begin(18, 19, 23, SS_PIN);
  rfid.PCD_Init();

  Serial.println("RFID siap.");
  Serial.println("Tempelkan tag RFID alat ke RC522...");
  Serial.println("====================================");
}

// ===================== LOOP =====================
void loop() {
  if (millis() - lastWifiConfigCheck > WIFI_CONFIG_CHECK_INTERVAL) {
    lastWifiConfigCheck = millis();
    fetchWifiConfigFromApi();
  }

  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  String uid = getUIDString();
  String namaAlat = getNamaAlat(uid);

  Serial.println();
  Serial.println("====================================");
  Serial.print("UID Kartu : ");
  Serial.println(uid);
  Serial.print("Nama Alat : ");
  Serial.println(namaAlat);

  if (namaAlat == "TIDAK TERDAFTAR") {
    Serial.println("Status    : RFID tidak terdaftar!");
    buzzerError();

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    delay(1500);
    return;
  }

  String status = MODE_STATUS;
  String keterangan = "";
  String durasi = "-";
  unsigned long durasiDetik = 0;
  unsigned long nowEpoch = getCurrentEpoch();

  if (status == "MEMINJAM") {
    if (nowEpoch > 0) {
      saveLoanStartTime(uid, nowEpoch);
    }

    keterangan = namaAlat + " sedang dipinjam";
  } else if (status == "MENGEMBALIKAN") {
    unsigned long startEpoch = getLoanStartTime(uid);

    if (startEpoch > 0 && nowEpoch >= startEpoch) {
      durasiDetik = nowEpoch - startEpoch;
      durasi = formatDuration(durasiDetik);
      clearLoanStartTime(uid);
      keterangan = namaAlat + " telah dikembalikan. Durasi pinjam: " + durasi;
    } else {
      durasi = "Tidak terdeteksi";
      durasiDetik = 0;
      keterangan = namaAlat + " telah dikembalikan. Waktu mulai pinjam tidak terdeteksi";
    }
  } else {
    status = "ERROR";
    keterangan = "Mode status tidak valid";
  }

  if (status == "MEMINJAM") {
    durasi = "Sedang berjalan";
    durasiDetik = 0;
  } else if (status == "MENGEMBALIKAN" && keterangan == "") {
    keterangan = namaAlat + " telah dikembalikan";
  }

  Serial.print("Status    : ");
  Serial.println(status);
  Serial.print("Ket       : ");
  Serial.println(keterangan);
  Serial.print("Durasi    : ");
  Serial.println(durasi);

  digitalWrite(LED_OK, HIGH);
  buzzerOK();

  sendToGoogleSheet(uid, namaAlat, status, keterangan, durasi, durasiDetik);

  delay(1000);
  digitalWrite(LED_OK, LOW);

  Serial.println("Data selesai dikirim.");
  Serial.println("====================================");

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(1500);
}
