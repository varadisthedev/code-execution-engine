#!/bin/sh
# Compile and run C++ code
cd /code

# Compile
g++ -std=c++17 -O2 main.cpp -o program 2>&1
if [ $? -ne 0 ]; then
    exit 1
fi

# Run with input if exists
if [ -f input.txt ]; then
    ./program < input.txt
else
    ./program
fi