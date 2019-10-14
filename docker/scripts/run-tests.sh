#!/bin/bash

wait-for-it -t 0 localhost:8080

npm run test:e2e:ci tests/e2e -- --color
