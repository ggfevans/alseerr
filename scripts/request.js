#!/usr/bin/env osascript -l JavaScript

// Alseerr - Request Action
// Submits a media request to Seerr when user presses Alt+Enter

ObjC.import("stdlib");

const app = Application.currentApplication();
app.includeStandardAdditions = true;

// ============================================================================
// CONFIGURATION
// ============================================================================

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

function parseTimeout(value, defaultMs = 5000, maxMs = 30000) {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed <= 0) {
		return defaultMs;
	}
	return Math.min(parsed, maxMs);
}

function shellEscape(str) {
	return "'" + str.replace(/'/g, "'\\''") + "'";
}

const CONFIG = {
	seerrUrl: getEnv("seerr_url"),
	apiKey: getEnv("seerr_api_key"),
	timeoutMs: parseTimeout(getEnv("timeout_ms", "5000")),
};

// ============================================================================
// NOTIFICATION HELPER
// ============================================================================

function notify(message, subtitle) {
	app.displayNotification(message, {
		withTitle: "Alseerr",
		subtitle: subtitle || "",
	});
}

// ============================================================================
// MAIN
// ============================================================================

// biome-ignore lint/correctness/noUnusedVariables: Alfred entry point
var run = function (argv) {
	const seerrUrl = CONFIG.seerrUrl.replace(/\/+$/, "");

	// Parse the request payload from arg (passed via alt modifier)
	let payload;
	try {
		payload = JSON.parse(argv[0]);
	} catch (e) {
		notify("Invalid request data", "Request failed");
		return "";
	}

	const mediaType = payload.mediaType;
	const mediaId = payload.mediaId;
	const mediaTitle = payload.mediaTitle || "Unknown";
	const mediaStatus = payload.mediaStatus || 0;

	// Validate required fields
	if (!mediaType || (mediaType !== "movie" && mediaType !== "tv")) {
		notify("Invalid media type", "Expected movie or tv");
		return "";
	}
	if (!mediaId) {
		notify("Missing media ID", "Cannot submit request without ID");
		return "";
	}

	const webUrl = `${seerrUrl}/${mediaType === "movie" ? "movie" : "tv"}/${mediaId}`;

	// If already available or processing, just open in Seerr
	if (mediaStatus >= 3) {
		notify(`${mediaTitle} is already ${mediaStatus === 5 ? "available" : "processing"}`, "No request needed");
		return webUrl;
	}

	// If already pending, notify
	if (mediaStatus === 2) {
		notify(`${mediaTitle} is already pending approval`, "Request already submitted");
		return webUrl;
	}

	// Submit request with HTTP status detection
	const body = JSON.stringify({
		mediaType: mediaType,
		mediaId: Number.parseInt(mediaId, 10),
	});

	const timeoutSecs = Math.ceil(CONFIG.timeoutMs / 1000);

	try {
		// Write API key to temp file for curl -K to keep it out of process listing
		// Using unique marker for HTTP status since doShellScript converts \n to \r
		const curlConfig = shellEscape(`header = "X-Api-Key: ${CONFIG.apiKey}"`);
		const curlCmd = `TMPK=$(mktemp) && echo ${curlConfig} > "$TMPK" && curl -K "$TMPK" --silent --location --max-time ${timeoutSecs} -w '__HTTPSTATUS__%{http_code}' -X POST -H "Content-Type: application/json" -d ${shellEscape(body)} -- ${shellEscape(seerrUrl + "/api/v1/request")}; S=$?; rm -f "$TMPK"; exit $S`;
		const raw = app.doShellScript(curlCmd);

		// Split response body from HTTP status marker
		// (doShellScript converts \n→\r, so we use a unique text marker instead)
		const statusIdx = raw.lastIndexOf("__HTTPSTATUS__");
		const responseBody = statusIdx > 0 ? raw.substring(0, statusIdx) : raw;
		const httpStatus = statusIdx > 0 ? Number.parseInt(raw.substring(statusIdx + 14), 10) : 0;

		// Handle specific HTTP errors
		if (httpStatus === 409) {
			notify(`${mediaTitle} was already requested`, "Duplicate request");
			return webUrl;
		}
		if (httpStatus === 401 || httpStatus === 403) {
			notify("Authentication failed", "Check your API key");
			return webUrl;
		}

		const data = JSON.parse(responseBody);

		if (data.id) {
			const typeLabel = mediaType === "movie" ? "Movie" : "TV Show (all seasons)";
			notify(`Requested: ${mediaTitle}`, `${typeLabel} request submitted`);
		} else if (data.message) {
			notify(data.message, "Request issue");
		}
	} catch (e) {
		notify(`Error: ${e.message || e}`, "Request failed");
	}

	// Return Seerr web URL to open after request
	return webUrl;
};
