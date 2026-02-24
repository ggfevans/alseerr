#!/bin/zsh

# goto git root
cd "$(git rev-parse --show-toplevel)" || exit 1

#───────────────────────────────────────────────────────────────────────────────

# Prompt for next version number
current_version=$(plutil -extract version xml1 -o - info.plist | sed -n 's/.*<string>\(.*\)<\/string>.*/\1/p')
echo "current version: $current_version"
echo -n "   next version: "
read -r next_version
echo "────────────────────────"

# GUARD
if [[ -z "$next_version" || "$next_version" == "$current_version" ]]; then
	print "\e[1;31mInvalid version number.\e[0m"
	exit 1
fi

#───────────────────────────────────────────────────────────────────────────────
# update version number in THE REPO's `info.plist`
plutil -replace version -string "$next_version" info.plist

# update version number in LOCAL `info.plist`
# Read WORKFLOW_UID from .env file
if [[ -f .env ]]; then
	source .env
fi
if [[ -z "$WORKFLOW_UID" ]]; then
	print "\e[1;31mError: WORKFLOW_UID not set. Copy .env.example to .env and configure it.\e[0m"
	exit 1
fi
prefs_location=$(defaults read com.runningwithcrayons.Alfred-Preferences syncfolder 2>/dev/null | sed "s|^~|$HOME|" || echo "$HOME/Library/Application Support/Alfred")
local_info_plist="$prefs_location/Alfred.alfredpreferences/workflows/$WORKFLOW_UID/info.plist"
if [[ -f "$local_info_plist" ]]; then
	plutil -replace version -string "$next_version" "$local_info_plist"
else
	print "\e[1;33mCould not increment version, local \`info.plist\` not found: '$local_info_plist'\e[0m"
	exit 1
fi

#───────────────────────────────────────────────────────────────────────────────

# copy download link for current version
repo=$(git remote --verbose | head -n1 | sed -E 's/.*github.com[:\/]([^[:space:]]*).*/\1/' | sed 's/\.git$//')
url="https://github.com/$repo/releases/download/v$next_version/ca.gvns.alseerr.alfred.alfredworkflow"
echo -n "Download: $url" | pbcopy

#───────────────────────────────────────────────────────────────────────────────

# commit and push
git add --all &&
	git commit -m "release: $next_version" &&
	git pull --no-progress &&
	git push --no-progress &&
	git tag "v$next_version" &&
	git push --no-progress origin --tags
