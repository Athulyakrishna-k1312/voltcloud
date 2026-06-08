const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json"))
});

const db = admin.firestore();

console.log("\n" + "=".repeat(60));
console.log("        MONTHLY ENERGY AGGREGATION SERVICE");
console.log("=".repeat(60) + "\n");

// Get first day of current month
const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

// Get first day of next month
const getNextMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
};

// Discover devices
const discoverDevices = async () => {
  const snapshot = await db.collection("energy_data").get();
  return snapshot.docs.map(doc => doc.id);
};

// Discover pins
const discoverPins = async (deviceId) => {
  const snapshot = await db
    .collection("energy_data")
    .doc(deviceId)
    .collection("aggregates_daily")
    .get();

  return snapshot.docs.map(doc => doc.id);
};

const runMonthlyAggregation = async () => {

  console.log("🔄 Running Monthly Aggregation...\n");

  const monthStart = getMonthStart();
  const nextMonthStart = getNextMonthStart();

  console.log(`📅 Aggregating for: ${monthStart.toLocaleString('default', { month: 'long' })} ${monthStart.getFullYear()}\n`);

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

      await db
        .collection("energy_data")
        .doc(deviceId)
        .collection("aggregates_monthly")
        .doc(pinId)
        .collection("data")
        .add(monthlyData);

      console.log("      ✅ Monthly stored");
      totalProcessed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Monthly aggregation complete. Processed: ${totalProcessed} pins`);
  console.log("=".repeat(60));

  process.exit(0);
};

runMonthlyAggregation();