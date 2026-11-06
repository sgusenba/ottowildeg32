// G32-Bridge: verbindet sich per BLE mit dem Otto Wilde G32 Connected, abonniert die Daten-Characteristic
// und reicht die Rohbytes per WebSocket an den Browser durch. Dekodiert wird im Browser (web/js/decoder.js).
//
// Die Bridge ist read-only: Es gibt keinen Codepfad, der an den Grill schreibt. Eingehende WebSocket-
// Nachrichten werden ignoriert.
//
// WebSocket-Frames (binär), Browser <- ESP32:
//   [0x01][0x00][Paket...]   Notification der Daten-Characteristic (Index 0 = dc0f41e2)
//   [0x10][0x00][Text...]    Status ("Suche Grill ...", "Grill verbunden", ...)
//
// Protokoll-Details: docs/PROTOCOL.md

#include <Arduino.h>
#include <ESPmDNS.h>
#include <LittleFS.h>
#include <NimBLEDevice.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <WiFi.h>

#if !__has_include("config.h")
#error "src/config.h fehlt: src/config.h.example nach src/config.h kopieren und WLAN-Daten eintragen."
#endif
#include "config.h"

// ---------- G32 ----------
static const char* NAME_PREFIX = "OWG-G32C";
static const char* SERVICE_STR = "dc0f41ea-b6ae-46a8-a19e-1a3bf4342bcb";
static const char* DATA_STR = "dc0f41e2-b6ae-46a8-a19e-1a3bf4342bcb";
static const uint32_t NO_DATA_TIMEOUT_MS = 15000;  // Notifications kommen alle ca. 2,4 s

static const uint8_t FRAME_NOTIFY = 0x01;
static const uint8_t FRAME_STATUS = 0x10;

// ---------- Web ----------
static WebServer server(80);
static WebSocketsServer ws(81);

// ---------- Daten zwischen BLE-Task und loop() ----------
static portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
static uint8_t g_pkt[64];
static size_t g_len = 0;
static bool g_newPkt = false;
static volatile uint32_t g_lastPacketMs = 0;
static char g_status[48] = "Starte ...";
static bool g_newStatus = true;

// Nur im loop()-Kontext genutzt: zuletzt gesendete Frames für neu verbundene Browser
static uint8_t g_lastFrame[sizeof(g_pkt) + 2];
static size_t g_lastFrameLen = 0;

static void setStatus(const char* text) {
  taskENTER_CRITICAL(&mux);
  strncpy(g_status, text, sizeof(g_status) - 1);
  g_status[sizeof(g_status) - 1] = '\0';
  g_newStatus = true;
  taskEXIT_CRITICAL(&mux);
  Serial.println(text);
}

// ---------- BLE ----------
static NimBLEClient* g_client = nullptr;
static volatile bool g_found = false;
static std::string g_addrStr;
static uint8_t g_addrType = 0;

class ScanCb : public NimBLEAdvertisedDeviceCallbacks {
  void onResult(NimBLEAdvertisedDevice* d) override {
    bool byName = d->haveName() && d->getName().rfind(NAME_PREFIX, 0) == 0;
    if (byName || d->isAdvertisingService(NimBLEUUID(SERVICE_STR))) {
      g_addrStr = d->getAddress().toString();
      g_addrType = d->getAddressType();
      g_found = true;
      NimBLEDevice::getScan()->stop();
    }
  }
};
static ScanCb scanCb;

class ClientCb : public NimBLEClientCallbacks {
  void onDisconnect(NimBLEClient*) override { setStatus("Grill getrennt"); }
};
static ClientCb clientCb;

static void onNotify(NimBLERemoteCharacteristic*, uint8_t* data, size_t length, bool) {
  if (length == 0) return;
  taskENTER_CRITICAL(&mux);
  g_len = length < sizeof(g_pkt) ? length : sizeof(g_pkt);
  memcpy(g_pkt, data, g_len);
  g_newPkt = true;
  g_lastPacketMs = millis();
  taskEXIT_CRITICAL(&mux);
}

static bool scanForGrill() {
  g_found = false;
  NimBLEScan* scan = NimBLEDevice::getScan();
  scan->setAdvertisedDeviceCallbacks(&scanCb, false);
  scan->setActiveScan(true);
  scan->setInterval(100);
  scan->setWindow(99);
  scan->start(8, false);  // blockiert bis Treffer (stop() im Callback) oder 8 s
  scan->clearResults();
  return g_found;
}

