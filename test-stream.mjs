import { Innertube } from 'youtubei.js';

const yt = await Innertube.create({ cache: undefined });
const info = await yt.getInfo('6X7p3O2rO38');
const fmt = info.chooseFormat({ type: 'audio', quality: 'best' });
console.log("Format found:", fmt?.mime_type);
console.log("URL (first 80 chars):", fmt?.url?.substring(0, 80));
