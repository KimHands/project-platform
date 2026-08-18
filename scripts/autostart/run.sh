#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.." || exit 1
exec npm run start -- -p 4319
