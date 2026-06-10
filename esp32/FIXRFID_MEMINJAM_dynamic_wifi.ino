#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>

// ===================== MODE SISTEM =====================
String MODE_STATUS = "DIPINJAM";

// ===================== WIFI DINAMIS =====================
const char* DEFAULT_SSID = "FAZ NET";
const char* DEFAULT_PASSWORD = "Gantengkalem1";
const bool ENABLE_DEFAULT_FALLBACK = false; // true kalau ingin coba WiFi default saat WiFi tersimpan gagal.

// ESP DIPINJAM disarankan memakai ESP32-1.
const char* DEVICE_NAME = "ESP32-1";

const char* WIFI_CONFIG_API = "https://script.google.com/macros/s/AKfycbxhFVEGoUNd8NhHRwOrpn8MfTJltsJ90lXWXi_1Jc0UMAFiYXcrlL7SspcnTTp_3UIe/exec";
const char* serverName = "https://script.google.com/macros/s/AKfycbxtiN6rKnkHZDJeaNGjsCCJimDGzhU12C3RsL2gA3zuy8jVEXEq5pd38Dlkb0NIq54F/exec";

Preferences preferences;

String activeSsid = "";
String activePassword = "";

unsigned long lastWifiConfigCheck = 0;
const unsigned long WIFI_CONFIG_CHECK_INTERVAL = 60000;
const uint16_t HTTP_TIMEOUT_MS = 10000;

// ===================== RFID PIN =====================
#define SS_PIN       5
#define RST_PIN      21

// ===================== OUTPUT PIN =====================
#define LED_OK       2
#define LED_MERAH    27
#define BUZZER_PIN   4

MFRC522 rfid(SS_PIN, RST_PIN);

// ===================== DATA UID ALAT =====================
String UID_OBENG_SET     = "BD27B889";
String UID_LAN_TESTER    = "40616A61";
String UID_MULTIMETER    = "D065DF5F";
String UID_SOLDER_UAP    = "30D85561";
String UID_WATT_METER    = "D019CD5F";
String UID_BOR_PORTABEL  = "00BA9E60";
String UID_OSCILLOSCOPE  = "FB7F8005";

// ===================== JSON SEDERHANA =====================
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

// ===================== STATUS PINJAM LOKAL =====================
String getBorrowKey(String uid) {
  return "p_" + uid;
}

bool isAlatSedangDipinjam(String uid) {
  return preferences.getBool(getBorrowKey(uid).c_str(), false);
}

void setAlatDipinjam(String uid, bool statusPinjam) {
  preferences.putBool(getBorrowKey(uid).c_str(), statusPinjam);
}

void resetSemuaStatusPinjamLokal() {
  setAlatDipinjam(UID_OBENG_SET, false);
  setAlatDipinjam(UID_LAN_TESTER, false);
  setAlatDipinjam(UID_MULTIMETER, false);
  setAlatDipinjam(UID_SOLDER_UAP, false);
  setAlatDipinjam(UID_WATT_METER, false);
  setAlatDipinjam(UID_BOR_PORTABEL, false);
  setAlatDipinjam(UID_OSCILLOSCOPE, false);

  Serial.println("Semua status pinjam lokal sudah direset.");
}

