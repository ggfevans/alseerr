#!/usr/bin/env osascript -l JavaScript

// Alseerr - Seerr Media Search & Request for Alfred
// Unified media discovery and request management via Seerr API

// ============================================================================
// IMPORTS AND INITIALIZATION
// ============================================================================

ObjC.import("stdlib");
ObjC.import("Foundation");

const app = Application.currentApplication();
app.includeStandardAdditions = true;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Read environment variable with optional default value.
 * In JXA, $.getenv() throws an error if the variable doesn't exist.
 * @param {string} name - Environment variable name
 * @param {string} [defaultValue] - Default if not set
 * @returns {string}
 */
function getEnv(name, defaultValue) {
	try {
		const value = $.getenv(name);
		if (value === undefined || value === null || value === "") {
			return defaultValue !== undefined ? defaultValue : "";
		}
		return value.trim();
	} catch {
		return defaultValue !== undefined ? defaultValue : "";
	}
}

/**
 * Parse and validate timeout value.
 * @param {string} value - String value to parse
 * @param {number} [defaultMs=5000] - Default timeout in milliseconds
 * @param {number} [maxMs=30000] - Maximum allowed timeout
 * @returns {number} Validated timeout in milliseconds
 */
function parseTimeout(value, defaultMs = 5000, maxMs = 30000) {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed <= 0) {
		return defaultMs;
	}
	return Math.min(parsed, maxMs);
}

const CONFIG = {
	seerrUrl: getEnv("seerr_url"),
	apiKey: getEnv("seerr_api_key"),
	timeoutMs: parseTimeout(getEnv("timeout_ms", "5000")),
};

// ============================================================================
// MEDIA STATUS CONSTANTS
// ============================================================================

