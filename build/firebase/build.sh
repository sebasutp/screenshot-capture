#!/bin/bash

# set current working directory to directory of the shell script
cd "$(dirname "$0")"

curl https://www.gstatic.com/firebasejs/9.15.0/firebase-compat.js --output ../../vendor/firebase-compat.js