// The base token path
const TOKEN_PATH = "modules/caeora-maps-tokens-assets/assets/tokens/";

// Store a reference to a special location of the token path (e.g. a Forge Assets Library)
let tokenPathLocation = "";

// A cached list of available tokens
let availableTokens = new Set();

// A cached list of available remote tokens to reduce network requests
let availableRemoteTokens = new Map();

// Store a reference to whether artwork is being replaced
let replaceArtwork = false;

/**
 * Initialize the Caeora module on Foundry VTT init
 */
function initialize() {

	// Only support the dnd5e system for this functionality
	if ( game.system.id !== "dnd5e" ) return;

	// Register token replacement setting
	game.settings.register("caeora-maps-tokens-assets", "replaceArtwork", {
		name: "Auto-Replace Actor Artwork",
		hint: "Automatically replace the portrait and token artwork for a NPC Actor when that actor is imported into the game world.",
		scope: "world",
		config: true,
		type: Boolean,
		default: false,
		onChange: replace => replaceArtwork = replace
	});

	// Register token replacement setting
	game.settings.register("caeora-maps-tokens-assets", "tokenPathLocation", {
		name: "Location of the module",
		hint: "If you store the module in a location other than User Data (for example in a Forge Assets Library), you need to specify that location here. Example: https://assets.forge-vtt.com/1234567890abcdefghijklmn/",
		scope: "world",
		config: true,
		type: String,
		default: "",
		onChange: setTokenPath,
	});

	// Assign the current saved values if there are any
	replaceArtwork = game.settings.get("caeora-maps-tokens-assets", "replaceArtwork") ?? false;
	setTokenPath(game.settings.get("caeora-maps-tokens-assets", "tokenPathLocation") ?? "");

	// Handle actor replacement, if the setting is enabled
	Hooks.on("preCreateActor", replaceActorArtwork);
}

function setTokenPath(location) {
	tokenPathLocation = location ?? "";

	// Make sure to cache available local tokens if switching back to "local mode"
	if (!tokenPathLocation) {
		cacheAvailableTokens();
	}
}

/**
 * Cache the set of available tokens which can be used to replace artwork to avoid repeated filesystem requests.
 * Will not be used if tokens are stored remotely.
 */
async function cacheAvailableTokens() {
	availableTokens.clear();
	const crs = await FilePicker.browse("data", TOKEN_PATH);
	for ( let cr of crs.dirs ) {
		try {
			const tokens = await FilePicker.browse("data", cr+"/with-shadows/");
			tokens.files.forEach(t => availableTokens.add(t));
		} catch {}
	}
}

/**
 * Verifies the given token does exist in the expected location
 * @param {String} src The token source
 */
function sourceExists(src) {
	// If the tokens are stored locally, we only need to check available tokens
	if ( !tokenPathLocation) {
		return availableTokens.has(src);
	}

	// If the tokens are stored remotely, we first check our cache
	if (availableRemoteTokens.has(src)) {
		return availableRemoteTokens.get(src)
	}

	try {
		const request = new XMLHttpRequest();
		request.open("HEAD", src, false);
		request.send();

		// Check if the token exists at the expected location
		const exists = request.status === 200;
		// Cache the result
		availableRemoteTokens.set(src, exists)

		return exists
	} catch {
		// In case of any errors, we assume the token does not exist but don't cache the result
		return false;
	}
}

/**
 * Replace the artwork for a NPC actor with the version from this module
 */
async function replaceActorArtwork(actor, data, options, userId) {
	if ( !replaceArtwork || (actor.type !== "npc") || !hasProperty(actor, "system.details.cr") ) return;

	const cleanName = actor.name.replace(/ /g, "");
	const crDir = String(getProperty(actor, "system.details.cr")).replace(".", "-");
	const tokenRootPath = tokenPathLocation
		? `${tokenPathLocation.replace(/^(.*?)\/$/, "$1")}/${TOKEN_PATH}`
		: TOKEN_PATH;
	const tokenSrc = `${tokenRootPath}cr${crDir}/with-shadows/${cleanName}.png`;

	if (!sourceExists(tokenSrc)) return;

	actor.updateSource({"img": tokenSrc, "prototypeToken.texture.src": tokenSrc});
}

// Initialize module
Hooks.on("init", initialize);
