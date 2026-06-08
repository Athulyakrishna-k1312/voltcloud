// =================================================
// IMPORTS
// =================================================
const admin = require("firebase-admin");
const cron = require("node-cron");

// =================================================
// FIREBASE SETUP
// =================================================
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json"))
});

const db = admin.firestore();

console.log("\n" + "=".repeat(60));
console.log("        DAILY ENERGY AGGREGATION SERVICE");
console.log("=".repeat(60) + "\n");

// =================================================
// DATE HELPERS (YESTERDAY RANGE)
// =================================================
const getYesterdayStart = () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  todayStart.setDate(todayStart.getDate() - 1);
  return todayStart;
};

const getTodayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// =================================================
// DISCOVER DEVICES
// =================================================
const discoverDevices = async () => {
  const snapshot = await db.collection("energy_data").get();
  return snapshot.docs.map(doc => doc.id);
};

const discoverPins = async (deviceId) => {
  const snapshot = await db
    .collection("energy_data")
    .doc(deviceId)
    .collection("aggregates_15min")
    .get();

  return snapshot.docs.map(doc => doc.id);
};

// =================================================
// DAILY AGGREGATION
// =================================================
const runDailyAggregation = async () => {
  try {
    console.log("🔄 Running Daily Aggregation...\n");

    const yesterdayStart = getYesterdayStart();
    const todayStart = getTodayStart();

    console.log(`📅 Aggregating for: ${yesterdayStart.toDateString()}\n`);

    const devices = await discoverDevices();

    if (devices.length === 0) {
      console.log("❌ No devices found!");
      return;
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
          .where("window_start", ">=", yesterdayStart)
          .where("window_start", "<", todayStart)
          .get();

        if (dataSnapshot.empty) {
          console.log("      ⚠ No data for yesterday");
          continue;
        }

        let totalPower = 0,
            totalVoltage = 0,
            totalCurrent = 0,
            totalEnergy = 0,
            totalSamples = 0;

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
          date: yesterdayStart,
          daily_avg_power: totalPower / count,
          daily_avg_voltage: totalVoltage / count,
          daily_avg_current: totalCurrent / count,
          daily_total_energy: totalEnergy,
          total_samples: totalSamples,
          window_count: count,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        // Store Daily
        await db
          .collection("energy_data")
          .doc(deviceId)
          .collection("aggregates_daily")
          .doc(pinId)
          .collection("data")
          .add(dailyData);

        console.log("      ✅ Daily stored");

        // DELETE 15-min data used
        const batch = db.batch();
        dataSnapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();

        console.log("      🗑 15-min documents deleted");

        totalProcessed++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`✅ Daily aggregation complete. Processed: ${totalProcessed} pins`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Daily Aggregation Error:", error);
  }
};

// =================================================
// SCHEDULE AT 12:00 AM DAILY
// =================================================
cron.schedule("0 0 * * *", async () => {
  console.log("⏰ Midnight reached. Starting daily aggregation...");
  await runDailyAggregation();
});

console.log("🕛 Scheduler Started. Waiting for 12:00 AM...");