static bool connectGrill() {
  setStatus("Verbinde mit Grill ...");
  if (!g_client) {
    g_client = NimBLEDevice::createClient();
    g_client->setClientCallbacks(&clientCb, false);
    g_client->setConnectTimeout(10);
  }
  NimBLEAddress addr(g_addrStr, g_addrType);
  if (!g_client->connect(addr)) {
    setStatus("Verbinden fehlgeschlagen");
    return false;
  }
  NimBLERemoteService* svc = g_client->getService(NimBLEUUID(SERVICE_STR));
  NimBLERemoteCharacteristic* chr = svc ? svc->getCharacteristic(NimBLEUUID(DATA_STR)) : nullptr;
  if (!chr || !chr->canNotify() || !chr->subscribe(true, onNotify)) {
    setStatus("Daten-Characteristic nicht nutzbar");
    g_client->disconnect();
    return false;
  }
  g_lastPacketMs = millis();
  setStatus("Grill verbunden");
  return true;
}

static void bleTask(void*) {
  NimBLEDevice::init("");
  for (;;) {
    if (g_client && g_client->isConnected()) {
      if (millis() - g_lastPacketMs > NO_DATA_TIMEOUT_MS) {
        setStatus("Keine Daten, trenne");
        g_client->disconnect();
      }
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }
    setStatus("Suche Grill ...");
    if (!scanForGrill()) {
      vTaskDelay(pdMS_TO_TICKS(2000));
      continue;
    }
    if (!connectGrill()) vTaskDelay(pdMS_TO_TICKS(3000));
  }
}

// ---------- WebSocket ----------
static size_t buildFrame(uint8_t* out, uint8_t type, const uint8_t* payload, size_t len) {
  out[0] = type;
  out[1] = 0x00;
  memcpy(out + 2, payload, len);
  return len + 2;
}

static void sendStatusTo(int num /* -1 = alle */) {
  uint8_t buf[sizeof(g_status) + 2];
  char text[sizeof(g_status)];
  taskENTER_CRITICAL(&mux);
  memcpy(text, g_status, sizeof(text));
  taskEXIT_CRITICAL(&mux);
  size_t n = buildFrame(buf, FRAME_STATUS, (const uint8_t*)text, strlen(text));
  if (num < 0) ws.broadcastBIN(buf, n);
  else ws.sendBIN(num, buf, n);
}

static void wsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t) {
  if (type != WStype_CONNECTED) return;  // Eingehende Daten bewusst ignoriert (read-only)
  if (strlen(WS_TOKEN) > 0) {
    String needle = String("token=") + WS_TOKEN;
    if (!strstr((const char*)payload, needle.c_str())) {
      ws.disconnect(num);
      return;
    }
  }
  sendStatusTo(num);
  if (g_lastFrameLen > 0) {
    uint8_t buf[sizeof(g_lastFrame)];
    memcpy(buf, g_lastFrame, g_lastFrameLen);
    ws.sendBIN(num, buf, g_lastFrameLen);
  }
}

// ---------- Arduino ----------
void setup() {
  Serial.begin(115200);
  Serial.println("\nG32-Bridge startet");

  if (!LittleFS.begin(true)) Serial.println("LittleFS konnte nicht gemountet werden");

  WiFi.mode(WIFI_STA);
  WiFi.setHostname(HOSTNAME);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  server.on("/", HTTP_GET, []() {
    File f = LittleFS.open("/index.html", "r");
    if (!f) {
      server.send(500, "text/plain", "index.html fehlt: pio run -t uploadfs");
      return;
    }
    server.sendHeader("Cache-Control", "no-cache");
    server.streamFile(f, "text/html");
    f.close();
  });
  server.serveStatic("/", LittleFS, "/", "no-cache");
  server.onNotFound([]() { server.send(404, "text/plain", "Nicht gefunden"); });
  server.begin();

  ws.begin();
  ws.onEvent(wsEvent);

  xTaskCreate(bleTask, "ble", 8192, nullptr, 1, nullptr);
}

void loop() {
  server.handleClient();
  ws.loop();

  static bool mdnsStarted = false;
  if (!mdnsStarted && WiFi.status() == WL_CONNECTED) {
    Serial.printf("WLAN verbunden, IP %s\n", WiFi.localIP().toString().c_str());
    if (MDNS.begin(HOSTNAME)) {
      MDNS.addService("http", "tcp", 80);
      Serial.printf("Erreichbar unter http://%s.local\n", HOSTNAME);
    }
    mdnsStarted = true;
  }

  uint8_t pkt[sizeof(g_pkt)];
  size_t len = 0;
  bool havePkt = false, haveStatus = false;
  taskENTER_CRITICAL(&mux);
  if (g_newPkt) {
    len = g_len;
    memcpy(pkt, g_pkt, len);
    g_newPkt = false;
    havePkt = true;
  }
  if (g_newStatus) {
    g_newStatus = false;
    haveStatus = true;
  }
  taskEXIT_CRITICAL(&mux);

  if (haveStatus) sendStatusTo(-1);
  if (havePkt) {
    g_lastFrameLen = buildFrame(g_lastFrame, FRAME_NOTIFY, pkt, len);
    uint8_t buf[sizeof(g_lastFrame)];
    memcpy(buf, g_lastFrame, g_lastFrameLen);
    ws.broadcastBIN(buf, g_lastFrameLen);
  }
  delay(2);
}
