const axios = require("axios");
require("dotenv").config();

async function testAcoustID(keyName, keyValue) {
  if (!keyValue) {
    console.log(`${keyName} is missing`);
    return;
  }
  const dummyFingerprint = "AQAAAA"; 
  const duration = 120;
  const url = `https://api.acoustid.org/v2/lookup?client=${keyValue}&fingerprint=${dummyFingerprint}&duration=${duration}`;
  
  try {
    const res = await axios.get(url);
    console.log(`${keyName} (${keyValue}) WORKS! Response:`, res.data);
  } catch (err) {
    console.log(`${keyName} (${keyValue}) FAILED:`, err.response ? err.response.data : err.message);
  }
}

async function run() {
  await testAcoustID("ACOUSTID_KEY", process.env.ACOUSTID_KEY);
  await testAcoustID("ACOUSTID_API_KEY", process.env.ACOUSTID_API_KEY);
}

run();
