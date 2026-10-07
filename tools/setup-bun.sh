#!/bin/sh
# Download a pinned standalone Bun binary without changing shell profiles or global tools.
set -eu
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version=1.4.2
case "$(uname -s)" in
  Darwin) platform=darwin ;;
  Linux) platform=linux ;;
  *) echo 'This bootstrap supports macOS and Linux.' >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) arch=aarch64 ;;
  x86_64) arch=x64 ;;
  *) echo 'Unsupported architecture.' >&2; exit 1 ;;
esac
archive="bun-$platform-$arch"
download_dir="$repo_dir/.cache/bun-download"
mkdir -p "$download_dir" "$repo_dir/.tools/bun/bin"
curl -fL "https://github.com/oven-sh/bun/releases/download/bun-v$version/$archive.zip" -o "$download_dir/bun.zip"
unzip -oq "$download_dir/bun.zip" -d "$download_dir"
cp "$download_dir/$archive/bun" "$repo_dir/.tools/bun/bin/bun"
"$repo_dir/.tools/bun/bin/bun" --version