const MEDIA_STATUS = {
	1: { label: "Unknown", icon: "❓" },
	2: { label: "Pending", icon: "⏳" },
	3: { label: "Processing", icon: "⬇️" },
	4: { label: "Partially Available", icon: "🟡" },
	5: { label: "Available", icon: "✅" },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Shell-escape a string for safe interpolation into shell commands.
 * @param {string} str - String to escape
 * @returns {string} Shell-safe escaped string
 */
function shellEscape(str) {
	return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * Truncate text to a maximum length.
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
function truncate(text, maxLength) {
	if (!text) return "";
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 1) + "…";
}

/**
 * Generate enhanced match string for Alfred filtering.
 * @param {string} str - String to create match variants for
 * @returns {string} Space-separated match terms
 */
function alfredMatcher(str) {
	if (!str) return "";
	const clean = str.replace(/[-()_.:#/\\;,[\]]/g, " ");
	const camelCaseSeparated = str.replace(/([A-Z])/g, " $1");
	return [clean, camelCaseSeparated, str].join(" ");
}

/**
 * Format year from date string (e.g., "2024-01-15" → "2024").
 * @param {string} dateStr - ISO date string
 * @returns {string} Year or empty string
 */
function extractYear(dateStr) {
	if (!dateStr) return "";
	const match = dateStr.match(/^(\d{4})/);
	return match ? match[1] : "";
}

/**
 * Get media status info from mediaInfo object.
 * @param {object} mediaInfo - Seerr mediaInfo object
 * @returns {{label: string, icon: string}} Status info
 */
function getMediaStatus(mediaInfo) {
	if (!mediaInfo || !mediaInfo.status) {
		return { label: "Not Requested", icon: "➕" };
	}
	return MEDIA_STATUS[mediaInfo.status] || { label: "Unknown", icon: "❓" };
}

// ============================================================================
// HTTP HELPERS
// ============================================================================

/**
 * Perform HTTP GET request to Seerr API.
 * @param {string} endpoint - API endpoint path (e.g., "/api/v1/search")
 * @param {object} [params] - Query parameters
 * @returns {{success: boolean, data?: object, error?: string}}
 */
function apiGet(endpoint, params) {
	const seerrUrl = CONFIG.seerrUrl.replace(/\/+$/, "");
	let url = `${seerrUrl}${endpoint}`;

	if (params) {
		const queryParts = [];
		for (const key in params) {
			if (Object.prototype.hasOwnProperty.call(params, key) && params[key] !== undefined) {
				queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
			}
		}
		if (queryParts.length > 0) {
			url += "?" + queryParts.join("&");
		}
	}

	const timeoutSecs = Math.ceil(CONFIG.timeoutMs / 1000);

	try {
		const escapedUrl = shellEscape(url);
		const curlCmd = `curl --silent --location --max-time ${timeoutSecs} -H "X-Api-Key: ${CONFIG.apiKey}" -- ${escapedUrl}`;
		const response = app.doShellScript(curlCmd);

		if (!response || response.includes("curl:") || response.includes("Could not resolve")) {
			return { success: false, error: "network" };
		}

		try {
			const data = JSON.parse(response);
			return { success: true, data: data };
		} catch {
			return { success: false, error: "parse" };
		}
	} catch (e) {
		return { success: false, error: "network" };
	}
}

/**
 * Perform HTTP POST request to Seerr API.
 * @param {string} endpoint - API endpoint path
 * @param {object} body - JSON request body
 * @returns {{success: boolean, data?: object, error?: string}}
 */
function apiPost(endpoint, body) {
	const seerrUrl = CONFIG.seerrUrl.replace(/\/+$/, "");
	const url = `${seerrUrl}${endpoint}`;
	const timeoutSecs = Math.ceil(CONFIG.timeoutMs / 1000);

	try {
		const escapedUrl = shellEscape(url);
		const escapedBody = shellEscape(JSON.stringify(body));
		const curlCmd = `curl --silent --location --max-time ${timeoutSecs} -X POST -H "X-Api-Key: ${CONFIG.apiKey}" -H "Content-Type: application/json" -d ${escapedBody} -- ${escapedUrl}`;
		const response = app.doShellScript(curlCmd);

		if (!response) {
			return { success: false, error: "empty" };
		}

		try {
			const data = JSON.parse(response);
			return { success: true, data: data };
		} catch {
			return { success: false, error: "parse" };
		}
	} catch (e) {
		return { success: false, error: "network" };
	}
}

// ============================================================================
// POSTER CACHING
// ============================================================================

let cachedWorkflowDataDir = null;
let cachedPosterDir = null;
let posterFetchesThisSearch = 0;
const MAX_POSTER_FETCHES_PER_SEARCH = 10;

/**
 * Get the workflow data directory path.
 * @returns {string} Absolute path to workflow data directory
 */
function getWorkflowDataDir() {
	if (cachedWorkflowDataDir) return cachedWorkflowDataDir;

	let dataDir;
	try {
		dataDir = $.getenv("alfred_workflow_data");
	} catch {
		const home = getEnv("HOME", "");
		if (!home) throw new Error("Cannot determine workflow data directory");
		dataDir = `${home}/Library/Application Support/Alfred/Workflow Data/ca.gvns.alseerr.alfred`;
	}

	app.doShellScript(`mkdir -p ${shellEscape(dataDir)}`);
	cachedWorkflowDataDir = dataDir;
	return dataDir;
}

/**
 * Get the poster cache directory path.
 * @returns {string} Absolute path to poster cache directory
 */
function getPosterDir() {
	if (cachedPosterDir) return cachedPosterDir;

	const version = getEnv("alfred_workflow_version", "0.0.0");
	const posterDir = `${getWorkflowDataDir()}/posters_v${version}`;
	app.doShellScript(`mkdir -p ${shellEscape(posterDir)}`);
	cachedPosterDir = posterDir;
	return posterDir;
}

/**
 * Check if a file exists using NSFileManager.
 * @param {string} path - File path to check
 * @returns {boolean}
 */
function fileExists(path) {
	return $.NSFileManager.defaultManager.fileExistsAtPath(path);
}

/**
 * Get or fetch a poster image for a TMDB media item.
 * @param {string} posterPath - TMDB poster path (e.g., "/abc123.jpg")
 * @returns {string} Path to local poster file or fallback icon
 */
function getPosterPath(posterPath) {
	if (!posterPath) return "icon.png";

	const cacheDir = getPosterDir();
	const safeFilename = posterPath.replace(/[^a-zA-Z0-9.-]/g, "_") + ".jpg";
	const localPath = `${cacheDir}/${safeFilename}`;

	// Check cache first
	if (fileExists(localPath)) return localPath;

	// Limit fetches per search for responsiveness
	if (posterFetchesThisSearch >= MAX_POSTER_FETCHES_PER_SEARCH) return "icon.png";
	posterFetchesThisSearch++;

	// Fetch from TMDB image CDN (w92 is smallest, good for Alfred icons)
	const tmdbUrl = `https://image.tmdb.org/t/p/w92${posterPath}`;
	try {
		const curlCmd = `curl --silent --location --max-time 2 --output ${shellEscape(localPath)} -- ${shellEscape(tmdbUrl)}`;
		app.doShellScript(curlCmd);

		const fileSize = app.doShellScript(`stat -f%z ${shellEscape(localPath)} 2>/dev/null || echo 0`);
		if (Number.parseInt(fileSize, 10) > 0) return localPath;

		app.doShellScript(`rm -f ${shellEscape(localPath)}`);
		return "icon.png";
	} catch {
		try { app.doShellScript(`rm -f ${shellEscape(localPath)}`); } catch { /* ignore */ }
		return "icon.png";
	}
}

// ============================================================================
// ALFRED OUTPUT HELPERS
// ============================================================================

/**
 * Create an error item for Alfred display.
 * @param {string} title - Error title
 * @param {string} subtitle - Error description
 * @param {string} [arg] - URL to open on Enter
 * @param {object} [details] - Debug context
 * @returns {object} Alfred item
 */
function errorItem(title, subtitle, arg, details) {
	const workflowVersion = getEnv("alfred_workflow_version", "unknown");

	let debugInfo = `${title}: ${subtitle}`;
	if (details && Object.keys(details).length > 0) {
		debugInfo += "\n\nDetails:";
		for (const key in details) {
			if (Object.prototype.hasOwnProperty.call(details, key)) {
				debugInfo += `\n  ${key}: ${details[key]}`;
			}
		}
	}
	debugInfo += `\n\nWorkflow: v${workflowVersion}`;

	const item = {
		title: title,
		subtitle: subtitle,
		valid: arg ? true : false,
		text: { copy: debugInfo, largetype: debugInfo },
		mods: {
			cmd: { valid: false, subtitle: "" },
			alt: { valid: false, subtitle: "" },
			ctrl: { valid: false, subtitle: "" },
			shift: { valid: false, subtitle: "" },
		},
	};
	if (arg) item.arg = arg;
	return item;
}

/**
 * Build Alfred response object with optional caching.
 * @param {object[]} items - Array of Alfred items
 * @param {number} [cacheSeconds] - Cache duration in seconds
 * @returns {object} Alfred response object
 */
function buildResponse(items, cacheSeconds) {
	const response = { items };
	if (cacheSeconds > 0) {
		response.cache = { seconds: cacheSeconds, loosereload: true };
	}
	return response;
}

/**
 * Transform a Seerr search result into an Alfred item.
 * @param {object} result - Seerr search result
 * @returns {object} Alfred item
 */
function resultToAlfredItem(result) {
	const seerrUrl = CONFIG.seerrUrl.replace(/\/+$/, "");
	const isMovie = result.mediaType === "movie";

	// Title and year
	const title = isMovie ? (result.title || result.originalTitle || "Unknown") :
		(result.name || result.originalName || "Unknown");
	const year = extractYear(isMovie ? result.releaseDate : result.firstAirDate);
	const mediaTypeLabel = isMovie ? "Movie" : "TV";

	// Status
	const status = getMediaStatus(result.mediaInfo);

	// Overview
	const overview = truncate(result.overview || "", 80);

	// Subtitle: status icon + type + year + overview
	const subtitleParts = [`${status.icon} ${mediaTypeLabel}`];
	if (year) subtitleParts.push(year);
	if (overview) subtitleParts.push(overview);
	const subtitle = subtitleParts.join(" · ");

	// Poster
	const iconPath = getPosterPath(result.posterPath);

	// TMDB ID for requesting
	const tmdbId = result.id;

	// Largetype with full overview
	const largetypeParts = [title];
	if (year) largetypeParts.push(`(${year})`);
	if (result.overview) largetypeParts.push("", result.overview);
	const largetype = largetypeParts.join("\n");

	// Seerr web URL for this item
	const seerrWebUrl = `${seerrUrl}/${isMovie ? "movie" : "tv"}/${tmdbId}`;

	// Request payload for alt action (request via API)
	const requestPayload = JSON.stringify({
		mediaType: result.mediaType,
		mediaId: tmdbId,
		mediaTitle: title,
		mediaStatus: result.mediaInfo ? result.mediaInfo.status : 0,
	});

	// Alt subtitle changes based on current status
	let altSubtitle = "⌥: Request this";
	if (result.mediaInfo && result.mediaInfo.status >= 3) {
		altSubtitle = "⌥: Already available";
	} else if (result.mediaInfo && result.mediaInfo.status === 2) {
		altSubtitle = "⌥: Already pending";
	}

	return {
		title: year ? `${title} (${year})` : title,
		subtitle: subtitle,
		arg: seerrWebUrl,
		icon: { path: iconPath },
		quicklookurl: seerrWebUrl,
		match: alfredMatcher(title),
		text: {
			copy: seerrWebUrl,
			largetype: largetype,
		},
		variables: {
			mediaType: result.mediaType,
			mediaId: String(tmdbId),
			mediaTitle: title,
			mediaStatus: String(result.mediaInfo ? result.mediaInfo.status : 0),
			seerrWebUrl: seerrWebUrl,
		},
		mods: {
			alt: {
				arg: requestPayload,
				subtitle: altSubtitle,
			},
			cmd: {
				valid: false,
				subtitle: `⌘: ${status.label}`,
			},
		},
	};
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

/**
 * Perform search and return Alfred items.
 * @param {string} query - Search query
 * @returns {object} Alfred response object
 */
function search(query) {
	// Reset poster fetch counter
	posterFetchesThisSearch = 0;

	const seerrUrl = CONFIG.seerrUrl.replace(/\/+$/, "");

	// Guard: No Seerr URL configured
	if (!seerrUrl) {
		return {
			items: [
				errorItem(
					"⚠️ Seerr URL not configured",
					"Set seerr_url in workflow settings",
					null,
					{ query: query }
				),
			],
		};
	}

	// Guard: No API key configured
	if (!CONFIG.apiKey) {
		return {
			items: [
				errorItem(
					"⚠️ Seerr API key not configured",
					"Set seerr_api_key in workflow settings",
					null,
					{ query: query }
				),
			],
		};
	}

	// Guard: Empty query
	if (!query || query.trim() === "") {
		return {
			items: [
				{
					title: "Search Seerr…",
					subtitle: "Type a movie or TV show name to search",
					valid: false,
					icon: { path: "icon.png" },
				},
			],
		};
	}

	const cleanQuery = query.trim();

	// Perform search
	const response = apiGet("/api/v1/search", {
		query: cleanQuery,
		language: "en",
	});

	// Guard: Network error
	if (!response.success) {
		return {
			items: [
				errorItem(
					"⚠️ Cannot reach Seerr",
					response.error === "parse" ? "Invalid response from Seerr" : "Check your connection",
					seerrUrl,
					{ query: cleanQuery, url: seerrUrl, error: response.error }
				),
			],
		};
	}

	// Guard: No results
	const results = response.data && response.data.results;
	if (!results || results.length === 0) {
		return buildResponse([
			{
				title: `No results for "${cleanQuery}"`,
				subtitle: "Try different keywords",
				valid: false,
				icon: { path: "icon.png" },
			},
		], 30);
	}

	// Filter to only movie and TV results (ignore person results etc.)
	const mediaResults = results.filter(
		(r) => r.mediaType === "movie" || r.mediaType === "tv"
	);

	if (mediaResults.length === 0) {
		return buildResponse([
			{
				title: `No movie or TV results for "${cleanQuery}"`,
				subtitle: "Try different keywords",
				valid: false,
				icon: { path: "icon.png" },
			},
		], 30);
	}

	// Transform to Alfred items
	const items = mediaResults.map(resultToAlfredItem);

	return buildResponse(items, 60);
}

// ============================================================================
// ALFRED ENTRY POINT
// ============================================================================

/**
 * Wrap a Script Filter handler to guarantee valid JSON output.
 * @param {function(string[]): object} handler
 * @returns {function(string[]): string}
 */
function scriptFilter(handler) {
	return function (argv) {
		try {
			const result = handler(argv);
			return JSON.stringify(result || { items: [] });
		} catch (err) {
			const message = (err && err.message) || String(err);
			const stack = (err && err.stack) || String(err);
			console.log(`Error: ${message}`);
			console.log(stack);
			const item = errorItem("Internal Error", message, null, { stack: stack });
			item.text = { copy: stack, largetype: stack };
			return JSON.stringify({ items: [item] });
		}
	};
}

// biome-ignore lint/correctness/noUnusedVariables: Alfred entry point
var run = scriptFilter((argv) => {
	const query = argv[0] || "";
	return search(query);
});