// ===================== WIFI CONNECT =====================
void connectWiFi() {
  Serial.print("Connecting WiFi: ");
  Serial.println(activeSsid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(activeSsid.c_str(), activePassword.c_str());

  int retry = 0;

  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
    retry++;

    if (retry > 50) {
      Serial.println();
      Serial.println("Gagal konek WiFi utama.");

      if (ENABLE_DEFAULT_FALLBACK && activeSsid != String(DEFAULT_SSID)) {
        Serial.println("Coba fallback ke WiFi default...");

        activeSsid = DEFAULT_SSID;
        activePassword = DEFAULT_PASSWORD;

        WiFi.disconnect(true);
        delay(500);
        WiFi.begin(activeSsid.c_str(), activePassword.c_str());

        retry = 0;

        while (WiFi.status() != WL_CONNECTED) {
          delay(300);
          Serial.print(".");
          retry++;

          if (retry > 50) {
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
  http.setTimeout(HTTP_TIMEOUT_MS);

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
  if (uid == UID_OBENG_SET) return "OBENG SET";
  if (uid == UID_LAN_TESTER) return "LAN TESTER";
  if (uid == UID_MULTIMETER) return "MULTIMETER";
  if (uid == UID_SOLDER_UAP) return "SOLDER UAP";
  if (uid == UID_WATT_METER) return "WATT METER";
  if (uid == UID_BOR_PORTABEL) return "BOR PORTABEL";
  if (uid == UID_OSCILLOSCOPE) return "OSCILLOSCOPE";

  return "TIDAK TERDAFTAR";
}

// ===================== OUTPUT LED + BUZZER =====================
void matikanOutput() {
  digitalWrite(LED_OK, LOW);
  digitalWrite(LED_MERAH, LOW);
  digitalWrite(BUZZER_PIN, LOW);
}

void bunyiScanAwal() {
  digitalWrite(LED_OK, LOW);
  digitalWrite(LED_MERAH, LOW);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(80);
  digitalWrite(BUZZER_PIN, LOW);
}

void hasilBerhasilHijau() {
  digitalWrite(LED_MERAH, LOW);
  digitalWrite(LED_OK, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(120);
  digitalWrite(BUZZER_PIN, LOW);
  delay(1000);
  matikanOutput();
}

void nyalakanHijauStatusSesuai() {
  digitalWrite(LED_MERAH, LOW);
  digitalWrite(LED_OK, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(120);
  digitalWrite(BUZZER_PIN, LOW);
}

void hasilGagalMerahDuaKali() {
  digitalWrite(LED_OK, LOW);
  digitalWrite(LED_MERAH, HIGH);
  delay(60);

  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(180);
    digitalWrite(BUZZER_PIN, LOW);
    delay(180);
  }

  delay(500);
  matikanOutput();
}

void hasilErrorInternet() {
  digitalWrite(LED_OK, LOW);
  digitalWrite(LED_MERAH, HIGH);
  delay(60);

  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(120);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }

  delay(500);
  matikanOutput();
}

// ===================== CEK STATUS TERAKHIR DARI SPREADSHEET =====================
bool cekStatusTerakhirDariSheet(String uid, String namaAlat, String &statusTerakhir) {
  statusTerakhir = "";

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi putus, reconnect sebelum cek status...");
    connectWiFi();
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(serverName) + "?action=cekstatus&uid=" + uid;

  Serial.println("Cek status terakhir alat dari Spreadsheet:");
  Serial.println(url);

  if (!http.begin(client, url)) {
    Serial.println("Gagal mulai HTTP cek status.");
    return false;
  }

  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setTimeout(HTTP_TIMEOUT_MS);

  int httpCode = http.GET();

  Serial.print("HTTP Cek Status: ");
  Serial.println(httpCode);

  if (httpCode <= 0) {
    Serial.println(http.errorToString(httpCode));
    http.end();
    return false;
  }

  String response = http.getString();
  http.end();

  Serial.println("Response cek status:");
  Serial.println(response);

  statusTerakhir = extractJsonValue(response, "lastStatus");
  if (statusTerakhir.length() == 0) statusTerakhir = extractJsonValue(response, "statusTerakhir");
  if (statusTerakhir.length() == 0) statusTerakhir = extractJsonValue(response, "last_status");
  if (statusTerakhir.length() == 0) statusTerakhir = extractJsonValue(response, "status");

  statusTerakhir.trim();
  statusTerakhir.toUpperCase();

  if (statusTerakhir.length() == 0) {
    Serial.println("Status terakhir kosong. Pastikan JSON Apps Script berisi lastStatus/statusTerakhir.");
    return false;
  }

  Serial.print("Status terakhir dari Sheet: ");
  Serial.println(statusTerakhir);

  return true;
}

bool statusBolehMeminjam(String statusTerakhir) {
  statusTerakhir.trim();
  statusTerakhir.toUpperCase();

  return statusTerakhir == "MENGEMBALIKAN"
    || statusTerakhir == "DIKEMBALIKAN"
    || statusTerakhir == "KEMBALI"
    || statusTerakhir == "BELUM_PERNAH_DIPINJAM"
    || statusTerakhir == "BELUM_ADA_DATA";
}

// ===================== KIRIM DATA KE GOOGLE SHEET =====================
bool sendToGoogleSheet(String uid, String namaAlat, String status, String keterangan) {
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
    return false;
  }

  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");

  String jsonData = "{";
  jsonData += "\"uid\":\"" + uid + "\",";
  jsonData += "\"alat\":\"" + namaAlat + "\",";
  jsonData += "\"status\":\"" + status + "\",";
  jsonData += "\"device\":\"" + String(DEVICE_NAME) + "\",";
  jsonData += "\"ket\":\"" + keterangan + "\",";
  jsonData += "\"durasi\":\"Sedang berjalan\",";
  jsonData += "\"durasiDetik\":0";
  jsonData += "}";

  Serial.println("Kirim JSON ke Spreadsheet:");
  Serial.println(jsonData);

  int httpResponseCode = http.POST(jsonData);

  Serial.print("HTTP Response: ");
  Serial.println(httpResponseCode);

  bool sukses = false;

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("Response dari Apps Script:");
    Serial.println(response);

    if (httpResponseCode >= 200 && httpResponseCode < 400) {
      sukses = true;
    }
  } else {
    Serial.print("HTTP Error: ");
    Serial.println(http.errorToString(httpResponseCode));
  }

  http.end();
  return sukses;
}

// ===================== PROSES RFID =====================
void prosesKartu(String uid, String namaAlat) {
  Serial.println();
  Serial.println("====================================");
  Serial.print("UID Kartu : ");
  Serial.println(uid);
  Serial.print("Nama Alat : ");
  Serial.println(namaAlat);

  bunyiScanAwal();

  if (namaAlat == "TIDAK TERDAFTAR") {
    Serial.println("Status    : DITOLAK");
    Serial.println("Ket       : RFID tidak terdaftar. Data tidak dikirim.");
    hasilGagalMerahDuaKali();
    return;
  }

  String statusTerakhir = "";
  bool cekOk = cekStatusTerakhirDariSheet(uid, namaAlat, statusTerakhir);

  if (!cekOk) {
    Serial.println("Status    : DITOLAK");
    Serial.println("Ket       : Gagal cek status terakhir dari Spreadsheet. Peminjaman dibatalkan agar tidak dobel data.");
    hasilErrorInternet();
    return;
  }

  if (!statusBolehMeminjam(statusTerakhir)) {
    setAlatDipinjam(uid, true);

    Serial.println("Status    : DITOLAK");
    Serial.print("Ket       : ");
    Serial.print(namaAlat);
    Serial.print(" status terakhirnya ");
    Serial.print(statusTerakhir);
    Serial.println(", jadi belum boleh dipinjam.");

    hasilGagalMerahDuaKali();
    return;
  }

  setAlatDipinjam(uid, false);

  String status = MODE_STATUS;
  String keterangan = namaAlat + " sedang dipinjam";

  Serial.print("Status    : ");
  Serial.println(status);
  Serial.print("Ket       : ");
  Serial.println(keterangan);
  Serial.print("Status sebelumnya dari Sheet: ");
  Serial.println(statusTerakhir);
  Serial.println("Cek status sesuai: alat boleh dipinjam.");

  nyalakanHijauStatusSesuai();

  setAlatDipinjam(uid, true);
  Serial.println("Status lokal langsung dikunci: SEDANG DIPINJAM");

  bool suksesKirim = sendToGoogleSheet(uid, namaAlat, status, keterangan);

  if (suksesKirim) {
    Serial.println("Data DIPINJAM berhasil dikirim ke Spreadsheet.");
    delay(1000);
    matikanOutput();
  } else {
    matikanOutput();
    setAlatDipinjam(uid, false);
    Serial.println("Gagal kirim data. Status lokal dibuka lagi supaya bisa scan ulang.");
    hasilErrorInternet();
  }
}

// ===================== SETUP =====================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_OK, OUTPUT);
  pinMode(LED_MERAH, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  matikanOutput();

  Serial.println("====================================");
  Serial.println("RFID ESP32 - MODE DIPINJAM");
  Serial.println("LED HASIL SETELAH CEK STATUS DAN KIRIM DATA");
  Serial.print("Mode Sistem: ");
  Serial.println(MODE_STATUS);
  Serial.print("Device Name: ");
  Serial.println(DEVICE_NAME);
  Serial.println("Alat:");
  Serial.println("1. OBENG SET");
  Serial.println("2. LAN TESTER");
  Serial.println("3. MULTIMETER");
  Serial.println("4. SOLDER UAP");
  Serial.println("5. WATT METER");
  Serial.println("6. BOR PORTABEL");
  Serial.println("7. OSCILLOSCOPE");
  Serial.println("====================================");

  loadWifiFromMemory();
  connectWiFi();
  fetchWifiConfigFromApi();
  lastWifiConfigCheck = millis();

  SPI.begin(18, 19, 23, SS_PIN);
  rfid.PCD_Init();

  Serial.println("RFID siap.");
  Serial.println("Tempelkan tag RFID alat ke RC522...");
  Serial.println("====================================");
}

// ===================== LOOP =====================
void loop() {
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = getUIDString();
    String namaAlat = getNamaAlat(uid);

    prosesKartu(uid, namaAlat);

    Serial.println("====================================");

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    delay(400);
    return;
  }

  if (millis() - lastWifiConfigCheck > WIFI_CONFIG_CHECK_INTERVAL) {
    lastWifiConfigCheck = millis();
    fetchWifiConfigFromApi();
  }
}
