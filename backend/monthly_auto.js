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
console.log("   MONTHLY ENERGY AGGREGATION SERVICE (AUTO SCHEDULED)");
console.log("=".repeat(60) + "\n");

// =================================================
// DATE HELPERS
// =================================================
const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const getNextMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};

// =================================================
// DISCOVER DEVICES & PINS
// =================================================
const discoverDevices = async () => {
  const snapshot = await db.collection("energy_data").get();
  return snapshot.docs.map(doc => doc.id);
};

const discoverPins = async (deviceId) => {
  const snapshot = await db
    .collection("energy_data")
    .doc(deviceId)
    .collection("aggregates_daily")
    .get();

  return snapshot.docs.map(doc => doc.id);
};

// =================================================
// MONTHLY AGGREGATION
// =================================================
const runMonthlyAggregation = async () => {
  console.log("\n🔄 Running Monthly Aggregation...\n");

  const monthStart = getMonthStart();
  const nextMonthStart = getNextMonthStart();

  console.log(`📅 Aggregating for: ${monthStart.toLocaleString('default', { month: 'long' })} ${monthStart.getFullYear()}\n`);

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
        .collection("aggregates_daily")
        .doc(pinId)
        .collection("data")
        .where("date", ">=", monthStart)
        .where("date", "<", nextMonthStart)
        .get();

      if (dataSnapshot.empty) {
        console.log("      ⚠ No daily data for this month");
        continue;
      }

      let totalPower = 0, totalVoltage = 0, totalCurrent = 0;
      let totalEnergy = 0, totalSamples = 0;

      dataSnapshot.forEach(doc => {
        const d = doc.data();
        totalPower += d.daily_avg_power || 0;
        totalVoltage += d.daily_avg_voltage || 0;
        totalCurrent += d.daily_avg_current || 0;
        totalEnergy += d.daily_total_energy || 0;
        totalSamples += d.total_samples || 0;
      });

      const count = dataSnapshot.size;

      const monthlyData = {
        month: monthStart,
        monthly_avg_power: totalPower / count,
        monthly_avg_voltage: totalVoltage / count,
        monthly_avg_current: totalCurrent / count,
        monthly_total_energy: totalEnergy,
        total_samples: totalSamples,
        day_count: count,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      };

      // Use set() with merge to avoid duplicate docs
      await db
        .collection("energy_data")
        .doc(deviceId)
        .collection("aggregates_monthly")
        .doc(pinId)
        .collection("data")
        .doc(monthStart.getFullYear() + "-" + (monthStart.getMonth() + 1))
        .set(monthlyData, { merge: true });

      console.log("      ✅ Monthly stored");
      totalProcessed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Monthly aggregation complete. Processed: ${totalProcessed} pins`);
  console.log("=".repeat(60));
};

// =================================================
// CRON SCHEDULER
// =================================================
// Runs daily at 23:59 and checks if it's the last day of the month
cron.schedule('59 23 * * *', async () => {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  if (today.getDate() === lastDay) {
    console.log("\n📌 Last day of the month detected. Starting aggregation...");
    await runMonthlyAggregation();
  }
});

