const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json"))
});

const db = admin.firestore();

console.log("\n" + "=".repeat(60));
console.log("        DAILY ENERGY AGGREGATION SERVICE");
console.log("=".repeat(60) + "\n");

// Get today's start (00:00:00)
const getTodayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Get tomorrow start (for range query)
const getTomorrowStart = () => {
  const today = getTodayStart();
  return new Date(today.getTime() + 24 * 60 * 60 * 1000);
};

// Discover devices automatically
const discoverDevices = async () => {
  const snapshot = await db.collection("energy_data").get();
  return snapshot.docs.map(doc => doc.id);
};

// Discover pins automatically
const discoverPins = async (deviceId) => {
  const snapshot = await db
    .collection("energy_data")
    .doc(deviceId)
    .collection("aggregates_15min")
    .get();

  return snapshot.docs.map(doc => doc.id);
};

const runDailyAggregation = async () => {
  console.log("🔄 Running Daily Aggregation...\n");

  const todayStart = getTodayStart();
  const tomorrowStart = getTomorrowStart();

  console.log(`📅 Aggregating for: ${todayStart.toDateString()}\n`);

  const devices = await discoverDevices();

  if (devices.length === 0) {
    console.log("❌ No devices found!");
    process.exit(0);
  }

  let totalProcessed = 0;

  for (const deviceId of devices) {
    console.log(`📱 Device: ${deviceId}`);

    const pins = await discoverPins(deviceId);

    for (const pinId of pins) {
      console.log(`   📌 Pin: ${pinId}`);

      const dataSnapshot = await db
        .collection("energy_data")
        .doc(deviceId)
        .collection("aggregates_15min")
        .doc(pinId)
        .collection("data")
        .where("created_at", ">=", todayStart)
        .where("created_at", "<", tomorrowStart)
        .get();

      if (dataSnapshot.empty) {
        console.log("      ⚠ No data for today");
        continue;
      }

      let totalPower = 0, totalVoltage = 0, totalCurrent = 0;
      let totalEnergy = 0, totalSamples = 0;

      dataSnapshot.forEach(doc => {
        const d = doc.data();
        totalPower += d.avg_power || 0;
        totalVoltage += d.avg_voltage || 0;
        totalCurrent += d.avg_current || 0;
        totalEnergy += d.total_energy || 0;
        totalSamples += d.sample_count || 0;
      });

      const count = dataSnapshot.size;

      const dailyData = {
        date: todayStart,
        daily_avg_power: totalPower / count,
        daily_avg_voltage: totalVoltage / count,
        daily_avg_current: totalCurrent / count,
        daily_total_energy: totalEnergy,
        total_samples: totalSamples,
        window_count: count,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      };
      // 🔹 Ensure daily pin document exists
      await db
        .collection("energy_data")
        .doc(deviceId)
        .collection("aggregates_daily")
        .doc(pinId)
        .set(
          {
            pin_id: pinId,
            device_id: deviceId,
            status: "active",
            created_at: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      await db
        .collection("energy_data")
        .doc(deviceId)
        .collection("aggregates_daily")
        .doc(pinId)
        .collection("data")
        .add(dailyData);

      console.log("      ✅ Daily stored");
      totalProcessed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Daily aggregation complete. Processed: ${totalProcessed} pins`);
  console.log("=".repeat(60));

  process.exit(0);
};

runDailyAggregation();