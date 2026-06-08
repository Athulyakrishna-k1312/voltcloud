const admin = require("firebase-admin");
const express = require("express");
const cron = require("node-cron");

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
});

const db = admin.firestore();
const app = express();
app.use(express.json());

let liveAggregation = {};

// Align to 15-min window
const getAligned15Min = (date = new Date()) => {
  const d = new Date(date);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - (d.getMinutes() % 15));
  return d;
};

// Receive 1-sec ESP data
app.post("/send-data", (req, res) => {
  const { esp_id, pin_number, power = 0, voltage = 0, current = 0, energy = 0 } = req.body;

  if (!esp_id || !pin_number) {
    console.log("❌ Missing esp_id or pin_number");
    return res.status(400).json({ error: "Missing esp_id or pin_number" });
  }

  const windowKey = getAligned15Min().toISOString();

  // Initialize nested objects safely
  if (!liveAggregation[esp_id]) {
    liveAggregation[esp_id] = {};
  }
  if (!liveAggregation[esp_id][pin_number]) {
    liveAggregation[esp_id][pin_number] = {};
  }
  if (!liveAggregation[esp_id][pin_number][windowKey]) {
    liveAggregation[esp_id][pin_number][windowKey] = {
      totalPower: 0,
      totalVoltage: 0,
      totalCurrent: 0,
      totalEnergy: 0,
      count: 0,
    };
  }

  const g = liveAggregation[esp_id][pin_number][windowKey];

  g.totalPower += +power;
  g.totalVoltage += +voltage;
  g.totalCurrent += +current;
  g.totalEnergy += +energy;
  g.count++;

  console.log(`[${new Date().toLocaleTimeString()}] 📥 ${esp_id}/${pin_number} | P:${power}W | V:${voltage}V | Samples:${g.count}`);

  res.json({ message: "Data accumulated", samples: g.count });
});

// Debug endpoint - check current memory state
app.get("/debug-memory", (req, res) => {
  res.json({
    liveAggregation,
    currentWindow: getAligned15Min().toISOString()
  });
});

// Store completed 15-min window
cron.schedule("*/1 * * * *", async () => {
  const now = new Date();
  const currentWindow = getAligned15Min(now);
  const previousKey = new Date(currentWindow - 15 * 60000).toISOString();

  console.log(`\n⏰ [${now.toLocaleTimeString()}] Cron Job Running`);
  console.log(`Current Window: ${currentWindow.toISOString()}`);
  console.log(`Previous Window: ${previousKey}`);

  let storedCount = 0;
  let emptyCount = 0;

  for (const [espId, pins] of Object.entries(liveAggregation)) {
    for (const [pin, windows] of Object.entries(pins)) {

      const data = windows[previousKey];
      
      if (!data || !data.count) {
        emptyCount++;
        console.log(`⚠️ No data for ${espId}/${pin} in window ${previousKey}`);
        continue;
      }

      try {
        console.log(`\n✅ Storing data for ${espId}/${pin}:`);
        console.log(`   Samples: ${data.count}`);
        console.log(`   Avg Power: ${(data.totalPower / data.count).toFixed(2)}W`);
        console.log(`   Avg Voltage: ${(data.totalVoltage / data.count).toFixed(2)}V`);
        console.log(`   Total Energy: ${data.totalEnergy.toFixed(4)} kWh`);

        // 🔹 STEP 0: Ensure device document exists
        await db
            .collection("energy_data")
            .doc(espId)
            .set(
            {
                device_id: espId,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                status: "active"
            },
            { merge: true }
            );

        // 🔹 STEP 1: Ensure pin document exists
        await db
            .collection("energy_data")
            .doc(espId)
            .collection("aggregates_15min")
            .doc(pin)
            .set(
            {
                pin_id: pin,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                status: "active"
            },
            { merge: true }
            );

        // 🔹 STEP 2: Store 15-min aggregated data
        await db
            .collection("energy_data")
            .doc(espId)
            .collection("aggregates_15min")
            .doc(pin)
            .collection("data")
            .add({
            avg_power: data.totalPower / data.count,
            avg_voltage: data.totalVoltage / data.count,
            avg_current: data.totalCurrent / data.count,
            total_energy: data.totalEnergy,   // 🔥 FIXED TYPO HERE
            sample_count: data.count,
            window_start: new Date(previousKey),
            window_end: currentWindow,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            });

        // Delete from memory
        delete windows[previousKey];
        storedCount++;
        console.log(`   ✅ Successfully stored to Firestore!`);

      } catch (error) {
        console.log(`   ❌ Firestore Error: ${error.message}`);
      }
    }
  }

  console.log(`\n📊 Cron Summary:`);
  console.log(`   Stored: ${storedCount} documents`);
  console.log(`   Empty: ${emptyCount} windows`);
  console.log(`   Memory Keys: ${Object.keys(liveAggregation)}`);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "running",
    time: new Date().toISOString(),
    memoryKeys: Object.keys(liveAggregation)
  });
});

app.listen(5000, () => {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 IoT Energy Meter Server Started");
  console.log("=".repeat(50));
  console.log("Server running on http://localhost:5000");
  console.log("\nEndpoints:");
  console.log("  POST /send-data     - Send sensor data");
  console.log("  GET  /debug-memory  - Check memory state");
  console.log("  GET  /health        - Health check");
  console.log("\nData stored in Firestore:");
  console.log("  /energy_data/{esp_id}/aggregates_15min/{pin}/data");
  console.log("\n⚠️ NOTE: Data stored 1 minute after 15-min window ends");
  console.log("=".repeat(50) + "\n");
});
