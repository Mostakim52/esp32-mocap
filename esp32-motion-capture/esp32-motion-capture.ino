#include <Wire.h>

// MPU6050 I2C address
const int MPU6050_ADDR = 0x68;

// I2C pins for Arduino Nano (A4 = SDA, A5 = SCL)
const int SDA_PIN = A4;
const int SCL_PIN = A5;

// Sensor variables
int16_t accelX, accelY, accelZ;
int16_t gyroX, gyroY, gyroZ;

// Kalman filter variables
float accelX_filtered = 0, accelY_filtered = 0, accelZ_filtered = 0;
float gyroX_filtered = 0, gyroY_filtered = 0, gyroZ_filtered = 0;
const float KALMAN_GAIN = 0.1;

// Timing
unsigned long lastTime = 0;
const int SAMPLE_RATE = 50; // ms between samples (20Hz)

void setup() {
  Serial.begin(115200);
  
  // Initialize I2C (Arduino Nano uses default pins A4=SDA, A5=SCL)
  Wire.begin();
  Wire.setClock(400000);
  
  // Initialize MPU6050
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x6B);  // PWR_MGMT_1 register
  Wire.write(0);     // Set to 0 to wake up MPU6050
  Wire.endTransmission(true);
  
  // Configure accelerometer (+-2g)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x1C);  // ACCEL_CONFIG register
  Wire.write(0x00);  // +-2g
  Wire.endTransmission(true);
  
  // Configure gyroscope (+-250deg/s)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x1B);  // GYRO_CONFIG register
  Wire.write(0x00);  // +-250deg/s
  Wire.endTransmission(true);
  
  lastTime = millis();
}

void readMPU6050Data() {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B);  // ACCEL_XOUT_H register
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_ADDR, 14, true);
  
  accelX = (Wire.read() << 8 | Wire.read());
  accelY = (Wire.read() << 8 | Wire.read());
  accelZ = (Wire.read() << 8 | Wire.read());
  
  // Skip temperature
  Wire.read();
  Wire.read();
  
  gyroX = (Wire.read() << 8 | Wire.read());
  gyroY = (Wire.read() << 8 | Wire.read());
  gyroZ = (Wire.read() << 8 | Wire.read());
}

void loop() {
  unsigned long currentTime = millis();
  
  if (currentTime - lastTime >= SAMPLE_RATE) {
    lastTime = currentTime;
    
    // Read accelerometer and gyroscope data
    readMPU6050Data();
    
    // Convert to appropriate units
    float ax = accelX / 16384.0; // g-force
    float ay = accelY / 16384.0;
    float az = accelZ / 16384.0;
    float gx = gyroX / 131.0; // deg/s
    float gy = gyroY / 131.0;
    float gz = gyroZ / 131.0;
    
    // Apply Kalman filter for smoother data
    accelX_filtered = accelX_filtered + KALMAN_GAIN * (ax - accelX_filtered);
    accelY_filtered = accelY_filtered + KALMAN_GAIN * (ay - accelY_filtered);
    accelZ_filtered = accelZ_filtered + KALMAN_GAIN * (az - accelZ_filtered);
    gyroX_filtered = gyroX_filtered + KALMAN_GAIN * (gx - gyroX_filtered);
    gyroY_filtered = gyroY_filtered + KALMAN_GAIN * (gy - gyroY_filtered);
    gyroZ_filtered = gyroZ_filtered + KALMAN_GAIN * (gz - gyroZ_filtered);
    
    // Send raw x, y, z data as JSON for the website to parse
    Serial.print("{\"ax\":");
    Serial.print(accelX_filtered, 6);
    Serial.print(",\"ay\":");
    Serial.print(accelY_filtered, 6);
    Serial.print(",\"az\":");
    Serial.print(accelZ_filtered, 6);
    Serial.print(",\"gx\":");
    Serial.print(gyroX_filtered, 6);
    Serial.print(",\"gy\":");
    Serial.print(gyroY_filtered, 6);
    Serial.print(",\"gz\":");
    Serial.print(gyroZ_filtered, 6);
    Serial.println("}");
  }
}