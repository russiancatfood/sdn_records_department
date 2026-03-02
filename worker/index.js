import { stats_to_hash_map } from '../gvas_parser/permalink_map.js';

const reverseMap = Object.fromEntries(
    Object.entries(stats_to_hash_map).map(([full, short]) => [short, full])
);

function decodeStats(encoded) {
    let decoded;
    try { decoded = atob(encoded); } catch { return null; }

    const stats = {};
    for (const pair of decoded.split('|')) {
        const colon = pair.indexOf(':');
        if (colon === -1) continue;
        const shortCode = pair.slice(0, colon);
        const value     = pair.slice(colon + 1);
        const fullName  = reverseMap[shortCode];
        if (fullName != null) stats[fullName] = Number(value);
    }
    return Object.keys(stats).length ? stats : null;
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function relationshipStatus(stats) {
    const bb   = stats['BV_104 Kissed Blazer'] && !stats['BV_BackedOutBlazer'];
    const visi = (stats['NV_SweetExitCounter'] >= 10) && stats['BV_Leaned In'];
    if (bb && visi) return 'Under HR Review';
    if (bb)         return 'Blonde Blazer (Mandy)';
    if (visi)       return 'Invisigal (Courtney)';
    return 'None';
}

function buildDescription(stats) {
    const parts = [];

    const hero = stats['NV_Robert Hero'];
    const anti = stats['NV_Robert Antihero'];
    if (hero != null || anti != null)
        parts.push(`Hero ${hero ?? '—'} / Antihero ${anti ?? '—'}`);

    const mentor = stats['NV_RobertMentorCounter'];
    if (mentor != null) parts.push(`Mentored ${mentor}\u00d7`);

    const waterboy = stats['BV_Chose Waterboy'];
    if (waterboy != null) parts.push(waterboy ? 'Hired Waterboy' : 'Hired Phenomaman');

    const sonar = stats['BV_Cut Sonar'];
    if (sonar != null) {
        let term = sonar ? 'Terminated Sonar' : 'Terminated Coupé';
        if (stats["BV_She's gone"]) term += ', Invisigal';
        parts.push(term);
    }

    const rel = relationshipStatus(stats);
    if (rel !== 'None') parts.push(`Relationship: ${rel}`);

    return parts.join(' · ') || 'SDN Personnel file';
}

export default {
    async fetch(request) {
        const url     = new URL(request.url);
        const encoded = url.searchParams.get('s');

        if (!encoded) return fetch(request);

        const stats = decodeStats(encoded);
        if (!stats) return fetch(request);

        const origin = await fetch(request);
        if (!origin.headers.get('content-type')?.includes('text/html')) return origin;

        const html  = await origin.text();
        const title = esc('R. Robertson III — SDN Records Department');
        const desc  = esc(buildDescription(stats));
        const href  = esc(url.toString());
        const img   = esc(`${url.origin}/assets/img/rob.jpg`);

        const tags = [
            `<meta property="og:type"        content="website">`,
            `<meta property="og:url"         content="${href}">`,
            `<meta property="og:title"       content="${title}">`,
            `<meta property="og:description" content="${desc}">`,
            `<meta property="og:image"       content="${img}">`,
            `<meta name="twitter:card"        content="summary">`,
            `<meta name="twitter:title"       content="${title}">`,
            `<meta name="twitter:description" content="${desc}">`,
            `<meta name="twitter:image"       content="${img}">`,
        ].join('\n    ');

        const modified = html.replace('</head>', `    ${tags}\n</head>`);

        return new Response(modified, {
            status:  origin.status,
            headers: {
                ...Object.fromEntries(origin.headers),
                'content-type': 'text/html;charset=UTF-8',
            },
        });
    },
};
