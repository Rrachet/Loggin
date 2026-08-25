#!/usr/bin/env bash
set -e
export DEMO_PASSWORD="${DEMO_PASSWORD:-LogginDemo123!}"
npm run seed:demo
