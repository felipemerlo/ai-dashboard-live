#!/bin/bash
cd "$(dirname "$0")"
nohup node index.js > bridge.log 2>&1 &
echo $! > bridge.pid

