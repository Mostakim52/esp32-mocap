#include <Wire.h>

// MPU6050 I2C address
const int MPU6050_ADDR = 0x68;

// HARDWARE ASSIGNMENT: ESP32-C3 SuperMini Hardware I2C Pins
const int SDA_PIN = 8;
const int SCL_PIN = 9;

// UART pins for Serial1 (hardware debug output)
const int UART_TX_PIN = 21; // GPIO21 TX
const int UART_RX_PIN = 20; // GPIO20 RX

// Sensor variables
int16_t accelX, accelY, accelZ;
int16_t gyroX, gyroY, gyroZ;

// Exponential Moving Average filter (Simple low-pass Kalman style approximation)
float accelX_filtered = 0, accelY_filtered = 0, accelZ_filtered = 0;
float gyroX_filtered = 0, gyroY_filtered = 0, gyroZ_filtered = 0;
const float KALMAN_GAIN = 0.1;

// Timing
unsigned long lastTime = 0;
const int SAMPLE_RATE = 16; // ~60Hz

// MPU6050 WHO_AM_I register value
const uint8_t MPU6050_WHO_AM_I = 0x75;

void debugPrint(const String &msg) {
  Serial.println(msg);   // USB CDC
  Serial1.println(msg);  // UART
}

void scanI2C() {
  debugPrint("[SCAN] Scanning I2C bus...");
  uint8_t found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      debugPrint("[SCAN] Found device at 0x" + String(addr, HEX));
      found++;
    }
  }
  if (found == 0) {
    debugPrint("[SCAN] No I2C devices found! Check SDA/SCL wiring.");
  } else {
    debugPrint("[SCAN] " + String(found) + " device(s) found.");
  }
}

bool checkMPU6050() {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_WHO_AM_I);
  if (Wire.endTransmission(false) != 0) {
    debugPrint("[ERR] MPU6050 not responding at address 0x68");
    return false;
  }
  Wire.requestFrom((uint8_t)MPU6050_ADDR, (uint8_t)1, (uint8_t)true);
  if (Wire.available()) {
    uint8_t reg = Wire.read();
    debugPrint("[OK] MPU6050 WHO_AM_I = 0x" + String(reg, HEX) + " (expected 0x68)");
    return (reg == 0x68);
  }
  debugPrint("[ERR] MPU6050 WHO_AM_I read failed");
  return false;
}

void setup() {
  Serial.begin(115200);   // USB CDC (native)
  Serial1.begin(115200, SERIAL_8N1, UART_RX_PIN, UART_TX_PIN); // UART

  while (!Serial) {
    delay(10);
  }

  debugPrint("");
  debugPrint("=== ESP32-C3 SuperMini MPU6050 ===");
  debugPrint("[INIT] SDA=GPIO" + String(SDA_PIN) + " SCL=GPIO" + String(SCL_PIN));

  // Init I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);
  delay(100);

  // Scan bus
  scanI2C();

  // Verify MPU6050 presence
  if (!checkMPU6050()) {
    debugPrint("[FATAL] MPU6050 not detected! Halting.");
    while (1) {
      delay(1000);
    }
  }

  // Wake up MPU6050
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);

  // Configure accelerometer (+-2g)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x1C);
  Wire.write(0x00);
  Wire.endTransmission(true);

  // Configure gyroscope (+-250deg/s)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x1B);
  Wire.write(0x00);
  Wire.endTransmission(true);

  debugPrint("[INIT] MPU6050 configured. Streaming data...");
  lastTime = millis();
}

bool readMPU6050Data() {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }
  if (Wire.requestFrom((uint8_t)MPU6050_ADDR, (uint8_t)14, (uint8_t)true) != 14) {
    return false;
  }

  accelX = (Wire.read() << 8 | Wire.read());
  accelY = (Wire.read() << 8 | Wire.read());
  accelZ = (Wire.read() << 8 | Wire.read());
  Wire.read(); Wire.read(); // skip temperature
  gyroX = (Wire.read() << 8 | Wire.read());
  gyroY = (Wire.read() << 8 | Wire.read());
  gyroZ = (Wire.read() << 8 | Wire.read());
  return true;
}

void sendJson(float ax, float ay, float az, float gx, float gy, float gz) {
  String json = "{\"ax\":" + String(ax, 6) +
                ",\"ay\":" + String(ay, 6) +
                ",\"az\":" + String(az, 6) +
                ",\"gx\":" + String(gx, 6) +
                ",\"gy\":" + String(gy, 6) +
                ",\"gz\":" + String(gz, 6) + "}";
  Serial.println(json);   // USB CDC to web UI
  Serial1.println(json);  // UART to serial monitor
}

void loop() {
  unsigned long currentTime = millis();
  
  if (currentTime - lastTime >= SAMPLE_RATE) {
    lastTime = currentTime;
    
    if (!readMPU6050Data()) {
      debugPrint("[ERR] I2C read failed, skipping cycle");
      return;
    }
    
    float ax = accelX / 16384.0;
    float ay = accelY / 16384.0;
    float az = accelZ / 16384.0;
    float gx = gyroX / 131.0;
    float gy = gyroY / 131.0;
    float gz = gyroZ / 131.0;
    
    accelX_filtered += KALMAN_GAIN * (ax - accelX_filtered);
    accelY_filtered += KALMAN_GAIN * (ay - accelY_filtered);
    accelZ_filtered += KALMAN_GAIN * (az - accelZ_filtered);
    gyroX_filtered += KALMAN_GAIN * (gx - gyroX_filtered);
    gyroY_filtered += KALMAN_GAIN * (gy - gyroY_filtered);
    gyroZ_filtered += KALMAN_GAIN * (gz - gyroZ_filtered);
    
    sendJson(accelX_filtered, accelY_filtered, accelZ_filtered,
             gyroX_filtered, gyroY_filtered, gyroZ_filtered);
  }
}