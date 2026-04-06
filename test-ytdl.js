const ytdl = require("@distube/ytdl-core");

async function test() {
  try {
    const info = await ytdl.getInfo("dQw4w9WgXcQ");
    const audioFormats = ytdl.filterFormats(info.formats, "audioonly");
    console.log("Found formats:", audioFormats.map(f => f.url).slice(0, 1));
  } catch (err) {
    console.error(err);
  }
}
test();
