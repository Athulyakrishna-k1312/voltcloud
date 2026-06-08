const http = require('http');

console.log("═══════════════════════════════════════════");
console.log("   ESP Device Simulator (Realistic Data)   ");
console.log("═══════════════════════════════════════════\n");

const ESP_CONFIG = {
  esp_ids: ['esp_001', 'esp_002'],
  pin_numbers: ['GPIO_5', 'GPIO_18', 'GPIO_4'],
  serverIP: 'localhost',
  serverPort: 5000
};

// Simulation state
let time = 0;
let basePower = 100;
let baseVoltage = 230;
let trend = 1; // Increasing or decreasing trend

const getSensorData = () => {
  time++;
  
  // Add time-based variations
  const hourOfDay = new Date().getHours();
  
  // Simulate daily usage pattern (higher during day, lower at night)
  let dailyFactor = 1;
  if (hourOfDay >= 6 && hourOfDay <= 9) dailyFactor = 1.3;    // Morning peak
  else if (hourOfDay >= 17 && hourOfDay <= 21) dailyFactor = 1.5; // Evening peak
  else if (hourOfDay >= 22 || hourOfDay <= 5) dailyFactor = 0.6;  // Night low
  
  // Change trend every 50 samples
  if (time % 50 === 0) {
    trend = Math.random() > 0.5 ? 1 : -1;
  }
  
  // Gradual power change (simulating load change)
  basePower += trend * (Math.random() * 3 - 1);
  basePower = Math.max(30, Math.min(250, basePower)); // Clamp between 30-250W
  
  // Voltage fluctuates around 230V with some noise
  const voltageNoise = (Math.random() - 0.5) * 10; // ±5V fluctuation
  const voltage = Math.round((230 + voltageNoise) * 10) / 10;
  
  // Current calculated from power/voltage
  const current = parseFloat((basePower / voltage).toFixed(3));
  
  // Energy accumulates (Wh per second)
  const energy = parseFloat((basePower / 3600).toFixed(4));
  
  // Power factor varies with load (0.7-0.95)
  const powerFactor = parseFloat((0.75 + Math.random() * 0.2).toFixed(3));
  
  // Frequency stays around 50Hz with small variations
  const frequency = parseFloat((50 + (Math.random() - 0.5) * 0.3).toFixed(2));
  
  // Apparent power = voltage × current
  const apparentPower = parseFloat((voltage * current).toFixed(2));
  
  // Reactive power = √(apparent² - real²)
  const realPower = parseFloat((apparentPower * powerFactor).toFixed(2));
  const reactivePower = parseFloat((Math.sqrt(Math.pow(apparentPower, 2) - Math.pow(realPower, 2))).toFixed(2));
  
  return {
  power: Math.round(basePower),
  voltage: voltage,
  current: current,
  energy: energy,
  frequency: frequency,
  power_factor: powerFactor,
  apparent_power: apparentPower,
  reactive_power: reactivePower
  };
};

let totalSamples = 0;
let totalPower = 0;
let startTime = Date.now();

const sendData = () => {

  ESP_CONFIG.esp_ids.forEach(esp => {
    ESP_CONFIG.pin_numbers.forEach(pin => {

      const data = {
        ...getSensorData(),
        esp_id: esp,
        pin_number: pin
      };

      const postData = JSON.stringify(data);

      const options = {
        hostname: ESP_CONFIG.serverIP,
        port: ESP_CONFIG.serverPort,
        path: '/send-data',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {

        res.on('data', () => {});

        res.on('end', () => {
          const timestamp = new Date().toLocaleTimeString();
          console.log(`[${timestamp}] ${esp} | ${pin} | ${data.power}W`);
        });

      });

      req.on('error', (error) => {
        console.error(`❌ ERROR: ${error.message}`);
      });

      req.write(postData);
      req.end();

    });
  });

};

// Start
console.log(`ESP Devices: ${ESP_CONFIG.esp_ids.join(", ")}`);
console.log(`Pins: ${ESP_CONFIG.pin_numbers.join(", ")}`);
console.log(`Server: http://${ESP_CONFIG.serverIP}:${ESP_CONFIG.serverPort}`);
console.log(`Sending realistic data every 1 second...\n`);
console.log("Sample | Power | Voltage | Current | Power Factor | Avg Power");
console.log("-".repeat(70));

// Send immediately then every second
sendData();
setInterval(sendData, 1000);